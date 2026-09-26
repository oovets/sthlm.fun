import { cameraAltitudeMeters, cameraFromPose, compass } from './util.js';

const RAD = Math.PI / 180;
const CRUISE_MS = 45;
const BOOST_MS = 170;
const CLIMB_MS = 25;
const MIN_ALT = 20;
const MAX_ALT = 3000;
const MIN_LOOK = 5;
const MAX_LOOK = 80;
const DEADZONE = 0.15;
const TAPE_PX_PER_DEG = 4;
const LADDER_PX_PER_DEG = 5;
const HANDLERS = ['dragPan', 'dragRotate', 'scrollZoom', 'keyboard', 'touchZoomRotate', 'touchPitch', 'doubleClickZoom', 'boxZoom'];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const dz = (v) => (Math.abs(v) < DEADZONE ? 0 : v);

export function createFpv({ map, root, onStart, onEnd }) {
  const $ = (sel) => root.querySelector(sel);
  const canvas = map.getCanvas();
  const keys = new Set();
  let active = false;
  let raf = 0;
  let last = 0;
  let saved = null;
  let tilt = null;
  let tiltBase = null;
  const lift = { touch: 0 };
  const s = { lng: 0, lat: 0, alt: 150, heading: 0, look: 20, ve: 0, vn: 0, vz: 0 };

  buildTape();
  buildLadder();

  function buildTape() {
    const tape = $('#fpv-tape');
    const parts = [];
    for (let d = -360; d <= 720; d += 5) {
      const deg = ((d % 360) + 360) % 360;
      const major = deg % 30 === 0;
      const label = major ? (deg % 90 === 0 ? compass(deg) : String(deg).padStart(3, '0')) : '';
      parts.push(`<span class="${major ? 'maj' : ''}" style="left:${(d + 360) * TAPE_PX_PER_DEG}px">${label}</span>`);
    }
    tape.innerHTML = parts.join('');
  }

  function buildLadder() {
    const parts = [];
    for (let a = 0; a <= 90; a += 10) {
      parts.push(`<div class="rung${a === 0 ? ' horizon' : ''}" style="top:${a * LADDER_PX_PER_DEG}px"><span>${a === 0 ? 'HOR' : `-${a}`}</span></div>`);
    }
    $('#fpv-ladder').innerHTML = parts.join('');
  }

  function applyCamera() {
    map.jumpTo(cameraFromPose(map, { ...s, look: clamp(s.look, MIN_LOOK, MAX_LOOK) }));
  }

  function readGamepad() {
    const pad = [...(navigator.getGamepads?.() ?? [])].find(Boolean);
    if (!pad) return null;
    return {
      strafe: dz(pad.axes[0] ?? 0),
      forward: -dz(pad.axes[1] ?? 0),
      yaw: dz(pad.axes[2] ?? 0),
      look: dz(pad.axes[3] ?? 0),
      lift: (pad.buttons[7]?.value ?? 0) - (pad.buttons[6]?.value ?? 0),
      boost: !!pad.buttons[0]?.pressed,
    };
  }

  function frame(t) {
    if (!active) return;
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    const k = (code) => (keys.has(code) ? 1 : 0);
    const pad = readGamepad();

    let forward = k('KeyW') - k('KeyS');
    let strafe = k('KeyD') - k('KeyA');
    let climb = k('KeyE') + k('Space') - k('KeyQ') - k('KeyC') + lift.touch;
    let yawRate = (k('ArrowRight') - k('ArrowLeft')) * 70;
    let lookRate = (k('ArrowDown') - k('ArrowUp')) * 40;
    let boost = keys.has('ShiftLeft') || keys.has('ShiftRight');

    if (pad) {
      forward += pad.forward;
      strafe += pad.strafe;
      climb += pad.lift;
      yawRate += pad.yaw * 90;
      lookRate += pad.look * 50;
      boost ||= pad.boost;
    }
    if (tilt && tiltBase) {
      forward += clamp((tilt.beta - tiltBase.beta) / -25, -1, 1);
      yawRate += clamp((tilt.gamma - tiltBase.gamma) / 25, -1, 1) * 70;
    }

    s.heading = (((s.heading + yawRate * dt) % 360) + 360) % 360;
    s.look = clamp(s.look + lookRate * dt, MIN_LOOK, MAX_LOOK);

    const speed = boost ? BOOST_MS : CRUISE_MS;
    const h = s.heading * RAD;
    const f = clamp(forward, -1, 1);
    const r = clamp(strafe, -1, 1);
    const targetE = (Math.sin(h) * f + Math.cos(h) * r) * speed;
    const targetN = (Math.cos(h) * f - Math.sin(h) * r) * speed;
    const targetZ = clamp(climb, -1, 1) * CLIMB_MS * (boost ? 2.5 : 1);
    const a = Math.min(1, dt * 2.5);
    s.ve += (targetE - s.ve) * a;
    s.vn += (targetN - s.vn) * a;
    s.vz += (targetZ - s.vz) * a;

    s.lat += (s.vn * dt) / 110540;
    s.lng += (s.ve * dt) / (111320 * Math.cos(s.lat * RAD));
    s.alt = clamp(s.alt + s.vz * dt, MIN_ALT, MAX_ALT);

    applyCamera();
    paintHud();
    raf = requestAnimationFrame(frame);
  }

  function paintHud() {
    const spd = Math.hypot(s.ve, s.vn, s.vz) * 3.6;
    $('#fpv-spd').textContent = Math.round(spd);
    $('#fpv-alt').textContent = Math.round(s.alt);
    $('#fpv-vs').textContent = `${s.vz >= 0 ? '+' : ''}${s.vz.toFixed(1)}`;
    $('#fpv-hdg').textContent = String(Math.round(s.heading) % 360).padStart(3, '0');
    const tapeWidth = $('#fpv-heading').clientWidth;
    $('#fpv-tape').style.transform = `translateX(${tapeWidth / 2 - (s.heading + 360) * TAPE_PX_PER_DEG}px)`;
    $('#fpv-ladder').style.transform = `translateY(${-s.look * LADDER_PX_PER_DEG}px)`;
    $('#fpv-pos').textContent = `${s.lat.toFixed(5)}N ${s.lng.toFixed(5)}E`;
    $('#fpv-warn').hidden = !(s.alt < 45 && s.vz <= 0.5);
  }

  const isTyping = (e) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

  function onKeyDown(e) {
    if (!active || isTyping(e)) return;
    if (e.code === 'Escape' && document.pointerLockElement !== canvas) {
      stop();
      return;
    }
    keys.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  }
  const onKeyUp = (e) => keys.delete(e.code);
  const onBlur = () => keys.clear();

  function onMouseMove(e) {
    if (!active) return;
    const locked = document.pointerLockElement === canvas;
    if (!locked && !(e.buttons & 1)) return;
    s.heading = (((s.heading + e.movementX * 0.15) % 360) + 360) % 360;
    s.look = clamp(s.look + e.movementY * 0.12, MIN_LOOK, MAX_LOOK);
  }

  function onCanvasClick() {
    if (active && document.pointerLockElement !== canvas && matchMedia('(pointer: fine)').matches) canvas.requestPointerLock?.();
  }

  function onTilt(e) {
    if (e.beta == null) return;
    tilt = { beta: e.beta, gamma: e.gamma };
    tiltBase ??= { ...tilt };
  }

  async function enableTilt() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') return;
      }
      tiltBase = null;
      addEventListener('deviceorientation', onTilt);
      $('#fpv-tilt').textContent = 'KALIBRERA LUTNING';
    } catch {
      $('#fpv-tilt').textContent = 'LUTNING EJ TILLGÄNGLIG';
    }
  }

  for (const btn of root.querySelectorAll('[data-lift]')) {
    const v = Number(btn.dataset.lift);
    btn.addEventListener('pointerdown', () => (lift.touch = v));
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, () => (lift.touch = 0));
  }
  $('#fpv-tilt').addEventListener('click', () => (tilt ? (tiltBase = { ...tilt }) : enableTilt()));
  $('#fpv-exit').addEventListener('click', () => stop());

  function start() {
    if (active) return;
    onStart?.();
    const c = map.getCenter();
    const alt = cameraAltitudeMeters(map);
    const pitch = map.getPitch();
    const back = alt * Math.tan(pitch * RAD);
    const bearing = map.getBearing();
    s.lat = c.lat - (Math.cos(bearing * RAD) * back) / 110540;
    s.lng = c.lng - (Math.sin(bearing * RAD) * back) / (111320 * Math.cos(c.lat * RAD));
    s.alt = clamp(alt > 1200 ? 250 : alt, MIN_ALT, MAX_ALT);
    s.heading = ((bearing % 360) + 360) % 360;
    s.look = clamp(90 - pitch, 12, 35);
    s.ve = s.vn = s.vz = 0;

    saved = Object.fromEntries(HANDLERS.map((h) => [h, map[h].isEnabled()]));
    for (const h of HANDLERS) map[h].disable();
    addEventListener('keydown', onKeyDown, true);
    addEventListener('keyup', onKeyUp, true);
    addEventListener('blur', onBlur);
    addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onCanvasClick);
    active = true;
    root.hidden = false;
    document.body.classList.add('fpv');
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(raf);
    keys.clear();
    lift.touch = 0;
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    removeEventListener('keydown', onKeyDown, true);
    removeEventListener('keyup', onKeyUp, true);
    removeEventListener('blur', onBlur);
    removeEventListener('mousemove', onMouseMove);
    removeEventListener('deviceorientation', onTilt);
    canvas.removeEventListener('click', onCanvasClick);
    tilt = null;
    tiltBase = null;
    for (const [h, on] of Object.entries(saved ?? {})) if (on) map[h].enable();
    root.hidden = true;
    document.body.classList.remove('fpv');
    onEnd?.();
  }

  return {
    start,
    stop,
    get active() {
      return active;
    },
  };
}
