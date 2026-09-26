const EARTH_RADIUS_M = 6371008.8;
const EARTH_CIRCUMFERENCE_M = 40075016.686;
const toRad = (d) => (d * Math.PI) / 180;

export function distanceMeters([lon1, lat1], [lon2, lat2]) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

// Mirrors MapLibre's transform.getCameraAltitude() using only public map getters.
export function cameraAltitudeMeters(map) {
  const { lat } = map.getCenter();
  const fov = toRad(map.getVerticalFieldOfView());
  const height = map.getCanvas().clientHeight;
  const cameraToCenterPx = height / 2 / Math.tan(fov / 2);
  const worldSizePx = 512 * 2 ** map.getZoom();
  const pxPerMeter = worldSizePx / (EARTH_CIRCUMFERENCE_M * Math.cos(toRad(lat)));
  return (Math.cos(toRad(map.getPitch())) * cameraToCenterPx) / pxPerMeter;
}

// Inverse of cameraAltitudeMeters(): camera options that put the eye at (lng, lat, alt)
// looking along `heading`, `look` degrees below the horizon (MapLibre pitch = 90 - look).
export function cameraFromPose(map, { lng, lat, alt, heading, look }) {
  const ground = alt / Math.tan(toRad(look));
  const kx = 111320 * Math.cos(toRad(lat));
  const center = [lng + (Math.sin(toRad(heading)) * ground) / kx, lat + (Math.cos(toRad(heading)) * ground) / 110540];
  const dist = alt / Math.sin(toRad(look));
  const camToCenterPx = map.getCanvas().clientHeight / 2 / Math.tan(toRad(map.getVerticalFieldOfView()) / 2);
  const zoom = Math.log2(((camToCenterPx / dist) * EARTH_CIRCUMFERENCE_M * Math.cos(toRad(center[1]))) / 512);
  return { center, zoom: Math.min(22, Math.max(0, zoom)), pitch: 90 - look, bearing: heading };
}

export function metersPerPixel(map) {
  const { lat } = map.getCenter();
  return (EARTH_CIRCUMFERENCE_M * Math.cos(toRad(lat))) / (512 * 2 ** map.getZoom());
}

export function toDMS(deg, pos, neg) {
  const hemi = deg >= 0 ? pos : neg;
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const s = (mFloat - m) * 60;
  return `${d}°${String(m).padStart(2, '0')}′${s.toFixed(2).padStart(5, '0')}″${hemi}`;
}

export function compass(deg) {
  const dirs = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSV', 'SV', 'VSV', 'V', 'VNV', 'NV', 'NNV'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

export function formatDistance(m) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`;
}

export const pad = (n, len = 2) => String(n).padStart(len, '0');

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export async function fetchJson(url, { timeoutMs = 12000, signal } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error(`timeout efter ${timeoutMs} ms`)), timeoutMs);
  const onAbort = () => ctrl.abort(signal.reason);
  signal?.addEventListener('abort', onAbort, { once: true });
  const t0 = performance.now();
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const err = new Error(res.status === 429 ? 'HTTP 429, kvoten är tillfälligt slut' : `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    return { data, latencyMs: performance.now() - t0 };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

// Repeats `task` every `intervalMs`; on failure retries with exponential backoff.
export function createPoller(task, { intervalMs, minBackoffMs = 5000, maxBackoffMs = 5 * 60000, onError }) {
  let timer = null;
  let backoff = minBackoffMs;
  let stopped = false;
  let running = false;

  async function run() {
    if (stopped || running) return;
    running = true;
    clearTimeout(timer);
    try {
      await task();
      backoff = minBackoffMs;
      schedule(intervalMs);
    } catch (err) {
      onError?.(err, backoff);
      schedule(backoff);
      backoff = Math.min(backoff * 2, maxBackoffMs);
    } finally {
      running = false;
    }
  }

  function schedule(ms) {
    if (!stopped) timer = setTimeout(run, ms);
  }

  return {
    now: run,
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
