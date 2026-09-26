import { escapeHtml } from './util.js';

const MAX_LINES = 200;

export function createTerminal({ log, form, input }) {
  const commands = new Map();
  const history = [];
  let historyIndex = 0;
  let completer = () => [];
  let guard = () => null;

  function print(text, kind = '') {
    const line = document.createElement('div');
    line.className = `tl ${kind}`;
    line.innerHTML = text;
    log.append(line);
    while (log.childElementCount > MAX_LINES) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
  }

  function register(name, { desc, usage, run }) {
    commands.set(name, { desc, usage: usage ?? name, run });
  }

  async function exec(raw) {
    const line = raw.trim();
    if (!line) return;
    print(`<span class="prompt">sthlm@mc:~$</span> ${escapeHtml(line)}`, 'echo');
    const [name, ...args] = line.split(/\s+/);
    const cmd = commands.get(name.toLowerCase());
    if (!cmd) {
      print(`kommando saknas: ${escapeHtml(name)} · skriv <b>help</b>`, 'err');
      return;
    }
    const blocked = guard(name.toLowerCase());
    if (blocked) {
      print(escapeHtml(blocked), 'err');
      return;
    }
    try {
      await cmd.run(args, line.slice(name.length).trim());
    } catch (err) {
      print(`FEL: ${escapeHtml(err.message ?? String(err))}`, 'err');
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value;
    input.value = '';
    if (value.trim()) {
      history.push(value);
      historyIndex = history.length;
    }
    exec(value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex];
    } else if (e.key === 'ArrowDown' && history.length) {
      e.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] ?? '';
    } else if (e.key === 'Tab') {
      e.preventDefault();
      complete();
    } else if (e.key === 'Escape') {
      input.blur();
    }
  });

  function complete() {
    const value = input.value;
    const parts = value.split(/\s+/);
    const candidates =
      parts.length <= 1
        ? [...commands.keys()].filter((c) => c.startsWith(parts[0].toLowerCase()))
        : completer(parts[0].toLowerCase(), parts.slice(1).join(' ').toLowerCase());
    if (candidates.length === 1) {
      input.value = parts.length <= 1 ? `${candidates[0]} ` : `${parts[0]} ${candidates[0]}`;
    } else if (candidates.length > 1) {
      print(candidates.map(escapeHtml).join('  '), 'dim');
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input && !(e.target instanceof HTMLInputElement)) {
      e.preventDefault();
      input.focus();
    }
  });

  return {
    print,
    register,
    exec,
    commands,
    setCompleter(fn) {
      completer = fn;
    },
    // fn(commandName) returns a reason string to refuse the command, or null.
    setGuard(fn) {
      guard = fn;
    },
  };
}
