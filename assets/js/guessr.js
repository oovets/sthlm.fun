import { STYLE_URL } from './map.js';
import { PLACES } from './places.js';
import { distanceMeters, escapeHtml, formatDistance } from './util.js';

const ROUNDS = 5;
const MAX_POINTS = 5000;
const SCORE_SCALE_M = 700;
const INNER_CITY = { w: 17.99, s: 59.3, e: 18.13, n: 59.355 };
const STORAGE_KEY = 'sthlm.fun:guessr:v1';
const HIDDEN_LAYERS = ['sl-sites-dot', 'sl-sites-selected', 'target-rings', 'sun-pois', 'sun-pois-glow'];
const RANKS = [
  [22000, 'Taxichaufför'],
  [15000, 'Stockholmare'],
  [8000, 'Inflyttad'],
  [0, 'Turist'],
];

const score = (d) => Math.round(MAX_POINTS * Math.exp(-d / SCORE_SCALE_M));

function loadBoard() {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveBoard(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Private mode or storage disabled: the leaderboard just isn't persisted.
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createGuessr({ map, root, getSites, onStart, onEnd, print }) {
  const $ = (sel) => root.querySelector(sel);
  let minimap = null;
  let game = null;
  let saved = null;
  let guessMarker = null;
  let resultMarkers = [];

  function buildPool() {
    const places = PLACES.map((p) => ({ name: p.name, kind: 'Mål', lngLat: p.lngLat }));
    const seen = new Set();
    const stations = (getSites() ?? [])
      .filter((s) => !s.note && s.lon > INNER_CITY.w && s.lon < INNER_CITY.e && s.lat > INNER_CITY.s && s.lat < INNER_CITY.n)
      .filter((s) => (seen.has(s.name) ? false : seen.add(s.name)))
      .map((s) => ({ name: s.name, kind: 'Hållplats', lngLat: [s.lon, s.lat] }));
    const pickPlaces = shuffle(places).slice(0, 2);
    const pickStations = shuffle(stations).slice(0, ROUNDS - pickPlaces.length);
    return shuffle([...pickPlaces, ...pickStations]).slice(0, ROUNDS);
  }

  function ensureMinimap() {
    if (minimap) return;
    minimap = new maplibregl.Map({
      container: $('#gs-minimap'),
      style: STYLE_URL,
      center: [18.066, 59.329],
      zoom: 11.6,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    minimap.touchZoomRotate.disableRotation();
    minimap.on('load', () => {
      minimap.addSource('gs-line', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      minimap.addLayer({ id: 'gs-line', type: 'line', source: 'gs-line', paint: { 'line-color': '#ffb000', 'line-width': 2, 'line-dasharray': [2, 2] } });
    });
    minimap.on('click', (e) => {
      if (!game || game.revealed) return;
      game.guess = [e.lngLat.lng, e.lngLat.lat];
      if (!guessMarker) {
        const el = document.createElement('div');
        el.className = 'gs-pin gs-pin-guess';
        guessMarker = new maplibregl.Marker({ element: el });
      }
      guessMarker.setLngLat(game.guess).addTo(minimap);
      $('#gs-guess').disabled = false;
    });
  }

  function hideMapHints() {
    saved = {
      camera: { center: map.getCenter(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() },
      minZoom: map.getMinZoom(),
      maxZoom: map.getMaxZoom(),
      visibility: [],
      handlers: {
        dragPan: map.dragPan.isEnabled(),
        keyboard: map.keyboard.isEnabled(),
        doubleClickZoom: map.doubleClickZoom.isEnabled(),
        boxZoom: map.boxZoom.isEnabled(),
      },
    };
    const ids = [...map.getStyle().layers.filter((l) => l.type === 'symbol').map((l) => l.id), ...HIDDEN_LAYERS];
    for (const id of ids) {
      if (!map.getLayer(id)) continue;
      saved.visibility.push([id, map.getLayoutProperty(id, 'visibility') ?? 'visible']);
      map.setLayoutProperty(id, 'visibility', 'none');
    }
    map.dragPan.disable();
    map.keyboard.disable();
    map.doubleClickZoom.disable();
    map.boxZoom.disable();
  }

  function restoreMap() {
    if (!saved) return;
    for (const [id, v] of saved.visibility) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v);
    for (const [name, on] of Object.entries(saved.handlers)) if (on) map[name].enable();
    map.setMinZoom(saved.minZoom);
    map.setMaxZoom(saved.maxZoom);
    map.flyTo({ ...saved.camera, speed: 1.4, essential: true });
    saved = null;
  }

  function clearMarkers() {
    guessMarker?.remove();
    for (const m of resultMarkers) m.remove();
    resultMarkers = [];
    minimap?.getSource('gs-line')?.setData({ type: 'FeatureCollection', features: [] });
  }

  function showRound() {
    const loc = game.rounds[game.index];
    game.guess = null;
    game.revealed = false;
    clearMarkers();
    $('#gs-round').textContent = `RUNDA ${game.index + 1}/${ROUNDS}`;
    $('#gs-score').textContent = `${game.total.toLocaleString('sv-SE')} p`;
    $('#gs-guess').disabled = true;
    $('#gs-guess').hidden = false;
    $('#gs-result').hidden = true;
    root.classList.remove('revealed');
    map.setMinZoom(null);
    map.setMaxZoom(null);
    map.jumpTo({ center: loc.lngLat, zoom: 17.2, pitch: 68, bearing: Math.random() * 360 });
    map.setMinZoom(16.3);
    map.setMaxZoom(18.6);
    minimap.jumpTo({ center: [18.066, 59.329], zoom: 11.6 });
  }

  function pin(lngLat, cls, target) {
    const el = document.createElement('div');
    el.className = `gs-pin ${cls}`;
    const m = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(target);
    resultMarkers.push(m);
  }

  function reveal() {
    const loc = game.rounds[game.index];
    const d = distanceMeters(game.guess, loc.lngLat);
    const pts = score(d);
    game.total += pts;
    game.results.push({ name: loc.name, kind: loc.kind, d, pts });
    game.revealed = true;
    root.classList.add('revealed');

    pin(loc.lngLat, 'gs-pin-truth', minimap);
    minimap.getSource('gs-line')?.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [game.guess, loc.lngLat] },
    });
    const bounds = new maplibregl.LngLatBounds(game.guess, game.guess).extend(loc.lngLat);
    minimap.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 900 });

    map.setMinZoom(null);
    map.setMaxZoom(null);
    pin(loc.lngLat, 'gs-pin-truth', map);
    pin(game.guess, 'gs-pin-guess', map);
    map.fitBounds(bounds, { padding: 120, maxZoom: 16.5, pitch: 45, duration: 1600 });

    const last = game.index === ROUNDS - 1;
    $('#gs-score').textContent = `${game.total.toLocaleString('sv-SE')} p`;
    $('#gs-guess').hidden = true;
    $('#gs-result').hidden = false;
    $('#gs-result').innerHTML = `
      <div class="gs-pts">+${pts.toLocaleString('sv-SE')} p</div>
      <div class="gs-where"><span class="dim">${escapeHtml(loc.kind)}</span> ${escapeHtml(loc.name)}</div>
      <div class="gs-dist">Du var <b>${formatDistance(d)}</b> fel</div>
      <button type="button" class="gs-btn" id="gs-next">${last ? 'SLUTRESULTAT' : 'NÄSTA RUNDA'}</button>`;
    $('#gs-next').addEventListener('click', () => (last ? finish() : (game.index++, showRound())));
  }

  function finish() {
    const board = loadBoard();
    const entry = { score: game.total, date: new Date().toISOString() };
    board.push(entry);
    board.sort((a, b) => b.score - a.score);
    const top = board.slice(0, 10);
    saveBoard(top);
    const rank = RANKS.find(([min]) => game.total >= min)[1];
    const place = top.indexOf(entry);
    clearMarkers();
    $('#gs-result').innerHTML = `
      <div class="gs-final">${game.total.toLocaleString('sv-SE')} <span class="dim">/ ${(ROUNDS * MAX_POINTS).toLocaleString('sv-SE')} p</span></div>
      <div class="gs-rank">RANG: ${rank}</div>
      <ol class="gs-rounds">${game.results
        .map((r) => `<li><span>${escapeHtml(r.name)}</span><span class="dim">${formatDistance(r.d)}</span><b>${r.pts.toLocaleString('sv-SE')}</b></li>`)
        .join('')}</ol>
      <div class="gs-board-title">TOPPLISTA · DENNA WEBBLÄSARE</div>
      <ol class="gs-board">${top
        .map((e, i) => `<li class="${i === place ? 'me' : ''}"><span>${new Date(e.date).toLocaleDateString('sv-SE')}</span><b>${e.score.toLocaleString('sv-SE')}</b></li>`)
        .join('')}</ol>
      <div class="gs-actions"><button type="button" class="gs-btn" id="gs-again">SPELA IGEN</button><button type="button" class="gs-btn ghost" id="gs-exit">AVSLUTA</button></div>`;
    $('#gs-again').addEventListener('click', start);
    $('#gs-exit').addEventListener('click', stop);
    print?.(`Sthlm-Guessr: ${game.total.toLocaleString('sv-SE')} poäng · rang ${rank}${place >= 0 ? ` · plats ${place + 1} på topplistan` : ''}`);
  }

  function start() {
    if (!getSites()) throw new Error('väntar på SL-registret, försök igen om en sekund');
    const firstStart = !game;
    ensureMinimap();
    if (firstStart) {
      onStart?.();
      hideMapHints();
      root.hidden = false;
      document.body.classList.add('guessr');
      requestAnimationFrame(() => minimap.resize());
    }
    game = { rounds: buildPool(), index: 0, total: 0, results: [], guess: null, revealed: false };
    showRound();
  }

  function stop() {
    if (!game) return;
    game = null;
    clearMarkers();
    root.hidden = true;
    document.body.classList.remove('guessr');
    restoreMap();
    onEnd?.();
  }

  $('#gs-guess').addEventListener('click', () => {
    if (game?.guess && !game.revealed) reveal();
  });
  $('#gs-quit').addEventListener('click', stop);
  $('#gs-minimap-wrap').addEventListener('transitionend', () => minimap?.resize());

  return {
    start,
    stop,
    get active() {
      return !!game;
    },
  };
}
