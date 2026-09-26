import { distanceMeters, fetchJson } from './util.js';
import { normalize } from './places.js';

const BASE = 'https://transport.integration.sl.se/v1';
// Server-side snapshot written by tools/update-sl-sites.py.
const SNAPSHOT_URL = '/data/sl-sites.json';

async function loadSnapshot() {
  const { data, latencyMs } = await fetchJson(SNAPSHOT_URL, { timeoutMs: 15000 });
  if (!Array.isArray(data?.sites) || !data.sites.length) throw new Error('tom snapshot');
  return { sites: data.sites, source: 'snapshot', generatedAt: new Date(data.generatedAt), latencyMs };
}

async function loadLive() {
  const { data, latencyMs } = await fetchJson(`${BASE}/sites`, { timeoutMs: 30000 });
  if (!Array.isArray(data)) throw new Error('oväntat svar från SL');
  const sites = data
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon))
    .map((s) => ({
      id: s.id,
      name: s.name,
      note: s.note ?? null,
      abbr: s.abbreviation ?? null,
      lat: +s.lat.toFixed(6),
      lon: +s.lon.toFixed(6),
    }));
  return { sites, source: 'live', latencyMs };
}

export async function loadSites() {
  try {
    return await loadSnapshot();
  } catch {
    return loadLive();
  }
}

export function nearestSites(sites, [lon, lat], count) {
  const kx = Math.cos((lat * Math.PI) / 180);
  return sites
    .map((s) => ({ s, d2: ((s.lon - lon) * kx) ** 2 + (s.lat - lat) ** 2 }))
    .sort((a, b) => a.d2 - b.d2)
    .slice(0, count)
    .map(({ s }) => ({ ...s, distance: distanceMeters([lon, lat], [s.lon, s.lat]) }));
}

export function findSite(sites, query) {
  const q = normalize(query);
  if (!q) return null;
  const byAbbr = sites.find((s) => s.abbr && normalize(s.abbr) === q);
  if (byAbbr) return byAbbr;
  const exact = sites.filter((s) => normalize(s.name) === q);
  if (exact.length) return exact.find((s) => !s.note) ?? exact[0];
  const prefix = sites.filter((s) => normalize(s.name).startsWith(q));
  if (prefix.length) return prefix.sort((a, b) => a.name.length - b.name.length)[0];
  return sites.find((s) => normalize(s.name).includes(q)) ?? null;
}

const departureTime = (d) => Date.parse(d.expected ?? d.scheduled);

export async function fetchDepartures(siteId) {
  const { data, latencyMs } = await fetchJson(`${BASE}/sites/${encodeURIComponent(siteId)}/departures?forecast=60`);
  if (!Array.isArray(data?.departures)) throw new Error('oväntat svar från SL');
  const departures = [...data.departures].sort((a, b) => departureTime(a) - departureTime(b));
  return { departures, deviations: data.stop_deviations ?? [], latencyMs };
}

export function lineColor(line) {
  const group = line?.group_of_lines ?? '';
  switch (line?.transport_mode) {
    case 'METRO':
      if (group.includes('röda')) return '#e8424a';
      if (group.includes('gröna')) return '#3fb56a';
      if (group.includes('blå')) return '#2f86d6';
      return '#9aa7b4';
    case 'TRAIN':
      return '#ec619f';
    case 'TRAM':
      return '#c9a24a';
    case 'BUS':
      return '#e0443c';
    case 'SHIP':
    case 'FERRY':
      return '#1fb2d6';
    default:
      return '#9aa7b4';
  }
}

export function modeLabel(mode) {
  const labels = { METRO: 'T-BANA', TRAIN: 'PENDEL', TRAM: 'SPÅR', BUS: 'BUSS', SHIP: 'BÅT', FERRY: 'BÅT', TAXI: 'TAXI' };
  return labels[mode] ?? mode ?? '?';
}
