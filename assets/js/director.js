const linear = (t) => t;

export function createDirector(map, { onTarget, onCaption, onStop }) {
  let session = null;

  function begin(kind) {
    stop();
    session = { kind, ctrl: new AbortController() };
    return session.ctrl.signal;
  }

  function end(signal) {
    if (session?.ctrl.signal === signal) session = null;
  }

  function stop(reason) {
    if (!session) return false;
    const { kind, ctrl } = session;
    session = null;
    ctrl.abort();
    map.stop();
    onCaption?.(null);
    onStop?.(kind, reason);
    return true;
  }

  const interrupt = () => stop('manuell styrning');
  const container = map.getCanvasContainer();
  for (const ev of ['pointerdown', 'wheel', 'touchstart']) container.addEventListener(ev, interrupt, { passive: true });
  map.getCanvas().addEventListener('keydown', interrupt);

  function waitMoveEnd(signal) {
    return new Promise((resolve) => {
      const done = () => {
        map.off('moveend', done);
        signal.removeEventListener('abort', done);
        resolve();
      };
      map.on('moveend', done);
      signal.addEventListener('abort', done, { once: true });
    });
  }

  async function flyToPlace(place, signal, { speed = 0.8 } = {}) {
    const { zoom, pitch, bearing } = place.camera;
    map.flyTo({ center: place.lngLat, zoom, pitch, bearing, speed, curve: 1.5, maxDuration: 12000, essential: true });
    await waitMoveEnd(signal);
  }

  async function sweep(signal, degrees, durationMs) {
    map.easeTo({ bearing: map.getBearing() + degrees, duration: durationMs, easing: linear, essential: true });
    await waitMoveEnd(signal);
  }

  async function goto(place) {
    const signal = begin('goto');
    onTarget?.(place);
    try {
      await flyToPlace(place, signal, { speed: 1.1 });
    } finally {
      end(signal);
    }
  }

  async function orbit(place, degPerSecond = 8) {
    const signal = begin('orbit');
    if (place) {
      onTarget?.(place);
      await flyToPlace(place, signal, { speed: 1.1 });
      if (signal.aborted) return;
    }
    let last = performance.now();
    const step = (now) => {
      if (signal.aborted) return;
      const dt = (now - last) / 1000;
      last = now;
      map.jumpTo({ bearing: map.getBearing() + degPerSecond * dt });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  async function tour(places) {
    const signal = begin('tour');
    try {
      for (let i = 0; !signal.aborted; i++) {
        const place = places[i % places.length];
        onTarget?.(place);
        onCaption?.({ place, index: i % places.length, total: places.length });
        await flyToPlace(place, signal, { speed: 0.55 });
        if (signal.aborted) break;
        await sweep(signal, 45, 8000);
      }
    } finally {
      end(signal);
    }
  }

  return {
    goto,
    orbit,
    tour,
    stop,
    get mode() {
      return session?.kind ?? null;
    },
  };
}
