// Musique de Noël.
// Par défaut : « Jingle Bells » (J. L. Pierpont, 1857, domaine public) jouée en boîte à musique,
// générée directement par le navigateur (aucun fichier). Si un MP3 est configuré dans l'admin, il est utilisé à la place.
// Les navigateurs interdisent le son avant une interaction : la musique démarre au premier clic / toucher.

const N = { C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0 };

// [note, durée en temps]
const A1 = [['E5',1],['E5',1],['E5',2],['E5',1],['E5',1],['E5',2],['E5',1],['G5',1],['C5',1.5],['D5',.5],['E5',4]];
const MELODY = [
  ...A1,
  ['F5',1],['F5',1],['F5',1.5],['F5',.5],['F5',1],['E5',1],['E5',1],['E5',.5],['E5',.5],
  ['E5',1],['D5',1],['D5',1],['E5',1],['D5',2],['G5',2],
  ...A1,
  ['F5',1],['F5',1],['F5',1],['F5',1],['F5',1],['E5',1],['E5',1],['E5',.5],['E5',.5],
  ['G5',1],['G5',1],['F5',1],['D5',1],['C5',4],
];
// Basse : une note fondamentale + quinte par mesure (4 temps)
const CHORDS = ['C','C','C','C','F','C','G','G','C','C','C','C','F','C','G','C'];
const BASS = { C: ['C3','G3'], F: ['F3','C3'], G: ['G3','D3'] };

const BEAT = 0.42;       // secondes par temps
const VOLUME = 0.16;

export function createMusic({ url } = {}) {
  let ctx = null, master = null, playing = false, timer = null, audioEl = null;

  function chime(freq, t, dur, vol) {
    // son de clochette : fondamentale + harmoniques avec décroissance
    [[1, 1], [2, .35], [3, .12], [4.2, .06]].forEach(([mult, g]) => {
      const o = ctx.createOscillator();
      const gain = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq * mult;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol * g, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.6, dur * 1.6));
      o.connect(gain).connect(master);
      o.start(t); o.stop(t + Math.max(0.7, dur * 1.7));
    });
  }

  function scheduleLoop(start) {
    let t = start;
    for (const [n, d] of MELODY) { chime(N[n], t, d * BEAT, 0.5); t += d * BEAT; }
    CHORDS.forEach((c, i) => {
      const bar = start + i * 4 * BEAT;
      chime(N[BASS[c][0]], bar, 2 * BEAT, 0.28);
      chime(N[BASS[c][1]], bar + 2 * BEAT, 2 * BEAT, 0.2);
    });
    return t + 2 * BEAT; // petite pause avant de recommencer
  }

  function startSynth() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = VOLUME;
      master.connect(ctx.destination);
    }
    ctx.resume();
    master.gain.setTargetAtTime(VOLUME, ctx.currentTime, 0.1);
    let next = ctx.currentTime + 0.1;
    const loop = () => {
      // on programme la boucle suivante un peu avant la fin de la précédente
      if (next - ctx.currentTime < 3) next = scheduleLoop(next);
      timer = setTimeout(loop, 1000);
    };
    loop();
  }

  function stopSynth() {
    clearTimeout(timer);
    if (ctx) {
      master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
      setTimeout(() => { if (!playing) ctx.suspend(); }, 600);
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
        // si le contexte avait été suspendu, on recrée une programmation propre
        if (ctx) { ctx.close(); ctx = null; }
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
