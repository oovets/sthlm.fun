import { compass, escapeHtml, formatDistance, toDMS } from './util.js';
import { describeWeather } from './weather.js';
import { moonPhaseName, skyPhase } from './sun.js';
import { lineColor, modeLabel } from './sl.js';

const timeFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' });
const hm = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? timeFmt.format(d) : '--:--');

const kv = (rows) =>
  `<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;

export function setPanelStatus(panel, state, text) {
  const badge = panel.querySelector('.panel-status');
  if (!badge) return;
  badge.dataset.state = state;
  badge.textContent = text;
}

export function renderWeather(body, w) {
  const arrow = `<svg class="wind-arrow" viewBox="0 0 24 24" style="transform:rotate(${w.wind_direction_10m + 180}deg)" aria-hidden="true"><path d="M12 3l5 9h-3.5v9h-3v-9H7z"/></svg>`;
  body.innerHTML = `
    <div class="wx-hero">
      <div class="wx-temp">${w.temperature_2m.toFixed(1)}<span>°C</span></div>
      <div class="wx-desc">${escapeHtml(describeWeather(w.weather_code))}<small>känns som ${w.apparent_temperature.toFixed(1)}°C</small></div>
    </div>
    ${kv([
      ['VIND', `${arrow}${w.wind_speed_10m.toFixed(1)} m/s ${compass(w.wind_direction_10m)} <span class="dim">(${w.wind_direction_10m}°) byar ${w.wind_gusts_10m.toFixed(1)}</span>`],
      ['LUFTFUKT', `${w.relative_humidity_2m}%`],
      ['LUFTTRYCK', `${w.surface_pressure.toFixed(1)} hPa`],
      ['MOLN', `${w.cloud_cover}%`],
      ['SIKT', w.visibility != null ? formatDistance(w.visibility) : '–'],
      ['NEDERBÖRD', `${w.precipitation.toFixed(1)} mm`],
      ['MÄTPUNKT', `<span class="dim">${w.gridLat.toFixed(3)}N ${w.gridLon.toFixed(3)}E · ${Math.round(w.elevation)} m ö.h.</span>`],
      ['OBS', `<span class="dim">${escapeHtml(w.time.slice(11))} lokal · ${Math.round(w.latencyMs)} ms RTT</span>`],
    ])}`;
}

function skyDome(sky) {
  const pos = (az, alt) => {
    const r = (Math.min(90, Math.max(-20, 90 - alt)) / 90) * 40;
    const a = ((az - 90) * Math.PI) / 180;
    return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
  };
  const [sx, sy] = pos(sky.sunAzimuth, sky.sunAltitude);
  const [mx, my] = pos(sky.moonAzimuth, sky.moonAltitude);
  return `<svg class="sky-dome" viewBox="0 0 100 100" aria-label="Polär himmelskarta med sol och måne">
    <circle cx="50" cy="50" r="40" class="dome-h"/>
    <circle cx="50" cy="50" r="26.67" class="dome-g"/>
    <circle cx="50" cy="50" r="13.33" class="dome-g"/>
    <line x1="50" y1="6" x2="50" y2="94" class="dome-g"/><line x1="6" y1="50" x2="94" y2="50" class="dome-g"/>
    <text x="50" y="5" class="dome-t">N</text><text x="97" y="52" class="dome-t">O</text>
    <text x="50" y="99.5" class="dome-t">S</text><text x="3" y="52" class="dome-t">V</text>
    <circle cx="${mx.toFixed(2)}" cy="${my.toFixed(2)}" r="3" class="dome-moon${sky.moonAltitude < 0 ? ' below' : ''}"/>
    <circle cx="${sx.toFixed(2)}" cy="${sy.toFixed(2)}" r="4.2" class="dome-sun${sky.sunAltitude < 0 ? ' below' : ''}"/>
  </svg>`;
}

export function renderSun(body, sky, simulated) {
  const t = sky.times;
  const dayMs = t.sunset - t.sunrise;
  const dayLen = Number.isFinite(dayMs) ? `${Math.floor(dayMs / 3600000)} h ${Math.round((dayMs % 3600000) / 60000)} min` : '–';
  body.innerHTML = `
    <div class="sun-wrap">
      ${skyDome(sky)}
      ${kv([
        ['AZIMUT', `${sky.sunAzimuth.toFixed(2)}° ${compass(sky.sunAzimuth)}`],
        ['ELEVATION', `${sky.sunAltitude.toFixed(2)}°`],
        ['FAS', `<span class="accent">${skyPhase(sky.sunAltitude)}</span>`],
        ['UPP / NED', `${hm(t.sunrise)} / ${hm(t.sunset)}`],
        ['HÖGST', hm(t.solarNoon)],
        ['GYLLENE', `${hm(t.goldenHour)} → ${hm(t.sunset)}`],
        ['DAGSLÄNGD', dayLen],
        ['MÅNE', `${moonPhaseName(sky.moonPhase)} <span class="dim">${Math.round(sky.moonFraction * 100)}% · ${sky.moonAltitude.toFixed(1)}°</span>`],
      ])}
    </div>
    ${simulated ? `<p class="sim-note">SIMULERAD TID ${hm(sky.date)} · <code>time now</code> återställer</p>` : ''}`;
}

export function renderStations(body, { station, nearby, departures, deviations, pinned }) {
  const near = nearby
    .map(
      (s) =>
        `<button type="button" class="chip${s.id === station.id ? ' is-on' : ''}" data-site="${s.id}">${escapeHtml(s.name)} <span class="dim">${formatDistance(s.distance)}</span></button>`,
    )
    .join('');

  const rows = departures.slice(0, 9).map((d) => {
    const dev = d.deviations?.length ? ' <span class="warn" title="Avvikelse">!</span>' : '';
    const late = d.expected && d.scheduled && Date.parse(d.expected) - Date.parse(d.scheduled) > 60000;
    return `<tr>
      <td><span class="line" style="--c:${lineColor(d.line)}" title="${escapeHtml(d.line?.group_of_lines ?? modeLabel(d.line?.transport_mode))}">${escapeHtml(d.line?.designation ?? '?')}</span></td>
      <td class="dest">${escapeHtml(d.destination ?? '')}${dev}</td>
      <td class="plat dim">${escapeHtml(d.stop_point?.designation ?? '')}</td>
      <td class="eta${late ? ' late' : ''}">${escapeHtml(d.display ?? '')}</td>
    </tr>`;
  });

  const alerts = deviations
    .slice()
    .sort((a, b) => (b.importance_level ?? 0) - (a.importance_level ?? 0))
    .slice(0, 2)
    .map((d) => `<li>${escapeHtml(d.message ?? '')}</li>`)
    .join('');

  body.innerHTML = `
    <div class="sl-head">
      <strong>${escapeHtml(station.name)}</strong>
      <span class="dim">${station.abbr ? escapeHtml(station.abbr) + ' · ' : ''}#${station.id}${pinned ? ' · LÅST' : ' · FÖLJER KAMERA'}</span>
    </div>
    <div class="chips">${near}</div>
    ${
      rows.length
        ? `<table class="dep"><thead><tr><th>LINJE</th><th>MOT</th><th>LÄGE</th><th>AVG</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
        : '<p class="dim">Inga avgångar inom 60 minuter.</p>'
    }
    ${alerts ? `<ul class="alerts">${alerts}</ul>` : ''}`;
}

export function renderSunHours(body, { label, lngLat, samples, step, nowMinutes, movedToFacade, buildingHeight, buildings }) {
  const cells = samples.map((s) => (s.alt <= 0 ? 'night' : s.shade ? 'shade' : 'sun'));
  const sunMinutes = cells.filter((c) => c === 'sun').length * step;
  const intervals = [];
  cells.forEach((c, i) => {
    const prev = intervals[intervals.length - 1];
    if (c !== 'sun') return;
    if (prev && prev.end === i) prev.end = i + 1;
    else intervals.push({ start: i, end: i + 1 });
  });
  const hm = (i) => {
    const m = Math.min(1439, i * step);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  const nowCell = cells[Math.min(cells.length - 1, Math.floor(nowMinutes / step))];
  const nowText = { night: 'SOLEN ÄR NERE', shade: 'I SKUGGA', sun: 'I SOL' }[nowCell];
  const colors = { night: '#0b1624', shade: '#3a4756', sun: '#ffc53d' };
  const bars = cells.map((c, i) => `<rect x="${i}" y="0" width="1.05" height="18" fill="${colors[c]}"/>`).join('');
  const ticks = [0, 6, 12, 18, 24]
    .map((h) => {
      const x = (h * 60) / step;
      return `<line x1="${x}" y1="18" x2="${x}" y2="22" class="tick"/>`;
    })
    .join('');
  const nowX = nowMinutes / step;

  body.innerHTML = `
    <div class="sk-head">
      <strong>${escapeHtml(label)}</strong>
      <span class="dim">${toDMS(lngLat[1], 'N', 'S')} ${toDMS(lngLat[0], 'O', 'V')}</span>
    </div>
    <div class="sk-now sk-${nowCell}">${nowText}</div>
    <svg class="sk-bar" viewBox="0 0 ${cells.length} 22" preserveAspectRatio="none" aria-label="Sol och skugga under dygnet">
      ${bars}${ticks}
      <line x1="${nowX}" y1="0" x2="${nowX}" y2="22" class="now"/>
    </svg>
    <div class="sk-ticks"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
    ${kv([
      ['SOLTIMMAR', `<span class="accent">${Math.floor(sunMinutes / 60)} h ${sunMinutes % 60} min</span>`],
      ['I SOL', intervals.length ? intervals.map((iv) => `${hm(iv.start)}–${hm(iv.end)}`).join(' · ') : '–'],
    ])}
    <p class="sk-note dim">${movedToFacade ? `Punkten ligger i en byggnad (${Math.round(buildingHeight)} m), beräknat vid närmaste fasad. ` : ''}Beräknat mot ${buildings.toLocaleString('sv-SE')} byggnader var ${step}:e minut. Terräng ingår inte.</p>`;
}

export function renderPlane(body, p) {
  const title = p.flight || p.hex.toUpperCase();
  const meta = [p.t, p.r, `hex ${p.hex}`].filter(Boolean).map(escapeHtml).join(' · ');
  body.innerHTML = `
    <div class="pl-head"><strong>${escapeHtml(title)}</strong><span class="dim">${meta}</span></div>
    ${kv([
      ['HÖJD', p.onGround ? 'på marken' : `${Math.round(p.alt).toLocaleString('sv-SE')} m`],
      ['FART', `${Math.round(p.speed * 3.6).toLocaleString('sv-SE')} km/h`],
      ['V/S', p.onGround ? '–' : `${p.vs >= 0 ? '+' : ''}${p.vs.toFixed(1)} m/s`],
      ['KURS', `${Math.round(p.heading)}° ${compass(p.heading)}`],
      ['SQUAWK', escapeHtml(p.squawk ?? '–')],
      ['AVSTÅND', `${formatDistance(p.distance)} från city`],
    ])}
    <div class="pl-actions">
      <button type="button" class="gs-btn${p.following ? ' ghost' : ''}" data-plane-action="${p.following ? 'unfollow' : 'follow'}">${p.following ? 'SLUTA FÖLJA' : 'FÖLJ'}</button>
    </div>`;
}

export function renderAddress(body, { name, label, kind, lngLat }) {
  body.innerHTML = `
    <div class="tgt-id">${escapeHtml(kind)}</div>
    <h3>${escapeHtml(name)}</h3>
    <p class="tgt-text">${escapeHtml(label)}</p>
    ${kv([
      ['LAT', toDMS(lngLat[1], 'N', 'S')],
      ['LON', toDMS(lngLat[0], 'O', 'V')],
    ])}
    <p class="sk-note dim">Geokodat via OpenStreetMap Nominatim</p>`;
}

export function renderTarget(body, place, index, total) {
  body.innerHTML = `
    <div class="tgt-id">T${String(index + 1).padStart(2, '0')}<span class="dim">/${total}</span></div>
    <h3>${escapeHtml(place.name)}</h3>
    <p class="tgt-district">${escapeHtml(place.district)}</p>
    <p class="tgt-text">${escapeHtml(place.text)}</p>
    ${kv([
      ['LAT', toDMS(place.lngLat[1], 'N', 'S')],
      ['LON', toDMS(place.lngLat[0], 'O', 'V')],
    ])}`;
}
