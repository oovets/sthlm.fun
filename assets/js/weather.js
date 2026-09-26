import { fetchJson } from './util.js';

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'surface_pressure',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'visibility',
];

const WMO = {
  0: 'Klart',
  1: 'Mestadels klart',
  2: 'Halvklart',
  3: 'Mulet',
  45: 'Dimma',
  48: 'Rimfrostdimma',
  51: 'Lätt duggregn',
  53: 'Måttligt duggregn',
  55: 'Tätt duggregn',
  56: 'Lätt underkylt duggregn',
  57: 'Tätt underkylt duggregn',
  61: 'Lätt regn',
  63: 'Måttligt regn',
  65: 'Kraftigt regn',
  66: 'Lätt underkylt regn',
  67: 'Kraftigt underkylt regn',
  71: 'Lätt snöfall',
  73: 'Måttligt snöfall',
  75: 'Kraftigt snöfall',
  77: 'Snökorn',
  80: 'Lätta regnskurar',
  81: 'Måttliga regnskurar',
  82: 'Kraftiga regnskurar',
  85: 'Lätta snöbyar',
  86: 'Kraftiga snöbyar',
  95: 'Åska',
  96: 'Åska med lätt hagel',
  99: 'Åska med kraftigt hagel',
};

export const describeWeather = (code) => WMO[code] ?? `WMO ${code}`;

export async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    current: FIELDS.join(','),
    wind_speed_unit: 'ms',
    timezone: 'Europe/Stockholm',
  });
  const { data, latencyMs } = await fetchJson(`${ENDPOINT}?${params}`);
  if (!data?.current) throw new Error('oväntat svar från Open-Meteo');
  return { ...data.current, gridLat: data.latitude, gridLon: data.longitude, elevation: data.elevation, latencyMs };
}
