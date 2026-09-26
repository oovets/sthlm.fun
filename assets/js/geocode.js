import { distanceMeters, fetchJson } from './util.js';

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
// Stockholms län (west, north, east, south).
const VIEWBOX = '17.2,60.2,19.4,58.7';
// Nominatim usage policy: at most one request per second, no search-as-you-type.
const MIN_INTERVAL_MS = 1100;

let lastRequest = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function shortLabel(displayName) {
  return displayName
    .split(', ')
    .filter((part) => !/^(Sverige|Stockholms län|\d{3} \d{2})$/.test(part))
    .slice(0, 4)
    .join(', ');
}

async function throttle() {
  const wait = lastRequest + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
}

export async function reverseGeocode([lng, lat]) {
  await throttle();
  const params = new URLSearchParams({
    lat: lat.toFixed(6),
    lon: lng.toFixed(6),
    format: 'jsonv2',
    zoom: '18',
    addressdetails: '1',
    'accept-language': 'sv',
  });
  const { data } = await fetchJson(`https://nominatim.openstreetmap.org/reverse?${params}`);
  if (!data || data.error) throw new Error(data?.error ?? 'ingen adress hittades');
  const a = data.address ?? {};
  const street = [a.road ?? a.pedestrian ?? a.footway ?? a.cycleway, a.house_number].filter(Boolean).join(' ');
  return {
    street: street || data.name || data.display_name.split(', ')[0],
    area: a.suburb ?? a.quarter ?? a.neighbourhood ?? a.city_district ?? null,
    city: a.city ?? a.town ?? a.village ?? a.municipality ?? null,
    label: shortLabel(data.display_name),
  };
}

export async function geocode(query) {
  await throttle();

  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '5',
    countrycodes: 'se',
    viewbox: VIEWBOX,
    bounded: '1',
    'accept-language': 'sv',
  });
  const { data } = await fetchJson(`${ENDPOINT}?${params}`);
  if (!Array.isArray(data)) throw new Error('oväntat svar från Nominatim');
  return data.map((r) => {
    const [minLat, maxLat, minLon, maxLon] = r.boundingbox.map(Number);
    return {
      name: r.name || r.display_name.split(', ')[0],
      label: shortLabel(r.display_name),
      kind: r.type === 'house' ? 'house' : r.addresstype || r.type,
      lngLat: [Number(r.lon), Number(r.lat)],
      bounds: [
        [minLon, minLat],
        [maxLon, maxLat],
      ],
      extentMeters: distanceMeters([minLon, minLat], [maxLon, maxLat]),
    };
  });
}

const KIND_LABELS = {
  house: 'Adress',
  building: 'Byggnad',
  road: 'Gata',
  suburb: 'Stadsdel',
  quarter: 'Kvarter',
  neighbourhood: 'Område',
  city: 'Stad',
  town: 'Tätort',
  village: 'By',
  municipality: 'Kommun',
  island: 'Ö',
  railway: 'Station',
  shop: 'Butik',
  amenity: 'Plats',
  tourism: 'Sevärdhet',
  leisure: 'Park/anläggning',
};

export const kindLabel = (kind) => KIND_LABELS[kind] ?? 'Plats';
