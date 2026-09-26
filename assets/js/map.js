export const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const FONT = ['Noto Sans Regular'];

export const HOME_VIEW = { center: [18.0632, 59.3245], zoom: 14.6, pitch: 64, bearing: -24 };

const HEIGHT = ['coalesce', ['get', 'render_height'], 0];
const MIN_HEIGHT = ['coalesce', ['get', 'render_min_height'], 0];
// Buildings grow from flat at z13 to full height at z14.5.
const growIn = (value) => ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, value];

const BASE_COLORS = {
  'buildings-3d': {
    'fill-extrusion-color': ['interpolate', ['linear'], HEIGHT, 0, '#0e1c2b', 20, '#15304a', 45, '#1f4c70', 90, '#2f7fa8', 160, '#5ee6ff'],
  },
  'buildings-roof': {
    'fill-extrusion-color': ['interpolate', ['linear'], HEIGHT, 0, '#1a3045', 20, '#22425f', 45, '#2d6488', 90, '#3f98c4', 160, '#8af0ff'],
  },
  background: { 'background-color': '#060b12' },
  water: { 'fill-color': '#0a1d2e' },
  landuse_residential: { 'fill-color': '#08111b' },
  landcover_wood: { 'fill-color': '#0a1a17' },
  landuse_park: { 'fill-color': '#0a1a17' },
  building: { 'fill-color': '#0c1723' },
  waterway: { 'line-color': '#0a1d2e' },
  highway_path: { 'line-color': '#0f1f2e' },
  highway_minor: { 'line-color': '#11202f' },
  highway_major_casing: { 'line-color': 'rgba(94,230,255,0.12)' },
  highway_major_inner: { 'line-color': '#172b3e' },
  highway_major_subtle: { 'line-color': '#172b3e' },
  highway_motorway_casing: { 'line-color': 'rgba(94,230,255,0.18)' },
  highway_motorway_inner: { 'line-color': '#1c3650' },
  highway_motorway_subtle: { 'line-color': '#1c3650' },
  railway: { 'line-color': '#26394d' },
  railway_transit: { 'line-color': '#26394d' },
  railway_minor: { 'line-color': '#26394d' },
};

const SUN_COLORS = {
  'buildings-3d': {
    'fill-extrusion-color': ['interpolate', ['linear'], HEIGHT, 0, '#8d9aa6', 40, '#a9b5c0', 120, '#d3dce4'],
  },
  'buildings-roof': {
    'fill-extrusion-color': ['interpolate', ['linear'], HEIGHT, 0, '#b3bdc6', 40, '#c6cfd7', 120, '#e4eaef'],
  },
  background: { 'background-color': '#3e4f5f' },
  water: { 'fill-color': '#2a5f86' },
  landuse_residential: { 'fill-color': '#3e4f5f' },
  landcover_wood: { 'fill-color': '#3d6149' },
  landuse_park: { 'fill-color': '#3d6149' },
  building: { 'fill-color': '#3a4c5d' },
  waterway: { 'line-color': '#1f4b6e' },
  highway_path: { 'line-color': '#3a4f63' },
  highway_minor: { 'line-color': '#3d5266' },
  highway_major_inner: { 'line-color': '#4b6379' },
  highway_major_subtle: { 'line-color': '#4b6379' },
  highway_motorway_inner: { 'line-color': '#587189' },
  highway_motorway_subtle: { 'line-color': '#587189' },
};

const LIGHT_COLORS = {
  'buildings-3d': {
    'fill-extrusion-color': ['interpolate', ['linear'], HEIGHT, 0, '#cfd8e0', 20, '#c1ccd6', 45, '#aebdca', 90, '#8eaabe', 160, '#5b9cc0'],
  },
  'buildings-roof': {
    'fill-extrusion-color': ['interpolate', ['linear'], HEIGHT, 0, '#eef2f5', 45, '#e2e9ef', 160, '#c3dcea'],
  },
  background: { 'background-color': '#e9eef2' },
  water: { 'fill-color': '#a8cce4' },
  landuse_residential: { 'fill-color': '#e2e7ec' },
  landcover_wood: { 'fill-color': '#cfe2cf' },
  landuse_park: { 'fill-color': '#cfe2cf' },
  building: { 'fill-color': '#d6dde4' },
  waterway: { 'line-color': '#a8cce4' },
  highway_path: { 'line-color': '#cdd6de' },
  highway_minor: { 'line-color': '#ffffff' },
  highway_major_casing: { 'line-color': 'rgba(0,118,158,0.22)' },
  highway_major_inner: { 'line-color': '#ffffff' },
  highway_major_subtle: { 'line-color': '#f5f7f9' },
  highway_motorway_casing: { 'line-color': 'rgba(0,118,158,0.35)' },
  highway_motorway_inner: { 'line-color': '#fffaf0' },
  highway_motorway_subtle: { 'line-color': '#f5efe2' },
  railway: { 'line-color': '#aeb9c4' },
  railway_transit: { 'line-color': '#aeb9c4' },
  railway_minor: { 'line-color': '#aeb9c4' },
};

const NIGHT_ROOF = ['interpolate', ['linear'], HEIGHT, 0, '#0a121c', 60, '#0e1a27', 160, '#142536'];

// Our own layers: [dark, light] per paint property.
const THEMED = {
  shoreline: { 'line-color': ['rgba(94,230,255,0.32)', 'rgba(0,118,158,0.45)'] },
  'target-rings': { 'line-color': ['#5ee6ff', '#0076a0'] },
  shadows: { 'fill-color': ['#141d27', '#9eabb7'] },
  'sl-sites-label': { 'text-color': ['#ffcf66', '#8a5000'], 'text-halo-color': ['rgba(4,8,13,0.92)', 'rgba(255,255,255,0.92)'] },
  'planes-label': { 'text-color': ['#bfefff', '#0b4d6b'], 'text-halo-color': ['rgba(4,8,13,0.9)', 'rgba(255,255,255,0.92)'] },
  'planes-trail': { 'line-color': ['#5ee6ff', '#0076a0'] },
  'planes-stem': { 'fill-extrusion-color': ['#5ee6ff', '#0076a0'] },
  'sun-pois-label': {
    'text-color': [['case', ['get', 'sun'], '#ffe08a', '#8a97a3'], ['case', ['get', 'sun'], '#8a5a00', '#5d6f7e']],
    'text-halo-color': ['rgba(4,8,13,0.9)', 'rgba(255,255,255,0.92)'],
  },
};

const LABELS = {
  dark: { water: '#3b7aa3', other: '#7fa3bf', halo: 'rgba(4,8,13,0.92)' },
  light: { water: '#2f6f98', other: '#3d5568', halo: 'rgba(255,255,255,0.92)' },
};

const LAYERS_3D = ['buildings-3d', 'buildings-roof', 'planes-stem'];
const FLAT_BUILDING_2D = { dark: '#1a2e42', light: '#bfcad4', sun: '#667a8d' };

const paletteState = { theme: 'dark', sun: false, night: false, flat: false };
let baseLabelLayers = [];

function currentPalette() {
  const { theme, sun, night } = paletteState;
  const palette = { ...(theme === 'light' ? LIGHT_COLORS : BASE_COLORS) };
  // Solkollen brightens the ground so shadows read; the light theme already has a light ground.
  if (sun && theme === 'dark') Object.assign(palette, SUN_COLORS);
  if (night) palette['buildings-roof'] = { 'fill-extrusion-color': NIGHT_ROOF };
  return palette;
}

function applyPalette(map) {
  const light = paletteState.theme === 'light';
  for (const [id, paint] of Object.entries(currentPalette())) {
    if (!map.getLayer(id)) continue;
    for (const [prop, value] of Object.entries(paint)) map.setPaintProperty(id, prop, value);
  }
  for (const [id, paint] of Object.entries(THEMED)) {
    if (!map.getLayer(id)) continue;
    for (const [prop, [dark, lightValue]] of Object.entries(paint)) map.setPaintProperty(id, prop, light ? lightValue : dark);
  }
  const labels = LABELS[paletteState.theme];
  for (const { id, water } of baseLabelLayers) {
    if (!map.getLayer(id)) continue;
    map.setPaintProperty(id, 'text-color', water ? labels.water : labels.other);
    map.setPaintProperty(id, 'text-halo-color', labels.halo);
  }
  if (paletteState.flat && map.getLayer('building')) {
    const key = paletteState.sun && !light ? 'sun' : paletteState.theme;
    map.setPaintProperty('building', 'fill-color', FLAT_BUILDING_2D[key]);
  }
}

// Merges { theme, sun, night } into the palette state and repaints; call again after adding themed layers.
export function setPalette(map, changes = {}) {
  Object.assign(paletteState, changes);
  applyPalette(map);
}

// 2D: hide extrusions and give the flat footprint layer enough contrast to read from above.
export function setFlatMode(map, flat) {
  paletteState.flat = flat;
  for (const id of LAYERS_3D) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', flat ? 'none' : 'visible');
  applyPalette(map);
}

const isStreetLabel = (l) => l.type === 'symbol' && (l['source-layer'] === 'transportation_name' || l.id.startsWith('road_oneway'));

export function setStreetLabels(map, visible) {
  for (const layer of map.getStyle().layers.filter(isStreetLabel)) {
    map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none');
  }
}

export function createMap(container) {
  const map = new maplibregl.Map({
    container,
    style: STYLE_URL,
    ...HOME_VIEW,
    maxPitch: 85,
    hash: 'cam',
    attributionControl: { compact: true },
    canvasContextAttributes: { antialias: true },
  });
  map.once('style.load', () => restyle(map));
  return map;
}

function restyle(map) {
  const styleLayers = map.getStyle().layers;
  const firstSymbol = styleLayers.find((l) => l.type === 'symbol')?.id;
  const lastRoadIdx = styleLayers.findLastIndex((l) => l.type === 'line' && l['source-layer'] === 'transportation');
  const aboveRoads = styleLayers[lastRoadIdx + 1]?.id;
  baseLabelLayers = styleLayers
    .filter((l) => l.type === 'symbol' && l.layout?.['text-field'])
    .map((l) => ({ id: l.id, water: l['source-layer'] === 'water_name' }));

  map.addLayer(
    {
      id: 'shoreline',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: {
        'line-color': 'rgba(94,230,255,0.32)',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.4, 16, 1.4],
        'line-blur': 0.6,
      },
    },
    firstSymbol,
  );

  map.addLayer(
    {
      id: 'buildings-3d',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 13,
      filter: ['!=', ['get', 'hide_3d'], true],
      paint: {
        'fill-extrusion-color': BASE_COLORS['buildings-3d']['fill-extrusion-color'],
        'fill-extrusion-height': growIn(HEIGHT),
        'fill-extrusion-base': MIN_HEIGHT,
        'fill-extrusion-opacity': 1,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    aboveRoads,
  );

  // A thin cap slightly above each roof: gives roofs their own tone and a cornice edge,
  // and hides the night window pattern that fill-extrusion-pattern also paints on roofs.
  map.addLayer(
    {
      id: 'buildings-roof',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 13,
      filter: ['all', ['!=', ['get', 'hide_3d'], true], ['>', HEIGHT, 0]],
      paint: {
        'fill-extrusion-color': BASE_COLORS['buildings-roof']['fill-extrusion-color'],
        'fill-extrusion-height': growIn(['+', HEIGHT, 0.5]),
        'fill-extrusion-base': growIn(['max', ['-', HEIGHT, 0.7], MIN_HEIGHT]),
        'fill-extrusion-opacity': 1,
        'fill-extrusion-vertical-gradient': false,
      },
    },
    aboveRoads,
  );

  map.addSource('target-rings', { type: 'geojson', data: emptyFC() });
  map.addLayer({
    id: 'target-rings',
    type: 'line',
    source: 'target-rings',
    paint: {
      'line-color': '#5ee6ff',
      'line-width': 1.2,
      'line-opacity': 0.75,
      'line-dasharray': [2, 3],
    },
  });

  applyPalette(map);
}

const emptyFC = () => ({ type: 'FeatureCollection', features: [] });

function circlePolygon([lon, lat], radiusM, steps = 96) {
  const coords = [];
  const dLat = radiusM / 111320;
  const dLon = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: 'Feature', properties: { r: radiusM }, geometry: { type: 'LineString', coordinates: coords } };
}

export function setTargetRings(map, lngLat) {
  const src = map.getSource('target-rings');
  if (!src) return;
  src.setData(
    lngLat
      ? { type: 'FeatureCollection', features: [100, 250, 500].map((r) => circlePolygon(lngLat, r)) }
      : emptyFC(),
  );
}

export function addStationLayer(map, sites, onSelect) {
  map.addSource('sl-sites', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: sites.map((s) => ({
        type: 'Feature',
        properties: { id: s.id, name: s.name },
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      })),
    },
  });
  map.addLayer({
    id: 'sl-sites-dot',
    type: 'circle',
    source: 'sl-sites',
    minzoom: 12,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 1.5, 16, 4, 18, 6],
      'circle-color': '#ffb000',
      'circle-opacity': 0.85,
      'circle-stroke-color': 'rgba(255,176,0,0.25)',
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 16, 5],
      'circle-pitch-alignment': 'map',
    },
  });
  map.addLayer({
    id: 'sl-sites-selected',
    type: 'circle',
    source: 'sl-sites',
    filter: ['==', ['get', 'id'], -1],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 6, 16, 12],
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': '#ffb000',
      'circle-stroke-width': 2,
      'circle-pitch-alignment': 'map',
    },
  });
  map.addLayer({
    id: 'sl-sites-label',
    type: 'symbol',
    source: 'sl-sites',
    minzoom: 15.5,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': FONT,
      'text-size': 11,
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
      'text-optional': true,
    },
    paint: { 'text-color': '#ffcf66', 'text-halo-color': 'rgba(4,8,13,0.92)', 'text-halo-width': 1.2 },
  });

  applyPalette(map);

  map.on('click', 'sl-sites-dot', (e) => {
    const f = e.features?.[0];
    if (f) onSelect(f.properties.id);
  });
  map.on('mouseenter', 'sl-sites-dot', () => (map.getCanvas().style.cursor = 'pointer'));
  map.on('mouseleave', 'sl-sites-dot', () => (map.getCanvas().style.cursor = ''));
}

export function setSelectedStation(map, id) {
  if (map.getLayer('sl-sites-selected')) map.setFilter('sl-sites-selected', ['==', ['get', 'id'], id ?? -1]);
}

export function addPlaceMarkers(map, places, onSelect) {
  const markers = new Map();
  places.forEach((place, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'target-marker';
    el.setAttribute('aria-label', `Flyg till ${place.name}`);
    el.innerHTML = `<span class="tm-box"></span><span class="tm-label"><b>T${String(i + 1).padStart(2, '0')}</b> ${place.name}</span>`;
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      onSelect(place);
    });
    new maplibregl.Marker({ element: el, anchor: 'center', pitchAlignment: 'viewport' })
      .setLngLat(place.lngLat)
      .addTo(map);
    markers.set(place.id, el);
  });
  return {
    setActive(id) {
      for (const [pid, el] of markers) el.classList.toggle('is-active', pid === id);
    },
  };
}
