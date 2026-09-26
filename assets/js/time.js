const TZ = 'Europe/Stockholm';

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

export function stockholmParts(date) {
  const p = Object.fromEntries(partsFmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, second: +p.second };
}

function offsetMs(date) {
  const p = stockholmParts(date);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - (date.getTime() - date.getMilliseconds());
}

// Wall-clock time in Stockholm -> absolute Date (handles DST).
export function stockholmDate(year, month, day, hour, minute) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(guess - offsetMs(new Date(guess)));
}

export function stockholmMinutes(date) {
  const p = stockholmParts(date);
  return p.hour * 60 + p.minute;
}

export function onSameDay(date, minutes) {
  const p = stockholmParts(date);
  return stockholmDate(p.year, p.month, p.day, Math.floor(minutes / 60), minutes % 60);
}

export const hhmm = (minutes) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
