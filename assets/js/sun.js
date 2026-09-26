import SunCalc from 'suncalc';

const DEG = 180 / Math.PI;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// SunCalc azimuth is measured from south, clockwise towards west.
const toCompass = (azRad) => (((azRad * DEG + 180) % 360) + 360) % 360;

export function computeSky(date, lat, lon) {
  const sun = SunCalc.getPosition(date, lat, lon);
  const moon = SunCalc.getMoonPosition(date, lat, lon);
  const illum = SunCalc.getMoonIllumination(date);
  return {
    date,
    sunAzimuth: toCompass(sun.azimuth),
    sunAltitude: sun.altitude * DEG,
    moonAzimuth: toCompass(moon.azimuth),
    moonAltitude: moon.altitude * DEG,
    moonFraction: illum.fraction,
    moonPhase: illum.phase,
    times: SunCalc.getTimes(date, lat, lon),
  };
}

export function sunPosition(date, lat, lon) {
  const p = SunCalc.getPosition(date, lat, lon);
  return { az: toCompass(p.azimuth), alt: p.altitude * DEG };
}

export function sunTimes(date, lat, lon) {
  return SunCalc.getTimes(date, lat, lon);
}

export function skyPhase(sunAltitude) {
  if (sunAltitude >= 6) return 'DAG';
  if (sunAltitude >= -0.833) return 'GYLLENE TIMMEN';
  if (sunAltitude >= -6) return 'BORGERLIG SKYMNING';
  if (sunAltitude >= -12) return 'NAUTISK SKYMNING';
  if (sunAltitude >= -18) return 'ASTRONOMISK SKYMNING';
  return 'NATT';
}

export function moonPhaseName(phase) {
  const names = ['Nymåne', 'Tilltagande skära', 'Första kvarteret', 'Tilltagande måne', 'Fullmåne', 'Avtagande måne', 'Sista kvarteret', 'Avtagande skära'];
  return names[Math.round(phase * 8) % 8];
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `#${ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

// 0 = day, 1 = full night; lights switch on through civil twilight.
export const nightness = (sunAltitude) => clamp(-sunAltitude / 6, 0, 1);

const DAY_SKY = {
  dark: { sky: '#0c2640', horizon: '#0f2f4a', fog: '#0b1a28', haze: '#4a5866' },
  light: { sky: '#8cc2e8', horizon: '#dcebf5', fog: '#e4edf3', haze: '#c9d3dc' },
};

export function applySkyToMap(map, sky, fog = 0, theme = 'dark') {
  const day = DAY_SKY[theme];
  const { sunAltitude, sunAzimuth, moonAltitude, moonAzimuth, moonFraction } = sky;
  const daylight = clamp((sunAltitude + 6) / 18, 0, 1);
  const golden = clamp(1 - Math.abs(sunAltitude - 1) / 7, 0, 1);

  let light;
  if (sunAltitude > -4) {
    light = {
      anchor: 'map',
      position: [1.5, sunAzimuth, clamp(90 - sunAltitude, 5, 88)],
      // Light theme uses a near-white sun so the pale facades stay grey instead of turning tan.
      color: theme === 'light' ? mix('#fbf8f2', '#ffd2a6', golden) : mix('#ffe7c2', '#ff9a4d', golden),
      intensity: 0.25 + 0.3 * daylight,
    };
  } else if (moonAltitude > 0) {
    light = {
      anchor: 'map',
      position: [1.5, moonAzimuth, clamp(90 - moonAltitude, 5, 88)],
      // Near-white: MapLibre adds a 0.3 * (1 - lightColor) floor, so a saturated blue light tints shadows purple.
      color: '#e2e9ff',
      intensity: 0.12 + 0.18 * moonFraction,
    };
  } else {
    light = { anchor: 'map', position: [1.5, 180, 30], color: '#dde5f7', intensity: 0.12 };
  }
  map.setLight(light);

  const horizonDay = mix(day.horizon, '#6b3a22', golden * (theme === 'light' ? 0.5 : 1));
  const haze = mix('#141c24', day.haze, daylight);
  const f = clamp(fog, 0, 1);
  map.setSky({
    'sky-color': mix(mix('#02050b', day.sky, daylight), haze, f * 0.7),
    'horizon-color': mix(mix('#081424', horizonDay, Math.max(daylight, golden * 0.8)), haze, f),
    'fog-color': mix(mix('#05090f', day.fog, daylight), haze, f),
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.7 + 0.3 * f,
    'fog-ground-blend': 0.5 - 0.45 * f,
    'atmosphere-blend': 0,
  });
}
