// ===== Zelda RPG Tracker — Sound System (Web Audio API) =====
(function () {
  let ac = null;
  function getAc() {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    return ac;
  }

  // Einzelner Ton: freq Hz, duration s, type, gain, delay s
  function tone(freq, duration, type = 'sine', gain = 0.25, delay = 0) {
    const a = getAc();
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.connect(g);
    g.connect(a.destination);
    osc.frequency.value = freq;
    osc.type = type;
    const t = a.currentTime + delay;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  // Arpeggio: Array von [freq, delay]
  function arp(notes, type = 'sine', gain = 0.25) {
    notes.forEach(([freq, delay]) => tone(freq, 0.18, type, gain, delay));
  }

  // ── Sounds ────────────────────────────────────────────────────

  // XP Gain — ändert sich je nach Streak
  // streak 0     : kurzer Blip (C5)
  // streak 1–4   : E5 leicht heller
  // streak 5–9   : Zweiklang G5+C6
  // streak 10–19 : Dreiklang C5+E5+G5 schnell
  // streak 20+   : epischer Dreiklang mit Oberton
  window.sfx = {
    xpGain(streak = 0) {
      if (streak <= 0) {
        tone(523, 0.09, 'sine', 0.22);
      } else if (streak <= 4) {
        tone(659, 0.11, 'sine', 0.24);
      } else if (streak <= 9) {
        tone(784, 0.13, 'sine', 0.22);
        tone(1047, 0.10, 'sine', 0.14, 0.04);
      } else if (streak <= 19) {
        arp([[523, 0], [659, 0.05], [784, 0.10]], 'triangle', 0.22);
      } else {
        arp([[523, 0], [659, 0.04], [784, 0.08], [1047, 0.12]], 'triangle', 0.26);
      }
    },

    // Level Up — aufsteigendes Zelda-artiges Arpeggio
    levelUp() {
      arp([
        [523, 0],
        [659, 0.09],
        [784, 0.18],
        [1047, 0.27],
        [1319, 0.36],
      ], 'sine', 0.28);
      // Sustain-Akkord am Ende
      setTimeout(() => {
        tone(523, 0.5, 'sine', 0.18);
        tone(659, 0.5, 'sine', 0.12);
        tone(784, 0.5, 'sine', 0.10);
      }, 480);
    },

    // Streak-Anstieg — kurzes, aufsteigendes Blip-Paar
    streakUp(streak) {
      const base = 440 + Math.min(streak * 12, 300);
      tone(base, 0.07, 'square', 0.12);
      tone(base * 1.25, 0.07, 'square', 0.10, 0.07);
    },

    // Streak-Reset — kurzes Abfall-Blip
    streakReset() {
      tone(440, 0.08, 'sawtooth', 0.12);
      tone(330, 0.12, 'sawtooth', 0.10, 0.07);
    },

    // Game Over — dramatisch absteigend
    gameOver() {
      arp([
        [440, 0],
        [370, 0.12],
        [294, 0.24],
        [220, 0.38],
      ], 'sawtooth', 0.28);
      setTimeout(() => tone(110, 0.8, 'sine', 0.22), 600);
    },

    // Schrein gestartet — mystisches Aufleuchten
    shrineStart() {
      tone(528, 0.3, 'sine', 0.18);
      tone(660, 0.2, 'sine', 0.12, 0.15);
      tone(792, 0.15, 'sine', 0.10, 0.28);
    },

    // Schrein abgeschlossen — kleine Fanfare
    shrineEnd() {
      arp([
        [659, 0],
        [784, 0.10],
        [988, 0.20],
        [1319, 0.30],
      ], 'sine', 0.26);
    },

    // Region befreit — triumphaler Dreiklang
    regionConquered() {
      arp([
        [523, 0],
        [659, 0.08],
        [784, 0.16],
        [1047, 0.24],
        [1319, 0.34],
        [1568, 0.44],
      ], 'sine', 0.30);
      setTimeout(() => {
        tone(523, 0.8, 'sine', 0.16);
        tone(659, 0.8, 'sine', 0.12);
        tone(784, 0.8, 'sine', 0.10);
        tone(1047, 0.8, 'sine', 0.08);
      }, 600);
    },

    // Run Reset — kurzer Abfall
    runReset() {
      arp([[440, 0], [330, 0.10], [220, 0.20]], 'sine', 0.18);
    },
  };
})();
