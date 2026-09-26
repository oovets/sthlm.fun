const LIGHT = new Set([51, 56, 61, 66, 71, 80, 85]);
const MODERATE = new Set([53, 63, 73, 81]);
const RAIN = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const SNOW = new Set([71, 73, 75, 77, 85, 86]);
const THUNDER = new Set([95, 96, 99]);
const FOG = new Set([45, 48]);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const PRESETS = {
  regn: { kind: 'rain', intensity: 0.7, fog: 0.2, thunder: false },
  snö: { kind: 'snow', intensity: 0.7, fog: 0.25, thunder: false },
  dimma: { kind: null, intensity: 0, fog: 0.9, thunder: false },
  åska: { kind: 'rain', intensity: 1, fog: 0.3, thunder: true },
};

export function effectFromWeather(w) {
  const code = w.weather_code;
  const kind = RAIN.has(code) ? 'rain' : SNOW.has(code) ? 'snow' : null;
  const codeIntensity = LIGHT.has(code) ? 0.3 : MODERATE.has(code) ? 0.6 : kind ? 1 : 0;
  const intensity = kind ? Math.max(codeIntensity, clamp(w.precipitation / 4, 0, 1)) : 0;
  const visFog = w.visibility != null ? clamp((10000 - w.visibility) / 9000, 0, 1) * 0.8 : 0;
  return { kind, intensity, fog: FOG.has(code) ? 0.85 : visFog, thunder: THUNDER.has(code) };
}

// Deterministic PRNG so the same windows stay lit as the lit fraction changes.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WIN = { size: 64, cell: 8, w: 4, h: 5 };

function windowImage(litFraction) {
  const { size, cell, w, h } = WIN;
  const data = new Uint8Array(size * size * 4);
  const rand = mulberry32(1337);
  const put = (x, y, [r, g, b]) => {
    const i = (y * size + x) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) put(x, y, [10, 18, 28]);
  for (let cy = 0; cy < size / cell; cy++) {
    for (let cx = 0; cx < size / cell; cx++) {
      const r = rand();
      const warm = rand();
      const lit = r < litFraction;
      const color = lit ? (warm < 0.75 ? [255, 196, 110] : [200, 225, 255]) : [20, 34, 50];
      const ox = cx * cell + 2;
      const oy = cy * cell + 1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(ox + x, oy + y, color);
    }
  }
  return { width: size, height: size, data };
}

function litFractionForHour(hour) {
  if (hour >= 16 && hour < 22) return 0.55;
  if (hour >= 22) return 0.35;
  if (hour < 2) return 0.2;
  if (hour < 5) return 0.08;
  return 0.3;
}

export function createFx(map, canvas, hazeEl) {
  const ctx = canvas.getContext('2d');
  let effect = { kind: null, intensity: 0, fog: 0, thunder: false };
  let wind = { dir: 0, speed: 0 };
  let particles = [];
  let running = false;
  let last = 0;
  let flash = 0;
  let nextStrike = 0;
  let dpr = 1;
  let nightOn = false;
  let litFraction = -1;
  let ink = { rain: '170,210,240', snow: '235,244,255' };

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  }
  resize();
  addEventListener('resize', resize);

  function targetCount() {
    if (!effect.kind) return 0;
    const area = (innerWidth * innerHeight) / 1e6;
    return Math.round(effect.intensity * (effect.kind === 'rain' ? 1100 : 600) * area);
  }

  function spawn(randomY) {
    const rain = effect.kind === 'rain';
    return {
      x: Math.random() * innerWidth,
      y: randomY ? Math.random() * innerHeight : -20,
      z: 0.4 + Math.random() * 0.6,
      v: rain ? 900 + Math.random() * 500 : 35 + Math.random() * 45,
      phase: Math.random() * Math.PI * 2,
    };
  }

  function drift() {
    const rel = ((wind.dir + 180 - map.getBearing()) * Math.PI) / 180;
    return Math.sin(rel) * wind.speed * (effect.kind === 'rain' ? 22 : 14);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const target = targetCount();
    const fresh = particles.length === 0;
    while (particles.length < target) particles.push(spawn(fresh));
    if (particles.length > target) particles.length = target;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const dx = drift();
    const rain = effect.kind === 'rain';
    ctx.lineCap = 'round';
    for (const p of particles) {
      const vx = dx * p.z;
      const vy = p.v * p.z;
      if (rain) {
        p.x += vx * dt;
        p.y += vy * dt;
        ctx.strokeStyle = `rgba(${ink.rain},${0.18 + 0.3 * p.z})`;
        ctx.lineWidth = 0.6 + p.z * 0.8;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - vx * 0.018, p.y - vy * 0.018);
        ctx.stroke();
      } else {
        p.phase += dt * 1.6;
        p.x += (vx + Math.sin(p.phase) * 18) * dt;
        p.y += vy * dt;
        ctx.fillStyle = `rgba(${ink.snow},${0.35 + 0.5 * p.z})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.8 + p.z * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      if (p.y > innerHeight + 20 || p.x < -40 || p.x > innerWidth + 40) Object.assign(p, spawn(false), { x: Math.random() * innerWidth });
    }

    if (effect.thunder) {
      if (now > nextStrike) {
        flash = 1;
        nextStrike = now + 4000 + Math.random() * 9000;
      }
      if (flash > 0) {
        ctx.fillStyle = `rgba(220,230,255,${flash * 0.35})`;
        ctx.fillRect(0, 0, innerWidth, innerHeight);
        flash = Math.max(0, flash - dt * (flash > 0.5 ? 6 : 2.5));
      }
    }

    if (particles.length || effect.thunder) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      running = false;
    }
  }

  function ensureRunning() {
    if (running || (!effect.kind && !effect.thunder)) return;
    running = true;
    last = performance.now();
    requestAnimationFrame((t) => {
      last = t;
      frame(t);
    });
  }

  function installLayers() {
    if (map.getLayer('night-glow')) return;
    map.addImage('night-windows', windowImage(0.4));
    litFraction = 0.4;
    map.addLayer(
      {
        id: 'night-glow',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service'], true, false],
        paint: {
          'line-color': '#ffb35c',
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.5, 16, 10, 18, 22],
          'line-blur': ['interpolate', ['linear'], ['zoom'], 12, 1, 16, 8, 18, 16],
          'line-opacity': 0,
          'line-opacity-transition': { duration: 1500 },
        },
      },
      'buildings-3d',
    );
  }

  return {
    installLayers,
    setWeather(next, windInfo) {
      if (next.kind !== effect.kind) particles = [];
      effect = next;
      if (windInfo) wind = windInfo;
      if (hazeEl) hazeEl.style.opacity = String(next.fog * 0.45);
      ensureRunning();
    },
    get effect() {
      return effect;
    },
    setTheme(theme) {
      ink = theme === 'light' ? { rain: '55,85,115', snow: '120,140,160' } : { rain: '170,210,240', snow: '235,244,255' };
    },
    setNight(level, localHour) {
      if (!map.getLayer('night-glow')) return;
      map.setPaintProperty('night-glow', 'line-opacity', level * 0.5);
      const on = level > 0.5;
      if (on) {
        const f = litFractionForHour(localHour);
        if (f !== litFraction) {
          map.updateImage('night-windows', windowImage(f));
          litFraction = f;
        }
      }
      if (on !== nightOn) {
        map.setPaintProperty('buildings-3d', 'fill-extrusion-pattern', on ? 'night-windows' : undefined);
        nightOn = on;
      }
    },
  };
}
