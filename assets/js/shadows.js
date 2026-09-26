import { sunPosition } from './sun.js';
import { onSameDay } from './time.js';

const POI_CLASSES = ['bar', 'beer', 'pub', 'cafe', 'restaurant', 'ice_cream', 'fast_food'];
const MARGIN_M = 700;
const MIN_ZOOM = 14;
const SAMPLE_MIN = 5;
const empty = () => ({ type: 'FeatureCollection', features: [] });

export function createShadows(map, { onStats, onPoiClick }) {
  const worker = new Worker(new URL(`./shadow-worker.js${new URL(import.meta.url).search}`, import.meta.url), { type: 'module' });
  let enabled = false;
  let sun = null;
  let frame = null;
  let pending = false;
  let queued = false;
  let reqId = 0;
  let poiList = [];
  let lastView = '';
  const waiting = new Map();

  function installLayers() {
    if (map.getSource('shadows')) return;
    map.addSource('shadows', { type: 'geojson', data: empty(), tolerance: 0.2 });
    map.addSource('sun-pois', { type: 'geojson', data: empty() });
    const before = map.getLayer('building') ? 'building' : 'buildings-3d';
    map.addLayer(
      { id: 'shadows', type: 'fill', source: 'shadows', layout: { visibility: 'none' }, paint: { 'fill-color': '#141d27', 'fill-antialias': false } },
      before,
    );
    map.addLayer({
      id: 'sun-pois-glow',
      type: 'circle',
      source: 'sun-pois',
      layout: { visibility: 'none' },
      filter: ['==', ['get', 'sun'], true],
      paint: { 'circle-radius': 14, 'circle-color': '#ffd24a', 'circle-opacity': 0.35, 'circle-blur': 1 },
    });
    map.addLayer({
      id: 'sun-pois',
      type: 'circle',
      source: 'sun-pois',
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 3, 17, 6],
        'circle-color': ['case', ['get', 'sun'], '#ffd24a', '#55626f'],
        'circle-stroke-color': ['case', ['get', 'sun'], '#fff3c4', '#2a333c'],
        'circle-stroke-width': 1,
      },
    });
    map.addLayer({
      id: 'sun-pois-label',
      type: 'symbol',
      source: 'sun-pois',
      minzoom: 16,
      layout: {
        visibility: 'none',
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-offset': [0, 1],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: {
        'text-color': ['case', ['get', 'sun'], '#ffe08a', '#8a97a3'],
        'text-halo-color': 'rgba(4,8,13,0.9)',
        'text-halo-width': 1.2,
      },
    });
    map.on('click', 'sun-pois', (e) => {
      const f = e.features?.[0];
      if (f) onPoiClick?.(f.properties.name, e.lngLat);
    });
    map.on('mouseenter', 'sun-pois', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'sun-pois', () => (map.getCanvas().style.cursor = ''));
  }

  const toLocal = ([lon, lat]) => [(lon - frame.origin[0]) * frame.kx, (lat - frame.origin[1]) * frame.ky];

  function collect() {
    if (!enabled) return;
    if (map.getZoom() < MIN_ZOOM) {
      frame = null;
      map.getSource('shadows')?.setData(empty());
      map.getSource('sun-pois')?.setData(empty());
      onStats?.({ tooFar: true });
      return;
    }
    const c = map.getCenter();
    frame = { origin: [c.lng, c.lat], kx: 111320 * Math.cos((c.lat * Math.PI) / 180), ky: 110540 };
    const bounds = map.getBounds();
    const dLon = MARGIN_M / frame.kx;
    const dLat = MARGIN_M / frame.ky;
    const w = bounds.getWest() - dLon;
    const e = bounds.getEast() + dLon;
    const s = bounds.getSouth() - dLat;
    const n = bounds.getNorth() + dLat;

    const buildings = [];
    const transfer = [];
    const seen = new Set();
    for (const f of map.querySourceFeatures('openmaptiles', { sourceLayer: 'building' })) {
      const p = f.properties;
      if (p.hide_3d) continue;
      const h = p.render_height ?? 0;
      if (h <= 0) continue;
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
      for (const poly of polys) {
        const [lon0, lat0] = poly[0][0];
        if (lon0 < w || lon0 > e || lat0 < s || lat0 > n) continue;
        const key = `${lon0.toFixed(6)},${lat0.toFixed(6)},${poly[0].length},${h}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const rings = poly.map((ring) => {
          const len = ring.length - 1;
          const arr = new Float64Array(len * 2);
          for (let i = 0; i < len; i++) {
            const [x, y] = toLocal(ring[i]);
            arr[i * 2] = x;
            arr[i * 2 + 1] = y;
          }
          transfer.push(arr.buffer);
          return arr;
        });
        buildings.push({ rings, h, minH: p.render_min_height ?? 0 });
      }
    }

    const poiSeen = new Set();
    poiList = [];
    for (const f of map.querySourceFeatures('openmaptiles', {
      sourceLayer: 'poi',
      filter: ['match', ['get', 'class'], POI_CLASSES, true, false],
    })) {
      if (f.geometry.type !== 'Point' || !f.properties.name) continue;
      const [lon, lat] = f.geometry.coordinates;
      if (!bounds.contains([lon, lat])) continue;
      const key = `${f.properties.name}|${lon.toFixed(5)}|${lat.toFixed(5)}`;
      if (poiSeen.has(key)) continue;
      poiSeen.add(key);
      poiList.push({ name: f.properties.name, cls: f.properties.class, lngLat: [lon, lat] });
      if (poiList.length >= 800) break;
    }

    worker.postMessage(
      {
        type: 'buildings',
        origin: frame.origin,
        kx: frame.kx,
        ky: frame.ky,
        buildings,
        pois: poiList.map((p) => {
          const [x, y] = toLocal(p.lngLat);
          return { x, y };
        }),
      },
      transfer,
    );
    requestShadows();
  }

  function requestShadows() {
    if (!enabled || !sun || !frame) return;
    if (pending) {
      queued = true;
      return;
    }
    pending = true;
    worker.postMessage({ type: 'shadows', id: ++reqId, az: sun.az, alt: sun.alt });
  }

  worker.onmessage = ({ data }) => {
    if (data.type === 'shadows') {
      pending = false;
      if (enabled) {
        map.getSource('shadows').setData(data.geojson);
        map.getSource('sun-pois').setData({
          type: 'FeatureCollection',
          features: poiList.map((p, i) => ({
            type: 'Feature',
            properties: { name: p.name, cls: p.cls, sun: !!data.poiSun[i] },
            geometry: { type: 'Point', coordinates: p.lngLat },
          })),
        });
        onStats?.({ buildings: data.buildingCount, pois: poiList.length, poisInSun: data.poiSun.filter(Boolean).length, alt: sun.alt });
      }
      if (queued) {
        queued = false;
        requestShadows();
      }
    } else if (data.type === 'sunhours') {
      waiting.get(data.id)?.(data);
      waiting.delete(data.id);
    }
  };

  map.on('idle', () => {
    if (!enabled) return;
    const c = map.getCenter();
    const view = `${c.lng.toFixed(5)},${c.lat.toFixed(5)},${map.getZoom().toFixed(2)},${map.getBearing().toFixed(1)}`;
    if (view === lastView) return;
    lastView = view;
    collect();
  });

  function setVisible(v) {
    for (const id of ['shadows', 'sun-pois-glow', 'sun-pois', 'sun-pois-label']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none');
    }
  }

  return {
    installLayers,
    get enabled() {
      return enabled;
    },
    setEnabled(v) {
      enabled = v;
      setVisible(v);
      lastView = '';
      if (v) collect();
    },
    setSun(date) {
      const c = map.getCenter();
      sun = sunPosition(date, c.lat, c.lng);
      requestShadows();
    },
    // Resolves per-sample shade for the local day of `date`, sampled every SAMPLE_MIN minutes.
    sunHours(lngLat, date) {
      if (!frame) return Promise.reject(new Error('zooma in närmare (zoom 14+) för att räkna soltimmar'));
      const samples = [];
      for (let m = 0; m < 1440; m += SAMPLE_MIN) {
        const t = onSameDay(date, m);
        samples.push({ m, ...sunPosition(t, lngLat[1], lngLat[0]) });
      }
      const [x, y] = toLocal(lngLat);
      const id = ++reqId;
      return new Promise((resolve) => {
        waiting.set(id, (res) =>
          resolve({ samples: samples.map((s, i) => ({ ...s, shade: res.shade[i] })), movedToFacade: res.movedToFacade, buildingHeight: res.buildingHeight }),
        );
        worker.postMessage({ type: 'sunhours', id, x, y, samples: samples.map(({ az, alt }) => ({ az, alt })) });
      });
    },
    SAMPLE_MIN,
  };
}
