import { findPlace } from './places.js';
import { findSite } from './sl.js';

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const clean = (s) =>
  s
    .toLowerCase()
    .replace(/[.,!?]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Maps a Swedish utterance to a terminal command plus a spoken reply.
export function parseUtterance(raw, { sites }) {
  const t = clean(raw);
  let m;

  if ((m = t.match(/(?:avgångar|avgång|nästa (?:tåg|buss|tunnelbana)).*?(?:från|vid|på) (.+)$/))) {
    const site = sites && findSite(sites, m[1]);
    return site ? { cmd: `dep ${site.name}`, say: `Visar avgångar från ${site.name}` } : { say: `Hittar ingen hållplats som heter ${m[1]}` };
  }
  if ((m = t.match(/^(?:flyg|åk|ta mig|gå|visa|zooma)(?: mig)? (?:till|mot) (.+)$/))) {
    const place = findPlace(m[1]);
    if (place) return { cmd: `goto ${place.id}`, say: `Kurs satt mot ${place.name}` };
    const site = sites && findSite(sites, m[1]);
    if (site) return { cmd: `dep ${site.name}`, say: `Flyger till ${site.name}` };
    return { cmd: `adress ${m[1]}`, say: `Söker ${m[1]}` };
  }
  if ((m = t.match(/(?:snurra|cirkla|orbit)(?: runt)?(?: (.+))?$/))) {
    const place = m[1] && findPlace(m[1]);
    return { cmd: place ? `orbit ${place.id}` : 'orbit', say: place ? `Cirklar runt ${place.name}` : 'Cirklar' };
  }
  if (/^(?:stopp|stanna|avbryt|sluta)/.test(t)) return { cmd: 'stop', say: 'Stoppar' };
  if (/(?:var är jag|hitta mig|min position)/.test(t)) return { cmd: 'hittamig', say: 'Letar efter dig' };
  if (/ljus(?:t)? (?:läge|tema)/.test(t)) return { cmd: 'tema ljus', say: 'Ljust tema' };
  if (/mörk(?:t)? (?:läge|tema)/.test(t)) return { cmd: 'tema mörk', say: 'Mörkt tema' };
  if (/(?:automatiskt|auto) (?:läge|tema)/.test(t)) return { cmd: 'tema auto', say: 'Temat följer solen' };
  if (/(?:2d|två ?d|platt karta)/.test(t)) return { cmd: '2d on', say: 'Tvådimensionell vy' };
  if (/(?:3d|tre ?d)/.test(t)) return { cmd: '3d', say: 'Tredimensionell vy' };
  if (/(?:drönartur|tur(?:en)?$|rundtur)/.test(t)) return { cmd: 'tour', say: 'Startar drönarturen' };
  if (/zooma in/.test(t)) return { cmd: 'zoom+', say: 'Zoomar in' };
  if (/zooma ut/.test(t)) return { cmd: 'zoom-', say: 'Zoomar ut' };
  if (/(?:^hem|startvy)/.test(t)) return { cmd: 'home', say: 'Återvänder till startvyn' };
  if ((m = t.match(/låt det (regna|snöa|åska)|(?:simulera|visa) (regn|snö|dimma|åska)/))) {
    const word = m[1] ?? m[2];
    const fx = { regna: 'regn', snöa: 'snö', åska: 'åska' }[word] ?? word;
    return { cmd: `fx ${fx}`, say: `Simulerar ${fx}` };
  }
  if (/(?:riktigt väder|stäng av väder|vädret som vanligt)/.test(t)) return { cmd: 'fx auto', say: 'Visar riktigt väder' };
  if (/(?:väder|vädret|temperatur|regnar det)/.test(t)) return { cmd: 'weather', say: null, speakWeather: true };
  if ((m = t.match(/(?:klockan|tiden) (?:till )?(\d{1,2})(?:[:. ](\d{2}))?/))) {
    const hh = m[1].padStart(2, '0');
    const mm = m[2] ?? '00';
    return +hh < 24 && +mm < 60 ? { cmd: `time ${hh}:${mm}`, say: `Tiden satt till ${+hh} ${mm === '00' ? '' : mm}`.trim() } : { say: 'Ogiltig tid' };
  }
  if (/(?:realtid|återställ tiden|tiden nu)/.test(t)) return { cmd: 'time now', say: 'Realtid' };
  if (/(?:skuggor|solkoll|soltimmar)/.test(t)) return { cmd: 'sol on', say: 'Solkollen aktiv' };
  if (/(?:spela|guessr|gissa)/.test(t)) return { cmd: 'guessr', say: 'Startar Sthlm Guessr. Lycka till' };
  if (/(?:drönare|fpv|flygläge)/.test(t)) return { cmd: 'fpv', say: 'FPV aktiverat' };
  return { say: 'Jag uppfattade inte kommandot' };
}

export function createVoice({ button, bubble, handle }) {
  const supported = !!Recognition;
  let rec = null;
  let listening = false;
  let hideTimer = 0;

  if (!supported) {
    button.hidden = true;
    return { supported, speak() {} };
  }

  function show(text, final) {
    clearTimeout(hideTimer);
    bubble.hidden = false;
    bubble.textContent = text;
    bubble.classList.toggle('final', final);
    if (final) hideTimer = setTimeout(() => (bubble.hidden = true), 3500);
  }

  function speak(text) {
    if (!text || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'sv-SE';
    const voice = speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('sv'));
    if (voice) u.voice = voice;
    u.rate = 1.05;
    speechSynthesis.speak(u);
  }

  function setListening(on) {
    listening = on;
    button.setAttribute('aria-pressed', String(on));
  }

  function start() {
    rec = new Recognition();
    rec.lang = 'sv-SE';
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.continuous = false;
    rec.onresult = (e) => {
      const result = e.results[e.results.length - 1];
      const text = result[0].transcript;
      show(`"${text}"`, result.isFinal);
      if (result.isFinal) handle([...result].map((alt) => alt.transcript));
    };
    rec.onerror = (e) => {
      const reasons = { 'not-allowed': 'mikrofonen nekades', 'no-speech': 'hörde inget', network: 'taligenkänningen är inte nåbar' };
      show(`RÖST: ${reasons[e.error] ?? e.error}`, true);
    };
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
    show('Lyssnar…', false);
  }

  button.addEventListener('click', () => {
    if (listening) rec?.stop();
    else start();
  });

  return { supported, speak };
}
