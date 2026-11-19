// Sons : tout est synthétisé (Web Audio), aucun fichier. Bruitages de combat et d'interface, souffle d'ambiance.
VG.son = (() => {
  let ac = null, maitre = null, amb = null, bruitBuf = null;
  function ctx() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); maitre = ac.createGain(); maitre.gain.value = .55; maitre.connect(ac.destination); } catch (e) { ac = null; } }
    if (ac && ac.state === "suspended") ac.resume().catch(() => {}); return ac; }
  function bruit(a) { if (bruitBuf) return bruitBuf; const b = a.createBuffer(1, a.sampleRate * 2, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return bruitBuf = b; }
  // note : glissando f0 -> f1
  function ton(a, f0, f1, dur, type = "sine", vol = .2, quand = 0) { const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + quand; o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0008, t + dur); o.connect(g); g.connect(maitre); o.start(t); o.stop(t + dur + .05); }
  // souffle : bruit filtré qui glisse
  function souffle(a, f0, f1, dur, q = 1, vol = .25, quand = 0, type = "bandpass") { const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + quand; s.buffer = bruit(a); s.loop = true; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(.02, dur * .2)); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(maitre); s.start(t, Math.random()); s.stop(t + dur + .05); }
  const J = {
    clic: a => ton(a, 620, 420, .05, "triangle", .07),
    page: a => souffle(a, 2400, 900, .16, .8, .08),
    ouvrir: a => { souffle(a, 500, 1600, .14, .7, .06); },
    coup: a => { souffle(a, 1800, 300, .13, .9, .34); ton(a, 190, 60, .14, "sine", .32); },
    lame: a => { souffle(a, 5200, 1400, .11, 2.2, .22); ton(a, 1500, 2600, .09, "triangle", .05, .02); },
    lourd: a => { souffle(a, 900, 90, .32, .7, .5); ton(a, 120, 34, .36, "sine", .55); ton(a, 70, 30, .3, "square", .1, .02); },
    parade: a => { ton(a, 2100, 1650, .2, "triangle", .16); ton(a, 3180, 2700, .16, "sine", .08); souffle(a, 6000, 3000, .06, 3, .14); },
    brise: a => { souffle(a, 3000, 200, .28, .6, .4); ton(a, 800, 120, .25, "sawtooth", .12); },
    esquive: a => souffle(a, 500, 2600, .2, 1.4, .2),
    rate: a => souffle(a, 1400, 500, .16, 1.2, .1),
    fleche: a => { souffle(a, 3200, 900, .13, 3, .2); ton(a, 220, 130, .12, "triangle", .12, .12); },
    feu: a => { souffle(a, 240, 900, .75, .5, .5, 0, "lowpass"); souffle(a, 1800, 600, .6, .8, .16, .05); ton(a, 70, 45, .7, "sawtooth", .12); },
    soin: a => { [660, 880, 1320].forEach((f, i) => ton(a, f, f * 1.01, .32, "sine", .09, i * .07)); },
    regard: a => { ton(a, 880, 1320, .16, "sine", .08); ton(a, 1320, 1760, .2, "sine", .06, .1); },
    annonce: a => { ton(a, 196, 185, .26, "sawtooth", .07); ton(a, 98, 92, .3, "sine", .16); },
    poison: a => { ton(a, 300, 180, .22, "sine", .1); souffle(a, 700, 300, .2, 4, .1); },
    victoire: a => { [392, 523.25, 659.25, 783.99].forEach((f, i) => { ton(a, f, f, .38, "triangle", .13, i * .11); ton(a, f / 2, f / 2, .38, "sine", .08, i * .11); }); },
    defaite: a => { [311.1, 261.6, 207.6, 155.6].forEach((f, i) => ton(a, f, f * .97, .5, "sine", .14, i * .17)); },
    niveau: a => { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => ton(a, f, f, .34, "triangle", .1, i * .075)); souffle(a, 4000, 9000, .5, 1.5, .05, .3); },
    or: a => { ton(a, 1760, 1700, .09, "square", .04); ton(a, 2349, 2300, .12, "square", .04, .06); },
    jour: a => { [293.7, 440, 587.3].forEach((f, i) => ton(a, f, f, .7, "sine", .08, i * .12)); },
    nuit: a => { [220, 174.6, 130.8].forEach((f, i) => ton(a, f, f, .9, "sine", .09, i * .16)); },
    alerte: a => { ton(a, 110, 104, .5, "sawtooth", .1); ton(a, 164.8, 155, .5, "sawtooth", .07, .04); },
    rugir: a => { souffle(a, 160, 60, 1.1, .6, .7, 0, "lowpass"); ton(a, 82, 40, 1.1, "sawtooth", .26); ton(a, 61, 33, 1.1, "square", .1, .03); },
    tomber: a => { ton(a, 110, 40, .3, "sine", .4); souffle(a, 500, 80, .28, .7, .3, .04); },
  };
  function jouer(nom) { if (!VG.reglages.get("son")) return; const a = ctx(); if (!a || !J[nom]) return; try { J[nom](a); } catch (e) {} }
  // ambiance : un vent très doux dont la couleur dépend du lieu (dehors, intérieur, antre)
  function ambiance(type) { if (!VG.reglages.get("musique") || !VG.reglages.get("son")) { stopAmb(); return; } const a = ctx(); if (!a) return;
    const R = { dehors: [420, .055], nuit: [300, .05], dedans: [150, .028], antre: [110, .07], bataille: [520, .08], marais: [240, .05] }[type] || [400, .05];
    if (!amb) { const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), l = a.createOscillator(), lg = a.createGain(); s.buffer = bruit(a); s.loop = true; f.type = "lowpass"; f.Q.value = .6; g.gain.value = 0; l.frequency.value = .09; lg.gain.value = 90;
      l.connect(lg); lg.connect(f.frequency); s.connect(f); f.connect(g); g.connect(maitre); s.start(); l.start(); amb = { s, f, g, l }; }
    amb.f.frequency.setTargetAtTime(R[0], a.currentTime, 1.2); amb.g.gain.setTargetAtTime(R[1], a.currentTime, 1.2); }
  function stopAmb() { if (amb && ac) amb.g.gain.setTargetAtTime(0, ac.currentTime, .3); }
  return { jouer, ambiance, stopAmb, eveiller: ctx };
})();
