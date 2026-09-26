import { cameraAltitudeMeters, compass, metersPerPixel, pad, toDMS } from './util.js';

const T0 = performance.now();

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
}

function dayOfYear(d) {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000);
}

const localFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export function startClock(root) {
  const $ = (k) => root.querySelector(`[data-clk="${k}"]`);
  const els = { local: $('local'), utc: $('utc'), unix: $('unix'), met: $('met'), cal: $('cal') };
  function tick() {
    const now = new Date();
    els.local.textContent = localFmt.format(now);
    els.utc.textContent = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}Z`;
    els.unix.textContent = Math.floor(now.getTime() / 1000);
    const s = Math.floor((performance.now() - T0) / 1000);
    els.met.textContent = `T+${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
    els.cal.textContent = `DOY ${pad(dayOfYear(now), 3)} · V${pad(isoWeek(now))}`;
  }
  tick();
  setInterval(tick, 1000);
}

function detectGpu() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { api: 'ingen', renderer: 'WebGL saknas' };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const api = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext ? 'WebGL 2.0' : 'WebGL 1.0';
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { api, renderer: String(renderer).replace(/^ANGLE \((.*)\)$/, '$1'), maxTex };
  } catch {
    return { api: 'okänd', renderer: 'okänd' };
  }
}

export function startTelemetry(map, root) {
  const els = Object.fromEntries([...root.querySelectorAll('[data-t]')].map((el) => [el.dataset.t, el]));
  const rose = root.querySelector('[data-compass]');
  const gpu = detectGpu();
  els.gpu.textContent = gpu.renderer;
  els.gpu.title = gpu.renderer;
  els.api.textContent = gpu.maxTex ? `${gpu.api} · tex ${gpu.maxTex}px` : gpu.api;

  let tiles = 0;
  let renders = 0;
  let frames = 0;
  let fps = 0;
  let renderHz = 0;
  let lastSample = performance.now();
  let lastPaint = 0;

  map.on('data', (e) => {
    if (e.dataType === 'source' && e.tile) tiles++;
  });
  map.on('render', () => renders++);

  rose?.closest('button')?.addEventListener('click', () => map.easeTo({ bearing: 0, duration: 900 }));

  function paint() {
    const c = map.getCenter();
    const bearing = ((map.getBearing() % 360) + 360) % 360;
    els.lat.textContent = toDMS(c.lat, 'N', 'S');
    els.lon.textContent = toDMS(c.lng, 'O', 'V');
    els.dec.textContent = `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`;
    els.zoom.textContent = map.getZoom().toFixed(2);
    els.scale.textContent = `${metersPerPixel(map).toFixed(3)} m/px`;
    els.bearing.textContent = `${bearing.toFixed(1).padStart(5, '0')}° ${compass(bearing)}`;
    els.pitch.textContent = `${map.getPitch().toFixed(1)}°`;
    els.alt.textContent = `${Math.round(cameraAltitudeMeters(map)).toLocaleString('sv-SE')} m`;
    els.fps.textContent = `${fps} / ${renderHz} Hz`;
    els.tiles.textContent = tiles.toLocaleString('sv-SE');
    const mem = performance.memory?.usedJSHeapSize;
    els.mem.textContent = mem ? `${(mem / 1048576).toFixed(1)} MB` : 'ej exponerat';
    els.view.textContent = `${innerWidth}×${innerHeight} @${devicePixelRatio.toFixed(2)}x`;
    if (rose) rose.style.transform = `rotate(${-bearing}deg)`;
  }

  function loop(now) {
    frames++;
    if (now - lastSample >= 1000) {
      fps = Math.round((frames * 1000) / (now - lastSample));
      renderHz = Math.round((renders * 1000) / (now - lastSample));
      frames = 0;
      renders = 0;
      lastSample = now;
    }
    if (now - lastPaint > 100) {
      lastPaint = now;
      paint();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  return { gpu };
}
