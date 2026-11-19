// La scène : la toile plein écran, le décor courant, les personnages, les effets et la caméra.
VG.scene = (() => {
  const G = VG.gfx, { clamp, lerp, rgba, easeOut, TAU, rng } = VG.u, P = G.PAL;
  let cv, ctx, W = 0, H = 0, ratio = 1, cssW = 0, cssH = 0, qual = 1;
  let B = null, cleB = "", prev = null, fondu = 0;
  let acteurs = [], fx = [], t0 = performance.now(), dernier = t0, temps = 0;
  let par = 0, parCible = 0, secousse = 0, eclairA = 0, eclairCol = "#fff", zoom = 0;
  let lent = [], enPause = false, surImage = null;

  function init() { cv = document.getElementById("toile"); ctx = cv.getContext("2d");
    addEventListener("pointermove", e => { if (e.pointerType === "mouse") parCible = clamp((e.clientX / innerWidth - .5) * 2, -1, 1); }, { passive: true });
    document.addEventListener("visibilitychange", () => { enPause = document.hidden; dernier = performance.now(); });
    requestAnimationFrame(boucle); }

  function taille() { cssW = innerWidth; cssH = innerHeight; const dpr = Math.min(2, devicePixelRatio || 1); ratio = dpr * qual;
    ratio = Math.min(ratio, Math.sqrt(2.4e6 / Math.max(1, cssW * cssH))); ratio = Math.max(.5, ratio);
    W = Math.round(cssW * ratio); H = Math.round(cssH * ratio); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; } }

  // zone : fenêtre utile en pixels CSS {x,y,w,h}. Reconstruit le décor s'il change (clé, nuit, fenêtre).
  function montrer(cle, o = {}) { taille(); const z = o.zone || { x: 0, y: 0, w: cssW, h: cssH };
    const safe = { x: z.x * ratio, y: z.y * ratio, w: Math.max(40, z.w * ratio), h: Math.max(40, z.h * ratio) };
    const sig = [cle, o.nuit ? 1 : 0, W, H, Math.round(safe.x), Math.round(safe.y), Math.round(safe.w), Math.round(safe.h), o.var || ""].join("|");
    if (sig !== cleB) { if (B && ctx && o.fondu !== false) { prev = prev || G.mk(W, H); if (prev.width !== W || prev.height !== H) { prev.width = W; prev.height = H; } const px = prev.getContext("2d"); px.clearRect(0, 0, W, H); try { px.drawImage(cv, 0, 0, W, H); fondu = 1; } catch (e) { fondu = 0; } }
      B = VG.decors.creer(cle, W, H, safe, o.nuit, o.donnees); cleB = sig; }
    if (o.acteurs !== undefined) poser(o.acteurs || []);
    return B; }

  // Pose des personnages : [{nom, opts, u, sens, k (échelle relative), st, cle}]. Les sprites déjà en scène sont repris (pas de saut).
  function poser(liste) { const anciens = acteurs; acteurs = liste.map(d => { let a = anciens.find(x => x.cle === (d.cle || d.nom) && x.nom === d.nom && x.sig === JSON.stringify(d.opts || {}));
      if (!a) { a = VG.sprites.creer(d.nom, d.opts || {}); a.cle = d.cle || d.nom; a.sig = JSON.stringify(d.opts || {}); a.alpha = 0; a.entre = 1; a.st = {}; }
      a.u = d.u; a.sens = d.sens || 1; a.k = d.k || 1; a.plan = d.plan || 0; a.dx = a.dx || 0; a.dy = a.dy || 0; if (d.st) a.st = Object.assign({}, d.st); if (d.alpha != null) a.alphaCible = d.alpha; else a.alphaCible = 1; a.yDec = d.yDec || 0; return a; });
    placer(); return acteurs; }
  function placer() { if (!B) return; for (const a of acteurs) { let e = a.ech0 || (a.ech0 = a.ech); e *= a.k;
      const larg = (a.humain ? 70 : a.larg) * e * B.U, maxL = B.s.w * (a.humain ? .5 : .6); if (larg > maxL) e *= maxL / larg;
      const haut = a.haut * e * B.U, maxH = (B.sol - B.s.y) * .97; if (haut > maxH) e *= maxH / haut;
      a.ech = e; a.bx = B.X(a.u); a.by = B.sol + (a.yDec || 0) * B.U; } }

  // ---------- effets ----------
  const ajouter = (dur, draw, o = {}) => { const e = Object.assign({ t: 0, dur, draw }, o); fx.push(e); return e; };
  const u = () => B ? B.U : 6;
  const FX = {
    // chiffre ou mot qui s'envole
    texte(x, y, txt, col = "#fff", taille = 1, o = {}) { const dx = (Math.random() - .5) * u() * 5; ajouter(o.dur || 1.15, (c, p) => { const s = u() * 4.6 * taille * (p < .14 ? .5 + p / .14 * .75 : 1.25 - Math.min(.25, (p - .14) * 1.2)), yy = y - easeOut(p) * u() * 13, a = p > .7 ? 1 - (p - .7) / .3 : 1;
        c.save(); c.globalAlpha = a; c.font = `700 ${s}px Fraunces, Georgia, serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.lineJoin = "round"; c.lineWidth = Math.max(3, s * .16); c.strokeStyle = "rgba(8,10,9,.9)"; c.strokeText(txt, x + dx, yy); c.fillStyle = col; c.fillText(txt, x + dx, yy); c.restore(); }, { dessus: true }); },
    // arc de lame
    taille(x, y, sens, col = "#fff6dc", k = 1) { const r = u() * 13 * k, a0 = sens > 0 ? -2.2 : -.94, a1 = sens > 0 ? .5 : -3.64; ajouter(.26, (c, p) => { const e = easeOut(p), a = lerp(a0, a1, e); c.save(); c.globalCompositeOperation = "lighter"; c.translate(x, y);
        for (let i = 0; i < 6; i++) { const k2 = i / 6; c.strokeStyle = rgba(col, (1 - p) * (1 - k2) * .8); c.lineWidth = u() * 1.7 * (1 - k2); c.lineCap = "round"; c.beginPath(); c.arc(0, 0, r, lerp(a0, a, .15 + k2 * .5), a, sens < 0); c.stroke(); } c.restore(); }); },
    // estoc : trait droit
    estoc(x0, y0, x1, y1, col = "#fff6dc") { ajouter(.2, (c, p) => { c.save(); c.globalCompositeOperation = "lighter"; c.strokeStyle = rgba(col, 1 - p); c.lineWidth = u() * 1.1 * (1 - p * .6); c.lineCap = "round"; c.beginPath(); c.moveTo(lerp(x0, x1, clamp(p * 2 - .6, 0, 1)), lerp(y0, y1, clamp(p * 2 - .6, 0, 1))); c.lineTo(lerp(x0, x1, clamp(p * 2, 0, 1)), lerp(y0, y1, clamp(p * 2, 0, 1))); c.stroke(); c.restore(); }); },
    // gerbe d'étincelles
    gerbe(x, y, col = P.feu, n = 14, k = 1) { const r = rng(Math.random() * 1e6 | 0), L = []; for (let i = 0; i < n; i++) L.push([r() * TAU, r.r(.4, 1), r.r(.5, 1)]);
      ajouter(.45, (c, p) => { c.save(); c.globalCompositeOperation = "lighter"; c.lineCap = "round"; for (const [a, v, w] of L) { const d0 = easeOut(p) * v * u() * 11 * k, d1 = easeOut(Math.max(0, p - .18)) * v * u() * 11 * k; c.strokeStyle = rgba(col, (1 - p) * .95); c.lineWidth = u() * .5 * w; c.beginPath(); c.moveTo(x + Math.cos(a) * d1, y + Math.sin(a) * d1 + p * p * u() * 4); c.lineTo(x + Math.cos(a) * d0, y + Math.sin(a) * d0 + p * p * u() * 4); c.stroke(); }
        c.restore(); G.glow(c, x, y, u() * 13 * k * (1 - p), col, (1 - p) * .7); }); },
    // parade : éclat en arc
    parade(x, y, sens) { ajouter(.4, (c, p) => { c.save(); c.globalCompositeOperation = "lighter"; c.strokeStyle = rgba(P.acier, (1 - p) * .95); c.lineWidth = u() * (1.4 - p); c.beginPath(); c.arc(x - sens * u() * 4, y, u() * (8 + p * 5), sens > 0 ? -1.1 : Math.PI - 1.1, sens > 0 ? 1.1 : Math.PI + 1.1); c.stroke(); c.restore(); G.glow(c, x, y, u() * 9, P.acier, (1 - p) * .5); }); },
    // souffle de flammes d'un point à un autre
    flammes(x0, y0, x1, y1, dur = .8, col = P.feu, col2 = P.feu2) { const r = rng(Math.random() * 1e6 | 0), L = []; for (let i = 0; i < 46; i++) L.push([r(), r.r(-1, 1), r.r(.6, 1.4), r()]);
      ajouter(dur, (c, p, t) => { c.save(); c.globalCompositeOperation = "lighter"; const tile = G.glowTile(col), tile2 = G.glowTile(col2);
        for (const [ph, lat, s, v] of L) { const k = (p * 2.2 + ph) % 1, front = clamp(p * 2.6, 0, 1), fin = clamp((1 - p) * 4, 0, 1); if (k > front) continue; const x = lerp(x0, x1, k), y = lerp(y0, y1, k) + lat * k * u() * 7 + Math.sin(t * 20 + ph * 9) * u(), d = u() * (3 + k * 13) * s; c.globalAlpha = (1 - k * .55) * fin * .6; c.drawImage(v < .5 ? tile : tile2, x - d / 2, y - d / 2, d, d); }
        c.restore(); }); },
    // projectile (flèche)
    trait(x0, y0, x1, y1, col = "#e9e2cf", dur = .16, fin) { ajouter(dur, (c, p) => { const x = lerp(x0, x1, p), y = lerp(y0, y1, p) - Math.sin(p * Math.PI) * u() * 2, a = Math.atan2(y1 - y0, x1 - x0); c.save(); c.translate(x, y); c.rotate(a); c.strokeStyle = col; c.lineWidth = Math.max(1.5, u() * .35); c.lineCap = "round"; c.beginPath(); c.moveTo(-u() * 6, 0); c.lineTo(0, 0); c.stroke();
        c.globalCompositeOperation = "lighter"; c.strokeStyle = rgba(col, .35); c.lineWidth = u() * .9; c.beginPath(); c.moveTo(-u() * 12, 0); c.lineTo(-u() * 2, 0); c.stroke(); c.restore(); }, { fin }); },
    // soin : étincelles qui montent
    soin(x, y, col = P.ok) { const r = rng(Math.random() * 1e6 | 0), L = []; for (let i = 0; i < 16; i++) L.push([r.r(-1, 1), r(), r.r(.5, 1.2)]);
      ajouter(1, (c, p) => { c.save(); c.globalCompositeOperation = "lighter"; const tile = G.glowTile(col); for (const [dx, ph, s] of L) { const k = clamp(p * 1.4 - ph * .4, 0, 1); if (k <= 0) continue; const d = u() * 3.2 * s; c.globalAlpha = Math.sin(k * Math.PI) * .9; c.drawImage(tile, x + dx * u() * 6 - d / 2, y - k * u() * 26 - d / 2, d, d); } c.restore(); G.glow(c, x, y - u() * 10, u() * 16, col, Math.sin(p * Math.PI) * .28); }); },
    // lecture de la garde : un œil se dessine
    regard(x, y, col = P.or) { ajouter(.8, (c, p) => { const a = Math.sin(p * Math.PI), w = u() * 6; c.save(); c.globalCompositeOperation = "lighter"; c.strokeStyle = rgba(col, a); c.lineWidth = Math.max(1.5, u() * .4); c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x, y - w * .7 * easeOut(p * 2), x + w, y); c.quadraticCurveTo(x, y + w * .7 * easeOut(p * 2), x - w, y); c.stroke(); c.beginPath(); c.arc(x, y, w * .26, 0, TAU); c.stroke();
        c.strokeStyle = rgba(col, a * .5); c.beginPath(); c.arc(x, y, w * (1.4 + p * 1.6), 0, TAU); c.stroke(); c.restore(); }); },
    // onde (cri, intimidation, montée de niveau)
    onde(x, y, col = P.or, k = 1) { ajouter(.7, (c, p) => { c.save(); c.globalCompositeOperation = "lighter"; c.strokeStyle = rgba(col, (1 - p) * .8); c.lineWidth = u() * 1.2 * (1 - p); c.beginPath(); c.arc(x, y, u() * 30 * k * easeOut(p), 0, TAU); c.stroke(); c.restore(); G.glow(c, x, y, u() * 22 * k, col, (1 - p) * .35); }); },
    // poison / eau noire : bulles sombres
    miasme(x, y, col = "#7fd29a") { const r = rng(Math.random() * 1e6 | 0), L = []; for (let i = 0; i < 9; i++) L.push([r.r(-1, 1), r(), r.r(.6, 1.3)]);
      ajouter(.8, (c, p) => { c.save(); for (const [dx, ph, s] of L) { const k = clamp(p * 1.3 - ph * .3, 0, 1); if (k <= 0) continue; c.strokeStyle = rgba(col, Math.sin(k * Math.PI) * .9); c.lineWidth = 1.5; c.beginPath(); c.arc(x + dx * u() * 5, y - k * u() * 12, u() * .9 * s, 0, TAU); c.stroke(); } c.restore(); }); },
  };
  const secouer = a => { if (VG.reglages.get("mouvement")) secousse = Math.max(secousse, a); };
  const eclair = (col, a) => { eclairCol = col; eclairA = Math.max(eclairA, a); };
  const coupDeZoom = a => { if (VG.reglages.get("mouvement")) zoom = Math.max(zoom, a); };

  // ---------- boucle ----------
  function boucle(now) { requestAnimationFrame(boucle); if (enPause || !B) { dernier = now; return; }
    const dt = Math.min(.05, (now - dernier) / 1000); dernier = now; temps += dt;
    // qualité adaptative : si la machine peine, on réduit la définition de la toile
    lent.push(dt); if (lent.length > 90) { const m = lent.reduce((a, b) => a + b, 0) / lent.length; lent = []; if (m > .03 && qual > .55 && VG.reglages.get("qualite") === "auto") { qual *= .8; cleB = ""; if (VG.ui && VG.ui.rafraichirScene) VG.ui.rafraichirScene(); } }
    par += ((VG.reglages.get("mouvement") ? parCible + Math.sin(temps * .18) * .35 : 0) - par) * Math.min(1, dt * 2.5);
    secousse *= Math.pow(.0009, dt); eclairA *= Math.pow(.002, dt); zoom *= Math.pow(.004, dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (secousse > .02 || zoom > .002) { const s = secousse * B.U * 1.3; ctx.translate(W / 2, H / 2); ctx.scale(1 + zoom, 1 + zoom); ctx.translate(-W / 2 + (Math.random() - .5) * s, -H / 2 + (Math.random() - .5) * s); }
    VG.rendu.decor(ctx, B, temps, dt, par, dessinerActeurs);
    for (let i = fx.length - 1; i >= 0; i--) { const e = fx[i]; e.t += dt; const p = e.t / e.dur; if (p >= 1) { fx.splice(i, 1); if (e.fin) e.fin(); continue; } if (e.dessus) e.draw(ctx, p, temps); }
    ctx.restore();
    if (surImage) surImage(ctx, temps, dt, B);
    if (eclairA > .01) { ctx.fillStyle = rgba(eclairCol, clamp(eclairA, 0, 1)); ctx.fillRect(0, 0, W, H); }
    if (fondu > 0 && prev) { fondu -= dt / .42; if (fondu > 0) { ctx.globalAlpha = clamp(fondu, 0, 1); ctx.drawImage(prev, 0, 0, W, H); ctx.globalAlpha = 1; } }
  }
  function dessinerActeurs(c) { const dx = -par * B.M * .75; c.save(); c.translate(dx, 0);
    const L = acteurs.slice().sort((a, b) => (a.plan || 0) - (b.plan || 0));
    L.forEach((a, i) => { if (a.alpha < a.alphaCible) a.alpha = Math.min(a.alphaCible, a.alpha + .05); else if (a.alpha > a.alphaCible) a.alpha = Math.max(a.alphaCible, a.alpha - .05);
      if (a.flash > 0) a.flash = Math.max(0, a.flash - .07); a.x = a.bx + (a.dx || 0) * B.U; a.y = a.by + (a.dy || 0) * B.U; a.x0 = a.x; a.y0 = a.by;
      if (a.alpha > .01) VG.rendu.acteur(c, a, acteurs.indexOf(a), temps, B.lum, B.U); });
    for (const e of fx) if (!e.dessus) e.draw(c, e.t / e.dur, temps);
    c.restore(); }

  // point d'ancrage d'un acteur en pixels de toile (tete, coeur, bouche)
  function ancre(a, quoi = "coeur") { const pts = (a.st && a.st.souffle && a.pointsSouffle) || a.points || {}, p = pts[quoi] || pts.coeur || [0, -a.haut * .5];
    return [a.bx + (a.dx || 0) * B.U + p[0] * a.ech * B.U * a.sens, a.by + (a.dy || 0) * B.U + p[1] * a.ech * B.U]; }
  // … et en pixels CSS, pour poser des éléments d'interface
  const css = (x, y) => [x / ratio, y / ratio];

  return { init, montrer, poser, placer, FX, secouer, eclair, coupDeZoom, ancre, css,
    get B() { return B; }, get acteurs() { return acteurs; }, get temps() { return temps; }, get ratio() { return ratio; },
    oublier() { cleB = ""; }, surImage(f) { surImage = f; }, taille };
})();
