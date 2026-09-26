import { cameraFromPose, createPoller, distanceMeters } from './util.js';

const FEED_URL = '/data/planes.json';
const POLL_MS = 10000;
const STALE_S = 120;
const MAX_EXTRAPOLATE_S = 30;
const SCALE = 3;
const FT = 0.3048;
const KT = 0.514444;
const RAD = Math.PI / 180;
const TRAIL_POINTS = 30;
const CITY = [18.0686, 59.3293];
// Top-down airliner outline in metres (x right, y forward), roughly a 40 m narrow-body.
const SHAPE = [
  [0, 20], [1.8, 17], [1.8, 3], [18, -3], [18, -6], [1.8, -3], [1.8, -14], [6.5, -18], [6.5, -20], [0, -19],
  [-6.5, -20], [-6.5, -18], [-1.8, -14], [-1.8, -3], [-18, -6], [-18, -3], [-1.8, 3], [-1.8, 17],
];
const empty = () => ({ type: 'FeatureCollection', features: [] });

export function altitudeMeters(a) {
  if (a.alt_baro === 'ground') return 0;
  const ft = typeof a.alt_geom === 'number' ? a.alt_geom : a.alt_baro;
  return typeof ft === 'number' ? Math.max(0, ft * FT) : 0;
}

function altitudeColor(alt, selected) {
  if (selected) return '#ffb000';
  if (alt < 5) return '#7d8a96';
  if (alt < 1500) return '#ffcf66';
  if (alt < 6000) return '#5ee6ff';
  return '#dff6ff';
}

function offset([lng, lat], headingDeg, meters) {
  const h = headingDeg * RAD;
  return [lng + (Math.sin(h) * meters) / (111320 * Math.cos(lat * RAD)), lat + (Math.cos(h) * meters) / 110540];
}

function outline([lng, lat], headingDeg, scale) {
  const h = headingDeg * RAD;
  const kx = 111320 * Math.cos(lat * RAD);
  const ring = SHAPE.map(([x, y]) => {
    const e = (x * Math.cos(h) + y * Math.sin(h)) * scale;
    const n = (-x * Math.sin(h) + y * Math.cos(h)) * scale;
    return [lng + e / kx, lat + n / 110540];
  });
  ring.push(ring[0]);
  return [ring];
}

function square([lng, lat], half) {
  const dx = half / (111320 * Math.cos(lat * RAD));
  const dy = half / 110540;
  return [[[lng - dx, lat - dy], [lng + dx, lat - dy], [lng + dx, lat + dy], [lng - dx, lat + dy], [lng - dx, lat - dy]]];
}

export function createPlanes(map, { onStatus, onSelect, isFlat }) {
  let feed = null;
  let ageAtFetch = 0;
  let fetchedAt = 0;
  let selected = null;
  let following = null;
  let raf = 0;
  let lastDraw = 0;
  let lastSelectPush = 0;
  const trails = new Map();

  function installLayers() {
    if (map.getSource('planes')) return;
    for (const id of ['planes', 'planes-stem', 'planes-trail', 'planes-label']) map.addSource(id, { type: 'geojson', data: empty() });
    map.addLayer({
      id: 'planes-trail',
      type: 'line',
      source: 'planes-trail',
      paint: { 'line-color': '#5ee6ff', 'line-width': 1.2, 'line-opacity': 0.45, 'line-dasharray': [1, 2] },
    });
    map.addLayer({
      id: 'planes-stem',
      type: 'fill-extrusion',
      source: 'planes-stem',
      paint: { 'fill-extrusion-color': '#5ee6ff', 'fill-extrusion-height': ['get', 'top'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.25 },
    });
    map.addLayer({
      id: 'planes-3d',
      type: 'fill-extrusion',
      source: 'planes',
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-base': ['get', 'base'],
        'fill-extrusion-height': ['get', 'top'],
        'fill-extrusion-opacity': 0.95,
      },
    });
    map.addLayer({
      id: 'planes-label',
      type: 'symbol',
      source: 'planes-label',
      minzoom: 8,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 10.5,
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
        'text-allow-overlap': false,
      },
      paint: { 'text-color': '#bfefff', 'text-halo-color': 'rgba(4,8,13,0.9)', 'text-halo-width': 1.2 },
    });
    const pick = (e) => {
      const hex = e.features?.[0]?.properties?.hex;
      if (hex) select(hex);
    };
    map.on('click', 'planes-3d', pick);
    map.on('click', 'planes-label', pick);
    for (const id of ['planes-3d', 'planes-label']) {
      map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''));
    }
    const container = map.getCanvasContainer();
    for (const ev of ['pointerdown', 'wheel', 'touchstart']) container.addEventListener(ev, () => stopFollow(), { passive: true });
  }

  const ageNow = () => ageAtFetch + (performance.now() - fetchedAt) / 1000;

  function pose(a) {
    const age = Math.min(MAX_EXTRAPOLATE_S, Math.max(0, ageNow() + (a.seen_pos ?? 0)));
    const alt0 = altitudeMeters(a);
    const onGround = alt0 === 0;
    const speed = (a.gs ?? 0) * KT;
    const heading = a.track ?? 0;
    const [lng, lat] = offset([a.lon, a.lat], heading, speed * age);
    const vs = ((typeof a.geom_rate === 'number' ? a.geom_rate : a.baro_rate) ?? 0) * FT / 60;
    return { lng, lat, alt: onGround ? 0 : Math.max(0, alt0 + vs * age), heading, speed, vs, onGround };
  }

  function draw() {
    if (!feed || !map.getSource('planes')) return;
    const planes = [];
    const stems = [];
    const labels = [];
    for (const a of feed.aircraft) {
      const p = pose(a);
      const isSel = a.hex === selected;
      const pos = [p.lng, p.lat];
      const thickness = 4 * SCALE;
      planes.push({
        type: 'Feature',
        properties: { hex: a.hex, base: p.alt, top: p.alt + thickness, color: altitudeColor(p.alt, isSel) },
        geometry: { type: 'Polygon', coordinates: outline(pos, p.heading, SCALE) },
      });
      if (p.alt > 30) stems.push({ type: 'Feature', properties: { top: p.alt }, geometry: { type: 'Polygon', coordinates: square(pos, 1.5 * SCALE) } });
      labels.push({
        type: 'Feature',
        properties: { hex: a.hex, label: `${a.flight || a.hex.toUpperCase()}\n${p.onGround ? 'MARK' : `${Math.round(p.alt).toLocaleString('sv-SE')} m`}` },
        geometry: { type: 'Point', coordinates: pos },
      });
    }
    map.getSource('planes').setData({ type: 'FeatureCollection', features: planes });
    map.getSource('planes-stem').setData({ type: 'FeatureCollection', features: stems });
    map.getSource('planes-label').setData({ type: 'FeatureCollection', features: labels });
  }

  function drawTrails() {
    map.getSource('planes-trail')?.setData({
      type: 'FeatureCollection',
      features: [...trails.values()].filter((t) => t.length > 1).map((coords) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } })),
    });
  }

  function followCamera() {
    const a = feed?.aircraft.find((x) => x.hex === following);
    if (!a) return stopFollow();
    const p = pose(a);
    if (isFlat?.()) {
      map.jumpTo({ center: [p.lng, p.lat], bearing: p.heading, zoom: 13 });
      return;
    }
    const back = 1200 + p.alt * 0.15;
    const up = 300 + p.alt * 0.05;
    const [lng, lat] = offset([p.lng, p.lat], p.heading, -back);
    map.jumpTo(cameraFromPose(map, { lng, lat, alt: p.alt + up, heading: p.heading, look: Math.atan2(up, back) / RAD }));
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (!feed) return;
    if (following) {
      followCamera();
      draw();
    } else if (t - lastDraw > 80) {
      lastDraw = t;
      draw();
    }
    if (selected && t - lastSelectPush > 500) {
      lastSelectPush = t;
      const a = feed.aircraft.find((x) => x.hex === selected);
      onSelect?.(a ? info(a) : null);
    }
  }

  function info(a) {
    const p = pose(a);
    return { ...a, ...p, distance: distanceMeters(CITY, [p.lng, p.lat]), following: following === a.hex };
  }

  const poller = createPoller(
    async () => {
      const res = await fetch(FEED_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const serverNow = Date.parse(res.headers.get('Date') ?? '') / 1000 || Date.now() / 1000;
      const stale = serverNow - data.generatedAt > STALE_S;
      fetchedAt = performance.now();
      ageAtFetch = Math.max(0, serverNow - data.now);
      feed = stale ? { ...data, aircraft: [] } : data;
      for (const a of feed.aircraft) {
        const trail = trails.get(a.hex) ?? [];
        const last = trail[trail.length - 1];
        if (!last || last[0] !== a.lon || last[1] !== a.lat) trail.push([a.lon, a.lat]);
        if (trail.length > TRAIL_POINTS) trail.shift();
        trails.set(a.hex, trail);
      }
      const live = new Set(feed.aircraft.map((a) => a.hex));
      for (const hex of trails.keys()) if (!live.has(hex)) trails.delete(hex);
      drawTrails();
      onStatus?.({ count: feed.aircraft.length, stale, ageS: Math.round(serverNow - data.generatedAt) });
    },
    { intervalMs: POLL_MS, onError: (err) => onStatus?.({ error: err.message }) },
  );

  function select(hex) {
    selected = hex;
    lastSelectPush = 0;
    const a = feed?.aircraft.find((x) => x.hex === hex);
    onSelect?.(a ? info(a) : null);
  }

  function follow(hex) {
    following = hex;
    select(hex);
  }

  function stopFollow() {
    if (!following) return false;
    following = null;
    return true;
  }

  return {
    installLayers,
    start() {
      poller.now();
      raf ||= requestAnimationFrame(frame);
    },
    list() {
      return (feed?.aircraft ?? []).map(info).sort((a, b) => a.distance - b.distance);
    },
    find(query) {
      const q = query.toLowerCase().replace(/\s+/g, '');
      return feed?.aircraft.find((a) => a.hex === q || (a.flight ?? '').toLowerCase() === q || (a.r ?? '').toLowerCase().replace('-', '') === q.replace('-', ''));
    },
    select,
    follow,
    stopFollow,
    deselect() {
      selected = null;
      following = null;
      onSelect?.(null);
    },
  };
}
