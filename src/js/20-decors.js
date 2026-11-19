// Décors : chaque lieu est une scène peinte en couches (ciel, lointains, plan moyen, sol, premier plan),
// avec un jeu jour (heure dorée voilée) et un jeu nuit (clair de lune). Les couches fixes sont
// peintes une fois ; flammes, eau, brumes et particules vivent à chaque image.
//
// Contrat d'un décor : function(B) où B fournit
//   B.W, B.H        taille du canevas ; B.x0, B.x1 : bornes à couvrir (marge de parallaxe incluse)
//   B.X(u), B.Y(v)  coordonnées dans la « fenêtre utile » (zone non recouverte par l'interface), u et v de 0 à 1
//   B.U             unité = 1 % de la hauteur utile ; B.nuit ; B.r hasard reproductible
//   B.couche(p)     nouvelle couche fixe (p : profondeur de parallaxe 0 = ciel … 1 = premier plan) -> ctx
//   B.dyn(p, f)     élément animé f(ctx, t, dt) ; B.part(p, type, zone, opts) : particules
//   B.acteurs()     plan où se tiennent les personnages (les couches suivantes passent devant eux)
//   B.sol           ordonnée du sol pour les personnages ; B.lum = {col, dir, amb, brume}
VG.decors = (() => {
  const G = VG.gfx, U = VG.u, { clamp, lerp, rng, rgba, mix, mixc, TAU, fbm1 } = U, P = G.PAL;

  // ---------- éléments de paysage ----------
  function pin(ctx, x, y, h, col, r) { const w = h * r.r(.26, .36), n = 5 + (h > 80 ? 2 : 0); ctx.fillStyle = col;
    ctx.fillRect(x - h * .018, y - h * .2, h * .036, h * .2);
    ctx.beginPath(); ctx.moveTo(x, y - h);
    for (let i = 1; i <= n; i++) { const k = i / n, ww = w * k * r.r(.85, 1.1), yy = y - h + h * .86 * k; ctx.lineTo(x + ww, yy + h * .03); ctx.lineTo(x + ww * .45, yy - h * .02); }
    for (let i = n; i >= 1; i--) { const k = i / n, ww = w * k * r.r(.85, 1.1), yy = y - h + h * .86 * k; ctx.lineTo(x - ww * .45, yy - h * .02); ctx.lineTo(x - ww, yy + h * .03); }
    ctx.closePath(); ctx.fill(); }

  function feuillu(ctx, x, y, h, col, r) { ctx.fillStyle = col; const tw = h * .05;
    ctx.beginPath(); ctx.moveTo(x - tw, y); ctx.quadraticCurveTo(x - tw * .5, y - h * .3, x - tw * .3, y - h * .55); ctx.lineTo(x + tw * .3, y - h * .55); ctx.quadraticCurveTo(x + tw * .5, y - h * .3, x + tw, y); ctx.closePath(); ctx.fill();
    const n = 7; for (let i = 0; i < n; i++) { const a = r() * TAU, d = r() * h * .2; G.blob(ctx, x + Math.cos(a) * d, y - h * .68 + Math.sin(a) * d * .7, h * r.r(.16, .26), h * r.r(.13, .2), r.i(1, 999), .22, 14); ctx.fill(); } }

  function branche(ctx, x, y, len, ang, w, r, depth) { if (depth <= 0 || len < 3) return; const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    ctx.lineWidth = Math.max(.6, w); ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(ang + r.r(-.3, .3)) * len * .5, y + Math.sin(ang + r.r(-.3, .3)) * len * .5, x2, y2); ctx.stroke();
    const n = depth > 2 ? 2 : r.i(1, 2); for (let i = 0; i < n; i++) branche(ctx, x2, y2, len * r.r(.55, .78), ang + r.r(-.75, .75), w * .62, r, depth - 1); }
  function arbreMort(ctx, x, y, h, col, r) { ctx.strokeStyle = col; ctx.lineCap = "round"; branche(ctx, x, y, h * .42, -Math.PI / 2 + r.r(-.12, .12), h * .07, r, 5); }

  // grand tronc de premier plan, du haut de l'image jusqu'au sol, avec racines
  function tronc(ctx, x, yTop, ySol, w, col, r, penche = 0) { ctx.fillStyle = col; ctx.beginPath(); const k = penche * (ySol - yTop);
    ctx.moveTo(x - w * .5 + k, yTop); ctx.bezierCurveTo(x - w * .56 + k * .6, lerp(yTop, ySol, .4), x - w * .62, lerp(yTop, ySol, .8), x - w * 1.25, ySol + w * .1);
    ctx.lineTo(x - w * .5, ySol + w * .02); ctx.lineTo(x - w * .1, ySol + w * .16); ctx.lineTo(x + w * .3, ySol + w * .02); ctx.lineTo(x + w * 1.3, ySol + w * .12);
    ctx.bezierCurveTo(x + w * .6, lerp(yTop, ySol, .8), x + w * .52 + k * .6, lerp(yTop, ySol, .4), x + w * .5 + k, yTop); ctx.closePath(); ctx.fill();
    // nœuds et branches cassées
    for (let i = 0; i < 3; i++) { const yy = lerp(yTop, ySol, r.r(.15, .7)), s = r() < .5 ? -1 : 1; ctx.beginPath(); ctx.moveTo(x + s * w * .45, yy); ctx.lineTo(x + s * w * r.r(.9, 1.5), yy - w * r.r(.3, .7)); ctx.lineTo(x + s * w * .45, yy + w * .28); ctx.closePath(); ctx.fill(); } }

  function herbe(ctx, x0, x1, y, h, col, r, dens = 1) { ctx.fillStyle = col; const pas = Math.max(2, h * .22 / dens);
    for (let x = x0; x < x1; x += pas * r.r(.5, 1.5)) { const hh = h * r.r(.35, 1), lean = r.r(-.5, .5) * hh, w = Math.max(1, hh * .09);
      ctx.beginPath(); ctx.moveTo(x - w, y + 2); ctx.quadraticCurveTo(x + lean * .3, y - hh * .6, x + lean, y - hh); ctx.quadraticCurveTo(x + lean * .4, y - hh * .5, x + w, y + 2); ctx.closePath(); ctx.fill(); } }

  // ronces : arceaux épineux
  function ronces(ctx, x0, x1, y, h, col, r, n) { ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = "round";
    for (let i = 0; i < n; i++) { const xa = lerp(x0, x1, r()), span = h * r.r(1.2, 3.4) * (r() < .5 ? -1 : 1), top = h * r.r(.45, 1), w = Math.max(1.2, h * r.r(.03, .06));
      ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(xa, y + 3); ctx.quadraticCurveTo(xa + span * .5, y - top * 2, xa + span, y + 3); ctx.stroke();
      for (let k = .12; k < .9; k += r.r(.08, .16)) { const px = xa + span * k, py = y + 3 - (4 * k * (1 - k)) * top, s = r() < .5 ? -1 : 1; ctx.beginPath(); ctx.moveTo(px - w, py); ctx.lineTo(px + s * w * 1.2, py - w * 3.2); ctx.lineTo(px + w, py); ctx.closePath(); ctx.fill(); } } }

  function rochers(ctx, x0, x1, y, h, col, r, n) { ctx.fillStyle = col; for (let i = 0; i < n; i++) { const x = lerp(x0, x1, r()), hh = h * r.r(.4, 1), w = hh * r.r(1, 1.9);
    ctx.beginPath(); ctx.moveTo(x - w, y + 2); ctx.lineTo(x - w * r.r(.5, .8), y - hh * r.r(.5, .8)); ctx.lineTo(x - w * r.r(0, .2), y - hh); ctx.lineTo(x + w * r.r(.3, .6), y - hh * r.r(.6, .9)); ctx.lineTo(x + w, y + 2); ctx.closePath(); ctx.fill(); } }

  // maison à toit de chaume. Renvoie ses fenêtres (pour les lueurs).
  function maison(ctx, x, y, w, h, col, r, o = {}) { const toit = o.toit || h * r.r(.75, 1.05), deb = w * .12, fen = []; ctx.fillStyle = col;
    ctx.fillRect(x - w / 2, y - h, w, h + 2);
    ctx.beginPath(); ctx.moveTo(x - w / 2 - deb, y - h + 2); ctx.quadraticCurveTo(x - w * .22, y - h - toit * .62, x - w * .04, y - h - toit); ctx.lineTo(x + w * .06, y - h - toit * .98);
    ctx.quadraticCurveTo(x + w * .24, y - h - toit * .6, x + w / 2 + deb, y - h + 2); ctx.closePath(); ctx.fill();
    if (o.cheminee !== false) { const cx = x + w * r.r(.12, .3) * (r() < .5 ? -1 : 1); ctx.fillRect(cx - w * .05, y - h - toit * .95, w * .1, toit * .6); fen.cheminee = [cx, y - h - toit * .95]; }
    const nf = o.fen == null ? r.i(1, 2) : o.fen; for (let i = 0; i < nf; i++) { const fx = x - w * .28 + i * w * .46 + r.r(-2, 2), fy = y - h * r.r(.5, .62), fw = w * .13, fh = h * .2; fen.push([fx, fy, fw, fh]); }
    if (o.porte !== false) fen.porte = [x + w * r.r(-.08, .08), y, w * .16, h * .46];
    return fen; }
  function lueursFenetres(ctx, fens, col, a) { fens.forEach(f => { ctx.fillStyle = rgba(col, a); ctx.fillRect(f[0] - f[2] / 2, f[1] - f[3] / 2, f[2], f[3]); ctx.fillStyle = rgba("#000", .35); ctx.fillRect(f[0] - .6, f[1] - f[3] / 2, 1.2, f[3]); G.glow(ctx, f[0], f[1], f[3] * 3.4, col, a * .5); }); }

  function tour(ctx, x, y, w, h, col, r, o = {}) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - w * .56, y + 2); ctx.lineTo(x - w * .46, y - h); ctx.lineTo(x + w * .46, y - h); ctx.lineTo(x + w * .56, y + 2); ctx.closePath(); ctx.fill();
    if (o.creneaux) { const n = 4, cw = w * 1.2 / (n * 2 - 1); ctx.fillRect(x - w * .6, y - h - cw * .2, w * 1.2, cw * .5); for (let i = 0; i < n; i++) ctx.fillRect(x - w * .6 + i * cw * 2, y - h - cw * 1.1, cw, cw); }
    else { ctx.beginPath(); ctx.moveTo(x - w * .7, y - h + 1); ctx.lineTo(x, y - h - w * (o.fleche || 1.1)); ctx.lineTo(x + w * .7, y - h + 1); ctx.closePath(); ctx.fill(); }
    return [x, y - h - (o.creneaux ? w * .3 : w * (o.fleche || 1.1))]; }

  function palissade(ctx, x0, x1, y, h, col, r, pas) { ctx.fillStyle = col; pas = pas || h * .22;
    for (let x = x0; x < x1; x += pas) { const hh = h * r.r(.88, 1.08); ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x, y - hh + pas * .6); ctx.lineTo(x + pas * .5, y - hh); ctx.lineTo(x + pas, y - hh + pas * .6); ctx.lineTo(x + pas, y + 2); ctx.closePath(); ctx.fill(); }
    ctx.fillRect(x0, y - h * .62, x1 - x0, h * .07); ctx.fillRect(x0, y - h * .3, x1 - x0, h * .07); }

  // bannière qui flotte (animée)
  function banniere(ctx, x, y, w, h, col, t, ph = 0) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y);
    const n = 8; for (let i = 1; i <= n; i++) { const k = i / n; ctx.lineTo(x + w * k, y + Math.sin(t * 2.4 + ph + k * 5) * h * .09 * k); }
    ctx.lineTo(x + w * .8, y + h * .5 + Math.sin(t * 2.4 + ph + 4) * h * .08);
    for (let i = n; i >= 0; i--) { const k = i / n; ctx.lineTo(x + w * k, y + h + Math.sin(t * 2.4 + ph + k * 5 + .6) * h * .09 * k); }
    ctx.closePath(); ctx.fill(); }

  function nuages(ctx, B, y0, y1, col, a, n, seed) { const r = rng(seed); for (let i = 0; i < n; i++) { const x = lerp(B.x0, B.x1, r()), y = lerp(y0, y1, r()), w = B.U * r.r(18, 46), h = B.U * r.r(2.2, 5);
    for (let k = 0; k < 5; k++) { const dx = (r() - .5) * w, hh = h * r.r(.6, 1.3), ww = w * r.r(.35, .7); ctx.save(); ctx.translate(x + dx, y + (r() - .5) * h); ctx.scale(ww / hh, 1);
      ctx.fillStyle = G.rad(ctx, 0, 0, 0, hh, [[0, rgba(col, a)], [.6, rgba(col, a * .3)], [1, rgba(col, 0)]]); ctx.beginPath(); ctx.arc(0, 0, hh, 0, TAU); ctx.fill(); ctx.restore(); } } }

  // ciel complet : dégradé, étoiles, astre, nuages. o = {haut, milieu, bas, astre:[u,v,rayon], col astre, halo}
  function ciel(B, o) { const ctx = B.couche(0), yh = B.Y(o.horizon == null ? .72 : o.horizon);
    ctx.fillStyle = G.lin(ctx, 0, 0, 0, yh, [[0, o.haut], [.55, o.milieu], [1, o.bas]]); ctx.fillRect(B.x0, 0, B.x1 - B.x0, B.H);
    if (B.nuit || o.etoiles) G.stars(ctx, B.x0, 0, B.x1, yh * .9, Math.round((B.x1 - B.x0) * yh / 5200), 11 + (o.seed || 0), "#dfe8ff");
    if (o.astre) G.astre(ctx, B.X(o.astre[0]), B.Y(o.astre[1]), B.U * o.astre[2], o.astreCol, o.halo, B.nuit && o.lune !== false);
    if (o.nuages !== false) nuages(ctx, B, B.Y(.04), yh * .8, o.nuageCol || o.bas, o.nuageA == null ? .22 : o.nuageA, o.nuagesN || 7, 5 + (o.seed || 0));
    return ctx; }

  // voile d'air entre deux plans
  const voile = (ctx, B, y0, y1, col, a) => { ctx.fillStyle = G.lin(ctx, 0, y0, 0, y1, [[0, rgba(col, 0)], [1, rgba(col, a)]]); ctx.fillRect(B.x0, y0, B.x1 - B.x0, y1 - y0); };

  // ---------- les lieux ----------
  const D = {};

  // Valdren : le village au bord du gué, la tour de la Guilde, la Crête au loin.
  D.village = B => { const n = B.nuit, r = B.r, Uu = B.U;
    const c = n ? { haut: "#070b16", milieu: "#131f36", bas: "#2b3d58", loin: "#1b2a40", bois: "#101b28", bati: "#0a1119", sol: "#0b1218", pre: "#04070b", brume: "#5f7fa6", feu: "#ffb766" }
                : { haut: "#27333c", milieu: "#8a8672", bas: "#e9bf7c", loin: "#6f7f86", bois: "#3a4a48", bati: "#1c2424", sol: "#232a22", pre: "#0c1210", brume: "#e7cf9c", feu: "#ffc37a" };
    B.lum = { col: n ? P.lune : "#ffd9a0", dir: 1, amb: n ? "#1a2740" : "#3a3024", brume: c.brume };
    ciel(B, { haut: c.haut, milieu: c.milieu, bas: c.bas, astre: n ? [.2, .2, 3.4] : [.3, .36, 4.2], astreCol: n ? "#eef3ff" : "#fff0cf", halo: n ? "#8fb1ff" : "#ffcf8a", nuageCol: n ? "#40557a" : "#f6dfb4", nuageA: n ? .2 : .26, horizon: .7 });
    // lointains : montagnes, et la Crête qui rougeoie
    let ctx = B.couche(.1); const yH = B.Y(.66);
    G.ridge(ctx, { x0: B.x0, x1: B.x1, y: B.Y(.5), amp: Uu * 13, freq: .7, seed: 4, bottom: B.H, fill: mixc(c.loin, c.bas, .45), jag: Uu * 1.2 });
    const cx = B.X(.84), cy = B.Y(.34); ctx.fillStyle = mixc(c.loin, c.bas, .3); ctx.beginPath(); ctx.moveTo(cx - Uu * 26, yH); ctx.lineTo(cx - Uu * 9, cy + Uu * 7); ctx.lineTo(cx - Uu * 3, cy); ctx.lineTo(cx + Uu * 1, cy + Uu * 2.5); ctx.lineTo(cx + Uu * 5, cy + Uu * .5); ctx.lineTo(cx + Uu * 12, cy + Uu * 10); ctx.lineTo(cx + Uu * 30, yH); ctx.closePath(); ctx.fill();
    G.glow(ctx, cx + Uu, cy + Uu, Uu * 9, P.braise, n ? .55 : .3);
    G.ridge(ctx, { x0: B.x0, x1: B.x1, y: B.Y(.6), amp: Uu * 6, freq: 1.3, seed: 9, bottom: B.H, fill: mixc(c.loin, c.bois, .5), jag: Uu });
    voile(ctx, B, B.Y(.45), yH, c.brume, n ? .22 : .38);
    B.dyn(.1, (x, t) => { G.glow(x, cx + Uu, cy + Uu * .5, Uu * (5 + Math.sin(t * .8) * .6), P.braise, (n ? .3 : .16) * (.8 + .2 * Math.sin(t * 1.9))); });
    B.part(.1, "fumee", { x: cx - Uu, y: cy - Uu * 8, w: Uu * 3, h: Uu * 8 }, { n: 5, col: n ? "#3a3f55" : "#8f8577", scale: Uu * .16 });
    // la forêt derrière le village
    ctx = B.couche(.22); const rb = rng("bois" + n); for (let x = B.x0; x < B.x1; x += Uu * rb.r(1.6, 3.2)) pin(ctx, x, B.Y(.685) + rb.r(-1, 1) * Uu, Uu * rb.r(7, 13), mixc(c.bois, c.bas, .16), rb);
    voile(ctx, B, B.Y(.56), B.Y(.7), c.brume, n ? .16 : .3);
    // le village
    ctx = B.couche(.36); const fens = [], ySol = B.Y(.725), rv = rng("valdren"), chem = [];
    palissade(ctx, B.x0, B.X(.2), ySol, Uu * 6.5, mixc(c.bati, c.bas, .1), rv); palissade(ctx, B.X(.86), B.x1, ySol, Uu * 6.5, mixc(c.bati, c.bas, .1), rv);
    const tourTop = tour(ctx, B.X(.56), ySol, Uu * 6.2, Uu * 25, mixc(c.bati, c.bas, .06), rv, { creneaux: true });
    ctx.fillStyle = mixc(c.bati, c.bas, .06); ctx.fillRect(B.X(.56) - Uu * 10, ySol - Uu * 11, Uu * 20, Uu * 11);
    ctx.beginPath(); ctx.moveTo(B.X(.56) - Uu * 11.5, ySol - Uu * 11); ctx.lineTo(B.X(.56), ySol - Uu * 17); ctx.lineTo(B.X(.56) + Uu * 11.5, ySol - Uu * 11); ctx.closePath(); ctx.fill();
    [[-6.5, -6], [6.5, -6], [0, -21], [0, -14.5]].forEach(([dx, dy]) => fens.push([B.X(.56) + dx * Uu, ySol + dy * Uu, Uu * 1.2, Uu * 2.1]));
    [[.25, 9, 6.4], [.33, 11.5, 7.4], [.42, 9.5, 6.2], [.69, 10.5, 6.8], [.775, 9, 6], [.14, 8, 5.4]].forEach(([u, w, h]) => { const f = maison(ctx, B.X(u), ySol + rv.r(-.3, .3) * Uu, Uu * w, Uu * h, mixc(c.bati, c.bas, rv.r(.02, .12)), rv); f.forEach(q => fens.push(q)); if (f.cheminee) chem.push(f.cheminee); });
    ctx.save(); ctx.globalCompositeOperation = "lighter"; lueursFenetres(ctx, fens, c.feu, n ? .95 : .5); ctx.restore();
    voile(ctx, B, ySol - Uu * 8, ySol + Uu, c.brume, n ? .12 : .2);
    B.dyn(.36, (x, t) => { banniere(x, tourTop[0] + Uu * .2, tourTop[1] - Uu * 5.5, Uu * 5.4, Uu * 3, rgba(P.acier, n ? .7 : .85), t); x.fillStyle = mixc(c.bati, c.bas, .06); x.fillRect(tourTop[0] - Uu * .15, tourTop[1] - Uu * 6, Uu * .3, Uu * 7);
      if (n) fens.forEach((f, i) => G.glow(x, f[0], f[1], f[3] * (2.6 + .5 * Math.sin(t * 5 + i * 2.1)), c.feu, .16)); });
    chem.slice(0, 3).forEach((q, i) => B.part(.36, "fumee", { x: q[0] - Uu * .4, y: q[1] - Uu * 7, w: Uu * .8, h: Uu * 7 }, { n: 6, col: n ? "#3d4660" : "#b7ab96", scale: Uu * .1, seed: "ch" + i }));
    // le gué : l'eau, ses reflets, les pierres
    ctx = B.couche(.55); const yEau = B.Y(.735), yRive = B.Y(.87);
    ctx.fillStyle = G.lin(ctx, 0, yEau, 0, yRive, [[0, mixc(c.bas, c.sol, .35)], [.5, mixc(c.milieu, c.sol, .55)], [1, mixc(c.sol, "#000", .2)]]); ctx.fillRect(B.x0, yEau, B.x1 - B.x0, yRive - yEau + 2);
    ctx.save(); ctx.globalCompositeOperation = "lighter"; fens.forEach(f => { ctx.fillStyle = G.lin(ctx, 0, yEau, 0, yEau + Uu * 7, [[0, rgba(c.feu, n ? .32 : .12)], [1, rgba(c.feu, 0)]]); ctx.fillRect(f[0] - f[2], yEau, f[2] * 2, Uu * 7); }); ctx.restore();
    const re = rng("gue"); ctx.fillStyle = mixc(c.sol, "#000", .35); for (let i = 0; i < 9; i++) { const u = .3 + i * .05 + re.r(-.01, .01), yy = lerp(yEau, yRive, .25 + .6 * (i % 2 ? .35 : .6) + re.r(-.1, .1)); ctx.beginPath(); ctx.ellipse(B.X(u), yy, Uu * re.r(1.2, 2.1), Uu * re.r(.4, .7), 0, 0, TAU); ctx.fill(); }
    B.dyn(.55, (x, t) => { x.save(); x.globalCompositeOperation = "lighter"; const rr = rng("ond"); for (let i = 0; i < 46; i++) { const px = lerp(B.x0, B.x1, rr()), py = lerp(yEau + Uu, yRive - Uu, rr()), w = Uu * rr.r(1.5, 6), a = .5 + .5 * Math.sin(t * rr.r(.8, 2) + i * 3);
      x.fillStyle = rgba(n ? P.lune : "#fff0c8", .1 * a); x.fillRect(px + Math.sin(t * .4 + i) * Uu, py, w, Math.max(1, Uu * .14)); } x.restore(); });
    // la berge où l'on se tient
    ctx = B.couche(.75); G.ridge(ctx, { x0: B.x0, x1: B.x1, y: B.Y(.845), amp: Uu * 1.6, freq: 1.4, seed: 21, bottom: B.H, fill: G.lin(ctx, 0, B.Y(.82), 0, B.H, [[0, mixc(c.sol, c.bas, .12)], [.25, c.sol], [1, mixc(c.sol, "#000", .55)]]) });
    herbe(ctx, B.x0, B.x1, B.Y(.85), Uu * 2.4, mixc(c.sol, c.bas, .1), rng("h1"), 1.2);
    B.sol = B.Y(.9);
    B.acteurs();
    ctx = B.couche(1); const rp = rng("pre"); herbe(ctx, B.x0, B.x1, B.H + Uu, Uu * 9, c.pre, rp, .8);
    // poteau indicateur et clôture à gauche, branche en haut à droite
    ctx.fillStyle = c.pre; const px = B.X(.035); ctx.fillRect(px, B.H - Uu * 22, Uu * 1.1, Uu * 24); ctx.beginPath(); ctx.moveTo(px - Uu * 5, B.H - Uu * 20); ctx.lineTo(px + Uu * 6.5, B.H - Uu * 20.6); ctx.lineTo(px + Uu * 8.4, B.H - Uu * 18.8); ctx.lineTo(px + Uu * 6.5, B.H - Uu * 17); ctx.lineTo(px - Uu * 5, B.H - Uu * 17.4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = c.pre; ctx.lineCap = "round"; branche(ctx, B.x1 + Uu * 2, B.Y(.02), Uu * 22, Math.PI * .93, Uu * 2.6, rng("br"), 5);
    G.fog(ctx, B.x0, B.x1, B.Y(.9), Uu * 6, c.brume, n ? .1 : .16, 31, 12);
    B.part(1, n ? "luciole" : "poussiere", { x: B.x0, y: B.Y(.4), w: B.x1 - B.x0, h: B.Y(.95) - B.Y(.4) }, { n: n ? 26 : 40 });
    if (!n) B.part(1, "feuille", { x: B.x0, y: 0, w: B.x1 - B.x0, h: B.H }, { n: 7, col: "#b9853d" });
  };

  // Lisière des ronces : futaie haute, rais de lumière, ronciers.
  D.lisiere = B => { const n = B.nuit, Uu = B.U;
    const c = n ? { haut: "#081018", milieu: "#122434", bas: "#27425a", f1: "#1c3346", f2: "#122434", f3: "#0a1620", sol: "#0a141a", pre: "#03070a", brume: "#6f93b4", rai: "#9cc4ff" }
                : { haut: "#3b4a3e", milieu: "#9aa37a", bas: "#f0d590", f1: "#8a9a74", f2: "#4f6650", f3: "#253a32", sol: "#1c2a22", pre: "#08100d", brume: "#f0dc9e", rai: "#ffe9a8" };
    B.lum = { col: n ? P.lune : "#ffe2a4", dir: -1, amb: n ? "#14283a" : "#33402c", brume: c.brume };
    let ctx = ciel(B, { haut: c.haut, milieu: c.milieu, bas: c.bas, astre: n ? [.3, .22, 3] : [.26, .3, 6], astreCol: n ? "#eef3ff" : "#fff6d8", halo: n ? "#8fb1ff" : "#ffe7a0", nuages: false, horizon: .78 });
    G.glow(ctx, B.X(.28), B.Y(.3), Uu * 60, c.rai, n ? .16 : .34);
    // trois rideaux d'arbres, du plus pâle au plus sombre
    const rideau = (p, col, yb, hMin, hMax, pas, seed, wk) => { const cx = B.couche(p), rr = rng(seed); for (let x = B.x0 - Uu * 4; x < B.x1 + Uu * 4; x += Uu * rr.r(pas * .6, pas * 1.5)) { const w = Uu * rr.r(wk * .6, wk * 1.4); tronc(cx, x, -Uu * 4, B.Y(yb) + rr.r(-1, 1) * Uu, w, col, rr, rr.r(-.03, .03)); }
      // frondaisons en haut
      for (let x = B.x0; x < B.x1; x += Uu * rr.r(6, 12)) { G.blob(cx, x, B.Y(rr.r(-.02, .1)), Uu * rr.r(9, 16), Uu * rr.r(5, 9), rr.i(1, 999), .3, 18); cx.fillStyle = col; cx.fill(); } return cx; };
    ctx = rideau(.12, mixc(c.f1, c.bas, .4), .74, 0, 0, 9, "r1" + n, 1.6); voile(ctx, B, 0, B.Y(.8), c.brume, n ? .2 : .32);
    ctx = rideau(.24, mixc(c.f2, c.bas, .16), .77, 0, 0, 13, "r2" + n, 2.6); voile(ctx, B, B.Y(.3), B.Y(.82), c.brume, n ? .16 : .26);
    G.shafts(ctx, B.X(.1), -Uu * 12, B.H * 1.25, Uu * 70, c.rai, n ? .1 : .17, 9, 14, -.42);
    ctx = rideau(.4, c.f3, .81, 0, 0, 20, "r3" + n, 4.2);
    // le sol : terre, fougères, ronces du plan moyen
    ctx = B.couche(.6); G.ridge(ctx, { x0: B.x0, x1: B.x1, y: B.Y(.83), amp: Uu * 2, freq: 1.2, seed: 5, bottom: B.H, fill: G.lin(ctx, 0, B.Y(.8), 0, B.H, [[0, mixc(c.sol, c.bas, .2)], [.3, c.sol], [1, mixc(c.sol, "#000", .6)]]) });
    herbe(ctx, B.x0, B.x1, B.Y(.835), Uu * 3, mixc(c.sol, c.bas, .14), rng("lh"), 1.1);
    ronces(ctx, B.x0, B.x1, B.Y(.84), Uu * 5, mixc(c.f3, "#000", .2), rng("ro1"), Math.round((B.x1 - B.x0) / (Uu * 14)));
    G.fog(ctx, B.x0, B.x1, B.Y(.82), Uu * 7, c.brume, n ? .14 : .22, 8, 14);
    B.sol = B.Y(.9);
    B.acteurs();
    ctx = B.couche(1); const rp = rng("lp" + n);
    tronc(ctx, B.x0 + Uu * 5, -Uu * 6, B.H + Uu * 2, Uu * 11, c.pre, rp, .02); tronc(ctx, B.x1 - Uu * 2, -Uu * 6, B.H + Uu * 4, Uu * 14, c.pre, rp, -.03);
    ronces(ctx, B.x0, B.x1, B.H + Uu, Uu * 9, c.pre, rp, Math.round((B.x1 - B.x0) / (Uu * 22)));
    herbe(ctx, B.x0, B.x1, B.H + Uu, Uu * 7, c.pre, rp, .7);
    G.shafts(ctx, B.X(.02), -Uu * 12, B.H * 1.3, Uu * 50, c.rai, n ? .05 : .08, 5, 3, -.42);
    B.part(1, n ? "luciole" : "poussiere", { x: B.x0, y: B.Y(.2), w: B.x1 - B.x0, h: B.Y(.95) - B.Y(.2) }, { n: n ? 34 : 60 });
    B.part(1, "feuille", { x: B.x0, y: 0, w: B.x1 - B.x0, h: B.H }, { n: n ? 4 : 10, col: n ? "#3d5a66" : "#c98a3a" });
    B.part(.6, "brume", { x: B.x0, y: B.Y(.7), w: B.x1 - B.x0, h: Uu * 14 }, { n: 7, col: c.brume, scale: Uu * .09 });
  };

  // ---------- fabrique ----------
  // safe = {x,y,w,h} : fenêtre utile. Renvoie B avec B.items, la liste ordonnée à composer.
  function creer(cle, W, H, safe, nuit, donnees) { const M = Math.round(Math.max(W, H) * .035);
    const B = { cle, donnees, W, H, M, s: safe, nuit: !!nuit, r: rng(cle + (nuit ? "/n" : "/j")), items: [], x0: -M, x1: W + M, U: safe.h / 100,
      X: u => safe.x + u * safe.w, Y: v => safe.y + v * safe.h, sol: safe.y + safe.h * .9, lum: { col: "#ffd9a0", dir: 1, amb: "#2a2a2a", brume: "#b9c9c4" },
      couche(p) { const c = G.mk(W + 2 * M, H), ctx = c.getContext("2d"); ctx.translate(M, 0); B.items.push({ c, p }); return ctx; },
      dyn(p, draw) { B.items.push({ p, draw }); },
      part(p, kind, A, o) { B.items.push({ p, sys: G.particules(kind, A, o) }); },
      acteurs() { B.items.push({ acteurs: true }); } };
    (D[cle] || D.village)(B);
    if (!B.items.some(i => i.acteurs)) B.items.push({ acteurs: true });
    return B; }

  return { creer, D, outils: { pin, feuillu, arbreMort, branche, tronc, herbe, ronces, rochers, maison, lueursFenetres, tour, palissade, banniere, nuages, ciel, voile } };
})();
