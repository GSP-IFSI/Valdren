// Boîte à outils de dessin : tout l'univers graphique est peint par le code, sans aucune image externe
// (hormis les quinze portraits du prototype). Style : théâtre d'ombres, silhouettes découpées,
// brumes et lumières chaudes, dans la palette du prototype (or, braise, acier, nuit).
VG.gfx = (() => {
  const { clamp, lerp, rng, fbm1, noise2, rgba, mix, mixc, TAU } = VG.u;

  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

  // Palette commune (reprise des variables CSS du prototype)
  const PAL = { or: "#e3c27a", braise: "#e8825a", acier: "#8fc3e8", nuit: "#a99be0", ok: "#7fd29a", mid: "#e0b45c", bad: "#e07a6c",
    encre: "#0b100e", fond: "#0f1512", sang: "#b3382c", feu: "#ffb35a", feu2: "#ff6a2a", lune: "#cfe0ff", os: "#e9e2cf" };

  function lin(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([p, c]) => g.addColorStop(clamp(p, 0, 1), c)); return g; }
  function rad(ctx, x, y, r0, r1, stops) { const g = ctx.createRadialGradient(x, y, r0, x, y, Math.max(r0 + .01, r1)); stops.forEach(([p, c]) => g.addColorStop(clamp(p, 0, 1), c)); return g; }

  // halo lumineux additif
  function glow(ctx, x, y, r, col, a = 1, mode = "lighter") {
    if (r <= 0 || a <= 0) return; ctx.save(); ctx.globalCompositeOperation = mode;
    ctx.fillStyle = rad(ctx, x, y, 0, r, [[0, rgba(col, a)], [.3, rgba(col, a * .48)], [.62, rgba(col, a * .12)], [.86, rgba(col, a * .015)], [1, rgba(col, 0)]]);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore(); }

  // ligne de crête fractale, remplie jusqu'en bas. pts renvoyés pour y poser des éléments.
  function ridge(ctx, o) { const { x0, x1, y, amp, freq = 1, seed = 1, oct = 4, bottom, fill, jag = 0, step = 3 } = o; const pts = [];
    ctx.beginPath(); ctx.moveTo(x0, bottom);
    for (let x = x0; x <= x1 + step; x += step) { const n = fbm1(x * freq / 400, seed, oct) - .5, j = jag ? (fbm1(x * freq / 40, seed + 91, 2) - .5) * jag : 0; const yy = y + n * amp * 2 + j; pts.push([x, yy]); ctx.lineTo(x, yy); }
    ctx.lineTo(x1, bottom); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); return pts; }
  const ridgeY = (pts, x) => { if (!pts.length) return 0; const i = clamp(Math.round((x - pts[0][0]) / (pts[1] ? pts[1][0] - pts[0][0] : 1)), 0, pts.length - 1); return pts[i][1]; };

  // nappe de brume : taches molles alignées
  function fog(ctx, x0, x1, y, h, col, a = .5, seed = 3, n = 14) { const r = rng(seed); ctx.save();
    for (let i = 0; i < n; i++) { const x = lerp(x0, x1, r()), yy = y + (r() - .5) * h * .6, rx = h * r.r(1.6, 4), ry = h * r.r(.35, .8);
      const aa = a * r.r(.5, 1); ctx.save(); ctx.translate(x, yy); ctx.scale(rx / ry, 1); ctx.fillStyle = rad(ctx, 0, 0, 0, ry, [[0, rgba(col, aa)], [.6, rgba(col, aa * .3)], [1, rgba(col, 0)]]); ctx.beginPath(); ctx.arc(0, 0, ry, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.restore(); }

  // rais de lumière obliques
  function shafts(ctx, x, y, len, spread, col, a, n, seed, ang = .5) { const r = rng(seed); ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.translate(x, y); ctx.rotate(ang);
    for (let i = 0; i < n; i++) { const off = (r() - .5) * spread, w = r.r(.04, .14) * spread, aa = a * r.r(.35, 1);
      ctx.fillStyle = lin(ctx, 0, 0, 0, len, [[0, rgba(col, 0)], [.12, rgba(col, aa)], [1, rgba(col, 0)]]);
      ctx.beginPath(); ctx.moveTo(off, 0); ctx.lineTo(off + w, 0); ctx.lineTo(off + w * 2.6 + off * .5, len); ctx.lineTo(off * 1.5 - w * .6, len); ctx.closePath(); ctx.fill(); }
    ctx.restore(); }

  function stars(ctx, x0, y0, x1, y1, n, seed, col = "#ffffff") { const r = rng(seed);
    for (let i = 0; i < n; i++) { const x = lerp(x0, x1, r()), y = lerp(y0, y1, Math.pow(r(), 1.6)), s = r.r(.4, 1.5), a = r.r(.25, .95) * (1 - (y - y0) / (y1 - y0) * .8);
      ctx.fillStyle = rgba(col, a); ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill(); if (s > 1.25) glow(ctx, x, y, s * 6, col, a * .35); } }

  // astre : soleil voilé ou lune avec croissant d'ombre
  function astre(ctx, x, y, r, col, halo, lune) { glow(ctx, x, y, r * 9, halo, .28); glow(ctx, x, y, r * 3.2, halo, .5);
    ctx.fillStyle = rgba(col, 1); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (lune) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip(); ctx.fillStyle = rgba("#7d8fb0", .35);
      [[.3, -.2, .22], [-.25, .3, .16], [.1, .45, .1], [-.4, -.3, .12]].forEach(([dx, dy, k]) => { ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, k * r, 0, TAU); ctx.fill(); });
      ctx.fillStyle = rgba("#0a1020", .28); ctx.beginPath(); ctx.arc(x + r * .45, y - r * .1, r * 1.05, 0, TAU); ctx.fill(); ctx.restore(); } }

  // grain de papier : une tuile de bruit à plaquer en surimpression
  let _grain = null;
  function grain() { if (_grain) return _grain; const c = mk(160, 160), x = c.getContext("2d"), d = x.createImageData(160, 160), r = rng(77);
    for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() - .5) * 110; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 26; }
    x.putImageData(d, 0, 0); return _grain = c; }

  // contour irrégulier fermé (rochers, frondaisons) autour d'un centre
  function blob(ctx, x, y, rx, ry, seed, rough = .25, n = 22) { ctx.beginPath();
    for (let i = 0; i <= n; i++) { const a = i / n * TAU, k = 1 + (fbm1(i * .9, seed, 2) - .5) * 2 * rough, px = x + Math.cos(a) * rx * k, py = y + Math.sin(a) * ry * k; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath(); }

  // ----- particules -----
  // Un seul type de système, paramétré : braises, lucioles, cendres, poussières, brume, fumée, pluie, feuilles, feux follets.
  const _gl = {};
  function glowTile(col) { const k = Array.isArray(col) ? col.join(",") : col; if (_gl[k]) return _gl[k]; const c = mk(64, 64), x = c.getContext("2d");
    x.fillStyle = rad(x, 32, 32, 0, 32, [[0, rgba(col, 1)], [.25, rgba(col, .55)], [1, rgba(col, 0)]]); x.fillRect(0, 0, 64, 64); return _gl[k] = c; }

  const KINDS = {
    braise: { col: PAL.feu, add: true, init(p, r, A) { p.x = A.x + r() * A.w; p.y = A.y + A.h * r.r(.6, 1.05); p.vx = r.r(-6, 6); p.vy = -r.r(14, 46); p.s = r.r(1, 3.2); p.life = r.r(2.5, 6); },
      step(p, dt, t) { p.x += (p.vx + Math.sin(t * 1.7 + p.ph * 9) * 9) * dt; p.y += p.vy * dt; }, alpha: p => Math.sin(Math.min(1, p.age / p.life) * Math.PI) * (.55 + .45 * Math.sin(p.age * 9 + p.ph * 20)) },
    luciole: { col: "#d8f08a", add: true, init(p, r, A) { p.x = A.x + r() * A.w; p.y = A.y + r() * A.h; p.s = r.r(1.4, 3); p.life = r.r(5, 11); p.vx = r.r(-1, 1); p.vy = r.r(-1, 1); },
      step(p, dt, t) { p.x += (Math.sin(t * .7 + p.ph * 30) * 14 + p.vx * 6) * dt; p.y += (Math.cos(t * .9 + p.ph * 17) * 10 + p.vy * 4) * dt; }, alpha: p => Math.sin(Math.min(1, p.age / p.life) * Math.PI) * Math.max(0, Math.sin(p.age * 2.2 + p.ph * 40)) },
    follet: { col: "#8fe6c8", add: true, init(p, r, A) { p.x = A.x + r() * A.w; p.y = A.y + r() * A.h; p.s = r.r(3, 6); p.life = r.r(6, 12); p.vx = r.r(-1, 1); },
      step(p, dt, t) { p.x += (Math.sin(t * .4 + p.ph * 30) * 9 + p.vx * 3) * dt; p.y += Math.cos(t * .6 + p.ph * 12) * 5 * dt; }, alpha: p => Math.sin(Math.min(1, p.age / p.life) * Math.PI) * (.5 + .3 * Math.sin(p.age * 3 + p.ph * 9)) },
    cendre: { col: "#c9c2b6", init(p, r, A) { p.x = A.x + r() * A.w * 1.2; p.y = A.y - 10 + (p.fresh ? r() * A.h : 0); p.vx = -r.r(8, 26); p.vy = r.r(12, 34); p.s = r.r(.8, 2.2); p.life = r.r(6, 12); },
      step(p, dt, t) { p.x += (p.vx + Math.sin(t + p.ph * 20) * 8) * dt; p.y += p.vy * dt; }, alpha: p => Math.sin(Math.min(1, p.age / p.life) * Math.PI) * .7 },
    poussiere: { col: "#fff1c4", add: true, init(p, r, A) { p.x = A.x + r() * A.w; p.y = A.y + r() * A.h; p.vx = r.r(-3, 3); p.vy = r.r(-4, 2); p.s = r.r(.6, 1.6); p.life = r.r(4, 9); },
      step(p, dt, t) { p.x += (p.vx + Math.sin(t * .5 + p.ph * 20) * 3) * dt; p.y += p.vy * dt; }, alpha: p => Math.sin(Math.min(1, p.age / p.life) * Math.PI) * .6 },
    brume: { col: "#b9c9c4", big: true, init(p, r, A) { p.x = A.x + r() * A.w; p.y = A.y + r() * A.h; p.vx = r.r(4, 14) * (r() < .5 ? -1 : 1); p.s = r.r(60, 150); p.life = r.r(14, 30); p.k = r.r(2.2, 4); },
      step(p, dt) { p.x += p.vx * dt; }, alpha: p => Math.sin(Math.min(1, p.age / p.life) * Math.PI) * .16 },
    fumee: { col: "#8d8a86", big: true, init(p, r, A) { p.x = A.x + r() * A.w; p.y = A.y + A.h; p.vx = r.r(4, 12); p.vy = -r.r(10, 22); p.s = r.r(6, 12); p.life = r.r(4, 8); p.k = 1; },
      step(p, dt) { p.x += p.vx * dt; p.y += p.vy * dt; p.s += 9 * dt; }, alpha: p => Math.sin(Math.min(1, p.age / p.life) * Math.PI) * .22 },
    pluie: { col: "#a8c4d8", line: true, init(p, r, A) { p.x = A.x + r() * A.w * 1.2; p.y = A.y + (p.fresh ? r() * A.h : -20); p.vx = -90; p.vy = r.r(620, 900); p.s = r.r(8, 18); p.life = 2; },
      step(p, dt) { p.x += p.vx * dt; p.y += p.vy * dt; }, alpha: () => .28 },
    feuille: { col: "#c98a3a", init(p, r, A) { p.x = A.x + r() * A.w; p.y = A.y - 8 + (p.fresh ? r() * A.h : 0); p.vx = -r.r(10, 30); p.vy = r.r(16, 34); p.s = r.r(1.6, 3); p.life = r.r(6, 11); },
      step(p, dt, t) { p.x += (p.vx + Math.sin(t * 1.3 + p.ph * 20) * 22) * dt; p.y += (p.vy + Math.cos(t * 2 + p.ph * 9) * 8) * dt; }, alpha: p => Math.sin(Math.min(1, p.age / p.life) * Math.PI) * .8 },
    neige: { col: "#e8eef5", init(p, r, A) { p.x = A.x + r() * A.w * 1.1; p.y = A.y - 8 + (p.fresh ? r() * A.h : 0); p.vx = -r.r(4, 14); p.vy = r.r(14, 30); p.s = r.r(.8, 2); p.life = r.r(7, 13); },
      step(p, dt, t) { p.x += (p.vx + Math.sin(t + p.ph * 20) * 10) * dt; p.y += p.vy * dt; }, alpha: p => Math.sin(Math.min(1, p.age / p.life) * Math.PI) * .75 },
  };

  // A = zone d'émission {x,y,w,h} ; o = {n, col, scale}
  function particules(kind, A, o = {}) { const K = KINDS[kind], r = rng(o.seed || kind), n = o.n || 30, L = [], col = o.col || K.col, sc = o.scale || 1;
    const born = (p, fresh) => { p.fresh = fresh; p.ph = r(); K.init(p, r, A); p.s *= sc; p.age = fresh ? r() * p.life : 0; return p; };
    for (let i = 0; i < n; i++) L.push(born({}, true));
    return { kind, A, draw(ctx, t, dt) { const tile = glowTile(col); ctx.save(); if (K.add) ctx.globalCompositeOperation = "lighter";
      for (const p of L) { p.age += dt; if (p.age >= p.life || p.y > A.y + A.h + 60 || p.x < A.x - 200 || p.x > A.x + A.w + 200) born(p, false); K.step(p, dt, t);
        const a = clamp(K.alpha(p) * (o.alpha || 1), 0, 1); if (a <= .01) continue; ctx.globalAlpha = a;
        if (K.line) { ctx.strokeStyle = rgba(col, 1); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .02, p.y - p.s); ctx.stroke(); }
        else if (K.big) { const w = p.s * (p.k || 1) * 2, h = p.s * 2; ctx.drawImage(tile, p.x - w / 2, p.y - h / 2, w, h); }
        else if (K.add) { const d = p.s * 7; ctx.drawImage(tile, p.x - d / 2, p.y - d / 2, d, d); }
        else { ctx.fillStyle = rgba(col, 1); ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.fill(); } }
      ctx.restore(); } }; }

  // flamme vivante (torche, feu de camp, forge) : trois langues qui dansent
  function flamme(ctx, x, y, h, t, seed = 0, col = PAL.feu, col2 = PAL.feu2) { ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) { const k = 1 - i * .28, w = h * .34 * k, sw = Math.sin(t * (7 + i * 2.3) + seed + i) * h * .08, hh = h * k * (.85 + .15 * Math.sin(t * 11 + seed * 3 + i * 2));
      ctx.fillStyle = lin(ctx, 0, y, 0, y - hh, [[0, rgba(i ? col : col2, .75)], [.6, rgba(col, .5)], [1, rgba(col, 0)]]);
      ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 1.1 + sw * .4, y - hh * .5, x + sw, y - hh); ctx.quadraticCurveTo(x + w * 1.1 + sw * .4, y - hh * .5, x + w, y); ctx.closePath(); ctx.fill(); }
    ctx.restore(); glow(ctx, x, y - h * .4, h * (2.4 + .25 * Math.sin(t * 9 + seed)), col, .32); }

  // trait d'encre d'épaisseur variable le long d'une liste de points
  function trait(ctx, pts, w0, w1, col) { ctx.strokeStyle = col; ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (let i = 1; i < pts.length; i++) { ctx.lineWidth = lerp(w0, w1, i / (pts.length - 1)); ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); } }

  return { mk, PAL, lin, rad, glow, ridge, ridgeY, fog, shafts, stars, astre, grain, blob, particules, glowTile, flamme, trait };
})();
