// Musique de Noël jouée en boîte à musique, générée par le navigateur (aucun fichier).
// Mélodies du domaine public :
//  - « We Wish You a Merry Christmas » (chant traditionnel anglais)
//  - « Jingle Bells » (J. L. Pierpont, 1857)
//  - « Douce nuit » (F. X. Gruber, 1818)
//  - « Deck the Halls » (chant traditionnel gallois)
// La piste « ambiance » (par défaut) est une composition originale écrite pour ce site.
// La piste « jinglelive » reprend l'ambiance de la vidéo de présentation (Jingle Bells, 120 bpm, grelots).
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
const JINGLE_CHORUS = (() => {
  const a = [['E5', 1], ['E5', 1], ['E5', 2], ['E5', 1], ['E5', 1], ['E5', 2], ['E5', 1], ['G5', 1], ['C5', 1.5], ['D5', .5], ['E5', 4]];
  return [
    ...a,
    ['F5', 1], ['F5', 1], ['F5', 1.5], ['F5', .5], ['F5', 1], ['E5', 1], ['E5', 1], ['E5', .5], ['E5', .5],
    ['E5', 1], ['D5', 1], ['D5', 1], ['E5', 1], ['D5', 2], ['G5', 2],
    ...a,
    ['F5', 1], ['F5', 1], ['F5', 1], ['F5', 1], ['F5', 1], ['E5', 1], ['E5', 1], ['E5', .5], ['E5', .5],
    ['G5', 1], ['G5', 1], ['F5', 1], ['D5', 1], ['C5', 4],
  ];
})();
const JINGLE_CHORDS = ['C', 'C', 'C', 'C', 'F', 'C', 'G', 'G', 'C', 'C', 'C', 'C', 'F', 'C', 'G', 'C'];

// ----- « Ambiance de Noël » : composition originale, douce, faite pour tourner en boucle -----
// 16 mesures à 4 temps, ~76 bpm. Accords en Fa majeur, mélodie au célesta, nappes, basse, écho et réverbération.
const AMBIENT = {
  unit: 60 / 76,
  // [accord (notes de la nappe), basse, mélodie de la mesure]
  bars: [
    [['F3', 'A3', 'C4', 'E4'], 'F2', [['A5', 2], ['C6', 1], ['A5', 1]]],
    [['D3', 'F3', 'A3', 'C4'], 'D2', [['F5', 3], ['E5', .5], ['D5', .5]]],
    [['Bb3', 'D4', 'F4', 'A4'], 'Bb1', [['D5', 1], ['F5', 1], ['A5', 1.5], ['G5', .5]]],
    [['C4', 'E4', 'G4', 'C3'], 'C2', [['G5', 3], ['-', 1]]],
    [['F3', 'A3', 'C4', 'E4'], 'F2', [['A5', 1.5], ['Bb5', .5], ['C6', 2]]],
    [['A3', 'C4', 'E4', 'G4'], 'A1', [['E6', 2], ['C6', 1], ['A5', 1]]],
    [['Bb3', 'D4', 'F4', 'A4'], 'Bb1', [['Bb5', 1], ['A5', 1], ['F5', 1], ['D5', 1]]],
    [['G3', 'Bb3', 'D4', 'F4'], 'G1', [['G5', 2], ['E5', 2]]],
    [['D3', 'F3', 'A3', 'C4'], 'D2', [['F5', 1], ['A5', 1], ['D6', 2]]],
    [['Bb3', 'D4', 'F4', 'A4'], 'Bb1', [['C6', 1.5], ['Bb5', .5], ['A5', 2]]],
    [['F3', 'A3', 'C4', 'E4'], 'F2', [['A5', 1], ['G5', 1], ['F5', 1], ['C5', 1]]],
    [['C4', 'E4', 'G4', 'C3'], 'C2', [['E5', 3], ['-', 1]]],
    [['Bb3', 'D4', 'F4', 'A4'], 'Bb1', [['D5', 1], ['F5', 1], ['Bb5', 1], ['A5', 1]]],
    [['A3', 'C4', 'E4', 'G4'], 'A1', [['G5', 1.5], ['E5', .5], ['C5', 2]]],
    [['G3', 'Bb3', 'D4', 'F4'], 'G1', [['Bb4', 1], ['D5', 1], ['G5', 1], ['F5', 1]]],
    [['C4', 'F4', 'G4', 'C3'], 'C2', [['F5', 2], ['E5', 2]]],
  ],
};

const TRACKS = {
  noel: { engine: 'medley' },
  ambiance: { engine: 'ambient' },
  // Comme la vidéo : intro en arpèges, puis « Jingle Bells » à 120 bpm avec grelots
  jinglelive: {
    unit: 0.5,
    bells: true,
    melody: [
      ...[['C5', .5], ['E5', .5], ['G5', .5], ['C6', .5], ['G5', .5], ['E5', .5], ['G5', .5], ['C6', .5]],
      ...[['A4', .5], ['C5', .5], ['F5', .5], ['A5', .5], ['F5', .5], ['C5', .5], ['F5', .5], ['A5', .5]],
      ...[['C5', .5], ['E5', .5], ['G5', .5], ['C6', .5], ['G5', .5], ['E5', .5], ['G5', .5], ['C6', .5]],
      ...[['B4', .5], ['D5', .5], ['G5', .5], ['B5', .5], ['D6', 1], ['G5', 1]],
      ...JINGLE_CHORUS,
      ['-', 4],
    ],
    bass: [
      ['C3', 4], ['F3', 4], ['C3', 4], ['G3', 4],
      ...JINGLE_CHORDS.flatMap((c) => ({ C: [['C3', 1], ['G3', 1], ['E3', 1], ['G3', 1]], F: [['F3', 1], ['C4', 1], ['A3', 1], ['C4', 1]], G: [['G3', 1], ['D4', 1], ['B3', 1], ['D4', 1]] }[c])),
      ['C3', 4],
    ],
  },
  deckhalls: {
    unit: 0.32,
    melody: (() => {
      const a = [
        ['C6', 1.5], ['Bb5', .5], ['A5', 1], ['G5', 1],
        ['F5', 1], ['G5', 1], ['A5', 1], ['F5', 1],
        ['G5', .5], ['A5', .5], ['Bb5', .5], ['G5', .5], ['A5', 1.5], ['G5', .5],
        ['F5', 1], ['E5', 1], ['F5', 2],
      ];
      return [
        ...a, ...a,
        ['G5', 1.5], ['A5', .5], ['Bb5', 1], ['G5', 1],
        ['A5', 1.5], ['Bb5', .5], ['C6', 1], ['G5', 1],
        ['A5', .5], ['B5', .5], ['C6', 1], ['D6', .5], ['E6', .5], ['F6', 1],
        ['E6', 1], ['D6', 1], ['C6', 2],
        ['C6', 1.5], ['Bb5', .5], ['A5', 1], ['G5', 1],
        ['F5', 1], ['G5', 1], ['A5', 1], ['F5', 1],
        ['D6', .5], ['D6', .5], ['D6', .5], ['D6', .5], ['C6', 1.5], ['Bb5', .5],
        ['A5', 1], ['G5', 1], ['F5', 2], ['-', 2],
      ];
    })(),
    bass: [
      ...[['F3', 2], ['C3', 2], ['F3', 2], ['C3', 2], ['C3', 2], ['G3', 2], ['C3', 2], ['F3', 2]],
      ...[['F3', 2], ['C3', 2], ['F3', 2], ['C3', 2], ['C3', 2], ['G3', 2], ['C3', 2], ['F3', 2]],
      ['C3', 2], ['G3', 2], ['F3', 2], ['C3', 2], ['C3', 2], ['G3', 2], ['G3', 2], ['C3', 2],
      ['F3', 2], ['C3', 2], ['F3', 2], ['C3', 2], ['Bb3', 2], ['F3', 2], ['C3', 2], ['F3', 2], ['-', 2],
    ],
  },
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

// ----- « Chants de Noël » : enchaînement de chants traditionnels (domaine public) -----
// Célesta + glockenspiel, nappes chaudes, basse, grelots, écho et réverbération.
const CHORD_NOTES = {
  C: ['C4', 'E4', 'G4'], F: ['F3', 'A3', 'C4'], G: ['G3', 'B3', 'D4'], G7: ['G3', 'B3', 'F4'], Am: ['A3', 'C4', 'E4'],
  Em: ['E3', 'G3', 'B3'], A7: ['A3', 'C#4', 'G4'], D: ['D3', 'F#3', 'A3'], B7: ['B3', 'D#4', 'A4'], Bb: ['Bb3', 'D4', 'F4'],
};
const CHORD_BASS = { C: ['C2', 'G2'], F: ['F2', 'C3'], G: ['G2', 'D3'], G7: ['G2', 'D3'], Am: ['A2', 'E3'], Em: ['E2', 'B2'], A7: ['A2', 'E3'], D: ['D2', 'A2'], B7: ['B1', 'F#2'], Bb: ['Bb1', 'F2'] };
const MEDLEY = [
  { unit: 0.44, bells: true, bounce: true, melody: JINGLE_CHORUS, chords: JINGLE_CHORDS.map((c) => [c, 4]) },
  { unit: 0.42, bells: true, bounce: true,
    melody: [...TRACKS.wewish.melody, ...TRACKS.wewish.melody],
    chords: (() => { const one = [['-', 1], ['G', 3], ['C', 3], ['A7', 3], ['D', 3], ['B7', 3], ['Em', 3], ['C', 1.5], ['D', 1.5], ['G', 3], ['-', 1]]; return [...one, ...one]; })() },
  { unit: 0.34, bells: true, bounce: true, melody: TRACKS.deckhalls.melody,
    chords: [['F', 4], ['F', 4], ['C', 4], ['F', 4], ['F', 4], ['F', 4], ['C', 4], ['F', 4],
      ['C', 4], ['F', 4], ['C', 4], ['G', 2], ['C', 2], ['F', 4], ['F', 4], ['Bb', 4], ['C', 2], ['F', 2], ['-', 2]] },
  { unit: 0.26, bells: false, bounce: false, melody: TRACKS.doucenuit.melody,
    chords: [['C', 12], ['C', 12], ['G7', 12], ['C', 12], ['F', 12], ['C', 12], ['F', 12], ['C', 12], ['G7', 12], ['C', 12], ['C', 6], ['G7', 6], ['C', 12], ['-', 6]] },
];

export function createMusic({ url, track, renderSeconds } = {}) {
  const T = TRACKS[track] || TRACKS.noel;
  let ctx = null, master = null, playing = false, timer = null, audioEl = null;
  let reverb = null, echo = null, loopIndex = 0;

  // ----- Effets : réverbération (salle) + écho doux -----
  function setupFx() {
    const len = ctx.sampleRate * 3.6;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    conv.connect(wet).connect(master);
    reverb = conv;
    const d = ctx.createDelay(2); d.delayTime.value = AMBIENT.unit * 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 3200;
    d.connect(tone).connect(fb).connect(d);
    const echoOut = ctx.createGain(); echoOut.gain.value = 0.35;
    tone.connect(echoOut); echoOut.connect(master); echoOut.connect(reverb);
    echo = d;
  }

  // Célesta : son de clochette doux, envoyé dans l'écho et la réverbération
  function celesta(f, t, dur, vol) {
    const out = ctx.createGain(); out.gain.value = 1;
    out.connect(master); out.connect(reverb); out.connect(echo);
    [[1, 1], [2, .28], [3, .08], [4.1, .04]].forEach(([mult, g]) => {
      const o = ctx.createOscillator(), gain = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * mult;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol * g, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(1.2, dur * 2.2) / (mult > 1 ? 1.6 : 1));
      o.connect(gain).connect(out);
      o.start(t); o.stop(t + Math.max(1.3, dur * 2.3));
    });
  }

  // Nappe chaude : oscillateurs légèrement désaccordés, filtrés, attaque et relâche lentes
  function pad(notes, t, dur, vol) {
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 900; filt.Q.value = 0.4;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(vol, t + 1.4);
    env.gain.setValueAtTime(vol, t + dur - 0.2);
    env.gain.linearRampToValueAtTime(0.0001, t + dur + 1.8);
    filt.connect(env); env.connect(master); env.connect(reverb);
    for (const n of notes) {
      for (const det of [-7, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = freq(n); o.detune.value = det;
        o.connect(filt); o.start(t); o.stop(t + dur + 2);
      }
    }
  }

  function bassNote(n, t, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq(n);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.8);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 1);
  }

  // Petits grelots très doux en début de phrase
  function shimmer(t) {
    const len = ctx.sampleRate * 1.2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2) * (0.5 + 0.5 * Math.sin(i / 900));
    const src = ctx.createBufferSource(); src.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.value = 0.12;
    src.connect(hp).connect(g); g.connect(master); g.connect(reverb);
    src.start(t);
  }

  let songIndex = 0;
  function scheduleSong(start) {
    const song = MEDLEY[songIndex % MEDLEY.length];
    const round = Math.floor(songIndex / MEDLEY.length);
    songIndex++;
    const u = song.unit;
    shimmer(start);
    // Mélodie : célesta + glockenspiel une octave au-dessus (plus discret)
    let t = start;
    for (const [note, d] of song.melody) {
      if (note !== '-') {
        const f = freq(note);
        celesta(f, t, d * u, 0.26);
        if (song.bells || round % 2 === 1) celesta(f * 2, t, d * u, 0.05);
      }
      t += d * u;
    }
    const melEnd = t;
    // Accords : nappe + basse (rebondissante sur les chants rythmés)
    t = start;
    for (const [c, beats] of song.chords) {
      const dur = beats * u;
      if (c !== '-') {
        pad(CHORD_NOTES[c], t, dur, song.bounce ? 0.011 : 0.016);
        if (song.bounce) {
          for (let b = 0; b < beats; b++) bassNote(CHORD_BASS[c][b % 2], t + b * u, u * 0.6);
        } else {
          bassNote(CHORD_BASS[c][0], t, dur);
        }
      }
      t += dur;
    }
    // Grelots sur les chants rythmés
    if (song.bells) {
      for (let b = 0; b * u < melEnd - start - u; b += 0.5) bell(start + b * u, b % 1 === 0 ? (b % 2 === 0 ? 0.2 : 0.14) : 0.08);
    }
    return Math.max(melEnd, t) + u; // petite respiration entre deux chants
  }

  function scheduleAmbient(start) {
    const u = AMBIENT.unit;
    const n = loopIndex++;
    // Variations : 1re boucle = intro sans mélodie au début, puis mélodie normale,
    // une boucle sur trois en version « étoiles » (sans mélodie), une sur deux une octave plus haut.
    const withMelody = n % 3 !== 2;
    const octaveUp = n % 2 === 1;
    AMBIENT.bars.forEach(([chord, bass, mel], i) => {
      const t = start + i * 4 * u;
      pad(chord, t, 4 * u, 0.018);
      bassNote(bass, t, 4 * u);
      if (i % 4 === 0) shimmer(t);
      const playMel = withMelody && !(n === 0 && i < 4);
      if (playMel) {
        let tt = t;
        for (const [note, d] of mel) {
          if (note !== '-') {
            const f = freq(note) * (octaveUp ? 2 : 1);
            celesta(f, tt, d * u, octaveUp ? 0.16 : 0.24);
          }
          tt += d * u;
        }
      }
      // Étincelles : quelques notes de l'accord, au hasard, très douces
      const sparks = playMel ? (Math.random() < 0.5 ? 1 : 0) : 2 + Math.floor(Math.random() * 2);
      for (let k = 0; k < sparks; k++) {
        const note = chord[Math.floor(Math.random() * chord.length)];
        const f = freq(note) * (Math.random() < 0.5 ? 4 : 8);
        if (f > 3000) continue;
        celesta(f, t + Math.floor(Math.random() * 8) * u / 2, u, 0.07);
      }
    });
    return start + AMBIENT.bars.length * 4 * u;
  }

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

  // Grelots : petit bruit aigu très court, sur chaque temps (plus fort sur les temps forts)
  let noise = null;
  function bell(t, vol) {
    if (!noise) {
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    }
    const src = ctx.createBufferSource(); src.buffer = noise;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6500;
    const bp = ctx.createBiquadFilter(); bp.type = 'peaking'; bp.frequency.value = 9000; bp.gain.value = 8;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(hp).connect(bp).connect(g).connect(master);
    src.start(t);
  }

  function scheduleLoop(start) {
    const end = Math.max(playLine(T.melody, start, 0.5), playLine(T.bass, start, 0.22));
    if (T.bells) {
      // les grelots commencent avec le refrain (après l'intro de 16 temps)
      const introBeats = 16;
      for (let b = introBeats; b * T.unit < end - start - 2 * T.unit; b += 0.5) {
        bell(start + b * T.unit, b % 1 === 0 ? (b % 2 === 0 ? 0.55 : 0.4) : 0.22);
      }
    }
    return end;
  }

  function startSynth() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    const rich = T.engine === 'ambient' || T.engine === 'medley';
    master.gain.value = rich ? 0.0001 : VOLUME;
    master.connect(ctx.destination);
    try { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); } catch { /* contexte hors ligne */ }
    if (rich) {
      setupFx();
      master.gain.linearRampToValueAtTime(T.engine === 'medley' ? 0.6 : 0.95, ctx.currentTime + 3); // fondu d'entrée
    }
    let next = ctx.currentTime + 0.1;
    // Pré-écoute (rendu hors ligne) : tout programmer d'un coup
    if (renderSeconds) {
      while (next < renderSeconds) next = T.engine === 'ambient' ? scheduleAmbient(next) : T.engine === 'medley' ? scheduleSong(next) : scheduleLoop(next);
      return;
    }
    const loop = () => {
      // on programme la boucle suivante un peu avant la fin de la précédente
      if (ctx && next - ctx.currentTime < 4) {
        next = T.engine === 'ambient' ? scheduleAmbient(next) : T.engine === 'medley' ? scheduleSong(next) : scheduleLoop(next);
      }
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
    // true si le navigateur a bloqué le son (aucune interaction encore)
    get blocked() {
      if (!playing) return false;
      if (audioEl) return audioEl.paused;
      return !ctx || ctx.state !== 'running';
    },
    unlock() {
      if (audioEl) return audioEl.play().catch(() => {});
      if (ctx && ctx.state !== 'running') return ctx.resume();
      return Promise.resolve();
    },
    play() {
      if (playing) return;
      playing = true;
      if (url) {
        if (!audioEl) { audioEl = new Audio(url); audioEl.loop = true; audioEl.volume = 0.4; }
        audioEl.play().catch(() => { /* bloqué : on réessaiera au premier geste */ });
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
