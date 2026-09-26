import { hhmm, onSameDay, stockholmMinutes } from './time.js';

const MIN_PER_SECOND = 60;

export function createTimebar(root, { onChange, getTimes }) {
  const range = root.querySelector('#tb-range');
  const out = root.querySelector('#tb-time');
  const play = root.querySelector('#tb-play');
  const now = root.querySelector('#tb-now');
  let base = new Date();
  let playing = false;
  let raf = 0;
  let last = 0;
  let acc = 0;

  function paintDaylight(date) {
    const t = getTimes(date);
    const pct = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? (stockholmMinutes(d) / 1440) * 100 : null);
    const dawn = pct(t.dawn);
    const rise = pct(t.sunrise);
    const set = pct(t.sunset);
    const dusk = pct(t.dusk);
    if (rise == null || set == null) {
      range.style.setProperty('--track', 'linear-gradient(90deg, #0b1624, #0b1624)');
      return;
    }
    const night = '#0b1624';
    const twilight = '#4a3a3a';
    const day = '#2d6c8f';
    range.style.setProperty(
      '--track',
      `linear-gradient(90deg, ${night} 0%, ${night} ${dawn ?? rise}%, ${twilight} ${rise}%, ${day} ${rise + 2}%, ${day} ${set - 2}%, ${twilight} ${set}%, ${night} ${dusk ?? set}%, ${night} 100%)`,
    );
  }

  function sync(date, simulated) {
    base = date;
    const m = stockholmMinutes(date);
    if (document.activeElement !== range) range.value = String(m);
    out.textContent = hhmm(m);
    root.dataset.mode = simulated ? 'sim' : 'live';
    paintDaylight(date);
  }

  function emit(minutes) {
    onChange(onSameDay(base, ((minutes % 1440) + 1440) % 1440));
  }

  function stop() {
    playing = false;
    cancelAnimationFrame(raf);
    play.setAttribute('aria-pressed', 'false');
  }

  function tick(t) {
    const dt = (t - last) / 1000;
    last = t;
    acc += dt * MIN_PER_SECOND;
    if (acc >= 1) {
      const step = Math.floor(acc);
      acc -= step;
      emit(Number(range.value) + step);
      range.value = String((Number(range.value) + step) % 1440);
    }
    if (playing) raf = requestAnimationFrame(tick);
  }

  range.addEventListener('input', () => {
    stop();
    emit(Number(range.value));
  });
  play.addEventListener('click', () => {
    if (playing) return stop();
    playing = true;
    play.setAttribute('aria-pressed', 'true');
    last = performance.now();
    acc = 0;
    raf = requestAnimationFrame(tick);
  });
  now.addEventListener('click', () => {
    stop();
    onChange(null);
  });

  return { sync, stop };
}
