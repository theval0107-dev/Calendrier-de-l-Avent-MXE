// Musique de Noël jouée en boîte à musique, générée par le navigateur (aucun fichier).
// Mélodies du domaine public :
//  - « We Wish You a Merry Christmas » (chant traditionnel anglais)
//  - « Jingle Bells » (J. L. Pierpont, 1857)
//  - « Douce nuit » (F. X. Gruber, 1818)
// Si un MP3 est configuré dans l'admin, il est utilisé à la place.
// Les navigateurs interdisent le son avant une interaction : la musique démarre au premier clic / toucher.

const SEMI = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
function freq(note) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(note);
  if (!m) return 0;
  const n = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * Math.pow(2, n / 12);
}

// Chaque morceau : unité de temps (secondes), mélodie et basse sous forme [note, durée]
const TRACKS = {
  wewish: {
    unit: 0.4,
    melody: [
      ['D5', 1],
      ['G5', 1], ['G5', .5], ['A5', .5], ['G5', .5], ['F#5', .5],
      ['E5', 1], ['C5', 1], ['E5', 1],
      ['A5', 1], ['A5', .5], ['B5', .5], ['A5', .5], ['G5', .5],
      ['F#5', 1], ['D5', 1], ['D5', 1],
      ['B5', 1], ['B5', .5], ['C6', .5], ['B5', .5], ['A5', .5],
      ['G5', 1], ['E5', 1], ['D5', .5], ['D5', .5],
      ['E5', 1], ['A5', 1], ['F#5', 1],
      ['G5', 3], ['-', 1],
    ],
    bass: [
      ['-', 1],
      ['G3', 3], ['C3', 3], ['A3', 3], ['D3', 3], ['B3', 3], ['E3', 3], ['C3', 1.5], ['D3', 1.5], ['G3', 3], ['-', 1],
    ],
  },
  jingle: {
    unit: 0.42,
    melody: (() => {
      const a = [['E5', 1], ['E5', 1], ['E5', 2], ['E5', 1], ['E5', 1], ['E5', 2], ['E5', 1], ['G5', 1], ['C5', 1.5], ['D5', .5], ['E5', 4]];
      return [
        ...a,
        ['F5', 1], ['F5', 1], ['F5', 1.5], ['F5', .5], ['F5', 1], ['E5', 1], ['E5', 1], ['E5', .5], ['E5', .5],
        ['E5', 1], ['D5', 1], ['D5', 1], ['E5', 1], ['D5', 2], ['G5', 2],
        ...a,
        ['F5', 1], ['F5', 1], ['F5', 1], ['F5', 1], ['F5', 1], ['E5', 1], ['E5', 1], ['E5', .5], ['E5', .5],
        ['G5', 1], ['G5', 1], ['F5', 1], ['D5', 1], ['C5', 4], ['-', 2],
      ];
    })(),
    bass: ['C', 'C', 'C', 'C', 'F', 'C', 'G', 'G', 'C', 'C', 'C', 'C', 'F', 'C', 'G', 'C']
      .flatMap((c) => ({ C: [['C3', 2], ['G3', 2]], F: [['F3', 2], ['C3', 2]], G: [['G3', 2], ['D3', 2]] }[c])),
  },
  doucenuit: {
    unit: 0.24,
    melody: [
      ['G5', 3], ['A5', 1], ['G5', 2], ['E5', 6],
      ['G5', 3], ['A5', 1], ['G5', 2], ['E5', 6],
      ['D6', 4], ['D6', 2], ['B5', 6],
      ['C6', 4], ['C6', 2], ['G5', 6],
      ['A5', 4], ['A5', 2], ['C6', 3], ['B5', 1], ['A5', 2],
      ['G5', 3], ['A5', 1], ['G5', 2], ['E5', 6],
      ['A5', 4], ['A5', 2], ['C6', 3], ['B5', 1], ['A5', 2],
      ['G5', 3], ['A5', 1], ['G5', 2], ['E5', 6],
      ['D6', 4], ['D6', 2], ['F6', 3], ['D6', 1], ['B5', 2],
      ['C6', 6], ['E6', 6],
      ['C6', 3], ['G5', 1], ['E5', 2], ['G5', 3], ['F5', 1], ['D5', 2],
      ['C5', 12], ['-', 6],
    ],
    bass: [
      ['C3', 12], ['C3', 12], ['G3', 12], ['C3', 12], ['F3', 12], ['C3', 12], ['F3', 12], ['C3', 12],
      ['G3', 12], ['C3', 12], ['G3', 6], ['G3', 6], ['C3', 12], ['-', 6],
    ],
  },
};

const VOLUME = 0.16;

export function createMusic({ url, track } = {}) {
  const T = TRACKS[track] || TRACKS.wewish;
  let ctx = null, master = null, playing = false, timer = null, audioEl = null;

  function chime(f, t, dur, vol) {
    // son de clochette : fondamentale + harmoniques avec décroissance
    [[1, 1], [2, .35], [3, .12], [4.2, .06]].forEach(([mult, g]) => {
      const o = ctx.createOscillator();
      const gain = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f * mult;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol * g, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.6, dur * 1.6));
      o.connect(gain).connect(master);
      o.start(t); o.stop(t + Math.max(0.7, dur * 1.7));
    });
  }

  function playLine(line, start, vol) {
    let t = start;
    for (const [n, d] of line) {
      const dur = d * T.unit;
      if (n !== '-') chime(freq(n), t, dur, vol);
      t += dur;
    }
    return t;
  }

  function scheduleLoop(start) {
    return Math.max(playLine(T.melody, start, 0.5), playLine(T.bass, start, 0.25));
  }

  function startSynth() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = VOLUME;
    master.connect(ctx.destination);
    ctx.resume();
    let next = ctx.currentTime + 0.1;
    const loop = () => {
      // on programme la boucle suivante un peu avant la fin de la précédente
      if (ctx && next - ctx.currentTime < 3) next = scheduleLoop(next);
      timer = setTimeout(loop, 1000);
    };
    loop();
  }

  function stopSynth() {
    clearTimeout(timer);
    if (ctx) {
      const c = ctx; ctx = null;
      master.gain.setTargetAtTime(0.0001, c.currentTime, 0.15);
      setTimeout(() => c.close(), 600);
    }
  }

  return {
    get playing() { return playing; },
    play() {
      if (playing) return;
      playing = true;
      if (url) {
        if (!audioEl) { audioEl = new Audio(url); audioEl.loop = true; audioEl.volume = 0.4; }
        audioEl.play().catch(() => { playing = false; });
      } else {
        startSynth();
      }
    },
    stop() {
      if (!playing) return;
      playing = false;
      if (audioEl) audioEl.pause(); else stopSynth();
    },
  };
}
