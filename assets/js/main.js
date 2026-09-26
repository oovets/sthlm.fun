import { addPlaceMarkers, addStationLayer, createMap, HOME_VIEW, setFlatMode, setPalette, setSelectedStation, setStreetLabels, setTargetRings } from './map.js';
import { findPlace, normalize, PLACES, TOUR_ORDER } from './places.js';
import { startClock, startTelemetry } from './hud.js';
import { createTerminal } from './terminal.js';
import { createDirector } from './director.js';
import { applySkyToMap, computeSky, nightness, skyPhase, sunTimes } from './sun.js';
import { describeWeather, fetchWeather } from './weather.js';
import { fetchDepartures, findSite, loadSites, nearestSites } from './sl.js';
import { geocode, kindLabel, reverseGeocode } from './geocode.js';
import { geolocationPermission, getPosition } from './locate.js';
import { renderAddress, renderPlane, renderStations, renderSun, renderSunHours, renderTarget, renderWeather, setPanelStatus } from './panels.js';
import { createFx, effectFromWeather, PRESETS } from './fx.js';
import { createShadows } from './shadows.js';
import { createTimebar } from './timebar.js';
import { onSameDay, stockholmMinutes, stockholmParts } from './time.js';
import { createGuessr } from './guessr.js';
import { createFpv } from './fpv.js';
import { createVoice, parseUtterance } from './voice.js';
import { createPlanes } from './planes.js';
import { cameraAltitudeMeters, compass, createPoller, debounce, distanceMeters, escapeHtml, formatDistance, toDMS } from './util.js';

const T0 = performance.now();
const $ = (sel) => document.querySelector(sel);

const bootLog = $('#boot-log');
function boot(msg, state = 'ok') {
  const ms = (performance.now() - T0).toFixed(0).padStart(5, ' ');
  const line = document.createElement('div');
  line.className = `bl ${state}`;
  line.textContent = `[${ms} ms] ${msg}`;
  bootLog.append(line);
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

if (!webglAvailable() || typeof maplibregl === 'undefined') {
  boot(typeof maplibregl === 'undefined' ? 'MapLibre GL kunde inte laddas från CDN' : 'WebGL stöds inte av den här webbläsaren', 'err');
  $('#boot').classList.add('fatal');
  throw new Error('sthlm.fun: kan inte starta kartan');
}

boot(`MapLibre GL ${maplibregl.getVersion()} laddad`);
startClock($('#clocks'));

const term = createTerminal({ log: $('#term-log'), form: $('#term-form'), input: $('#term-in') });
if (matchMedia('(pointer: coarse)').matches) $('#term-in').placeholder = 'skriv help';
const map = createMap('map');
const telemetry = startTelemetry(map, $('#p-telemetry'));
boot(`GPU: ${telemetry.gpu.renderer}`);

const panels = {
  target: $('#p-target'),
  weather: $('#p-weather'),
  sun: $('#p-sun'),
  sl: $('#p-sl'),
};
const body = (panel) => panel.querySelector('.panel-body');

const state = {
  target: null,
  simDate: null,
  sites: null,
  station: null,
  nearby: [],
  pinned: false,
  weather: null,
  weatherAt: null,
  fxOverride: null,
  selectedPlane: null,
};

// ---------- theme ----------

const THEME_KEY = 'sthlm.fun:theme';
const THEME_MODES = ['auto', 'ljus', 'mörk'];
// Auto switches to dark where the night windows switch on (civil twilight, sun 3° below the horizon).
const AUTO_LIGHT_MIN_ALT = -3;
state.themeMode = THEME_MODES.includes(readPref(THEME_KEY)) ? readPref(THEME_KEY) : 'auto';
state.paletteTheme = 'dark';
state.paletteNight = false;

function effectiveTheme(sunAltitude) {
  if (state.themeMode === 'ljus') return 'light';
  if (state.themeMode === 'mörk') return 'dark';
  return sunAltitude >= AUTO_LIGHT_MIN_ALT ? 'light' : 'dark';
}

function setBodyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  document.querySelector('meta[name="theme-color"]').content = theme === 'light' ? '#e9eef2' : '#05080d';
}

setBodyTheme(effectiveTheme(computeSky(new Date(), 59.3293, 18.0686).sunAltitude));

const centerLngLat = () => {
  const c = map.getCenter();
  return [c.lng, c.lat];
};

// ---------- targets ----------

const markers = addPlaceMarkers(map, PLACES, (place) => director.goto(place));

let addressPin = null;

function selectTarget(place) {
  if (place) planes.stopFollow();
  addressPin?.remove();
  addressPin = null;
  state.target = place;
  markers.setActive(place?.id ?? null);
  setTargetRings(map, place?.lngLat ?? null);
  for (const li of document.querySelectorAll('#target-list button')) li.classList.toggle('is-on', li.dataset.id === place?.id);
  if (!place) {
    panels.target.hidden = true;
    return;
  }
  renderTarget(body(panels.target), place, PLACES.indexOf(place), PLACES.length);
  panels.target.hidden = false;
}

$('#target-list').innerHTML = PLACES.map(
  (p, i) =>
    `<li><button type="button" data-id="${p.id}"><b>T${String(i + 1).padStart(2, '0')}</b> ${escapeHtml(p.name)}<span class="dim">${escapeHtml(p.district)}</span></button></li>`,
).join('');
$('#target-count').textContent = PLACES.length;
$('#target-list').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-id]');
  if (btn) director.goto(findPlace(btn.dataset.id));
});
$('#target-close').addEventListener('click', () => selectTarget(null));

function showAddress(result) {
  director.stop();
  planes.stopFollow();
  selectTarget(null);
  setTargetRings(map, result.lngLat);
  const el = document.createElement('div');
  el.className = 'addr-pin';
  addressPin = new maplibregl.Marker({ element: el }).setLngLat(result.lngLat).addTo(map);
  renderAddress(body(panels.target), { ...result, kind: kindLabel(result.kind) });
  panels.target.hidden = false;
  if (result.extentMeters > 250) {
    const cam = map.cameraForBounds(result.bounds, { padding: 80 });
    map.flyTo({ center: cam.center, zoom: Math.min(cam.zoom, 16.3), pitch: 55, speed: 0.9, essential: true });
  } else {
    map.flyTo({ center: result.lngLat, zoom: 17.2, pitch: 62, speed: 0.9, curve: 1.5, essential: true });
  }
}

async function searchAddress(query) {
  term.print(`Söker "${escapeHtml(query)}" i Stockholms län…`, 'dim');
  const results = await geocode(query);
  if (!results.length) throw new Error(`hittar inget som matchar "${query}" i Stockholms län`);
  const [first, ...rest] = results;
  const others = rest.filter((r) => distanceMeters(r.lngLat, first.lngLat) > 300);
  term.print(`${kindLabel(first.kind)}: ${escapeHtml(first.label)} · ${formatDistance(distanceMeters(centerLngLat(), first.lngLat))}`, 'ok');
  if (others.length) {
    term.print(`Andra träffar: ${others.slice(0, 3).map((r) => escapeHtml(r.label.split(', ').slice(0, 2).join(', '))).join(' · ')}`, 'dim');
  }
  showAddress(first);
}

const caption = $('#caption');
const director = createDirector(map, {
  onTarget: selectTarget,
  onCaption(info) {
    if (!info) {
      caption.hidden = true;
      return;
    }
    const { place, index, total } = info;
    caption.innerHTML = `<div class="cap-meta">DRÖNARTUR · WAYPOINT ${String(index + 1).padStart(2, '0')}/${total} · ${toDMS(place.lngLat[1], 'N', 'S')} ${toDMS(place.lngLat[0], 'O', 'V')}</div>
      <div class="cap-title">${escapeHtml(place.name)}</div><div class="cap-text">${escapeHtml(place.text)}</div>`;
    caption.hidden = false;
    caption.classList.remove('in');
    void caption.offsetWidth;
    caption.classList.add('in');
  },
  onStop(kind, reason) {
    const names = { tour: 'Drönartur', orbit: 'Orbit', goto: 'Flygning' };
    term.print(`${names[kind] ?? kind} avbruten${reason ? ` (${reason})` : ''}`, 'dim');
  },
});

// ---------- sun, time, weather effects, shadows ----------

const fx = createFx(map, $('#fx-canvas'), $('#fx-haze'));
const simNow = () => state.simDate ?? new Date();

const solPanel = $('#p-solkoll');
let sunQuery = null;
let sunResult = null;
let sunPin = null;
let shadowStats = { buildings: 0 };

const shadows = createShadows(map, {
  onStats(stats) {
    shadowStats = stats;
    const el = $('#tb-stats');
    if (stats.tooFar) el.textContent = 'zooma in (zoom 14+) för skuggor';
    else if (stats.alt <= 0) el.textContent = 'solen är under horisonten';
    else el.textContent = `${stats.buildings.toLocaleString('sv-SE')} byggnader · ${stats.poisInSun}/${stats.pois} caféer, barer och restauranger i sol`;
  },
  onPoiClick: (name, lngLat) => querySunHours([lngLat.lng, lngLat.lat], name),
});

const timebar = createTimebar($('#timebar'), {
  onChange: (date) => setSimDate(date),
  getTimes: (date) => {
    const [lon, lat] = centerLngLat();
    return sunTimes(date, lat, lon);
  },
});

function updateSky() {
  const [lon, lat] = centerLngLat();
  const date = simNow();
  const sky = computeSky(date, lat, lon);
  const theme = effectiveTheme(sky.sunAltitude);
  const night = theme === 'dark' && nightness(sky.sunAltitude) > 0.5;
  setBodyTheme(theme);
  fx.setTheme(theme);
  $('#tb-theme').textContent = state.themeMode.toUpperCase();
  if (map.getLayer('night-glow')) {
    if (theme !== state.paletteTheme || night !== state.paletteNight) {
      setPalette(map, { theme, night });
      state.paletteTheme = theme;
      state.paletteNight = night;
    }
    applySkyToMap(map, sky, fx.effect.fog, theme);
    fx.setNight(theme === 'dark' ? nightness(sky.sunAltitude) : 0, stockholmParts(date).hour);
  }
  shadows.setSun(date);
  timebar.sync(date, !!state.simDate);
  renderSun(body(panels.sun), sky, !!state.simDate);
  setPanelStatus(panels.sun, state.simDate ? 'wait' : 'ok', state.simDate ? 'SIM' : 'BERÄKNAD');
  if (sunResult) renderSunResult();
  return sky;
}

function setSimDate(date) {
  state.simDate = date;
  updateSky();
}

function applyWeatherFx() {
  const w = state.weather;
  const none = { kind: null, intensity: 0, fog: 0, thunder: false };
  const effect = state.fxOverride === 'av' ? none : state.fxOverride ? PRESETS[state.fxOverride] : w ? effectFromWeather(w) : none;
  fx.setWeather(effect, w ? { dir: w.wind_direction_10m, speed: w.wind_speed_10m } : undefined);
  if (state.fxOverride && state.fxOverride !== 'av') setPanelStatus(panels.weather, 'wait', `SIM: ${state.fxOverride.toUpperCase()}`);
  else if (w) setPanelStatus(panels.weather, 'ok', 'LIVE');
  updateSky();
}

function renderSunResult() {
  renderSunHours(body(solPanel), {
    ...sunResult,
    label: sunQuery.label,
    lngLat: sunQuery.lngLat,
    step: shadows.SAMPLE_MIN,
    nowMinutes: stockholmMinutes(simNow()),
    buildings: shadowStats.buildings ?? 0,
  });
}

async function querySunHours(lngLat, label) {
  const query = { lngLat, label };
  sunQuery = query;
  solPanel.hidden = false;
  body(solPanel).innerHTML = '<p class="dim">Räknar solbanor mot omgivande byggnader…</p>';
  sunPin?.remove();
  const el = document.createElement('div');
  el.className = 'sun-pin';
  sunPin = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
  try {
    const res = await shadows.sunHours(lngLat, simNow());
    if (sunQuery !== query) return;
    sunResult = res;
    renderSunResult();
  } catch (err) {
    body(solPanel).innerHTML = `<p class="dim">${escapeHtml(err.message)}</p>`;
  }
}

function closeSunHours() {
  solPanel.hidden = true;
  sunPin?.remove();
  sunPin = null;
  sunQuery = null;
  sunResult = null;
}
$('#sol-close').addEventListener('click', closeSunHours);

function setShadowMode(on) {
  if (on === shadows.enabled) return;
  shadows.setEnabled(on);
  setPalette(map, { sun: on });
  document.body.classList.toggle('solkoll', on);
  $('#tb-shadows').setAttribute('aria-pressed', String(on));
  if (on) {
    shadows.setSun(simNow());
    term.print('Solkollen aktiv: dra i tidsreglaget, klicka på kartan för soltimmar, gula prickar = ställen i sol just nu', 'ok');
  } else {
    closeSunHours();
    $('#tb-stats').textContent = '';
  }
}
$('#tb-shadows').addEventListener('click', () => setShadowMode(!shadows.enabled));

function readPref(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage disabled: the choice just isn't remembered.
  }
}

const STREETS_KEY = 'sthlm.fun:streetnames';
state.streetNames = readPref(STREETS_KEY) === '1';

function setStreetNames(on) {
  state.streetNames = on;
  setStreetLabels(map, on);
  $('#tb-streets').setAttribute('aria-pressed', String(on));
  writePref(STREETS_KEY, on ? '1' : '0');
}
$('#tb-streets').addEventListener('click', () => setStreetNames(!state.streetNames));

const VIEW2D_KEY = 'sthlm.fun:view2d';
state.view2d = readPref(VIEW2D_KEY) === '1';

function set2D(on, { animate = true } = {}) {
  state.view2d = on;
  document.body.classList.toggle('view2d', on);
  $('#tb-2d').setAttribute('aria-pressed', String(on));
  setFlatMode(map, on);
  if (on) {
    map.touchPitch.disable();
    const lockPitch = () => state.view2d && map.setMaxPitch(0);
    if (animate && map.getPitch() > 0 && !map.isMoving()) {
      map.easeTo({ pitch: 0, duration: 800 });
      map.once('moveend', lockPitch);
    } else {
      lockPitch();
    }
  } else {
    map.setMaxPitch(85);
    map.touchPitch.enable();
    if (animate) map.easeTo({ pitch: 60, duration: 800 });
  }
  writePref(VIEW2D_KEY, on ? '1' : '0');
}
$('#tb-2d').addEventListener('click', () => set2D(!state.view2d));

function setThemeMode(mode) {
  state.themeMode = mode;
  writePref(THEME_KEY, mode);
  updateSky();
}
$('#tb-theme').addEventListener('click', () => {
  setThemeMode(THEME_MODES[(THEME_MODES.indexOf(state.themeMode) + 1) % THEME_MODES.length]);
});

map.on('click', (e) => {
  if (!shadows.enabled) return;
  const hits = map.queryRenderedFeatures(e.point, { layers: ['sun-pois', 'sl-sites-dot'].filter((id) => map.getLayer(id)) });
  if (hits.length) return;
  querySunHours([e.lngLat.lng, e.lngLat.lat], 'Vald punkt');
});

// ---------- weather ----------

const weatherPoller = createPoller(
  async () => {
    setPanelStatus(panels.weather, 'wait', 'HÄMTAR');
    const [lon, lat] = centerLngLat();
    const w = await fetchWeather(lat, lon);
    state.weather = w;
    state.weatherAt = [lon, lat];
    renderWeather(body(panels.weather), w);
    applyWeatherFx();
  },
  {
    intervalMs: 10 * 60000,
    onError(err, retryMs) {
      setPanelStatus(panels.weather, 'err', 'SIGNAL LOST');
      term.print(`Open-Meteo: ${escapeHtml(err.message)} · nytt försök om ${Math.round(retryMs / 1000)} s`, 'err');
    },
  },
);

// ---------- SL ----------

const EMPTY_STATION_TTL_MS = 5 * 60000;
const emptyStations = new Map();
const recentlyEmpty = (id) => Date.now() - (emptyStations.get(id) ?? 0) < EMPTY_STATION_TTL_MS;

const departuresPoller = createPoller(
  async () => {
    let station = state.station;
    if (!station) return;
    const pinned = state.pinned;
    setPanelStatus(panels.sl, 'wait', 'HÄMTAR');
    let res = await fetchDepartures(station.id);
    while (!pinned && !res.departures.length && state.station === station) {
      emptyStations.set(station.id, Date.now());
      const next = state.nearby.find((s) => !recentlyEmpty(s.id));
      if (!next) break;
      state.station = station = next;
      setSelectedStation(map, next.id);
      res = await fetchDepartures(next.id);
    }
    if (state.station !== station) return;
    const { departures, deviations, latencyMs } = res;
    renderStations(body(panels.sl), { station, nearby: state.nearby, departures, deviations, pinned: state.pinned });
    setPanelStatus(panels.sl, 'ok', `LIVE ${Math.round(latencyMs)} ms`);
  },
  {
    intervalMs: 30000,
    minBackoffMs: 8000,
    onError(err, retryMs) {
      setPanelStatus(panels.sl, 'err', 'SIGNAL LOST');
      if (err.status !== 429) {
        term.print(`SL: ${escapeHtml(err.message)} · nytt försök om ${Math.round(retryMs / 1000)} s`, 'err');
      }
    },
  },
);

function setStation(station, { pinned, nearby }) {
  const changed = state.station?.id !== station.id;
  state.station = station;
  state.pinned = pinned;
  state.nearby = nearby ?? nearestSites(state.sites, [station.lon, station.lat], 4);
  setSelectedStation(map, station.id);
  if (changed || pinned) departuresPoller.now();
}

function trackNearestStation() {
  if (!state.sites || state.pinned) return;
  const nearby = nearestSites(state.sites, centerLngLat(), 4);
  if (nearby.length) setStation(nearby.find((s) => !recentlyEmpty(s.id)) ?? nearby[0], { pinned: false, nearby });
}

function pinStationById(id) {
  const station = state.sites?.find((s) => s.id === id);
  if (!station) return;
  setStation(station, { pinned: true });
  term.print(`SL: låst på ${escapeHtml(station.name)} (#${station.id})`, 'ok');
}

panels.sl.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-site]');
  if (chip) pinStationById(Number(chip.dataset.site));
});

async function initSL() {
  setPanelStatus(panels.sl, 'wait', 'LADDAR REGISTER');
  const attempt = async (tries) => {
    try {
      const res = await loadSites();
      state.sites = res.sites;
      const origin =
        res.source === 'snapshot'
          ? `snapshot ${res.generatedAt.toISOString().slice(0, 16).replace('T', ' ')}Z`
          : 'direkt från SL';
      term.print(
        `SL-register laddat: ${res.sites.length.toLocaleString('sv-SE')} hållplatser (${origin}, ${Math.round(res.latencyMs)} ms)`,
        'dim',
      );
      addStationLayer(map, state.sites, pinStationById);
      trackNearestStation();
    } catch (err) {
      const wait = Math.min(60000, 5000 * 2 ** tries);
      setPanelStatus(panels.sl, 'err', 'SIGNAL LOST');
      if (err.status !== 429) {
        term.print(`SL-register: ${escapeHtml(err.message)} · nytt försök om ${wait / 1000} s`, 'err');
      }
      setTimeout(() => attempt(tries + 1), wait);
    }
  };
  await attempt(0);
}

// ---------- map lifecycle ----------

let lastMapError = 0;
map.on('error', (e) => {
  const now = Date.now();
  if (now - lastMapError < 5000) return;
  lastMapError = now;
  term.print(`KARTFEL: ${escapeHtml(e.error?.message ?? 'okänt fel')}`, 'err');
});

map.once('style.load', () => {
  boot('Kartstil laddad: OpenFreeMap dark + 3D-byggnader');
  fx.installLayers();
  shadows.installLayers();
  planes.installLayers();
  setStreetNames(state.streetNames);
  if (state.view2d) set2D(true, { animate: false });
  updateSky();
});

map.once('load', () => {
  boot('Första renderingen klar, alla system nominella');
  $('#sys-status').textContent = 'NOMINELL';
  $('#sys-status').closest('.status').dataset.state = 'ok';
  setTimeout(() => $('#boot').classList.add('done'), 600);
  weatherPoller.now();
  initSL();
  planes.start();
  offerLocate();
});

const onSettle = debounce(() => {
  trackNearestStation();
  if (state.weatherAt && distanceMeters(state.weatherAt, centerLngLat()) > 3000) weatherPoller.now();
}, 700);
map.on('moveend', onSettle);

setInterval(() => {
  if (!state.simDate) updateSky();
}, 30000);

// ---------- UI chrome ----------

for (const h of document.querySelectorAll('.panel > header')) {
  h.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    h.parentElement.classList.toggle('collapsed');
  });
}
for (const btn of document.querySelectorAll('[data-toggle]')) {
  btn.addEventListener('click', () => {
    const open = document.body.classList.toggle(`show-${btn.dataset.toggle}`);
    btn.setAttribute('aria-pressed', String(open));
  });
}

// ---------- sthlm-guessr ----------

const guessr = createGuessr({
  map,
  root: $('#guessr'),
  getSites: () => state.sites,
  onStart() {
    director.stop();
    selectTarget(null);
    setShadowMode(false);
  },
  print: (text) => term.print(escapeHtml(text), 'ok'),
});

function startGuessr() {
  if (fpv.active) fpv.stop();
  guessr.start();
  term.print('Sthlm-Guessr: 5 rundor · titta runt med mus eller fingrar, gissa sedan på minikartan', 'ok');
}
$('#btn-guessr').addEventListener('click', () => {
  try {
    startGuessr();
  } catch (err) {
    term.print(escapeHtml(err.message), 'err');
  }
});

// ---------- FPV drone ----------

const fpv = createFpv({
  map,
  root: $('#fpv'),
  onStart() {
    director.stop();
    planes.stopFollow();
    term.print('FPV-läge: WASD flyg, klicka och styr med musen, Esc avslutar', 'ok');
  },
  onEnd: () => term.print('FPV-läge avslutat', 'dim'),
});

function startFpv() {
  if (guessr.active) throw new Error('avsluta Sthlm-Guessr först');
  if (state.view2d) {
    set2D(false, { animate: false });
    term.print('FPV kräver 3D, växlar till 3D-vy', 'dim');
  }
  fpv.start();
}
$('#btn-fpv').addEventListener('click', () => {
  try {
    if (fpv.active) fpv.stop();
    else startFpv();
  } catch (err) {
    term.print(escapeHtml(err.message), 'err');
  }
});

// ---------- aircraft ----------

const planePanel = $('#p-plane');
let planesAnnounced = false;
let planesStaleWarned = false;
const planes = createPlanes(map, {
  isFlat: () => state.view2d,
  onStatus(s) {
    if (s.error) return;
    if (s.stale && !planesStaleWarned) {
      planesStaleWarned = true;
      term.print(`Flygradar: senaste data är ${s.ageS} s gammal, visar inga plan`, 'err');
    } else if (!s.stale) {
      planesStaleWarned = false;
    }
    if (!planesAnnounced && !s.stale) {
      planesAnnounced = true;
      term.print(`Flygradar: ${s.count} luftfartyg inom 110 km (ADS-B via adsb.lol) · skriv <b>planes</b>`, 'dim');
    }
  },
  onSelect(p) {
    state.selectedPlane = p?.hex ?? null;
    if (!p) {
      planePanel.hidden = true;
      return;
    }
    planePanel.hidden = false;
    renderPlane(body(planePanel), p);
  },
});
planePanel.addEventListener('click', (e) => {
  const action = e.target.closest('[data-plane-action]')?.dataset.planeAction;
  if (action === 'follow') {
    director.stop();
    planes.follow(state.selectedPlane);
  } else if (action === 'unfollow') {
    planes.stopFollow();
  }
});
$('#plane-close').addEventListener('click', () => planes.deselect());

// ---------- visitor location ----------

const LOCATE_KEY = 'sthlm.fun:locate';
const STOCKHOLM = [18.0686, 59.3293];
const FLY_RADIUS_M = 120000;
let mePin = null;

async function locateMe() {
  $('#locate-toast').hidden = true;
  term.print('Hämtar din position från webbläsaren…', 'dim');
  const { lngLat, accuracy } = await getPosition();
  writePref(LOCATE_KEY, 'yes');
  mePin?.remove();
  const el = document.createElement('div');
  el.className = 'me-pin';
  mePin = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map);

  let addr = null;
  try {
    addr = await reverseGeocode(lngLat);
  } catch (err) {
    term.print(`Adressuppslag: ${escapeHtml(err.message)}`, 'err');
  }
  const acc = `±${Math.round(accuracy)} m`;
  const where = addr ? [addr.street, addr.area, addr.city].filter(Boolean).join(', ') : `${lngLat[1].toFixed(5)}, ${lngLat[0].toFixed(5)}`;
  term.print(`Du är här: ${escapeHtml(where)} (${acc})`, 'ok');

  director.stop();
  planes.stopFollow();
  selectTarget(null);
  renderAddress(body(panels.target), {
    name: addr?.street ?? 'Din position',
    label: [addr?.area, addr?.city, `noggrannhet ${acc}`].filter(Boolean).join(' · '),
    kind: 'DU ÄR HÄR',
    lngLat,
  });
  panels.target.hidden = false;

  const dist = distanceMeters(STOCKHOLM, lngLat);
  if (dist < FLY_RADIUS_M) map.flyTo({ center: lngLat, zoom: 16.5, pitch: 60, speed: 0.9, essential: true });
  else term.print(`Du är ${formatDistance(dist)} från Stockholm, kameran stannar kvar här`, 'dim');
}

const tryLocate = () => locateMe().catch((err) => term.print(`Position: ${escapeHtml(err.message)}`, 'err'));

// Ask only via a click (the prompt needs a user gesture to be trusted); auto-run if already allowed.
async function offerLocate() {
  const permission = await geolocationPermission();
  if (permission === 'granted') {
    return locateMe().catch((err) => term.print(`Position: ${escapeHtml(err.message)} · tryck HITTA MIG för att försöka igen`, 'dim'));
  }
  if (permission !== 'prompt' || readPref(LOCATE_KEY) === 'no') return;
  setTimeout(() => {
    if (!guessr.active && !fpv.active) $('#locate-toast').hidden = false;
  }, 1500);
}

$('#tb-locate').addEventListener('click', tryLocate);
$('#locate-yes').addEventListener('click', tryLocate);
$('#locate-no').addEventListener('click', () => {
  writePref(LOCATE_KEY, 'no');
  $('#locate-toast').hidden = true;
});

// ---------- voice ----------

const voice = createVoice({ button: $('#btn-voice'), bubble: $('#voice-bubble'), handle: runVoice });

function weatherSentence() {
  const w = state.weather;
  if (!w) return 'Ingen väderdata än';
  return `${describeWeather(w.weather_code)}, ${Math.round(w.temperature_2m)} grader, vind ${Math.round(w.wind_speed_10m)} meter per sekund från ${compass(w.wind_direction_10m)}`;
}

function runVoice(alternatives) {
  let intent = null;
  for (const alt of alternatives) {
    intent = parseUtterance(alt, { sites: state.sites });
    if (intent.cmd) break;
  }
  term.print(`RÖST&gt; ${escapeHtml(alternatives[0])}`, 'dim');
  if (intent.cmd === 'zoom+' || intent.cmd === 'zoom-') {
    map.easeTo({ zoom: map.getZoom() + (intent.cmd === 'zoom+' ? 1 : -1), duration: 700 });
  } else if (intent.cmd) {
    term.exec(intent.cmd);
  }
  voice.speak(intent.speakWeather ? weatherSentence() : intent.say);
  return intent;
}

const GUESSR_BLOCKED = new Set(['goto', 'adress', 'orbit', 'tour', 'home', 'dep', 'whereami', 'share', 'zoom', 'pitch', 'bearing', 'sol', 'fpv', 'follow', 'gatunamn', '2d', '3d', 'hittamig']);
const FPV_BLOCKED = new Set(['goto', 'adress', 'orbit', 'tour', 'home', 'zoom', 'pitch', 'bearing', 'guessr', 'follow', '2d', 'hittamig']);
term.setGuard((name) => {
  if (guessr.active && GUESSR_BLOCKED.has(name)) return 'inte tillåtet under Sthlm-Guessr · skriv guessr stop för att avsluta';
  if (fpv.active && FPV_BLOCKED.has(name)) return 'inte tillåtet i FPV-läge · skriv fpv för att avsluta';
  return null;
});

// ---------- terminal commands ----------

const num = (v, name) => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} kräver ett tal`);
  return n;
};

term.register('help', {
  desc: 'visa alla kommandon',
  run() {
    const rows = [...term.commands].map(
      ([, c]) => `<span class="hl">${escapeHtml(c.usage.padEnd(22, ' '))}</span>${escapeHtml(c.desc)}`,
    );
    term.print(rows.join('\n'), 'pre');
  },
});

term.register('list', {
  desc: 'lista alla mål',
  run() {
    term.print(PLACES.map((p, i) => `T${String(i + 1).padStart(2, '0')}  ${p.id.padEnd(18, ' ')} ${escapeHtml(p.name)}`).join('\n'), 'pre');
  },
});

term.register('goto', {
  usage: 'goto <plats|adress>',
  desc: 'flyg till ett mål, en adress eller en ort i Stockholms län',
  async run(args, rest) {
    if (!rest) throw new Error('ange ett mål eller en adress, t.ex. goto Drottninggatan 53');
    const tn = rest.match(/^t?(\d{1,2})$/i);
    const place = tn ? PLACES[Number(tn[1]) - 1] : findPlace(rest);
    if (!place) return searchAddress(rest);
    term.print(`Kurs satt mot ${escapeHtml(place.name)} · ${formatDistance(distanceMeters(centerLngLat(), place.lngLat))}`, 'ok');
    await director.goto(place);
  },
});

term.register('adress', {
  usage: 'adress <sökord>',
  desc: 'sök adress, plats eller ort i Stockholms län och flyg dit',
  run(args, rest) {
    if (!rest) throw new Error('ange en adress, t.ex. adress Täby centrum');
    return searchAddress(rest);
  },
});

term.register('orbit', {
  usage: 'orbit [plats]',
  desc: 'cirkla runt ett mål eller nuvarande position',
  async run(args, rest) {
    const place = rest ? findPlace(rest) : null;
    if (rest && !place) throw new Error(`hittar inget mål som matchar "${rest}"`);
    term.print(`Orbit initierad${place ? ` runt ${escapeHtml(place.name)}` : ''} · stop avbryter`, 'ok');
    await director.orbit(place);
  },
});

term.register('tour', {
  desc: 'starta filmisk drönartur genom stan',
  async run() {
    term.print(`Drönartur startad: ${TOUR_ORDER.length} waypoints · rör kartan eller skriv stop för att avbryta`, 'ok');
    await director.tour(TOUR_ORDER.map(findPlace));
  },
});

term.register('stop', {
  desc: 'avbryt tur, orbit eller flygning',
  run() {
    const stopped = director.stop('kommando');
    if (!planes.stopFollow() && !stopped) term.print('Inget att stoppa', 'dim');
  },
});

term.register('home', {
  desc: 'återgå till startvyn över Riddarfjärden',
  run() {
    director.stop();
    planes.stopFollow();
    selectTarget(null);
    map.flyTo({ ...HOME_VIEW, speed: 1.2, essential: true });
  },
});

term.register('dep', {
  usage: 'dep <station|auto>',
  desc: 'realtidsavgångar för en SL-station',
  run(args, rest) {
    if (!state.sites) throw new Error('SL-registret är inte laddat än');
    if (!rest || rest === 'auto') {
      state.pinned = false;
      trackNearestStation();
      term.print('SL följer kamerans mittpunkt', 'ok');
      return;
    }
    const site = findSite(state.sites, rest);
    if (!site) throw new Error(`ingen SL-station matchar "${rest}"`);
    pinStationById(site.id);
    planes.stopFollow();
    map.flyTo({ center: [site.lon, site.lat], zoom: Math.max(map.getZoom(), 15.5), speed: 1.2, essential: true });
  },
});

term.register('weather', {
  desc: 'aktuellt väder vid kamerans position',
  run() {
    const w = state.weather;
    if (!w) throw new Error('ingen väderdata än');
    term.print(
      `${escapeHtml(describeWeather(w.weather_code))} · ${w.temperature_2m.toFixed(1)}°C (känns ${w.apparent_temperature.toFixed(1)}°C) · vind ${w.wind_speed_10m.toFixed(1)} m/s ${compass(w.wind_direction_10m)} · ${w.relative_humidity_2m}% RH · ${w.surface_pressure.toFixed(1)} hPa`,
    );
  },
});

term.register('sun', {
  desc: 'solens och månens position',
  run() {
    const s = updateSky();
    term.print(
      `Sol: az ${s.sunAzimuth.toFixed(2)}° el ${s.sunAltitude.toFixed(2)}° (${skyPhase(s.sunAltitude)}) · Måne: az ${s.moonAzimuth.toFixed(1)}° el ${s.moonAltitude.toFixed(1)}° · ${Math.round(s.moonFraction * 100)}% belyst`,
    );
  },
});

term.register('time', {
  usage: 'time <HH:MM|now>',
  desc: 'simulera solljus vid annan tid idag',
  run(args) {
    const v = args[0];
    if (!v || v === 'now') {
      setSimDate(null);
      term.print('Realtid återställd', 'ok');
      return;
    }
    const m = v.match(/^(\d{1,2})[:.]?(\d{2})$/);
    if (!m || +m[1] > 23 || +m[2] > 59) throw new Error('ange tid som HH:MM, t.ex. time 19:30');
    setSimDate(onSameDay(new Date(), +m[1] * 60 + +m[2]));
    const s = computeSky(simNow(), map.getCenter().lat, map.getCenter().lng);
    term.print(`Simulerad tid ${m[1].padStart(2, '0')}:${m[2]} · solhöjd ${s.sunAltitude.toFixed(1)}° · ${skyPhase(s.sunAltitude)}`, 'ok');
  },
});

term.register('planes', {
  desc: 'lista luftfartyg i realtid, närmast först',
  run() {
    const list = planes.list();
    if (!list.length) {
      term.print('Inga luftfartyg i flygradarn just nu', 'dim');
      return;
    }
    const rows = list.slice(0, 12).map((p) => {
      const id = (p.flight || p.hex.toUpperCase()).padEnd(9, ' ');
      const type = (p.t ?? '?').padEnd(5, ' ');
      const alt = (p.onGround ? 'mark' : `${Math.round(p.alt).toLocaleString('sv-SE')} m`).padStart(9, ' ');
      const spd = `${Math.round(p.speed * 3.6)} km/h`.padStart(10, ' ');
      return `${escapeHtml(id)} ${escapeHtml(type)} ${alt} ${spd}  ${formatDistance(p.distance)}`;
    });
    term.print(`ANROP     TYP        HÖJD       FART  AVSTÅND\n${rows.join('\n')}\n<span class="dim">follow &lt;anrop&gt; för att följa ett plan</span>`, 'pre');
  },
});

term.register('follow', {
  usage: 'follow <anrop|stop>',
  desc: 'följ ett flygplan med kameran',
  run(args, rest) {
    if (!rest || rest === 'stop') {
      if (!planes.stopFollow()) term.print('Följer inget plan', 'dim');
      return;
    }
    const a = planes.find(rest);
    if (!a) throw new Error(`hittar inget plan "${rest}" · skriv planes för listan`);
    director.stop();
    selectTarget(null);
    planes.follow(a.hex);
    term.print(`Följer ${escapeHtml(a.flight || a.hex)} · rör kartan för att släppa`, 'ok');
  },
});

term.register('fpv', {
  desc: 'FPV-drönare: flyg själv med tangentbord, mus eller handkontroll',
  run() {
    if (fpv.active) fpv.stop();
    else startFpv();
  },
});

term.register('guessr', {
  usage: 'guessr [stop]',
  desc: 'spela Sthlm-Guessr: gissa var i stan du är',
  run(args) {
    if (args[0] === 'stop') {
      guessr.stop();
      return;
    }
    startGuessr();
  },
});

term.register('fx', {
  usage: 'fx <auto|regn|snö|dimma|åska|av>',
  desc: 'vädereffekter: riktigt väder, simulering eller av',
  run(args) {
    const v = (args[0] ?? '').toLowerCase();
    if (!v) {
      term.print(`Vädereffekter: ${state.fxOverride ?? 'auto (följer Open-Meteo)'}`);
      return;
    }
    if (v === 'auto') state.fxOverride = null;
    else if (v === 'av' || PRESETS[v]) state.fxOverride = v;
    else throw new Error('välj auto, regn, snö, dimma, åska eller av');
    applyWeatherFx();
    term.print(v === 'auto' ? 'Vädereffekter följer riktigt väder' : v === 'av' ? 'Vädereffekter avstängda' : `Simulerat väder: ${v}`, 'ok');
  },
});

term.register('gatunamn', {
  usage: 'gatunamn [on|off]',
  desc: 'visa eller dölj gatunamn på kartan',
  run(args) {
    const v = args[0];
    setStreetNames(v === 'on' ? true : v === 'off' ? false : !state.streetNames);
    term.print(`Gatunamn ${state.streetNames ? 'visas' : 'dolda'}`, 'ok');
  },
});

term.register('tema', {
  usage: 'tema <auto|ljus|mörk>',
  desc: 'ljust eller mörkt tema, auto följer solen',
  run(args) {
    const v = (args[0] ?? '').toLowerCase().replace('mork', 'mörk');
    if (!v) {
      term.print(`Tema: ${state.themeMode} (just nu ${state.paletteTheme === 'light' ? 'ljust' : 'mörkt'})`);
      return;
    }
    if (!THEME_MODES.includes(v)) throw new Error('välj auto, ljus eller mörk');
    setThemeMode(v);
    term.print(v === 'auto' ? 'Tema följer solen: ljust på dagen, mörkt på natten' : `Tema: ${v}`, 'ok');
  },
});

term.register('2d', {
  usage: '2d [on|off]',
  desc: 'platt 2D-karta uppifrån (allt fungerar som vanligt)',
  run(args) {
    const v = args[0];
    set2D(v === 'on' ? true : v === 'off' ? false : !state.view2d);
    term.print(state.view2d ? '2D-vy aktiv' : '3D-vy aktiv', 'ok');
  },
});

term.register('3d', {
  desc: 'tillbaka till 3D-vy',
  run() {
    set2D(false);
    term.print('3D-vy aktiv', 'ok');
  },
});

term.register('hittamig', {
  desc: 'visa din egen position och adress (kräver tillåtelse)',
  run: () => locateMe(),
});

term.register('sol', {
  usage: 'sol [on|off]',
  desc: 'Solkollen: skuggor, soltimmar och ställen i sol',
  run(args) {
    const v = args[0];
    setShadowMode(v === 'on' ? true : v === 'off' ? false : !shadows.enabled);
    if (shadows.enabled && map.getZoom() < 14) map.easeTo({ zoom: 15.5, pitch: 55, duration: 1200 });
  },
});

for (const [name, desc, min, max, apply] of [
  ['zoom', 'sätt zoomnivå', 0, 22, (n) => map.easeTo({ zoom: n, duration: 800 })],
  ['pitch', 'sätt kameralutning i grader', 0, 85, (n) => map.easeTo({ pitch: n, duration: 800 })],
  ['bearing', 'sätt kompasskurs i grader', -360, 360, (n) => map.easeTo({ bearing: n, duration: 800 })],
]) {
  term.register(name, {
    usage: `${name} <n>`,
    desc,
    run(args) {
      const n = num(args[0], name);
      if (n < min || n > max) throw new Error(`${name} måste vara mellan ${min} och ${max}`);
      director.stop();
      apply(n);
    },
  });
}

term.register('whereami', {
  desc: 'var är kameran just nu',
  run() {
    const c = centerLngLat();
    const nearest = PLACES.map((p) => ({ p, d: distanceMeters(c, p.lngLat) })).sort((a, b) => a.d - b.d)[0];
    const lines = [
      `POS  ${toDMS(c[1], 'N', 'S')} ${toDMS(c[0], 'O', 'V')}  (${c[1].toFixed(6)}, ${c[0].toFixed(6)})`,
      `ALT  ${Math.round(cameraAltitudeMeters(map))} m · zoom ${map.getZoom().toFixed(2)} · pitch ${map.getPitch().toFixed(1)}° · kurs ${map.getBearing().toFixed(1)}°`,
      `MÅL  närmast: ${escapeHtml(nearest.p.name)} (${formatDistance(nearest.d)})`,
    ];
    if (state.station) lines.push(`SL   ${escapeHtml(state.station.name)} (${formatDistance(distanceMeters(c, [state.station.lon, state.station.lat]))})`);
    term.print(lines.join('\n'), 'pre');
  },
});

term.register('share', {
  desc: 'kopiera länk till exakt denna kameravy',
  async run() {
    await navigator.clipboard.writeText(location.href);
    term.print(`Kopierat: ${escapeHtml(location.href)}`, 'ok');
  },
});

term.register('sys', {
  desc: 'systeminformation och datakällor',
  run() {
    term.print(
      [
        `MOTOR    MapLibre GL ${maplibregl.getVersion()} · ${escapeHtml(telemetry.gpu.api)}`,
        `GPU      ${escapeHtml(telemetry.gpu.renderer)}`,
        `KARTA    OpenFreeMap · OpenMapTiles-schema · © OpenStreetMap-bidragsgivare`,
        `VÄDER    Open-Meteo (api.open-meteo.com)`,
        `TRAFIK   SL Transport API (transport.integration.sl.se)`,
        `SOL      SunCalc 1.9.0, beräknas lokalt i webbläsaren`,
        `SKUGGOR  byggnadshöjder ur OpenStreetMap, geometri i Web Worker`,
        `FLYG     ADS-B via adsb.lol (ODbL), uppdateras var 10:e sekund`,
      ].join('\n'),
      'pre',
    );
  },
});

term.register('clear', {
  desc: 'töm terminalen',
  run() {
    $('#term-log').replaceChildren();
  },
});

term.setCompleter((cmd, arg) => {
  if (cmd === 'goto' || cmd === 'orbit') return PLACES.map((p) => p.id).filter((id) => id.startsWith(normalize(arg)));
  if (cmd === 'dep' && state.sites) {
    const q = normalize(arg);
    return [...new Set(state.sites.filter((s) => normalize(s.name).startsWith(q)).map((s) => s.name))].slice(0, 12);
  }
  if (cmd === 'time') return ['now'].filter((v) => v.startsWith(arg));
  if (cmd === 'fx') return ['auto', 'regn', 'snö', 'dimma', 'åska', 'av'].filter((v) => v.startsWith(arg));
  if (cmd === 'tema') return THEME_MODES.filter((v) => v.startsWith(arg));
  if (cmd === 'sol' || cmd === 'gatunamn' || cmd === '2d') return ['on', 'off'].filter((v) => v.startsWith(arg));
  return [];
});

window.sthlm = Object.freeze({
  map,
  state,
  exec: term.exec,
  say: (text) => runVoice([text]),
  version: new URL(import.meta.url).searchParams.get('v'),
});
console.info('%cSTHLM.FUN MISSION CONTROL', 'color:#5ee6ff;font:600 14px monospace', '\nwindow.sthlm = { map, state, exec(cmd), say(text) }');

term.print('STHLM.FUN MISSION CONTROL · skriv <b>help</b> för kommandon, <b>goto</b> + adress eller ort för att flyga dit, <b>tour</b> för drönartur', 'ok');
