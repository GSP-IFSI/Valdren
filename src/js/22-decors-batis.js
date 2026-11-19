// Décors bâtis : fort, cellule, forge, herboristerie, guilde, auberge, bataille, titre.
(() => { const G = VG.gfx, U = VG.u, O = VG.decors.outils, D = VG.decors.D, P = G.PAL; const { clamp, lerp, rng, rgba, mixc, TAU } = U;

  // ---------- outils propres aux décors bâtis ----------
  const ton = (col, k) => k >= 0 ? mixc(col, "#ffffff", k) : mixc(col, "#000000", -k);
  const tonA = (col, k) => k >= 0 ? U.mix(col, "#ffffff", k) : U.mix(col, "#000000", -k);   // même chose, en [r,v,b] réutilisable
  const poly = (ctx, pts, col) => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); if (col) { ctx.fillStyle = col; ctx.fill(); } };
  const rrect = (ctx, x, y, w, h, r) => { r = Math.max(0, Math.min(r, w / 2, h / 2)); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  const seg = (ctx, x0, y0, x1, y1, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  // lumière posée sur ce qui est déjà peint dans la couche (éclaire les silhouettes sans déborder sur le vide)
  const eclaire = (ctx, x, y, r, col, a) => G.glow(ctx, x, y, r, col, a, "source-atop");
  const ombre = (ctx, x, y, r, a) => G.glow(ctx, x, y, r, "#000000", a, "source-over");

  // Repère de scène : (u, v) pensés pour un cadre 16:9. Quand la fenêtre utile est plus étroite (téléphone en portrait),
  // la scène recule un peu autour de sa ligne de sol au lieu de s'écraser. T(v) part du haut de la fenêtre (poutres, plafond).
  function repere(B, vSol = .8, kMin = .76) { const k = clamp(B.s.w / (B.U * 178), kMin, 1.1), E = B.U * k, cx = B.X(.5), ys = B.Y(vSol);
    return { k, E, X: u => cx + (u - .5) * 178 * E, Y: v => ys + (v - vSol) * 100 * E, T: v => B.Y(0) + v * 100 * E }; }

  // mur de pierres : assises irrégulières, joints sombres, tons légèrement variés
  function pierres(ctx, x0, y0, x1, y1, o) { const r = rng(o.seed || 1), h = o.h, v = o.v == null ? .07 : o.v, lw = o.joint == null ? Math.max(1, h * .07) : o.joint;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip(); ctx.fillStyle = o.fond || ton(o.col, -.45); ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (let y = y0; y < y1;) { const hh = h * r.r(.8, 1.2); let x = x0 - h * r.r(0, 1.6);
      while (x < x1) { const w = h * r.r(1.15, 2.5); ctx.fillStyle = ton(o.col, r.r(-v, v)); rrect(ctx, x + lw / 2, y + lw / 2, w - lw, hh - lw, h * .14); ctx.fill(); x += w; }
      y += hh; }
    ctx.restore(); }

  // bardage de planches (verticales, ou horizontales avec o.horiz)
  function planches(ctx, x0, y0, x1, y1, col, o = {}) { const r = rng(o.seed || 5), l = o.l || 20, v = o.v == null ? .05 : o.v, j = Math.max(1, l * .06);
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
    if (o.horiz) for (let y = y0; y < y1;) { const h = l * r.r(.8, 1.25); ctx.fillStyle = ton(col, r.r(-v, v)); ctx.fillRect(x0, y, x1 - x0, h + 1); ctx.fillStyle = rgba("#000", o.j || .3); ctx.fillRect(x0, y + h - j, x1 - x0, j); y += h; }
    else for (let x = x0; x < x1;) { const w = l * r.r(.8, 1.25); ctx.fillStyle = ton(col, r.r(-v, v)); ctx.fillRect(x, y0, w + 1, y1 - y0); ctx.fillStyle = rgba("#000", o.j || .3); ctx.fillRect(x + w - j, y0, j, y1 - y0); x += w; }
    ctx.restore(); }

  // assombrit les bords de l'image (intérieurs) ; centré sur la fenêtre utile
  function vignette(ctx, B, a, col = "#000000", k = 1) { const cx = B.X(.5), cy = B.Y(.52), R = Math.hypot(B.s.w, B.s.h) * .62 * k;
    ctx.fillStyle = G.rad(ctx, cx, cy, R * .4, R, [[0, rgba(col, 0)], [.6, rgba(col, a * .45)], [1, rgba(col, a)]]); ctx.fillRect(B.x0, 0, B.x1 - B.x0, B.H); }

  // chaîne : maillons alternés le long d'un segment (mou = flèche)
  function chaine(ctx, x0, y0, x1, y1, m, col, mou = 0) { const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(d / (m * 1.45))), a = Math.atan2(y1 - y0, x1 - x0); ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, m * .3);
    for (let i = 0; i <= n; i++) { const k = i / n, x = lerp(x0, x1, k), y = lerp(y0, y1, k) + Math.sin(k * Math.PI) * mou; ctx.beginPath(); ctx.ellipse(x, y, m * (i % 2 ? .95 : .55), m * (i % 2 ? .45 : .16), a, 0, TAU); ctx.stroke(); } }

  // torche ou brasero : le support est peint dans la couche, la flamme est rendue par l'appelant (liste feux)
  function torche(ctx, feux, x, y, h, col, seed) { ctx.fillStyle = col; ctx.fillRect(x - h * .06, y - h * .05, h * .12, h * .85); poly(ctx, [[x - h * .22, y - h * .1], [x + h * .22, y - h * .1], [x + h * .12, y + h * .16], [x - h * .12, y + h * .16]], col); feux.push([x, y - h * .08, h, seed == null ? feux.length * 1.7 : seed]); }
  function brasero(ctx, feux, x, y, h, col, seed) { ctx.strokeStyle = col; ctx.lineCap = "round"; ctx.lineWidth = Math.max(1.2, h * .07);
    [[-.3, -.42], [.3, .42], [0, 0]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(x + a * h, y - h * .62); ctx.lineTo(x + b * h * 1.05, y); ctx.stroke(); });
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - h * .5, y - h * .95); ctx.quadraticCurveTo(x, y - h * .35, x + h * .5, y - h * .95); ctx.closePath(); ctx.fill(); ctx.fillRect(x - h * .54, y - h * .99, h * 1.08, h * .09);
    feux.push([x, y - h * .96, h * .95, seed == null ? feux.length * 1.7 : seed]); }
  const flammes = (B, p, feux, k = 1) => { if (feux.length) B.dyn(p, (x, t) => { for (const f of feux) G.flamme(x, f[0], f[1], f[2] * k, t, f[3]); }); };

  // pieu taillé en pointe, planté de biais
  function pieu(ctx, x, y, len, ang, w, col) { const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy * w / 2, ny = dx * w / 2, p = len * .2;
    poly(ctx, [[x + nx, y + ny], [x + dx * (len - p) + nx, y + dy * (len - p) + ny], [x + dx * len, y + dy * len], [x + dx * (len - p) - nx, y + dy * (len - p) - ny], [x - nx, y - ny]], col); }
  // cheval de frise : rondin couché hérissé de pieux croisés
  function frise(ctx, x, y, l, h, col, r) { seg(ctx, x - l / 2, y - h * .35, x + l / 2, y - h * .32, h * .16, col); const n = Math.max(3, Math.round(l / (h * .5)));
    for (let i = 0; i < n; i++) { const px = x - l / 2 + (i + .5) * l / n, s = i % 2 ? 1 : -1; pieu(ctx, px - s * h * .28, y + 2, h * r.r(.9, 1.15), -Math.PI / 2 + s * r.r(.42, .62), h * .13, col); } }

  // ====================================================================================================
  // Le fort de Varek : forteresse de renégats sur sa butte, palissade, tours, torches et bannières de braise.
  D.fort = B => { const n = B.nuit, Uu = B.U, R = repere(B, .56), E = R.E, X = R.X, yT = B.Y(.56);
    const c = n ? { haut: "#04060c", milieu: "#0c1524", bas: "#22324a", loin: "#141f2e", roc: "#0e151d", bati: "#05080c", sol: "#0a0f14", pre: "#020305", brume: "#5b7599", feu: "#ffab5c" }
                : { haut: "#141b22", milieu: "#4c5a65", bas: "#b7b6a8", loin: "#5c6a74", roc: "#2c353b", bati: "#11161a", sol: "#1d2427", pre: "#06090b", brume: "#b4bbb9", feu: "#ffb86a" };
    B.lum = { col: n ? "#ffb070" : "#dfe4e4", dir: n ? 1 : -1, amb: n ? "#121a28" : "#262d34", brume: c.brume };
    // ciel d'acier : chape de nuages lourds, astre voilé
    let ctx = O.ciel(B, { haut: c.haut, milieu: c.milieu, bas: c.bas, astre: n ? [.86, .2, 2.8] : [.075, .31, 3.8], astreCol: n ? "#dfe8f6" : "#f0ead8", halo: n ? "#7f9fd0" : "#e6dcc4", nuageCol: n ? "#34465f" : "#d6d4c6", nuageA: n ? .18 : .22, horizon: .62, seed: 3 });
    O.nuages(ctx, B, B.Y(-.03), B.Y(.26), n ? "#020409" : "#10161b", n ? .6 : .55, 10, 41);
    O.nuages(ctx, B, B.Y(.2), B.Y(.46), n ? "#0a111c" : "#343f48", .34, 7, 43);
    // montagnes en dents de scie
    ctx = B.couche(.08);
    G.ridge(ctx, { x0: B.x0, x1: B.x1, y: B.Y(.45), amp: Uu * 13, freq: .9, seed: 31, bottom: B.H, fill: mixc(c.loin, c.bas, .52), jag: Uu * 2.6 });
    G.ridge(ctx, { x0: B.x0, x1: B.x1, y: B.Y(.54), amp: Uu * 7, freq: 1.5, seed: 37, bottom: B.H, fill: mixc(c.loin, c.bas, .26), jag: Uu * 1.6 });
    O.voile(ctx, B, B.Y(.38), B.Y(.66), c.brume, n ? .26 : .42);
    // bois mort au pied de la butte
    ctx = B.couche(.2); const rf = rng("fortbois"), colB = mixc(c.roc, c.bas, .3);
    G.ridge(ctx, { x0: B.x0, x1: B.x1, y: B.Y(.63), amp: Uu * 2.5, freq: 1.2, seed: 12, bottom: B.H, fill: colB });
    for (let x = B.x0; x < B.x1; x += Uu * rf.r(2.5, 7)) { const y = B.Y(.635) + rf.r(-1, 1) * Uu; rf() < .45 ? O.arbreMort(ctx, x, y, Uu * rf.r(9, 16), colB, rf) : O.pin(ctx, x, y, Uu * rf.r(6, 12), colB, rf); }
    O.voile(ctx, B, B.Y(.5), B.Y(.68), c.brume, n ? .2 : .34);
    // ---- la butte et le fort ----
    ctx = B.couche(.36); const feux = [], bans = [], rb = rng("varek"), colP = mixc(c.bati, c.bas, .05), colF = mixc(c.bati, c.bas, .13), colT = mixc(c.bati, c.bas, .1);
    // grande salle derrière la palissade (toit long, cheminée)
    poly(ctx, [[X(.5), yT], [X(.5), yT - E * 12], [X(.535), yT - E * 19], [X(.63), yT - E * 19.6], [X(.66), yT - E * 12], [X(.66), yT]], colF); ctx.fillRect(X(.6), yT - E * 23, E * 2.2, E * 6);
    poly(ctx, [[X(.3), yT], [X(.3), yT - E * 11], [X(.33), yT - E * 16], [X(.39), yT - E * 16.4], [X(.41), yT - E * 11], [X(.41), yT]], colF);
    // tour de guet en bois
    const gx = X(.2), gh = E * 31; ctx.strokeStyle = colP; ctx.lineCap = "round"; ctx.lineWidth = E * .9;
    [[-4.6, -2.9], [4.6, 2.9]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(gx + a * E, yT + E); ctx.lineTo(gx + b * E, yT - E * 23); ctx.stroke(); });
    ctx.lineWidth = E * .5; [[0, 7.5], [7.5, 15], [15, 22.5]].forEach(([a, b]) => { const w0 = lerp(4.4, 3, a / 23) * E, w1 = lerp(4.4, 3, b / 23) * E; ctx.beginPath(); ctx.moveTo(gx - w0, yT - a * E); ctx.lineTo(gx + w1, yT - b * E); ctx.moveTo(gx + w0, yT - a * E); ctx.lineTo(gx - w1, yT - b * E); ctx.moveTo(gx - w1, yT - b * E); ctx.lineTo(gx + w1, yT - b * E); ctx.stroke(); });
    ctx.fillStyle = colP; ctx.fillRect(gx - E * 5.4, yT - E * 23.6, E * 10.8, E * 1.1);
    [-5, -1.7, 1.7, 5].forEach(d => ctx.fillRect(gx + d * E - E * .3, yT - E * 30, E * .6, E * 6.6)); ctx.fillRect(gx - E * 5.4, yT - E * 26.6, E * 10.8, E * .6);
    poly(ctx, [[gx - E * 7, yT - E * 29.6], [gx - E * .6, yT - E * 34.6], [gx + E * .9, yT - E * 34.4], [gx + E * 7, yT - E * 29.6]], colP);
    // l'échelle et la sentinelle
    ctx.lineWidth = E * .3; ctx.beginPath(); ctx.moveTo(gx + E * 6.4, yT + E); ctx.lineTo(gx + E * 3.6, yT - E * 23); ctx.moveTo(gx + E * 7.9, yT + E); ctx.lineTo(gx + E * 5.1, yT - E * 23); ctx.stroke();
    for (let i = 1; i < 14; i++) { const k = i / 14, lx = lerp(gx + E * 6.4, gx + E * 3.6, k), ly = lerp(yT + E, yT - E * 23, k); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + E * 1.5, ly); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(gx - E * 1.4, yT - E * 28.2, E * .62, 0, TAU); ctx.fill(); poly(ctx, [[gx - E * 2.3, yT - E * 23.6], [gx - E * 2.1, yT - E * 27.4], [gx - E * .7, yT - E * 27.4], [gx - E * .5, yT - E * 23.6]], colP); seg(ctx, gx - E * .1, yT - E * 23.6, gx - E * .1, yT - E * 30.4, E * .2, colP);
    bans.push([gx + E * .2, yT - E * 39.4, 5, 2.9, .5]); ctx.fillRect(gx, yT - E * 40, E * .3, E * 6);
    // palissade
    O.palissade(ctx, X(.03), X(.432), yT + E * 2, E * 13.5, colP, rb, E * 1.75); O.palissade(ctx, X(.508), X(.99), yT + E * 2, E * 13.5, colP, rb, E * 1.75);
    // porte fortifiée : deux poteaux massifs, galerie couverte, herse à demi levée
    const px0 = X(.432), px1 = X(.508), pm = (px0 + px1) / 2, pw = px1 - px0;
    ctx.fillStyle = G.lin(ctx, 0, yT - E * 12, 0, yT + E, [[0, mixc(c.bati, c.feu, n ? .32 : .2)], [1, mixc(c.bati, c.feu, n ? .62 : .4)]]); ctx.fillRect(px0, yT - E * 12, pw, E * 13);
    ctx.fillStyle = mixc(c.bati, c.feu, n ? .2 : .14); ctx.fillRect(pm - E * 3.2, yT - E * 5.5, E * 2.6, E * 6); poly(ctx, [[pm - E * 3.8, yT - E * 5.4], [pm - E * 1.9, yT - E * 7.6], [pm, yT - E * 5.4]]); ctx.fill();
    ctx.fillStyle = colP; for (let i = 0; i <= 6; i++) { const bx = px0 + pw * (i + .5) / 7; poly(ctx, [[bx - E * .28, yT - E * 12], [bx + E * .28, yT - E * 12], [bx + E * .28, yT - E * 5.6], [bx, yT - E * 4.4], [bx - E * .28, yT - E * 5.6]], colP); }
    ctx.fillRect(px0, yT - E * 9.6, pw, E * .5); ctx.fillRect(px0, yT - E * 7, pw, E * .5);
    [px0 - E * 1.5, px1 + E * 1.5].forEach(x => poly(ctx, [[x - E * 1.9, yT + E * 2], [x - E * 1.7, yT - E * 19], [x, yT - E * 21.4], [x + E * 1.7, yT - E * 19], [x + E * 1.9, yT + E * 2]], colP));
    ctx.fillRect(px0 - E * 3.6, yT - E * 17.4, pw + E * 7.2, E * 5.6); poly(ctx, [[px0 - E * 5, yT - E * 17.2], [pm - E * 1, yT - E * 20.6], [pm + E * 1, yT - E * 20.6], [px1 + E * 5, yT - E * 17.2]], colP);
    ctx.fillStyle = mixc(c.bati, c.feu, n ? .75 : .45); [-3.2, 0, 3.2].forEach(d => ctx.fillRect(pm + d * E - E * .3, yT - E * 15.6, E * .6, E * 2));
    // bois de cerf cloués au fronton
    ctx.strokeStyle = colP; ctx.lineWidth = E * .34; [-1, 1].forEach(s => { ctx.beginPath(); ctx.moveTo(pm, yT - E * 20.4); ctx.quadraticCurveTo(pm + s * E * 2.6, yT - E * 21, pm + s * E * 3.6, yT - E * 24.6); ctx.moveTo(pm + s * E * 1.8, yT - E * 21); ctx.lineTo(pm + s * E * 1.5, yT - E * 23.4); ctx.moveTo(pm + s * E * 3, yT - E * 22.4); ctx.lineTo(pm + s * E * 4.6, yT - E * 23.2); ctx.stroke(); });
    torche(ctx, feux, px0 - E * 3.4, yT - E * 9.4, E * 2.6, colP); torche(ctx, feux, px1 + E * 3.4, yT - E * 9.4, E * 2.6, colP);
    bans.push([px0 - E * 1.3, yT - E * 26.6, 5.4, 3.1, 1.3]); ctx.fillStyle = colP; ctx.fillRect(px0 - E * 1.65, yT - E * 27.2, E * .34, E * 7); bans.push([px1 + E * 1.7, yT - E * 26.6, 5.4, 3.1, 2.6]); ctx.fillRect(px1 + E * 1.35, yT - E * 27.2, E * .34, E * 7);
    // tour de pierre trapue
    const tx = X(.715), tw = E * 17, th = E * 30, top = O.tour(ctx, tx, yT + E * 2, tw, th + E * 2, colT, rb, { creneaux: true }); const rt = rng("tourvarek");
    for (let i = 0; i < 46; i++) { const sx = tx + rt.r(-.44, .4) * tw, sy = yT - rt.r(.02, .96) * th; ctx.fillStyle = rgba(rt() < .5 ? c.bas : "#000000", rt.r(.03, .09)); rrect(ctx, sx, sy, E * rt.r(1.4, 3), E * rt.r(.9, 1.4), E * .2); ctx.fill(); }
    { const s = n ? 1 : -1; poly(ctx, [[tx + s * tw * .46, yT - th], [tx + s * tw * .54, yT], [tx + s * (tw * .54 - E * .7), yT], [tx + s * (tw * .46 - E * .5), yT - th]], rgba(n ? c.brume : c.bas, n ? .16 : .24)); }
    ctx.fillStyle = colP; ctx.fillRect(tx - tw * .68, yT - th - E * .4, tw * 1.36, E * 1.3); for (let i = 0; i < 7; i++) ctx.fillRect(tx - tw * .64 + i * tw * .2, yT - th + E * .8, E * .7, E * 2.2);
    ctx.fillStyle = mixc(c.bati, c.feu, n ? .85 : .5); [[-3.4, -21], [3, -14], [-1.5, -7.4], [3.6, -24.4]].forEach(([dx, dy]) => { ctx.fillRect(tx + dx * E - E * .32, yT + dy * E, E * .64, E * 2.8); G.glow(ctx, tx + dx * E, yT + dy * E + E * 1.4, E * 4, c.feu, n ? .3 : .12); });
    brasero(ctx, feux, tx - tw * .2, yT - th - E * 3.2, E * 3, colP); bans.push([tx + tw * .3, yT - th - E * 12, 7.4, 4.2, 4]); ctx.fillStyle = colP; ctx.fillRect(tx + tw * .3 - E * .4, yT - th - E * 12.8, E * .44, E * 10);
    [.1, .3, .62, .86].forEach((u, i) => torche(ctx, feux, X(u), yT - E * 8.6, E * 2.3, colP, i * 2.3 + 5));
    // la butte de roc
    const haut = x => { const d = Math.abs(x - X(.5)) / (E * 84); return yT + E * (1.2 + (U.fbm1(x / (E * 9), 5, 3) - .5) * 2.2) + Math.pow(Math.max(0, d - .86) * 2.2, 1.6) * E * 16; };
    ctx.beginPath(); ctx.moveTo(B.x0, B.H); for (let x = B.x0; x <= B.x1 + 4; x += 4) ctx.lineTo(x, haut(x)); ctx.lineTo(B.x1, B.H); ctx.closePath();
    ctx.fillStyle = G.lin(ctx, 0, yT, 0, B.Y(.84), [[0, mixc(c.roc, c.bas, .1)], [.5, mixc(c.roc, c.bas, .2)], [1, mixc(c.roc, c.brume, .5)]]); ctx.fill();
    // corniche de roc sous la palissade, strates, éboulis, chemin qui descend de la porte
    ctx.beginPath(); ctx.moveTo(B.x0, haut(B.x0)); for (let x = B.x0; x <= B.x1 + 4; x += 4) ctx.lineTo(x, haut(x) - 1);
    for (let x = B.x1 + 4; x >= B.x0; x -= 4) { const q = Math.abs(x - X(.47)) < E * 7 ? .25 : 1; ctx.lineTo(x, haut(x) + E * q * (2.2 + 8 * Math.pow(U.fbm1(x / (E * 7), 77, 2), 1.5) + (U.fbm1(x / (E * 1.2), 78, 2) - .5) * 2.4)); }
    ctx.closePath(); ctx.fillStyle = mixc(c.roc, "#000000", n ? .3 : .34); ctx.fill();
    const rr = rng("butte"); for (let i = 0; i < 26; i++) { const x = lerp(B.x0, B.x1, rr()), y = haut(x) + E * rr.r(1.5, 13), w = E * rr.r(4, 11), h = E * rr.r(1.2, 3.2); poly(ctx, [[x - w, y + h], [x - w * rr.r(.3, .7), y - h * rr.r(.2, 1)], [x + w * rr.r(.1, .5), y - h], [x + w, y + h * rr.r(.2, 1)]], rgba(rr() < .5 ? "#000000" : c.bas, rr.r(.05, .12))); }
    ctx.fillStyle = rgba(c.bas, n ? .1 : .2); ctx.beginPath(); ctx.moveTo(pm - E * 3.4, yT + E * 1.6); ctx.bezierCurveTo(pm - E * 5, yT + E * 9, pm + E * 9, yT + E * 12, pm - E * 4, B.Y(.84)); ctx.lineTo(pm + E * 24, B.Y(.84)); ctx.bezierCurveTo(pm + E * 20, yT + E * 12, pm + E * 2, yT + E * 9, pm + E * 3.4, yT + E * 1.6); ctx.closePath(); ctx.fill();
    // pieux de défense hérissés au pied de la palissade
    for (let x = X(.02); x < X(.99); x += E * rb.r(2.2, 3.6)) { if (Math.abs(x - pm) < pw * .9) continue; const s = x < pm ? -1 : 1; pieu(ctx, x, haut(x) + E * 1.4, E * rb.r(4.4, 6.4), -Math.PI / 2 + s * rb.r(.5, .85), E * .62, colP); }
    // lueurs : la cour derrière la porte, les torches sur le bois
    G.glow(ctx, pm, yT - E * 3, E * 16, c.feu, n ? .42 : .2); eclaire(ctx, pm, yT + E * 3, E * 22, c.feu, n ? .34 : .14);
    feux.forEach(f => { eclaire(ctx, f[0], f[1] + E, E * 13, c.feu, n ? .55 : .2); G.glow(ctx, f[0], f[1], E * 9, c.feu, n ? .3 : .12); });
    O.voile(ctx, B, yT + E * 3, B.Y(.84), c.brume, n ? .42 : .6); ctx.fillStyle = rgba(c.brume, n ? .42 : .6); ctx.fillRect(B.x0, B.Y(.84) - 1, B.x1 - B.x0, B.H);
    G.fog(ctx, B.x0, B.x1, B.Y(.71), Uu * 8, c.brume, n ? .22 : .34, 17, 16);
    B.dyn(.36, (x, t) => { for (const f of feux) G.flamme(x, f[0], f[1], f[2], t, f[3]);
      for (const b of bans) O.banniere(x, b[0], b[1], E * b[2], E * b[3], n ? "#b85a38" : "#a9502f", t * 1.25, b[4]);
      // corbeaux qui tournent au-dessus de la tour
      x.strokeStyle = rgba(c.bati, .85); x.lineWidth = Math.max(1, E * .22); x.lineCap = "round";
      for (let i = 0; i < 5; i++) { const a = t * (.22 + i * .03) + i * 1.9, bx = tx + Math.cos(a) * E * (14 + i * 4) - E * 6, by = yT - th - E * (13 + i * 2.2) + Math.sin(a * 1.3) * E * 3, f = Math.sin(t * 7 + i * 2) * E * .9, s = E * (1 + .2 * Math.sin(a));
        x.beginPath(); x.moveTo(bx - s * 1.3, by - f); x.quadraticCurveTo(bx - s * .5, by - s * .5, bx, by); x.quadraticCurveTo(bx + s * .5, by - s * .5, bx + s * 1.3, by - f); x.stroke(); } });
    B.part(.36, "fumee", { x: X(.6), y: yT - E * 36, w: E * 3, h: E * 13 }, { n: 9, col: n ? "#2c3244" : "#6f6f6c", scale: E * .16, seed: "fv1" });
    B.part(.36, "fumee", { x: pm - E * 2, y: yT - E * 30, w: E * 4, h: E * 12 }, { n: 7, col: n ? "#3a3340" : "#77726b", scale: E * .15, seed: "fv2" });
    // terre-plein brumeux derrière les combattants : chevaux de frise sur les côtés
    ctx = B.couche(.6); const rm = rng("glacis"), colM = mixc(c.sol, c.brume, n ? .3 : .4);
    G.ridge(ctx, { x0: B.x0, x1: B.x1, y: B.Y(.815), amp: Uu * 1.6, freq: 1.5, seed: 7, bottom: B.H, fill: G.lin(ctx, 0, B.Y(.8), 0, B.Y(.9), [[0, mixc(c.sol, c.brume, n ? .42 : .55)], [1, mixc(c.sol, c.brume, n ? .2 : .26)]]) });
    frise(ctx, B.X(.06), B.Y(.83), Uu * 17, Uu * 7.5, colM, rm); frise(ctx, B.X(.955), B.Y(.835), Uu * 15, Uu * 7, colM, rm); if (B.s.w > Uu * 130) frise(ctx, B.X(.5), B.Y(.822), Uu * 12, Uu * 4.6, mixc(c.sol, c.brume, n ? .4 : .52), rm);
    O.rochers(ctx, B.x0, B.x1, B.Y(.83), Uu * 2.2, colM, rm, 9);
    G.fog(ctx, B.x0, B.x1, B.Y(.8), Uu * 6, c.brume, n ? .2 : .3, 23, 14);
    B.part(.6, "brume", { x: B.x0, y: B.Y(.68), w: B.x1 - B.x0, h: Uu * 14 }, { n: 7, col: c.brume, scale: Uu * .09 });
    // le sol
    ctx = B.couche(.78); G.ridge(ctx, { x0: B.x0, x1: B.x1, y: B.Y(.858), amp: Uu * 1.3, freq: 1.6, seed: 19, bottom: B.H, fill: G.lin(ctx, 0, B.Y(.84), 0, B.Y(1.08), [[0, mixc(c.sol, c.brume, .22)], [.3, c.sol], [1, mixc(c.sol, "#000000", .6)]]) });
    O.herbe(ctx, B.x0, B.x1, B.Y(.862), Uu * 1.7, mixc(c.sol, c.brume, .16), rng("fh"), .5); O.rochers(ctx, B.x0, B.x1, B.Y(.875), Uu * 1.1, mixc(c.sol, "#000000", .2), rng("fr"), 10);
    B.sol = B.Y(.9);
    B.acteurs();
    // premier plan : pieux de défense, lance au chiffon
    ctx = B.couche(1); const yb = Math.min(B.H, B.Y(1.03)), rp = rng("fp");
    ctx.fillStyle = c.pre; ctx.fillRect(B.x0, yb - Uu * 2, B.x1 - B.x0, B.H - yb + Uu * 2);
    [[-2, -.98, 33], [4.5, -1.16, 27], [11, -.86, 21], [-3, -1.38, 37]].forEach(([d, a, l]) => pieu(ctx, B.X(0) + d * Uu, yb + Uu * 3, Uu * l, a, Uu * 3.3, c.pre));
    [[2, -2.16, 34], [-4.5, -1.98, 27], [-11, -2.3, 21], [3, -1.76, 38]].forEach(([d, a, l]) => pieu(ctx, B.X(1) + d * Uu, yb + Uu * 3, Uu * l, a, Uu * 3.3, c.pre));
    seg(ctx, B.X(0) - Uu * 8, yb - Uu * 9, B.X(0) + Uu * 17, yb - Uu * 3.4, Uu * 2.8, c.pre); seg(ctx, B.X(1) + Uu * 8, yb - Uu * 8.4, B.X(1) - Uu * 17, yb - Uu * 3, Uu * 2.8, c.pre);
    O.herbe(ctx, B.x0, B.x1, yb + Uu, Uu * 5, c.pre, rp, .5); O.rochers(ctx, B.x0, B.x1, yb, Uu * 3.4, c.pre, rp, 7);
    G.fog(ctx, B.x0, B.x1, B.Y(.92), Uu * 6, c.brume, n ? .09 : .14, 31, 12);
    B.part(1, "cendre", { x: B.x0, y: 0, w: B.x1 - B.x0, h: B.Y(1) }, { n: n ? 14 : 22, col: n ? "#6b7890" : "#c9c5ba" });
    if (n) B.part(1, "braise", { x: B.X(.3), y: B.Y(.3), w: B.s.w * .5, h: B.Y(.6) - B.Y(.3) }, { n: 10, scale: .7 });
  };

  // carte de lumière : la couche est peinte en pleine lumière, puis multipliée par cette carte (ambiance + sources).
  // L : [x, y, rayon, couleur, force] ou fonction(ctx) qui peint une forme claire. À n'utiliser que sur une couche opaque.
  function lumieres(ctx, B, amb, L, q = 4) { const w = Math.ceil((B.x1 - B.x0) / q), h = Math.ceil(B.H / q), m = G.mk(w, h), x = m.getContext("2d");
    x.fillStyle = amb; x.fillRect(0, 0, w, h); x.scale(1 / q, 1 / q); x.translate(-B.x0, 0);
    L.forEach(l => typeof l === "function" ? l(x) : G.glow(x, l[0], l[1], l[2], l[3], l[4] == null ? 1 : l[4]));
    ctx.save(); ctx.globalCompositeOperation = "multiply"; ctx.drawImage(m, B.x0, 0, B.x1 - B.x0, B.H); ctx.restore(); }

  // sol d'intérieur en perspective : dalles (ou lames de plancher si o.lames), fuyant vers le mur du fond
  function dallage(ctx, B, yF, col, o = {}) { const r = rng(o.seed || 9), cx = B.X(.5), vy = yF - B.U * (o.fuite || 46), yb = B.H, pas = B.U * (o.pas || 15);
    ctx.fillStyle = col; ctx.fillRect(B.x0, yF, B.x1 - B.x0, yb - yF);
    const rangs = [yF]; if (!o.lames) for (let i = 1; rangs[rangs.length - 1] < yb; i++) rangs.push(yF + B.U * 1.5 * (Math.pow(1.5, i) - 1) * (o.rang || 1)); else rangs.push(yb);
    for (let i = 0; i < rangs.length - 1; i++) { const y0 = rangs[i], y1 = Math.min(yb, rangs[i + 1]), k0 = (y0 - vy) / (yF - vy), k1 = (y1 - vy) / (yF - vy), dec = o.lames ? 0 : r();
      for (let j = -40; j < 40; j++) { const a = (j + dec) * pas, b = (j + 1 + dec) * pas; if (cx + b * k1 < B.x0 || cx + a * k1 > B.x1) continue;
        ctx.fillStyle = ton(col, r.r(-.07, .05)); poly(ctx, [[cx + a * k0, y0], [cx + b * k0, y0], [cx + b * k1, y1], [cx + a * k1, y1]]); ctx.fill();
        ctx.strokeStyle = rgba("#000000", o.j || .4); ctx.lineWidth = Math.max(1, B.U * .16 * k0); ctx.beginPath(); ctx.moveTo(cx + a * k0, y0); ctx.lineTo(cx + a * k1, y1); ctx.stroke(); }
      ctx.fillStyle = rgba("#000000", o.j || .4); ctx.fillRect(B.x0, y0 - 1, B.x1 - B.x0, Math.max(1, B.U * .14 * k0)); } }

  // ====================================================================================================
  // Cellule du fort : gros appareil de pierre, lucarne à barreaux, rai de lumière poussiéreux, paille et chaînes.
  D.cellule = B => { const n = B.nuit, Uu = B.U, R = repere(B, .8), E = R.E, X = R.X, Y = R.Y, yF = B.Y(.8);
    const c = n ? { mur: "#5d6c86", sol: "#4a566c", rai: "#a9c6ff", ciel: "#243a66", pre: "#020306", brume: "#7c98c8", paille: "#7a7f8c", fer: "#05070b", amb: "#222b44", torche: "#ff9a4a" }
                : { mur: "#8f8876", sol: "#756f60", rai: "#ffe6b0", ciel: "#f8ebc8", pre: "#050504", brume: "#d8c8a0", paille: "#b89c58", fer: "#0a0908", amb: "#453d31", torche: "#ff9a4a" };
    B.lum = { col: c.rai, dir: -1, amb: n ? "#10182a" : "#2a251c", brume: n ? "#56709c" : "#b7a57c" };
    let ctx = B.couche(.4);
    pierres(ctx, B.x0, 0, B.x1, yF + 2, { col: c.mur, h: E * 7.2, seed: 3, v: .07 });
    // suintements et entailles du prisonnier (les jours comptés)
    const rs = rng("suint"); for (let i = 0; i < 12; i++) { const x = lerp(B.x0, B.x1, rs()), w = E * rs.r(1.5, 5), h = (yF) * rs.r(.3, .95); ctx.fillStyle = G.lin(ctx, 0, 0, 0, h, [[0, rgba("#0a0f0c", .4)], [1, rgba("#0a0f0c", 0)]]); ctx.fillRect(x, 0, w, h); }
    ctx.strokeStyle = rgba("#ffffff", .2); ctx.lineWidth = Math.max(1, E * .22); ctx.lineCap = "round";
    for (let g = 0; g < 4; g++) { const gx = X(.845) + g * E * 5.2, gy = Y(.47) + (g % 2) * E * .8, nb = g < 3 ? 4 : 2; for (let i = 0; i < nb; i++) { ctx.beginPath(); ctx.moveTo(gx + i * E * .9, gy); ctx.lineTo(gx + i * E * .9 + E * .2, gy + E * 3.2); ctx.stroke(); } if (g < 3) { ctx.beginPath(); ctx.moveTo(gx - E * .6, gy + E * 2.4); ctx.lineTo(gx + E * 3.5, gy + E * .7); ctx.stroke(); } }
    dallage(ctx, B, yF, c.sol, { seed: 4, pas: 17 });
    ctx.fillStyle = G.lin(ctx, 0, yF - E * 5, 0, yF + E * 2, [[0, rgba("#000000", 0)], [.7, rgba("#000000", .34)], [1, rgba("#000000", 0)]]); ctx.fillRect(B.x0, yF - E * 5, B.x1 - B.x0, E * 7);
    // litière de paille
    const rp = rng("paille"), hx = X(.88), hy = yF + E * 3.5; ctx.fillStyle = ton(c.paille, -.12); G.blob(ctx, hx, hy - E * 1.5, E * 19, E * 5, 7, .16, 26); ctx.fill(); ctx.fillStyle = c.paille; G.blob(ctx, hx + E * 2, hy - E * 2.4, E * 13, E * 3.6, 9, .2, 22); ctx.fill();
    ctx.lineWidth = Math.max(1, E * .2); for (let i = 0; i < 150; i++) { const far = i > 110, x = far ? X(rp.r(.05, 1)) : hx + rp.r(-1, 1) * E * 20, y = far ? yF + E * rp.r(1.5, 14) : hy - E * rp.r(-1.6, 6.4) * (1 - Math.abs(x - hx) / (E * 22)), a = rp.r(-.5, .5) + (rp() < .5 ? 0 : Math.PI), l = E * rp.r(1.5, 4.5); ctx.strokeStyle = ton(c.paille, rp.r(-.3, .22)); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y - Math.abs(Math.sin(a)) * l * .6); ctx.stroke(); }
    // seau
    const sx = X(.17), sy = yF + E * 4.5; poly(ctx, [[sx - E * 2.9, sy - E * 5.4], [sx + E * 2.9, sy - E * 5.4], [sx + E * 2.3, sy], [sx - E * 2.3, sy]], ton(c.sol, -.5)); ctx.fillStyle = ton(c.sol, -.7); ctx.fillRect(sx - E * 2.8, sy - E * 4.4, E * 5.6, E * .5); ctx.fillRect(sx - E * 2.45, sy - E * 1.4, E * 4.9, E * .5);
    ctx.strokeStyle = ton(c.sol, -.7); ctx.lineWidth = E * .3; ctx.beginPath(); ctx.ellipse(sx, sy - E * 5.4, E * 2.7, E * 2.6, 0, Math.PI, TAU); ctx.stroke();
    // lucarne : embrasure profonde
    const lx = X(.3), ly = Y(.17), lw = E * 10, lh = E * 13;
    const arche = (w, y0, y1) => { ctx.beginPath(); ctx.moveTo(lx - w / 2, y1); ctx.lineTo(lx - w / 2, y0 + w * .3); ctx.quadraticCurveTo(lx - w / 2, y0, lx, y0); ctx.quadraticCurveTo(lx + w / 2, y0, lx + w / 2, y0 + w * .3); ctx.lineTo(lx + w / 2, y1); ctx.closePath(); };
    ctx.fillStyle = ton(c.mur, -.42); arche(lw + E * 5.4, ly - E * 2.4, ly + lh + E * 3.6); ctx.fill();
    ctx.save(); ctx.clip(); poly(ctx, [[lx - lw / 2 - E * 3, ly + lh + E * 3.8], [lx + lw / 2 + E * 3, ly + lh + E * 3.8], [lx + lw / 2, ly + lh], [lx - lw / 2, ly + lh]], ton(c.mur, .3)); poly(ctx, [[lx + lw / 2, ly], [lx + lw / 2 + E * 3, ly - E * 3], [lx + lw / 2 + E * 3, ly + lh + E * 3.8], [lx + lw / 2, ly + lh]], ton(c.mur, .08)); ctx.restore();
    // la lumière : ambiance, lucarne, faisceau, flaque claire au sol, torche du couloir à gauche
    const fx = X(.6), fy = yF + E * 11, dir = [fx - lx, fy - (ly + lh / 2)];
    const faisceau = (x, k, a) => { x.save(); x.globalCompositeOperation = "lighter"; x.fillStyle = G.lin(x, lx, ly, fx, fy, [[0, rgba(c.rai, a)], [.75, rgba(c.rai, a * .5)], [1, rgba(c.rai, a * .16)]]);
      poly(x, [[lx - lw * .5 * k, ly + lh], [lx + lw * .5 * k, ly], [fx + E * 15 * k, fy - E * 6], [fx - E * 17 * k, fy + E * 6]]); x.fill(); x.restore(); };
    lumieres(ctx, B, c.amb, [[lx, ly + lh / 2, E * 46, c.rai, .7], x => faisceau(x, 1.5, .34), [fx, fy - E * 6, E * 70, c.rai, n ? .75 : .7], [fx - E * 4, fy, E * 30, c.rai, .5], [X(.25), yF - E * 12, E * 60, c.rai, .5], [X(.78), yF - E * 12, E * 60, c.rai, .42], [B.X(0) - Uu * 6, B.Y(.6), Uu * 60, c.torche, n ? .5 : .3]]);
    // le ciel dans la lucarne, les barreaux
    ctx.fillStyle = G.lin(ctx, 0, ly, 0, ly + lh, [[0, c.ciel], [1, ton(c.ciel, n ? .12 : .3)]]); arche(lw, ly, ly + lh); ctx.fill();
    if (n) { ctx.save(); arche(lw, ly, ly + lh); ctx.clip(); G.stars(ctx, lx - lw / 2, ly, lx + lw / 2, ly + lh * 1.6, 9, 5); G.astre(ctx, lx - E * 1.6, ly + E * 4.6, E * 2.1, "#eef3ff", "#8fb1ff", true); ctx.restore(); }
    G.glow(ctx, lx, ly + lh * .5, E * 24, c.rai, n ? .34 : .5);
    ctx.fillStyle = c.fer; [-.3, -.1, .1, .3].forEach(k => ctx.fillRect(lx + lw * k - E * .42, ly, E * .84, lh)); ctx.fillRect(lx - lw / 2, ly + lh * .42, lw, E * .8);
    // rai de lumière dans la poussière et sa tache barrée sur les dalles
    faisceau(ctx, 1, n ? .2 : .24); faisceau(ctx, .55, n ? .1 : .13); G.shafts(ctx, lx - E, ly + lh * .4, Math.hypot(dir[0], dir[1]) * 1.02, lw * 1.5, c.rai, n ? .09 : .11, 7, 12, Math.atan2(dir[1], dir[0]) - Math.PI / 2);
    ctx.save(); ctx.globalCompositeOperation = "lighter"; for (let i = 0; i < 5; i++) { const a = i / 5 + .03, b = (i + 1) / 5 - .03, q = (k, s) => [lerp(fx - E * 17, fx + E * 15, k) + s * E * 3.2, lerp(fy + E * 6, fy - E * 6, k) + s * E * 2.2]; [[-1, -.12], [.12, 1]].forEach(([s0, s1]) => poly(ctx, [q(a, s0), q(b, s0), q(b, s1), q(a, s1)], rgba(c.rai, n ? .2 : .24))); } ctx.restore();
    G.glow(ctx, fx - E, fy, E * 26, c.rai, n ? .14 : .18);
    // anneaux scellés, chaînes et fers
    const fer = (x, y) => { ctx.fillStyle = c.fer; rrect(ctx, x - E * 1.5, y - E * 1.5, E * 3, E * 3, E * .5); ctx.fill(); ctx.strokeStyle = c.fer; ctx.lineWidth = E * .55; ctx.beginPath(); ctx.arc(x, y + E * 2.2, E * 1.5, 0, TAU); ctx.stroke(); };
    const ax = X(.66), bx = X(.8), ay = Y(.27); fer(ax, ay); fer(bx, ay);
    chaine(ctx, ax, ay + E * 3.6, ax - E * 1.5, ay + E * 22, E * 1.05, c.fer); chaine(ctx, bx, ay + E * 3.6, bx + E * 1, ay + E * 18, E * 1.05, c.fer); chaine(ctx, ax + E * .8, ay + E * 3.4, bx - E * .8, ay + E * 3.4, E * 1.05, c.fer, E * 9);
    [[ax - E * 1.5, ay + E * 23.6], [bx + E * 1, ay + E * 19.6]].forEach(([x, y]) => { ctx.strokeStyle = c.fer; ctx.lineWidth = E * .7; ctx.beginPath(); ctx.arc(x, y, E * 1.7, -.9, Math.PI + .9); ctx.stroke(); });
    // voûte basse
    ctx.fillStyle = c.pre; ctx.beginPath(); ctx.moveTo(B.x0, 0); ctx.lineTo(B.x0, B.Y(.3)); ctx.quadraticCurveTo(B.X(.5), B.Y(-.2), B.x1, B.Y(.3)); ctx.lineTo(B.x1, 0); ctx.closePath(); ctx.fill();
    vignette(ctx, B, n ? .55 : .46);
    ctx.fillStyle = G.lin(ctx, 0, B.Y(1), 0, B.Y(1.25), [[0, rgba(c.pre, 0)], [1, rgba(c.pre, 1)]]); ctx.fillRect(B.x0, B.Y(1), B.x1 - B.x0, B.H);
    // poussières dans le rai, torche du couloir qui palpite, gouttes
    const grain = G.glowTile(c.rai), gouttes = [[.47, 0, 3.7], [.9, .37, 5.3], [.13, .71, 4.6]];
    B.dyn(.4, (x, t) => { x.save(); x.globalCompositeOperation = "lighter"; const rr = rng("grains");
      for (let i = 0; i < 38; i++) { const s = (rr() + t * rr.r(.004, .014)) % 1, o = rr() - .5 + Math.sin(t * rr.r(.2, .5) + i) * .05, w = lerp(lw, E * 26, s), d = E * rr.r(.5, 1.3);
        x.globalAlpha = (.34 + .3 * Math.sin(t * rr.r(.6, 1.6) + i * 3)) * Math.sin(s * Math.PI); x.drawImage(grain, lerp(lx, fx, s) + o * w - d, lerp(ly + lh / 2, fy, s) + o * w * .5 - d, d * 2, d * 2); }
      x.globalAlpha = 1; x.restore();
      G.glow(x, B.X(0) - Uu * 8, B.Y(.6), Uu * 58, c.torche, (n ? .2 : .1) * (.75 + .25 * Math.sin(t * 6.3) * Math.sin(t * 2.1 + 1)));
      for (const [u, ph, per] of gouttes) { const k = (t / per + ph) % 1, px = B.X(u), y1 = B.Y(.93); if (k < .4) { const yy = lerp(B.Y(.1), y1, k * k * 6.25); x.fillStyle = rgba(c.rai, .5); x.fillRect(px - .8, yy - Uu * 1.3, 1.6, Uu * 1.3); } else if (k < .62) { const q = (k - .4) / .22; x.strokeStyle = rgba(c.rai, .4 * (1 - q)); x.lineWidth = 1.2; x.beginPath(); x.ellipse(px, y1, Uu * 2.6 * q, Uu * .7 * q, 0, 0, TAU); x.stroke(); } } });
    B.sol = B.Y(.9);
    B.acteurs();
    // premier plan : la grille de la cellule, à gauche
    ctx = B.couche(1); const g0 = B.X(0);
    ctx.fillStyle = c.pre; [-5.4, 1, 7.4, 13.8].forEach(d => ctx.fillRect(g0 + d * Uu, -2, Uu * 1.8, B.H + 4)); [.2, .66].forEach(v => ctx.fillRect(B.x0, B.Y(v), g0 + Uu * 17.2 - B.x0, Uu * 2.3));
    ctx.fillRect(g0 + Uu * 13.2, 0, Uu * 4, B.H); rrect(ctx, g0 + Uu * 11, B.Y(.4), Uu * 8.4, Uu * 10, Uu * .8); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = "destination-out"; ctx.beginPath(); ctx.arc(g0 + Uu * 15.2, B.Y(.4) + Uu * 4.2, Uu * .8, 0, TAU); ctx.fill(); poly(ctx, [[g0 + Uu * 14.8, B.Y(.4) + Uu * 4.4], [g0 + Uu * 15.6, B.Y(.4) + Uu * 4.4], [g0 + Uu * 15.9, B.Y(.4) + Uu * 7], [g0 + Uu * 14.5, B.Y(.4) + Uu * 7]], "#000"); ctx.restore();
    ctx.fillStyle = rgba(c.rai, n ? .2 : .26); [-5.4, 1, 7.4].forEach(d => ctx.fillRect(g0 + d * Uu + Uu * 1.5, 0, Uu * .3, B.H)); ctx.fillRect(g0 + Uu * 16.9, 0, Uu * .3, B.Y(.4)); ctx.fillRect(g0 + Uu * 16.9, B.Y(.4) + Uu * 10, Uu * .3, B.H);
    ctx.fillStyle = G.lin(ctx, 0, B.Y(.93), 0, B.Y(1.06), [[0, rgba(c.pre, 0)], [1, rgba(c.pre, .9)]]); ctx.fillRect(B.x0, B.Y(.93), B.x1 - B.x0, B.H);
    faisceau(ctx, .8, n ? .05 : .06);
  };

  // ---------- mobilier et outils en silhouette ----------
  function tonneau(ctx, x, y, w, h, col, cerc) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - w * .4, y); ctx.quadraticCurveTo(x - w * .6, y - h * .5, x - w * .4, y - h); ctx.lineTo(x + w * .4, y - h); ctx.quadraticCurveTo(x + w * .6, y - h * .5, x + w * .4, y); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = cerc; [.13, .33, .67, .87].forEach(k => ctx.fillRect(x - w, y - h * k - h * .03, w * 2, h * .06)); ctx.fillStyle = rgba("#000000", .2); for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * w * .17, y - h, Math.max(1, w * .018), h); ctx.restore(); }
  function enclume(ctx, x, y, s, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - s * 2.6, y); ctx.lineTo(x + s * 3.3, y); ctx.lineTo(x + s * 3.3, y + s * 1.5); ctx.quadraticCurveTo(x + s * 1.5, y + s * 1.9, x + s * 1.3, y + s * 3.2); ctx.lineTo(x + s * 1.3, y + s * 4.4); ctx.lineTo(x + s * 3, y + s * 5.5); ctx.lineTo(x + s * 3, y + s * 6.6); ctx.lineTo(x - s * 3, y + s * 6.6); ctx.lineTo(x - s * 3, y + s * 5.5); ctx.lineTo(x - s * 1.3, y + s * 4.4); ctx.lineTo(x - s * 1.3, y + s * 3.2);
    ctx.quadraticCurveTo(x - s * 1.6, y + s * 2, x - s * 3, y + s * 1.8); ctx.quadraticCurveTo(x - s * 5, y + s * 1.5, x - s * 6.6, y + s * .3); ctx.quadraticCurveTo(x - s * 4.5, y - s * .1, x - s * 2.6, y); ctx.closePath(); ctx.fill(); }
  const marteau = (ctx, x, y, s, col) => { ctx.fillStyle = col; ctx.fillRect(x - s * .28, y, s * .56, s * 7.4); rrect(ctx, x - s * 2, y - s * .3, s * 4, s * 2, s * .3); ctx.fill(); };
  const pince = (ctx, x, y, s, col) => { ctx.strokeStyle = col; ctx.lineWidth = s * .46; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x - s * 1, y + s * 9); ctx.lineTo(x + s * .3, y + s * 2.2); ctx.quadraticCurveTo(x + s * 1, y + s * .9, x + s * .12, y); ctx.moveTo(x + s * 1, y + s * 9); ctx.lineTo(x - s * .3, y + s * 2.2); ctx.quadraticCurveTo(x - s * 1, y + s * .9, x - s * .12, y); ctx.stroke(); };
  const epee = (ctx, x, y, s, col, L = 13) => { poly(ctx, [[x - s * .52, y + s * 3.4], [x + s * .52, y + s * 3.4], [x + s * .4, y + s * (L + 2)], [x, y + s * (L + 3.8)], [x - s * .4, y + s * (L + 2)]], col); ctx.fillRect(x - s * 1.8, y + s * 2.9, s * 3.6, s * .6); ctx.fillRect(x - s * .3, y + s * .6, s * .6, s * 2.4); ctx.beginPath(); ctx.arc(x, y + s * .4, s * .6, 0, TAU); ctx.fill(); };
  // objet sombre avec un filet de lumière du côté de la source (dx : décalage du filet)
  const liseré = (ctx, dx, dy, rim, col, f) => { ctx.save(); ctx.translate(dx, dy); f(rim); ctx.restore(); f(col); };
  // petite vue du village par une ouverture (auvent, fenêtre) : ciel, crête, toits, fenêtres
  function dehors(ctx, B, x0, y0, x1, y1, E, n, o = {}) { const k = n ? { h: "#0a1120", m: "#17253e", b: "#30456a", loin: "#1b2a40", bati: "#0a1119", sol: "#18222f", feu: "#ffb766", br: "#5f7fa6" } : { h: "#5a6062", m: "#a39a7c", b: "#f0c98a", loin: "#7f8a86", bati: "#262b28", sol: "#6a6450", feu: "#ffc37a", br: "#f0d9a4" };
    const r = rng(o.seed || "dehors"), yh = lerp(y0, y1, o.h == null ? .78 : o.h); ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
    ctx.fillStyle = G.lin(ctx, 0, y0, 0, yh, [[0, k.h], [.5, k.m], [1, k.b]]); ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (n) G.stars(ctx, x0, y0, x1, yh, 14, 8, "#dfe8ff"); G.astre(ctx, lerp(x0, x1, o.au == null ? .7 : o.au), lerp(y0, yh, o.av == null ? .42 : o.av), E * (n ? 2 : 2.6), n ? "#eef3ff" : "#fff0cf", n ? "#8fb1ff" : "#ffcf8a", n);
    G.ridge(ctx, { x0, x1, y: yh - E * 7, amp: E * 5, freq: 2, seed: 4, bottom: y1, fill: mixc(k.loin, k.b, .45), jag: E * .6 });
    for (let x = x0; x < x1; x += E * r.r(1.3, 2.6)) O.pin(ctx, x, yh + r.r(-.5, .5) * E, E * r.r(4, 7.5), mixc(k.loin, k.bati, .45), r);
    const fens = []; (o.maisons || [[.26, 9, 6], [.8, 8, 5.4]]).forEach(([u, w, h]) => O.maison(ctx, lerp(x0, x1, u), yh + E, E * w, E * h, k.bati, r).forEach(f => fens.push(f)));
    if (o.tour !== false) { const tx = lerp(x0, x1, o.tour || .54); O.tour(ctx, tx, yh + E, E * 3.4, E * 14, mixc(k.bati, k.b, .1), r, { creneaux: true }); fens.push([tx, yh - E * 9, E * .8, E * 1.4]); }
    ctx.save(); ctx.globalCompositeOperation = "lighter"; O.lueursFenetres(ctx, fens, k.feu, n ? .95 : .5); ctx.restore();
    ctx.fillStyle = G.lin(ctx, 0, yh, 0, y1, [[0, mixc(k.sol, k.b, .3)], [1, k.sol]]); ctx.fillRect(x0, yh + E * .8, x1 - x0, y1 - yh);
    ctx.fillStyle = G.lin(ctx, 0, yh - E * 9, 0, yh + E * 2, [[0, rgba(k.br, 0)], [1, rgba(k.br, n ? .22 : .4)]]); ctx.fillRect(x0, yh - E * 9, x1 - x0, E * 11); ctx.restore(); return k; }

  // ====================================================================================================
  // La forge d'Ivan : foyer rougeoyant à gauche, enclume, outils au mur, auvent ouvert sur le village.
  D.forge = B => { const n = B.nuit, Uu = B.U, R = repere(B, .8, .7), E = R.E, X = R.X, Y = R.Y, T = R.T, yF = B.Y(.8);
    const c = n ? { bois: "#9a7450", pierre: "#8c8278", sol: "#7c6853", amb: "#1d1311", ext: "#6f8fc8", noir: "#0a0605", pre: "#040202", cuir: "#6a4028" }
                : { bois: "#a37c54", pierre: "#958b7d", sol: "#86725b", amb: "#2f2016", ext: "#ffdca0", noir: "#130c08", pre: "#070403", cuir: "#70452b" };
    B.lum = { col: "#ffb060", dir: -1, amb: n ? "#1a1210" : "#33241a", brume: n ? "#6e4a34" : "#a67c56" };
    let ctx = B.couche(.4);
    planches(ctx, B.x0, 0, B.x1, yF + 2, c.bois, { l: E * 6.4, seed: 11, v: .07 });
    const yRail = Y(.2); ctx.fillStyle = ton(c.bois, -.4); ctx.fillRect(B.x0, yRail, B.x1 - B.x0, E * 2.4); ctx.fillRect(B.x0, yF - E * 2, B.x1 - B.x0, E * 2.2);
    dallage(ctx, B, yF, c.sol, { seed: 6, pas: 21, j: .22 });
    // le foyer : table de pierre, niche du feu, hotte
    const h0 = X(.035), h1 = X(.235), hx = (h0 + h1) / 2, yTab = Y(.64), yHot = Y(.41), hy = yTab - E * .6;
    pierres(ctx, h0, yHot - 2, h1, yTab + 2, { col: tonA(c.pierre, -.45), h: E * 3, seed: 21 });
    pierres(ctx, h0, yTab, h1, yF + 2, { col: c.pierre, h: E * 3.4, seed: 22 }); pierres(ctx, h0, yHot, h0 + E * 3.6, yTab, { col: c.pierre, h: E * 3, seed: 23 }); pierres(ctx, h1 - E * 3.6, yHot, h1, yTab, { col: c.pierre, h: E * 3, seed: 24 });
    ctx.save(); poly(ctx, [[h0 - E * 1.5, yHot], [h1 + E * 1.5, yHot], [h1 + E * 1.5, yHot - E * 3], [X(.185), Y(.17)], [X(.185), -4], [X(.085), -4], [X(.085), Y(.17)], [h0 - E * 1.5, yHot - E * 3]]); ctx.clip(); pierres(ctx, h0 - E * 2, -4, h1 + E * 2, yHot, { col: tonA(c.pierre, -.12), h: E * 3.6, seed: 25 }); ctx.restore();
    ctx.fillStyle = ton(c.pierre, -.6); ctx.fillRect(h0 - E * 1.5, yHot - E * .8, h1 - h0 + E * 3, E * .8); ctx.fillRect(h0 - E * .8, yTab - E * .3, h1 - h0 + E * 1.6, E * 1.5);
    ctx.fillStyle = ton(c.pierre, -.8); ctx.beginPath(); ctx.moveTo(hx - E * 5, yF); ctx.lineTo(hx - E * 5, yF - E * 6); ctx.quadraticCurveTo(hx, yF - E * 10.5, hx + E * 5, yF - E * 6); ctx.lineTo(hx + E * 5, yF); ctx.closePath(); ctx.fill();
    // le soufflet pendu aux chaînes, tuyère vers le feu
    const bx = X(.32), by = Y(.435); chaine(ctx, bx - E * 4, by - E * 2, bx - E * 4, yRail + E * 2, E * .8, ton(c.pierre, -.7)); chaine(ctx, bx + E * 5.5, by - E * 5, bx + E * 5.5, yRail + E * 2, E * .8, ton(c.pierre, -.7));
    ctx.save(); ctx.translate(bx, by); ctx.rotate(-.42); seg(ctx, -E * 16, 0, -E * 6, 0, E * .9, ton(c.pierre, -.72));
    ctx.fillStyle = c.cuir; ctx.beginPath(); ctx.moveTo(-E * 7.5, -E * .7); ctx.quadraticCurveTo(-E * 1, -E * 4.6, E * 6.5, -E * 3.6); ctx.quadraticCurveTo(E * 9.6, 0, E * 6.5, E * 3.6); ctx.quadraticCurveTo(-E * 1, E * 4.6, -E * 7.5, E * .7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ton(c.cuir, -.45); ctx.lineWidth = E * .4; [-.55, 0, .55].forEach(k => { ctx.beginPath(); ctx.moveTo(-E * 7, k * E); ctx.quadraticCurveTo(0, k * E * 5.2, E * 8, k * E * 4); ctx.stroke(); });
    ctx.strokeStyle = ton(c.bois, -.5); ctx.lineWidth = E * .9; ctx.beginPath(); ctx.moveTo(-E * 7.5, -E * .9); ctx.quadraticCurveTo(-E * 1, -E * 5, E * 6.5, -E * 3.9); ctx.lineTo(E * 12, -E * 4.4); ctx.moveTo(-E * 7.5, E * .9); ctx.quadraticCurveTo(-E * 1, E * 5, E * 6.5, E * 3.9); ctx.lineTo(E * 11, E * 4.6); ctx.stroke(); ctx.restore();
    // la lumière du feu sur les planches, celle du dehors près de l'auvent
    const ox0 = X(.6), ox1 = X(.93), oy0 = Y(.235);
    lumieres(ctx, B, c.amb, [[hx, hy - E * 4, E * 135, "#ff8a3c", .95], [hx, hy - E * 3, E * 58, "#ffc880", .7], [X(.765), yF + E * 3, E * 62, c.ext, n ? .42 : .62], [X(.5), Y(.66), E * 95, "#8a5230", .5]]);
    // la niche : suie, lit de braises
    ctx.fillStyle = G.lin(ctx, 0, yHot, 0, yTab, [[0, rgba("#060302", .85)], [.6, rgba("#1a0703", .3)], [1, rgba("#3a1004", 0)]]); ctx.fillRect(h0 + E * 3.6, yHot, h1 - h0 - E * 7.2, yTab - yHot);
    const rb = rng("braises"); ctx.fillStyle = "#1a0a06"; G.blob(ctx, hx, hy - E * .4, E * 9.4, E * 2.4, 4, .18, 20); ctx.fill();
    for (let i = 0; i < 26; i++) { const a = rb() * TAU, d = Math.sqrt(rb()), px = hx + Math.cos(a) * d * E * 8, py = hy - E * .5 + Math.sin(a) * d * E * 1.7; ctx.fillStyle = rb() < .4 ? "#ffd27a" : (rb() < .5 ? "#ff8a3a" : "#c8421a"); G.blob(ctx, px, py, E * rb.r(.5, 1.3), E * rb.r(.4, .8), i + 1, .3, 8); ctx.fill(); }
    G.glow(ctx, hx, hy - E, E * 14, "#ff7a2a", .7); G.glow(ctx, hx, hy - E * 3, E * 40, "#ff8a3c", n ? .34 : .28);
    // l'auvent ouvert sur Valdren
    dehors(ctx, B, ox0, oy0, ox1, yF, E, n, { seed: "forge-dehors", h: .8, au: .2, av: .5 });
    const rt = rng("chaume"); ctx.fillStyle = c.noir; ctx.beginPath(); ctx.moveTo(ox0, oy0 - 1); for (let x = ox0; x <= ox1; x += E * 1.1) { ctx.lineTo(x, oy0 + E * rt.r(2.4, 4.4)); ctx.lineTo(x + E * .55, oy0 + E * rt.r(1.2, 2.4)); } ctx.lineTo(ox1, oy0 - 1); ctx.closePath(); ctx.fill();
    liseré(ctx, -E * .3, 0, rgba("#ff9a50", n ? .34 : .4), c.noir, col => { ctx.fillStyle = col; ctx.fillRect(ox0 - E * 2.6, oy0 - E * 2.6, E * 2.6, yF - oy0 + E * 2.6); ctx.fillRect(ox1, oy0 - E * 2.6, E * 2.6, yF - oy0 + E * 2.6); });
    ctx.fillStyle = c.noir; ctx.fillRect(ox0 - E * 4, oy0 - E * 2.8, ox1 - ox0 + E * 8, E * 2.8); seg(ctx, ox0, oy0 + E * 9, ox0 + E * 8, oy0, E * 1.3, c.noir); seg(ctx, ox1, oy0 + E * 9, ox1 - E * 8, oy0, E * 1.3, c.noir);
    ctx.fillStyle = c.noir; ctx.fillRect(ox0, yF - E * 7.6, ox1 - ox0, E * 1); [.2, .4, .6, .8].forEach(k => ctx.fillRect(lerp(ox0, ox1, k) - E * .35, yF - E * 7.6, E * .7, E * 7.8));
    // outils pendus au rail : marteaux, pinces, fers ; râtelier de lames
    const rim = rgba("#ff9a50", n ? .5 : .55), yo = yRail + E * 3.4;
    liseré(ctx, -E * .26, 0, rim, c.noir, col => { [[.4, 1.15], [.435, .85]].forEach(([u, k]) => marteau(ctx, X(u), yo, E * k, col)); pince(ctx, X(.465), yo, E * 1.05, col); pince(ctx, X(.49), yo, E * .85, col);
      ctx.strokeStyle = col; ctx.lineWidth = E * .7; [.365, .375].forEach((u, i) => { ctx.beginPath(); ctx.arc(X(u), yo + E * (2.2 + i * 3.6), E * 1.5, -.5, Math.PI + .5); ctx.stroke(); });
      ctx.fillStyle = col; ctx.fillRect(X(.515), yRail + E * 6, X(.585) - X(.515), E * .9); [.522, .536, .55, .564, .578].forEach((u, i) => epee(ctx, X(u), yRail + E * (4.4 + (i % 2) * .5), E * (.95 + (i % 3) * .08), col, 12 + (i * 5 % 4))); });
    ctx.fillStyle = c.noir; [.4, .435, .465, .49].forEach(u => ctx.fillRect(X(u) - E * .3, yRail + E * 1.6, E * .6, E * 2.2));
    // solives du plafond
    ctx.fillStyle = c.pre; ctx.fillRect(B.x0, -2, B.x1 - B.x0, T(.06) + 2); for (let x = B.X(.5) - E * 100; x < B.x1; x += E * 16) ctx.fillRect(x, 0, E * 2.6, T(.105));
    vignette(ctx, B, n ? .6 : .5);
    ctx.fillStyle = G.lin(ctx, 0, B.Y(1), 0, B.Y(1.25), [[0, rgba(c.pre, 0)], [1, rgba(c.pre, 1)]]); ctx.fillRect(B.x0, B.Y(1), B.x1 - B.x0, B.H);
    B.dyn(.4, (x, t) => { const f = .8 + .2 * Math.sin(t * 7.1) * Math.sin(t * 2.3 + 1); G.glow(x, hx, hy - E * 2, E * 60, "#ff8a3c", (n ? .15 : .12) * f);
      G.flamme(x, hx - E * 3.6, hy, E * 6.4, t, 1); G.flamme(x, hx + E * 1, hy, E * 9, t, 2.7); G.flamme(x, hx + E * 4.6, hy, E * 5.4, t, 4.1); });
    B.part(.4, "braise", { x: h0 + E * 3, y: Y(.2), w: h1 - h0 - E * 6, h: hy - Y(.2) }, { n: 26, scale: Uu / 7.5, seed: "forge1" });
    // l'enclume sur son billot, le baquet de trempe
    ctx = B.couche(.55); const ex = X(.5), eb = yF + E * 5.5;
    ctx.fillStyle = G.rad(ctx, 0, 0, 0, 1, [[0, "rgba(0,0,0,.5)"], [1, "rgba(0,0,0,0)"]]); [[ex, E * 9], [X(.392), E * 7]].forEach(([x, w]) => { ctx.save(); ctx.translate(x, eb); ctx.scale(w, E * 1.5); ctx.fillRect(-1, -1, 2, 2); ctx.restore(); });
    ctx.fillStyle = "#241710"; rrect(ctx, ex - E * 4, eb - E * 8, E * 8, E * 8.4, E * .8); ctx.fill(); ctx.fillStyle = "#17100b"; ctx.fillRect(ex - E * 4.2, eb - E * 6.6, E * 8.4, E * .8);
    enclume(ctx, ex, eb - E * 17.4, E * 1.45, "#16130f"); marteau(ctx, ex + E * 2.4, eb - E * 19.2, E * .9, "#16130f");
    tonneau(ctx, X(.392), eb, E * 9, E * 9.5, "#2a1c12", "#120c08");
    ctx.fillStyle = rgba(n ? "#44608c" : "#8a8468", .6); ctx.beginPath(); ctx.ellipse(X(.392), eb - E * 9.5, E * 3.5, E * .7, 0, 0, TAU); ctx.fill();
    eclaire(ctx, ex - E * 16, eb - E * 16, E * 22, "#ff9a50", .85); eclaire(ctx, X(.392) - E * 12, eb - E * 8, E * 16, "#ff9a50", .7); eclaire(ctx, ex + E * 12, eb - E * 14, E * 12, c.ext, n ? .3 : .42);
    B.sol = B.Y(.9);
    B.acteurs();
    // premier plan : poutre, chaînes et crochets, fers à cheval, poteau, tas de charbon, lames à tremper
    ctx = B.couche(1); const yb = Math.min(B.H, B.Y(1.03)), g0 = B.X(0), g1 = B.X(1);
    ctx.fillStyle = c.pre; ctx.fillRect(B.x0, -2, B.x1 - B.x0, B.Y(.045) + 2); ctx.fillRect(B.x0, 0, g0 + Uu * (R.k < 1 ? 1.2 : 3.4) - B.x0, B.H); if (R.k >= 1) seg(ctx, g0 + Uu * 3, B.Y(.22), g0 + Uu * 17, B.Y(.03), Uu * 2.6, c.pre);
    [[.4, .2], [.64, .13]].forEach(([u, v]) => { chaine(ctx, B.X(u), B.Y(.04), B.X(u), B.Y(v), Uu * 1.1, c.pre); ctx.strokeStyle = c.pre; ctx.lineWidth = Uu * .8; ctx.beginPath(); ctx.arc(B.X(u) - Uu * 1.3, B.Y(v) + Uu * 2.2, Uu * 1.5, -.4, Math.PI * .9); ctx.stroke(); });
    ctx.lineWidth = Uu * 1; ctx.strokeStyle = c.pre; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(g1 - Uu * (7 + i * 6.4), B.Y(.045) + Uu * 3, Uu * 2.2, -.35, Math.PI + .35); ctx.stroke(); }
    ctx.fillStyle = c.pre; G.blob(ctx, g0 + Uu * 5, yb + Uu * 1, Uu * 17, Uu * 8, 3, .2, 24); ctx.fill(); seg(ctx, g0 + Uu * 12, yb - Uu * 3, g0 + Uu * 23, yb - Uu * 19, Uu * 1, c.pre); ctx.fillRect(B.x0, yb - Uu, B.x1 - B.x0, B.H - yb + Uu);
    tonneau(ctx, g1 - Uu * 6, yb + Uu * 2, Uu * 15, Uu * 14, c.pre, c.pre); [[-9, -.14], [-6, .05], [-2.6, .2]].forEach(([d, a]) => { ctx.save(); ctx.translate(g1 + d * Uu, yb - Uu * 22); ctx.rotate(a); epee(ctx, 0, 0, Uu * 1.15, c.pre, 8); ctx.restore(); });
    B.part(1, "braise", { x: B.x0, y: B.Y(.35), w: B.s.w * .5, h: B.Y(.95) - B.Y(.35) }, { n: 12, scale: Uu / 6, seed: "forge2" });
  };
  // reflet du feu sous un objet rond (croissant clair)
  const eclaireArc = (ctx, x, y, r, col) => { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = rgba(col, .5); ctx.lineWidth = Math.max(1, r * .12); ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(x, y - r * .62, r, .5, Math.PI - .5); ctx.stroke(); ctx.restore(); };

  // ---------- herbes, fioles, bougies, vitres ----------
  function bougie(ctx, feux, x, y, h, col) { ctx.fillStyle = col; ctx.fillRect(x - h * .13, y - h, h * .26, h); ctx.fillRect(x - h * .32, y - h * .1, h * .64, h * .12); feux.push([x, y - h * 1.06, h * .6, feux.length * 2.1 + x * .01]); }
  // fiole ou bocal posé en (x, y) : 0 ballon, 1 bouteille, 2 bocal, 3 petite fiole. Renvoie [x, y, rayon, couleur] pour la lueur.
  function fiole(ctx, x, y, s, type, col, a = .9) { const hc = [2, 2.7, 2.3, 1.7][type];
    const corps = () => { if (type === 0) { ctx.beginPath(); ctx.arc(x, y - s, s, 0, TAU); } else if (type === 1) rrect(ctx, x - s * .62, y - s * hc, s * 1.24, s * hc, s * .45); else if (type === 2) rrect(ctx, x - s, y - s * hc, s * 2, s * hc, s * .35); else rrect(ctx, x - s * .42, y - s * hc, s * .84, s * hc, s * .3); };
    ctx.fillStyle = rgba("#dfe8d4", .2); if (type !== 2) ctx.fillRect(x - s * .21, y - s * (hc + .75), s * .42, s * .9); corps(); ctx.fill();
    ctx.save(); corps(); ctx.clip(); ctx.fillStyle = mixc(col, "#1a1a10", .3, a); ctx.fillRect(x - s * 2, y - s * hc * .7, s * 4, s * hc); ctx.fillStyle = rgba(col, .5); ctx.fillRect(x - s * 2, y - s * hc * .7, s * 4, s * .28); ctx.fillStyle = rgba("#ffffff", .22); ctx.fillRect(x - s * [.6, .4, .72, .24][type], y - s * hc, s * .17, s * hc); ctx.restore();
    ctx.fillStyle = "#4a3826"; if (type === 2) ctx.fillRect(x - s * 1.1, y - s * (hc + .22), s * 2.2, s * .36); else ctx.fillRect(x - s * .27, y - s * (hc + 1.05), s * .54, s * .42);
    return [x, y - s * hc * .42, s, col]; }
  // bouquet d'herbes pendu tête en bas : ficelle, lien, feuillage qui s'évase
  function bouquet(ctx, x, y, l, w, col, r, lien) { seg(ctx, x, y, x, y + l * .2, Math.max(1, w * .05), lien || col); const yt = y + l * .22;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - w * .1, yt); ctx.quadraticCurveTo(x - w * .2, yt + l * .25, x - w * .5, yt + l * .52);
    const nb = 9; for (let i = 0; i <= nb; i++) { const k = i / nb, px = x - w * .5 + w * k, py = y + l * (.86 + .14 * Math.sin(k * Math.PI)) * r.r(.9, 1.04); ctx.lineTo(px, py); if (i < nb) ctx.lineTo(px + w / nb * .5, py - l * r.r(.05, .14)); }
    ctx.quadraticCurveTo(x + w * .2, yt + l * .25, x + w * .1, yt); ctx.closePath(); ctx.fill();
    poly(ctx, [[x - w * .09, yt + l * .03], [x - w * .2, y + l * .07], [x, y + l * .12], [x + w * .22, y + l * .06], [x + w * .09, yt + l * .03]], col);
    ctx.strokeStyle = rgba("#000000", .22); ctx.lineWidth = Math.max(1, w * .04); for (let i = 0; i < 5; i++) { const k = (i + .5) / 5 - .5; ctx.beginPath(); ctx.moveTo(x + k * w * .14, yt); ctx.quadraticCurveTo(x + k * w * .4, yt + l * .3, x + k * w * .9, y + l * .84); ctx.stroke(); }
    ctx.fillStyle = lien || rgba("#000000", .4); ctx.fillRect(x - w * .13, yt - l * .012, w * .26, l * .05); }
  function tresseAil(ctx, x, y, l, s, col, lien) { seg(ctx, x, y, x, y + l, Math.max(1, s * .3), lien); ctx.fillStyle = col; const nb = Math.round(l / (s * 1.5)); for (let i = 1; i <= nb; i++) { const px = x + (i % 2 ? -1 : 1) * s * .7, py = y + i * l / nb; ctx.beginPath(); ctx.ellipse(px, py, s * .85, s, 0, 0, TAU); ctx.fill(); ctx.fillRect(px - s * .12, py - s * 1.5, s * .24, s * .7); } }
  // fenêtre à petits carreaux (verre épais, teintes irrégulières), montants de bois
  function carreaux(ctx, x0, y0, x1, y1, o) { const r = rng(o.seed || "vitre"), nx = o.nx, ny = o.ny, w = (x1 - x0) / nx, h = (y1 - y0) / ny, pl = Math.max(1, w * .1);
    ctx.fillStyle = o.bois; ctx.fillRect(x0 - o.cadre, y0 - o.cadre, x1 - x0 + o.cadre * 2, y1 - y0 + o.cadre * 2);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const dy = (j + .5) / ny; ctx.fillStyle = mixc(o.teintes[r.i(0, o.teintes.length - 1)], o.bas || o.teintes[0], dy * (o.fondu == null ? .3 : o.fondu) + r.r(0, .12)); ctx.fillRect(x0 + i * w + pl / 2, y0 + j * h + pl / 2, w - pl, h - pl); }
    if (o.apres) { ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip(); o.apres(); ctx.restore(); }
    ctx.fillStyle = o.plomb || "#141410"; for (let i = 1; i < nx; i++) ctx.fillRect(x0 + i * w - pl / 2, y0, pl, y1 - y0); for (let j = 1; j < ny; j++) ctx.fillRect(x0, y0 + j * h - pl / 2, x1 - x0, pl);
    ctx.fillStyle = o.bois; (o.montants || [.5]).forEach(k => ctx.fillRect(lerp(x0, x1, k) - o.cadre * .4, y0, o.cadre * .8, y1 - y0)); (o.traverses || []).forEach(k => ctx.fillRect(x0, lerp(y0, y1, k) - o.cadre * .4, x1 - x0, o.cadre * .8)); }
  const TEINTES = ["#7fd29a", "#9ccf6a", "#5fb8a0", "#e0a84c", "#e3c27a", "#d9823a", "#cfe0d0", "#a99be0"];

  // ====================================================================================================
  // L'herboristerie d'Hilda : herbes pendues, fioles qui luisent, chaudron sur son feu, fenêtre à petits carreaux.
  D.herbo = B => { const n = B.nuit, Uu = B.U, R = repere(B, .8, .72), E = R.E, X = R.X, Y = R.Y, T = R.T, yF = B.Y(.8);
    const c = n ? { mur: "#93a088", bois: "#7c684a", sol: "#86724f", pierre: "#908c7e", amb: "#1b2428", jour: "#7f9fd8", noir: "#0a0d0a", pre: "#030504", feu: "#ffb060", cire: "#d8cba8" }
                : { mur: "#a5b092", bois: "#826b4b", sol: "#8c7752", pierre: "#9a9484", amb: "#353b2c", jour: "#ffe9b0", noir: "#10130d", pre: "#060805", feu: "#ffb868", cire: "#e8dcba" };
    B.lum = { col: n ? "#ffc080" : "#ffe6b0", dir: -1, amb: n ? "#141c1c" : "#2c3324", brume: n ? "#5a6a58" : "#b9b48a" };
    let ctx = B.couche(.4); const feux = [], lueurs = [];
    // crépi sauge, lambris, sol de planches
    ctx.fillStyle = c.mur; ctx.fillRect(B.x0, 0, B.x1 - B.x0, yF + 2);
    const rm = rng("crepi"); for (let i = 0; i < 70; i++) { G.blob(ctx, lerp(B.x0, B.x1, rm()), rm() * yF, E * rm.r(4, 14), E * rm.r(3, 8), i + 1, .3, 12); ctx.fillStyle = rgba(rm() < .5 ? "#1a2414" : "#ffffff", rm.r(.02, .055)); ctx.fill(); }
    const yL = Y(.64); planches(ctx, B.x0, yL, B.x1, yF + 2, tonA(c.bois, .14), { l: E * 4.2, seed: 3, v: .05, j: .2 }); ctx.fillStyle = ton(c.bois, -.3); ctx.fillRect(B.x0, yL - E * 1.2, B.x1 - B.x0, E * 1.5);
    [.045, .955].forEach(u => { ctx.fillRect(X(u) - E * 1.5, 0, E * 3, yF); });
    dallage(ctx, B, yF, c.sol, { seed: 8, pas: 9, lames: true, j: .26 });
    // manteau de cheminée au centre
    const m0 = X(.39), m1 = X(.57), mx = (m0 + m1) / 2, yMan = Y(.535), aw = E * 10.5, ah = E * 19;
    pierres(ctx, m0, 0, m1, yF + 2, { col: c.pierre, h: E * 3.5, seed: 31 }); ctx.fillStyle = rgba("#000000", .22); ctx.fillRect(m1, 0, E * 1.6, yF); ctx.fillRect(m0 - E * .5, 0, E * .5, yF);
    const arc = (w, h) => { ctx.beginPath(); ctx.moveTo(mx - w, yF + 2); ctx.lineTo(mx - w, yF - h + w * .7); ctx.quadraticCurveTo(mx - w, yF - h, mx, yF - h); ctx.quadraticCurveTo(mx + w, yF - h, mx + w, yF - h + w * .7); ctx.lineTo(mx + w, yF + 2); ctx.closePath(); };
    ctx.fillStyle = ton(c.pierre, -.25); arc(aw + E * 1.6, ah + E * 1.6); ctx.fill(); ctx.fillStyle = "#3a2a1c"; arc(aw, ah); ctx.fill();
    ctx.fillStyle = ton(c.bois, -.35); ctx.fillRect(m0 - E * 2.4, yMan, m1 - m0 + E * 4.8, E * 2.3); ctx.fillStyle = ton(c.bois, -.1); ctx.fillRect(m0 - E * 2.4, yMan, m1 - m0 + E * 4.8, E * .5);
    // couronne d'herbes au-dessus du manteau
    const rw = rng("couronne"), wy = Y(.33); for (let i = 0; i < 64; i++) { const a = i / 64 * TAU + rw.r(-.05, .05), rr = E * (6.2 + rw.r(-1, 1)); ctx.save(); ctx.translate(mx + Math.cos(a) * rr, wy + Math.sin(a) * rr); ctx.rotate(a + 1.2 + rw.r(-.5, .5)); ctx.fillStyle = mixc(rw.pick(["#5d7a4c", "#74884f", "#8a8a52", "#4a6a4a"]), "#000000", rw.r(0, .3)); ctx.beginPath(); ctx.ellipse(0, 0, E * rw.r(1.1, 1.9), E * .55, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    for (let i = 0; i < 7; i++) { const a = rw() * TAU; ctx.fillStyle = "#b9a25c"; ctx.beginPath(); ctx.arc(mx + Math.cos(a) * E * 6.2, wy + Math.sin(a) * E * 6.2, E * .5, 0, TAU); ctx.fill(); }
    // étagères de fioles (à droite) et établi
    const e0 = X(.655), e1 = X(.93), rf = rng("fioles"), colEt = ton(c.bois, -.3);
    [.275, .41, .545].forEach((v, k) => { const y = Y(v); ctx.fillStyle = colEt; ctx.fillRect(e0, y, e1 - e0, E * 1.2); [e0 + E * 2, e1 - E * 2.6].forEach(x => poly(ctx, [[x, y + E * 1.2], [x + E * .7, y + E * 1.2], [x + E * .7, y + E * 4]], colEt));
      ctx.fillStyle = rgba("#000000", .16); ctx.fillRect(e0, y + E * 1.2, e1 - e0, E * 1.6); });
    const yE = Y(.705), b0 = X(.66), b1 = X(.935); ctx.fillStyle = ton(c.bois, -.2); ctx.fillRect(b0, yE, b1 - b0, E * 1.7); planches(ctx, b0 + E * 1.4, yE + E * 1.7, b1 - E * 1.4, yF + 2, tonA(c.bois, -.12), { l: E * 4, seed: 5, j: .25 }); ctx.fillStyle = ton(c.bois, -.4); ctx.fillRect(b0 + E * 1.4, yE + E * 1.7, b1 - b0 - E * 2.8, E * .8);
    // sous la fenêtre : sacs et panier
    const sac = (x, w, h, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - w * .5, yF + E); ctx.quadraticCurveTo(x - w * .62, yF - h * .6, x - w * .2, yF - h); ctx.lineTo(x - w * .32, yF - h * 1.16); ctx.lineTo(x + w * .3, yF - h * 1.14); ctx.lineTo(x + w * .2, yF - h); ctx.quadraticCurveTo(x + w * .62, yF - h * .6, x + w * .5, yF + E); ctx.closePath(); ctx.fill(); };
    sac(X(.085), E * 9, E * 9.5, "#7a7058"); sac(X(.125), E * 7.5, E * 7, "#6a6048");
    // la lumière : fenêtre à gauche, feu au centre, bougies
    const f0 = X(.135), f1 = X(.315), fy0 = Y(.2), fy1 = Y(.585), fmx = (f0 + f1) / 2;
    const tache = (x, a) => { x.save(); x.globalCompositeOperation = "lighter"; poly(x, [[f0 + E * 9, yF + E * 1], [f1 + E * 7, yF + E * 1], [f1 + E * 22, yF + E * 15], [f0 + E * 18, yF + E * 15]], rgba(c.jour, a)); x.restore(); };
    lumieres(ctx, B, c.amb, [[fmx, (fy0 + fy1) / 2, E * 92, c.jour, n ? .6 : .85], [fmx + E * 12, yF - E * 6, E * 60, c.jour, n ? .3 : .5], x => tache(x, n ? .25 : .4), [mx, yF - E * 6, E * 54, c.feu, .95], [mx, yF - E * 4, E * 100, "#c87838", .4], [m0 + E * 2, yMan - E * 4, E * 24, c.feu, .5], [m1 - E * 2, yMan - E * 4, E * 24, c.feu, .5], [X(.9), yE - E * 5, E * 34, c.feu, .7], [X(.79), Y(.4), E * 60, "#9aa070", .5], [X(.5), Y(.6), E * 120, "#7f8458", .34]]);
    // fenêtre : petits carreaux, appui, pots d'herbes à contre-jour
    const tv = n ? ["#35508c", "#2c4678", "#3d5c94", "#304a70"] : ["#fff2c4", "#ffe6a6", "#eef0c0", "#f6e9b0", "#e2ecc0"];
    carreaux(ctx, f0, fy0, f1, fy1, { nx: 8, ny: 11, bois: c.noir, cadre: E * 1.5, teintes: tv, bas: n ? "#22365e" : "#f0d08a", fondu: .5, seed: "herbo", traverses: [.36], apres: () => { if (n) G.astre(ctx, lerp(f0, f1, .7), lerp(fy0, fy1, .2), E * 2.1, "#eef3ff", "#8fb1ff", true); else G.glow(ctx, lerp(f0, f1, .3), lerp(fy0, fy1, .25), E * 22, "#ffffff", .5); } });
    G.glow(ctx, fmx, (fy0 + fy1) / 2, E * 40, c.jour, n ? .2 : .32);
    ctx.fillStyle = c.noir; ctx.fillRect(f0 - E * 3, fy1 + E * 1.2, f1 - f0 + E * 6, E * 1.5);
    const rpot = rng("pots"); [.16, .42, .66, .88].forEach((k, i) => { const px = lerp(f0, f1, k), py = fy1 + E * 1.3, s = E * rpot.r(1.5, 2.1); poly(ctx, [[px - s, py - s * 1.6], [px + s, py - s * 1.6], [px + s * .72, py], [px - s * .72, py]], c.noir); ctx.strokeStyle = c.noir; ctx.lineCap = "round";
      for (let j = 0; j < 7; j++) { const a = -Math.PI / 2 + rpot.r(-.7, .7), l = s * rpot.r(2, 4.6); ctx.lineWidth = s * .16; ctx.beginPath(); ctx.moveTo(px, py - s * 1.5); ctx.quadraticCurveTo(px + Math.cos(a) * l * .4, py - s * 1.6 - l * .6, px + Math.cos(a) * l, py - s * 1.6 + Math.sin(a) * l); ctx.stroke(); if (i % 2) { ctx.fillStyle = c.noir; ctx.beginPath(); ctx.ellipse(px + Math.cos(a) * l, py - s * 1.6 + Math.sin(a) * l, s * .5, s * .32, a, 0, TAU); ctx.fill(); } else for (let q = .4; q < 1; q += .2) { ctx.beginPath(); ctx.ellipse(px + Math.cos(a) * l * q, py - s * 1.6 + Math.sin(a) * l * q, s * .34, s * .2, a + 1, 0, TAU); ctx.fill(); } } });
    tache(ctx, n ? .05 : .08);
    // l'âtre : braises, chaudron pendu à sa crémaillère
    ctx.save(); arc(aw, ah); ctx.clip(); ctx.fillStyle = G.lin(ctx, 0, yF - ah, 0, yF, [[0, "#0c0705"], [.55, "#3a1608"], [1, "#a8481a"]]); ctx.fillRect(mx - aw, yF - ah, aw * 2, ah + 2); G.glow(ctx, mx, yF - E * 1.5, E * 13, "#ffb050", .8);
    ctx.fillStyle = "#1a0d08"; [-1, 1].forEach(sg => { ctx.save(); ctx.translate(mx + sg * E * 1, yF - E * 1.1); ctx.rotate(sg * .16); ctx.fillRect(-E * 6, -E * .7, E * 12, E * 1.4); ctx.restore(); }); ctx.restore();
    const cy = yF - E * 8.6; ctx.fillStyle = "#0b0907"; chaine(ctx, mx, yF - ah, mx, cy - E * 5.5, E * .7, "#0b0907"); ctx.strokeStyle = "#0b0907"; ctx.lineWidth = E * .5; ctx.beginPath(); ctx.ellipse(mx, cy - E * 2.6, E * 4, E * 3.4, 0, Math.PI, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(mx, cy, E * 5, E * 4.2, 0, 0, TAU); ctx.fill(); ctx.fillRect(mx - E * 4.7, cy - E * 3.4, E * 9.4, E * 1.1); eclaireArc(ctx, mx, cy + E * 2.6, E * 4.4, "#ff9a48");
    // fioles et bocaux sur les étagères, puis sur le manteau
    [.275, .41, .545].forEach((v, k) => { const y = Y(v); for (let x = e0 + E * 2.4; x < e1 - E * 2; ) { const s = E * rf.r(.95, 1.55), t = rf.i(0, 3), w = s * [2, 1.3, 2, .9][t]; if (rf() < .13) { ctx.fillStyle = "#2a2219"; ctx.fillRect(x, y - E * 2.4, E * 3.4, E * 2.4); x += E * 4.4; continue; } lueurs.push(fiole(ctx, x + w / 2, y, s, t, TEINTES[rf() < .06 ? 7 : rf.i(0, 6)])); x += w + E * rf.r(.7, 2); } });
    [[-12.5, 1.5, 2, 3], [-9, 1.2, 0, 0], [8.4, 1.25, 1, 4], [11.6, 1.6, 2, 2]].forEach(([d, s, t, k]) => lueurs.push(fiole(ctx, mx + d * E, yMan, E * s, t, TEINTES[k])));
    ctx.save(); ctx.globalCompositeOperation = "lighter"; lueurs.forEach(l => G.glow(ctx, l[0], l[1], l[2] * 4.4, l[3], n ? .24 : .13)); ctx.restore();
    bougie(ctx, feux, mx - E * 4.6, yMan, E * 3.6, c.cire); bougie(ctx, feux, mx + E * 4.4, yMan, E * 2.6, c.cire);
    // sur l'établi : mortier et pilon, balance, livres, bougie
    const mo = X(.715); ctx.fillStyle = "#3a3832"; ctx.beginPath(); ctx.moveTo(mo - E * 3, yE - E * 3.6); ctx.quadraticCurveTo(mo - E * 2.8, yE - E * .4, mo - E * 1.3, yE - E * .4); ctx.lineTo(mo - E * 1.7, yE); ctx.lineTo(mo + E * 1.7, yE); ctx.lineTo(mo + E * 1.3, yE - E * .4); ctx.quadraticCurveTo(mo + E * 2.8, yE - E * .4, mo + E * 3, yE - E * 3.6); ctx.closePath(); ctx.fill(); seg(ctx, mo + E * .6, yE - E * 2.6, mo + E * 3.6, yE - E * 6.6, E * .9, "#2a2822");
    const ba = X(.815); ctx.fillStyle = "#1c1a14"; ctx.fillRect(ba - E * .25, yE - E * 7, E * .5, E * 7); ctx.fillRect(ba - E * 1.6, yE - E * .5, E * 3.2, E * .5); seg(ctx, ba - E * 4, yE - E * 6.3, ba + E * 4, yE - E * 6.9, E * .4, "#1c1a14");
    [[-4, -6.3], [4, -6.9]].forEach(([d, h]) => { ctx.strokeStyle = "#1c1a14"; ctx.lineWidth = Math.max(1, E * .14); ctx.beginPath(); ctx.moveTo(ba + d * E, yE + h * E); ctx.lineTo(ba + (d - 1.5) * E, yE + (h + 3.2) * E); ctx.moveTo(ba + d * E, yE + h * E); ctx.lineTo(ba + (d + 1.5) * E, yE + (h + 3.2) * E); ctx.stroke(); ctx.fillStyle = "#1c1a14"; ctx.beginPath(); ctx.ellipse(ba + d * E, yE + (h + 3.2) * E, E * 1.7, E * .6, 0, 0, Math.PI); ctx.fill(); });
    [["#4a2f24", 4.6, 1], ["#34402c", 4, .9], ["#5a4a2c", 3.4, .8]].forEach(([col, w, h], i) => { ctx.fillStyle = col; ctx.fillRect(X(.765) - E * w / 2 + (i % 2) * E * .4, yE - E * (1 + i * .95), E * w, E * h); });
    bougie(ctx, feux, X(.9), yE, E * 4, c.cire); bougie(ctx, feux, X(.878), yE, E * 2.4, c.cire); lueurs.push(fiole(ctx, X(.68), yE, E * 1.1, 3, TEINTES[0])); lueurs.push(fiole(ctx, X(.86), yE, E * 1.2, 0, TEINTES[3]));
    // poutre maîtresse et ses bouquets
    const rh = rng("bouquets"), colsH = n ? ["#32463a", "#3f4a34", "#4a4630", "#3a3a4a", "#2a3a30"] : ["#4f6a46", "#667444", "#7a6c3c", "#5f5870", "#3f5a44"];
    for (let x = B.X(.5) - E * 96; x < B.x1; x += E * rh.r(5.5, 9.5)) { const k = rh(); if (k < .14) tresseAil(ctx, x, T(.05), E * rh.r(9, 13), E * 1, n ? "#8f9486" : "#cfc8ac", "#2a2418"); else bouquet(ctx, x, T(.05), E * rh.r(9, 17), E * rh.r(4.5, 7.5), rh.pick(colsH), rh, "#2a2418"); }
    ctx.fillStyle = mixc(c.bois, "#000000", .72); ctx.fillRect(B.x0, -2, B.x1 - B.x0, T(.065) + 2); ctx.fillStyle = rgba("#000000", .3); ctx.fillRect(B.x0, T(.065), B.x1 - B.x0, E * 1);
    vignette(ctx, B, n ? .6 : .46);
    ctx.fillStyle = G.lin(ctx, 0, B.Y(1), 0, B.Y(1.25), [[0, rgba(c.pre, 0)], [1, rgba(c.pre, 1)]]); ctx.fillRect(B.x0, B.Y(1), B.x1 - B.x0, B.H);
    const halo = {}; lueurs.forEach(l => halo[l[3]] = G.glowTile(l[3]));
    B.dyn(.4, (x, t) => { G.flamme(x, mx - E * 2.4, yF - E * 1.4, E * 4.6, t, 1.3); G.flamme(x, mx + E * 2, yF - E * 1.4, E * 5.6, t, 3.9); for (const f of feux) G.flamme(x, f[0], f[1], f[2], t, f[3]);
      x.save(); x.globalCompositeOperation = "lighter"; lueurs.forEach((l, i) => { if (i % 3) return; const d = l[2] * (5 + Math.sin(t * .9 + i * 1.7)); x.globalAlpha = (n ? .26 : .14) * (.6 + .4 * Math.sin(t * .7 + i * 2.3)); x.drawImage(halo[l[3]], l[0] - d, l[1] - d, d * 2, d * 2); }); x.globalAlpha = 1; x.restore(); });
    B.part(.4, "fumee", { x: mx - E * 3, y: cy - E * 16, w: E * 6, h: E * 12.5 }, { n: 8, col: n ? "#8f988c" : "#d6dac8", scale: E * .1, seed: "vapeur", alpha: .8 });
    B.sol = B.Y(.9);
    B.acteurs();
    // premier plan : gros bouquets aux angles, coin de table avec fioles et bougie, fougère
    ctx = B.couche(1); const yb = Math.min(B.H, B.Y(1.03)), g0 = B.X(0), g1 = B.X(1), rp = rng("hp"), fp = [];
    ctx.fillStyle = c.pre; ctx.fillRect(B.x0, -2, B.x1 - B.x0, B.Y(.035) + 2);
    [[-1, 30, 13], [8, 21, 10], [15.5, 14, 7.5]].forEach(([d, l, w]) => { bouquet(ctx, g0 + d * Uu, B.Y(.03), Uu * l, Uu * w, c.pre, rp, c.pre); bouquet(ctx, g1 - d * Uu, B.Y(.03), Uu * l * rp.r(.8, 1.05), Uu * w, c.pre, rp, c.pre); });
    ctx.fillStyle = c.pre; poly(ctx, [[B.x0, yb - Uu * 9], [g0 + Uu * 20, yb - Uu * 7.4], [g0 + Uu * 23, yb - Uu * 5.4], [g0 + Uu * 23, B.H], [B.x0, B.H]], c.pre); ctx.fillRect(B.x0, yb - Uu, B.x1 - B.x0, B.H - yb + Uu);
    [[3, 0, 2.2], [8, 1, 1.9], [12.4, 3, 1.7]].forEach(([d, t, s]) => { const x = g0 + d * Uu, y = yb - Uu * (8.9 - d * .08), hc = [2, 2.7, 2.3, 1.7][t]; ctx.fillStyle = c.pre; if (t === 0) { ctx.beginPath(); ctx.arc(x, y - s * Uu, s * Uu, 0, TAU); ctx.fill(); } else { rrect(ctx, x - s * Uu * .6, y - s * Uu * hc, s * Uu * 1.2, s * Uu * hc, s * Uu * .4); ctx.fill(); } ctx.fillRect(x - s * Uu * .22, y - s * Uu * (hc + 1), s * Uu * .44, s * Uu * 1.2); });
    bougie(ctx, fp, g0 + Uu * 17.4, yb - Uu * 7.6, Uu * 5, c.pre);
    for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 - .2 - i * .16 + rp.r(-.05, .05), l = Uu * rp.r(15, 26), bx = g1 + Uu * 2, by = yb + Uu * 2; ctx.strokeStyle = c.pre; ctx.lineWidth = Uu * .5; ctx.beginPath(); ctx.moveTo(bx, by); const ex = bx + Math.cos(a) * l, ey = by + Math.sin(a) * l * (1 - i * .05); ctx.quadraticCurveTo(bx + Math.cos(a) * l * .4, by + Math.sin(a) * l * .9, ex, ey); ctx.stroke();
      for (let q = .25; q < 1; q += .09) { const px = lerp(bx, ex, q) + Math.cos(a) * l * .1 * Math.sin(q * 3), py = lerp(by, ey, q) - l * .12 * Math.sin(q * Math.PI); ctx.fillStyle = c.pre; [-1, 1].forEach(sg => { ctx.beginPath(); ctx.ellipse(px, py, Uu * 2.4 * (1 - q * .6), Uu * .55, a + sg * 1.1, 0, TAU); ctx.fill(); }); } }
    flammes(B, 1, fp);
    B.part(1, "poussiere", { x: B.X(.05), y: B.Y(.15), w: B.s.w * .6, h: B.Y(.9) - B.Y(.15) }, { n: 26, col: n ? "#c9d8ff" : "#fff1c4", scale: Uu / 7.5 });
  };

  // ====================================================================================================
  // Écran-titre : la vallée de Valdren au crépuscule, vue d'un promontoire. Le fort à gauche, le village au bord
  // de la rivière, la Crête de cendre qui rougeoie à droite, le dragon qui plane devant l'astre, les Failles aux bords.
  // dragon en vol plané, vu de trois quarts : deux ailes déployées, cou tendu vers la gauche, longue queue. bat : battement (-1 à 1)
  function dragon(ctx, x, y, s, bat, col) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = col;
    const aile = (sx, L, f, ox, bx, d2, d3, by) => { const wx = ox + sx * L * .56, wy = -L * .52 - f * .65, t1 = [ox + sx * L, -L * .36 - f], t2 = [ox + sx * L * .88, L * d2 - f * .7], t3 = [ox + sx * L * .6, L * d3 - f * .4];
      ctx.beginPath(); ctx.moveTo(ox, -.9); ctx.quadraticCurveTo(ox + sx * L * .3, -L * .46 - f * .3, wx, wy); ctx.quadraticCurveTo(lerp(wx, t1[0], .55), wy - L * .07, t1[0], t1[1]);
      ctx.quadraticCurveTo(lerp(wx, t2[0], .72), lerp(wy, t2[1], .42), t2[0], t2[1]); ctx.quadraticCurveTo(lerp(wx, t3[0], .78), lerp(wy, t3[1], .46), t3[0], t3[1]); ctx.quadraticCurveTo(lerp(wx, bx, .62), lerp(wy, by, .6), bx, by); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(wx - sx * .5, wy + .3); ctx.lineTo(wx + sx * .15, wy - 1.5); ctx.lineTo(wx + sx * .55, wy + .35); ctx.closePath(); ctx.fill(); };
    aile(-1, 9.6, bat * 1.1, -1.7, -3, -.2, -.15, -1); aile(1, 12.4, bat * 1.4, -.5, 2.6, .08, .24, .3);
    ctx.beginPath(); ctx.moveTo(-10.6, 1); ctx.quadraticCurveTo(-9.4, -.3, -8, -.5); ctx.lineTo(-5.8, -2.1); ctx.lineTo(-7, -.4); ctx.lineTo(-5.4, -1); ctx.lineTo(-6.5, -.1);
    ctx.quadraticCurveTo(-4.4, -1.7, -2.2, -1.3); ctx.quadraticCurveTo(0, -1.6, 2.4, -.8); ctx.quadraticCurveTo(6, -.7, 9.4, .8); ctx.quadraticCurveTo(11.6, 1.7, 13.6, .5); ctx.lineTo(14.3, -.7); ctx.lineTo(15.4, 1); ctx.lineTo(13.8, 1.3);
    ctx.quadraticCurveTo(11.5, 2.5, 9, 1.7); ctx.quadraticCurveTo(6, .5, 3.3, 1); ctx.lineTo(3.6, 2); ctx.lineTo(5.2, 2.7); ctx.lineTo(3.1, 2.7); ctx.lineTo(1.6, 1.5); ctx.quadraticCurveTo(0, 2, -1.6, 1.3); ctx.lineTo(-1.2, 2.2); ctx.lineTo(0, 3); ctx.lineTo(-1.9, 2.8); ctx.lineTo(-2.9, 1.2);
    ctx.quadraticCurveTo(-5, 1, -7.3, 1.2); ctx.lineTo(-8.5, 1.7); ctx.lineTo(-10.3, 1.7); ctx.closePath(); ctx.fill(); ctx.restore(); }

  D.titre = B => { const n = B.nuit, Uu = B.U, X = B.X, Y = B.Y, kk = B.s.w / (Uu * 178), k = clamp(kk, .42, 1.1), S = Uu * k, F = Uu * clamp(kk, .55, 1), A = Uu * lerp(k, 1, .5), fq = w => 400 / (S * w);
    const c = n ? { haut: "#03050d", milieu: "#0b1430", bas: "#26365f", hor: "#50608e", loin: "#1c2a4c", crete: "#121a30", col: "#0e1629", val: "#0c1424", pre: "#020308", brume: "#7088ba", eau: "#a6bdf0", astre: "#eef3ff", halo: "#8fb1ff", dragon: "#04060e", feu: "#ffb766" }
                : { haut: "#0f142c", milieu: "#3a2e55", bas: "#ae5e4c", hor: "#f2ab62", loin: "#5e4862", crete: "#34242f", col: "#2b2439", val: "#1d1d2e", pre: "#06050a", brume: "#dba88c", eau: "#ffcb8c", astre: "#ffe4b4", halo: "#ff9a58", dragon: "#170b0f", feu: "#ffc37a" };
    B.lum = { col: n ? P.lune : "#ffb880", dir: 1, amb: n ? "#141c36" : "#2a1c2c", brume: c.brume };
    // ciel de crépuscule : indigo, violet, braise à l'horizon ; l'astre bas, à droite du centre
    let ctx = B.couche(0); const yH = Y(.58), ax = X(.66), ay = Y(.455), ar = S * (n ? 7 : 8);
    ctx.fillStyle = G.lin(ctx, 0, 0, 0, yH, [[0, c.haut], [.42, c.milieu], [.8, c.bas], [1, c.hor]]); ctx.fillRect(B.x0, 0, B.x1 - B.x0, B.H);
    G.stars(ctx, B.x0, 0, B.x1, yH * (n ? .9 : .62), Math.round((B.x1 - B.x0) * yH / (n ? 3800 : 8000)), 21, "#e6e9ff");
    O.nuages(ctx, B, Y(.0), Y(.26), n ? "#060a16" : "#191630", .42, 6, 73);
    G.glow(ctx, ax, ay, S * 64, c.halo, n ? .2 : .42); G.astre(ctx, ax, ay, ar, c.astre, c.halo, n);
    O.nuages(ctx, B, Y(.36), Y(.55), n ? "#42548a" : "#ffb478", n ? .15 : .24, 8, 71);
    // lointains et Crête de cendre
    ctx = B.couche(.06);
    G.ridge(ctx, { x0: B.x0, x1: B.x1, y: Y(.535), amp: A * 6, freq: fq(110), seed: 51, bottom: B.H, fill: mixc(c.loin, c.hor, .46), jag: A * 1.2 });
    const cx = X(.865), cy = Y(.375), yb = Y(.62);
    ctx.beginPath(); ctx.moveTo(cx - S * 40, yb); ctx.quadraticCurveTo(cx - S * 13, cy + (yb - cy) * .7, cx - S * 3.4, cy + S * .4); ctx.lineTo(cx - S * 2.2, cy - S * .5); ctx.lineTo(cx - S * 1, cy + S * 1.5); ctx.lineTo(cx + S * .6, cy + S * .8); ctx.lineTo(cx + S * 2.4, cy - S * .9); ctx.lineTo(cx + S * 3.4, cy + S * .9); ctx.quadraticCurveTo(cx + S * 12, cy + (yb - cy) * .66, cx + S * 40, yb); ctx.closePath();
    ctx.fillStyle = G.lin(ctx, 0, cy, 0, yb, [[0, mixc(c.crete, "#5a2418", .5)], [.35, c.crete], [1, mixc(c.crete, c.hor, .38)]]); ctx.fill();
    poly(ctx, [[cx - S * 26, yb], [cx - S * 17, cy + (yb - cy) * .5], [cx - S * 14.6, cy + (yb - cy) * .44], [cx - S * 12, cy + (yb - cy) * .62], [cx - S * 4, yb]], mixc(c.crete, c.hor, .12));
    // coulées et gueule rougeoyante
    const rl = rng("coulees"); ctx.lineCap = "round"; ctx.lineJoin = "round"; [[-1.2, -1], [.4, 1], [-.4, -.35], [1.6, .5]].forEach(([d, s], i) => { const pts = [[cx + d * S, cy + S * 1.4]]; for (let j = 1; j < 7; j++) pts.push([pts[j - 1][0] + s * S * rl.r(.6, 2.4) + rl.r(-1, 1) * S * .8, pts[j - 1][1] + S * rl.r(1.6, 3)]);
      ctx.beginPath(); pts.forEach((q, j) => j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.strokeStyle = rgba("#ff7030", .16); ctx.lineWidth = S * 1.6; ctx.stroke(); ctx.strokeStyle = rgba("#ff9a50", i < 2 ? .8 : .5); ctx.lineWidth = Math.max(1, S * .32); ctx.stroke(); });
    G.glow(ctx, cx, cy + S, S * 15, "#ff6a30", n ? .7 : .55); G.glow(ctx, cx, cy - S * 3, S * 30, P.braise, n ? .3 : .22);
    G.ridge(ctx, { x0: B.x0, x1: B.x1, y: Y(.575), amp: A * 3.4, freq: fq(70), seed: 57, bottom: B.H, fill: mixc(c.loin, c.hor, .2), jag: A * .7 });
    O.voile(ctx, B, Y(.44), Y(.62), c.hor, n ? .2 : .3);
    B.dyn(.06, (x, t) => { G.glow(x, cx, cy, S * (9 + Math.sin(t * .8)), "#ff7a3a", (n ? .34 : .26) * (.8 + .2 * Math.sin(t * 1.9)));
      dragon(x, ax - S * .5 + Math.sin(t * .11) * S * 3, ay + S * 2.4 + Math.sin(t * .17 + 1) * S * 1.3, S * 1.02, Math.sin(t * .8) * .9, c.dragon); });
    B.part(.06, "fumee", { x: cx - S * 2, y: cy - S * 16, w: S * 4, h: S * 16 }, { n: 9, col: n ? "#2c2c48" : "#5a3a44", scale: S * .22, seed: "crete", alpha: 1.5 });
    // collines boisées
    ctx = B.couche(.14); const colC = mixc(c.col, c.hor, .14), rc = rng("collines");
    const pts = G.ridge(ctx, { x0: B.x0, x1: B.x1, y: Y(.615), amp: A * 3.2, freq: fq(60), seed: 61, bottom: B.H, fill: colC });
    for (let x = B.x0; x < B.x1; x += S * rc.r(1, 2.2)) O.pin(ctx, x, G.ridgeY(pts, x) + S * .6, S * rc.r(2.2, 4.6), colC, rc);
    O.voile(ctx, B, Y(.56), Y(.68), c.brume, n ? .2 : .3);
    // le fort de Varek sur sa butte
    ctx = B.couche(.22); const fx = X(.17), fy = Y(.588), colF = mixc(c.col, "#000000", .42), feux = [], rfo = rng("titre-fort");
    O.palissade(ctx, fx - S * 11, fx + S * 11, fy + S, S * 3.4, colF, rfo, S * .62); O.tour(ctx, fx + S * 4.6, fy + S, S * 3.6, S * 9.6, colF, rfo, { creneaux: true });
    poly(ctx, [[fx - S * 2.6, fy], [fx - S * 2.6, fy - S * 3.4], [fx - S * 1.4, fy - S * 5.4], [fx + S * 1.6, fy - S * 5.6], [fx + S * 2.4, fy - S * 3.4], [fx + S * 2.4, fy]], colF);
    ctx.strokeStyle = colF; ctx.lineWidth = Math.max(1, S * .34); ctx.lineCap = "round"; [[-1.5, -.9], [1.5, .9]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(fx - S * 7 + a * S, fy); ctx.lineTo(fx - S * 7 + b * S, fy - S * 7.4); ctx.stroke(); }); ctx.beginPath(); ctx.moveTo(fx - S * 8.4, fy - S * 1.2); ctx.lineTo(fx - S * 6, fy - S * 5.2); ctx.moveTo(fx - S * 5.6, fy - S * 1.2); ctx.lineTo(fx - S * 8, fy - S * 5.2); ctx.stroke();
    ctx.fillStyle = colF; ctx.fillRect(fx - S * 8.7, fy - S * 9.4, S * 3.4, S * 2.2); poly(ctx, [[fx - S * 9.4, fy - S * 9.3], [fx - S * 7, fy - S * 11.2], [fx - S * 4.6, fy - S * 9.3]], colF);
    const butte = x => { const d = Math.abs(x - fx) / (S * 30); return fy + S * (.8 + (U.fbm1(x / (S * 5), 9, 3) - .5) * 1.6) + Math.pow(Math.max(0, d - .34) * 1.5, 1.7) * (Y(.76) - fy) * 1.6; };
    ctx.beginPath(); ctx.moveTo(B.x0, B.H); for (let x = B.x0; x <= fx + S * 46; x += 3) ctx.lineTo(x, butte(x)); ctx.lineTo(fx + S * 46, B.H); ctx.closePath(); ctx.fillStyle = G.lin(ctx, 0, fy, 0, Y(.78), [[0, mixc(c.col, "#000000", .3)], [1, mixc(c.col, c.val, .7)]]); ctx.fill();
    [[-10, -3.6], [-.2, -2.2], [10, -3.6], [4.6, -11.4]].forEach(([dx, dy], i) => { feux.push([fx + dx * S, fy + dy * S, S * 1.5, i * 2.1]); G.glow(ctx, fx + dx * S, fy + dy * S, S * 6, c.feu, n ? .4 : .3); });
    ctx.fillStyle = rgba(c.feu, .9); ctx.fillRect(fx - S * .5, fy - S * 1.8, S * 1, S * 2); ctx.fillRect(fx + S * 4.3, fy - S * 6.4, S * .5, S * 1);
    G.fog(ctx, B.x0, fx + S * 40, Y(.675), A * 3.4, c.brume, n ? .2 : .26, 81, 9);
    B.dyn(.22, (x, t) => { for (const f of feux) G.flamme(x, f[0], f[1], f[2], t, f[3]); O.banniere(x, fx + S * 5.9, fy - S * 14.6, S * 3.4, S * 1.9, n ? "#b85a38" : "#b0502e", t, 1); x.fillStyle = colF; x.fillRect(fx + S * 5.6, fy - S * 15, Math.max(1, S * .28), S * 4.6); });
    // le fond de la vallée : bois, rivière, Valdren
    ctx = B.couche(.3); const rv = rng("titre-val"), vx = X(.47), vy = Y(.716);
    G.ridge(ctx, { x0: B.x0, x1: B.x1, y: Y(.655), amp: A * 1.2, freq: fq(80), seed: 67, bottom: B.H, fill: G.lin(ctx, 0, Y(.64), 0, Y(1), [[0, mixc(c.val, c.brume, .34)], [.3, mixc(c.val, c.brume, .1)], [1, mixc(c.val, "#000000", .4)]]) });
    const riv = [[.645, .652, .5], [.6, .668, 1.1], [.555, .69, 1.8], [.535, .722, 2.8], [.575, .765, 4.6], [.6, .81, 7], [.51, .87, 10], [.41, .94, 15], [.43, 1.05, 22]], rive = [];
    const cr = (a, b, d, e, t) => .5 * (2 * b + (d - a) * t + (2 * a - 5 * b + 4 * d - e) * t * t + (3 * b - a - 3 * d + e) * t * t * t);
    for (let i = 0; i < riv.length - 1; i++) for (let j = 0; j < 6; j++) { const t = j / 6, a = riv[Math.max(0, i - 1)], b = riv[i], d = riv[i + 1], e = riv[Math.min(riv.length - 1, i + 2)]; rive.push([X(cr(a[0], b[0], d[0], e[0], t)), Y(cr(a[1], b[1], d[1], e[1], t)), S * cr(a[2], b[2], d[2], e[2], t)]); }
    const rivX = y => { let m = rive[0]; for (const q of rive) if (Math.abs(q[1] - y) < Math.abs(m[1] - y)) m = q; return m; };
    // bosquets : les plus proches par-dessus
    const bos = []; for (let i = 0; i < 190; i++) { const v = lerp(.662, .96, Math.pow(rv(), 1.15)), x = lerp(B.x0, B.x1, rv()), y = Y(v), q = rivX(y); if (Math.abs(x - q[0]) < q[2] * .5 + S * 1.6 || (Math.abs(x - vx) < S * 21 && Math.abs(y - vy) < S * 3.4)) continue; bos.push([x, y, v]); }
    bos.sort((a, b) => a[1] - b[1]).forEach(([x, y, v]) => { const d = (v - .66) / .3; O.pin(ctx, x, y, S * (1.8 + d * 7) * rv.r(.8, 1.2), mixc(mixc(c.val, "#000000", .3 + d * .3), c.brume, (1 - d) * .22), rv); });
    ctx.beginPath(); rive.forEach((q, i) => i ? ctx.lineTo(q[0] - q[2] / 2, q[1]) : ctx.moveTo(q[0] - q[2] / 2, q[1])); for (let i = rive.length - 1; i >= 0; i--) ctx.lineTo(rive[i][0] + rive[i][2] / 2, rive[i][1]); ctx.closePath();
    ctx.fillStyle = G.lin(ctx, 0, Y(.65), 0, Y(1), [[0, rgba(c.eau, .95)], [.35, mixc(c.eau, c.val, .3)], [1, mixc(c.eau, c.val, .66)]]); ctx.fill();
    // Valdren : toits, tour de la Guilde, fenêtres allumées
    const colV = mixc(c.val, "#000000", .5), fens = []; O.palissade(ctx, vx - S * 20, vx - S * 14, vy + S * .3, S * 1.7, colV, rv, S * .5);
    [[-15, 3.6, 2.3], [-11, 4.2, 2.7], [-7.2, 3.6, 2.3], [-3.6, 4.4, 2.9], [3.4, 4, 2.6], [7, 3.4, 2.2], [10.6, 4.2, 2.6], [14.2, 3.2, 2]].forEach(([dx, w, h]) => O.maison(ctx, vx + dx * S, vy + rv.r(-.4, .5) * S, S * w, S * h, colV, rv, { porte: false }).forEach(f => fens.push([f[0], f[1], Math.max(1.2, f[2] * 1.3), Math.max(1.4, f[3] * 1.2)])));
    O.tour(ctx, vx, vy + S * .3, S * 2, S * 8.4, colV, rv, { creneaux: true }); ctx.fillRect(vx - S * 3, vy - S * 3.2, S * 6, S * 3.5); poly(ctx, [[vx - S * 3.6, vy - S * 3.1], [vx, vy - S * 5.2], [vx + S * 3.6, vy - S * 3.1]], colV);
    [[0, -6.6], [-1.8, -1.6], [1.8, -1.6], [0, -4.4]].forEach(([dx, dy]) => fens.push([vx + dx * S, vy + dy * S, Math.max(1.2, S * .5), Math.max(1.4, S * .8)]));
    ctx.save(); ctx.globalCompositeOperation = "lighter"; O.lueursFenetres(ctx, fens, c.feu, .95); G.glow(ctx, vx, vy - S * 1.5, S * 20, c.feu, n ? .2 : .16);
    fens.forEach(f => { const q = rivX(f[1] + S * 3); if (Math.abs(f[0] - q[0]) < q[2] * .5 + S * 7) { ctx.fillStyle = rgba(c.feu, .1); ctx.fillRect(q[0] - q[2] * .4, q[1] - S * .3, q[2] * .8, S * 1.4); } }); ctx.restore();
    G.fog(ctx, B.x0, B.x1, Y(.69), A * 3, c.brume, n ? .2 : .26, 83, 12); G.fog(ctx, B.x0, B.x1, Y(.79), A * 5, c.brume, n ? .12 : .16, 85, 10);
    const tw = G.glowTile(c.feu);
    B.dyn(.3, (x, t) => { x.save(); x.globalCompositeOperation = "lighter"; const rr = rng("reflets");
      for (let i = 0; i < 26; i++) { const q = rive[4 + Math.floor(rr() * (rive.length - 12))], a = .5 + .5 * Math.sin(t * rr.r(.7, 1.9) + i * 2.7), w = q[2] * rr.r(.15, .5); x.fillStyle = rgba(c.eau, .34 * a); x.fillRect(q[0] + (rr() - .5) * (q[2] - w) - w / 2 + Math.sin(t * .5 + i) * S * .3, q[1] + rr.r(-1, 1) * S, w, Math.max(1, S * .18)); }
      fens.forEach((f, i) => { if (i % 2) return; const d = S * (2.2 + .5 * Math.sin(t * 4 + i * 2.1)); x.globalAlpha = .3; x.drawImage(tw, f[0] - d, f[1] - d, d * 2, d * 2); }); x.globalAlpha = 1; x.restore(); });
    B.part(.3, "brume", { x: B.x0, y: Y(.64), w: B.x1 - B.x0, h: Y(.8) - Y(.64) }, { n: 7, col: c.brume, scale: A * .08, seed: "tb" });
    // les Failles : lueurs violettes derrière les versants boisés des bords
    const failles = [[X(.13), Y(.8), 1, 0], [X(.86), Y(.745), 1.15, 2.3], [X(.935), Y(.86), .7, 4.1]];
    B.dyn(.6, (x, t) => { failles.forEach(([px, py, g, ph]) => { const a = .62 + .38 * Math.sin(t * .9 + ph) * Math.sin(t * .37 + ph * 2); G.glow(x, px, py, F * 28 * g, "#8a5ae6", .62 * a); G.glow(x, px, py + F * 2, F * 10 * g, "#d8c4ff", .6 * a);
      x.save(); x.translate(px, py - F * 13 * g); x.scale(.07, 1); G.glow(x, 0, 0, F * 30 * g, "#b9a0ff", .5 * a); x.restore(); }); });
    ctx = B.couche(.6); const colS = mixc(c.pre, c.val, .46), rs = rng("versants");
    const pG = x => Y(.7) + Math.pow(clamp((x - B.x0) / (X(.46) - B.x0), 0, 1), 1.5) * (Y(1.05) - Y(.7)) + (U.fbm1(x / (F * 9), 3, 3) - .5) * F * 3, pD = x => Y(.715) + Math.pow(clamp((B.x1 - x) / (B.x1 - X(.6)), 0, 1), 1.5) * (Y(1.05) - Y(.715)) + (U.fbm1(x / (F * 9), 13, 3) - .5) * F * 3;
    ctx.fillStyle = colS; ctx.beginPath(); ctx.moveTo(B.x0, B.H); for (let x = B.x0; x <= X(.46); x += 4) ctx.lineTo(x, pG(x)); ctx.lineTo(X(.46), B.H); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(X(.6), B.H); for (let x = X(.6); x <= B.x1 + 4; x += 4) ctx.lineTo(x, pD(x)); ctx.lineTo(B.x1, B.H); ctx.closePath(); ctx.fill();
    for (let x = B.x0; x < X(.44); x += F * rs.r(1.6, 3.4)) O.pin(ctx, x, pG(x) + F, F * rs.r(6, 11), colS, rs); for (let x = X(.62); x < B.x1; x += F * rs.r(1.6, 3.4)) O.pin(ctx, x, pD(x) + F, F * rs.r(6, 11), colS, rs);
    failles.forEach(([px, py, g]) => { eclaire(ctx, px, py + F * 4, F * 22 * g, "#9a70f0", .55); });
    B.part(.6, "follet", { x: X(.06), y: Y(.68), w: X(.14), h: Y(.84) - Y(.68) }, { n: 5, col: "#b9a0ff", scale: F / 7, seed: "f1" }); B.part(.6, "follet", { x: X(.8), y: Y(.64), w: X(.98) - X(.8), h: Y(.88) - Y(.64) }, { n: 7, col: "#b9a0ff", scale: F / 7, seed: "f2" });
    B.sol = Y(.9);
    B.acteurs();
    // premier plan : le promontoire, les grands pins, le voyageur
    ctx = B.couche(1); const rp = rng("titre-pre"), g0 = X(0), g1 = X(1);
    G.ridge(ctx, { x0: B.x0, x1: B.x1, y: Y(.965), amp: Uu * 1.4, freq: fq(50), seed: 91, bottom: B.H, fill: c.pre, jag: Uu * .6 });
    ctx.fillStyle = c.pre; ctx.beginPath(); ctx.moveTo(B.x0, Y(.835)); ctx.quadraticCurveTo(g0 + F * 26, Y(.84), g0 + F * 36, Y(.9)); ctx.quadraticCurveTo(g0 + F * 42, Y(.95), g0 + F * 60, Y(.985)); ctx.lineTo(B.x0, B.H); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(B.x1, Y(.88)); ctx.quadraticCurveTo(g1 - F * 16, Y(.89), g1 - F * 30, Y(.975)); ctx.lineTo(B.x1, B.H); ctx.closePath(); ctx.fill();
    O.pin(ctx, g0 + F * 2, Y(.9), F * 62, c.pre, rp); O.pin(ctx, g0 + F * 13, Y(.88), F * 40, c.pre, rp); O.pin(ctx, g1 - F * 3, Y(.93), F * 52, c.pre, rp); O.arbreMort(ctx, g1 - F * 15, Y(.91), F * 30, c.pre, rp);
    O.herbe(ctx, B.x0, B.x1, Y(.972), Uu * 2.2, c.pre, rp, .7); O.rochers(ctx, g0 + F * 20, g0 + F * 44, Y(.9), F * 3, c.pre, rp, 4);
    const hx = g0 + F * 29.5, hy = Y(.868), hh = F * 9; G.glow(ctx, hx + F * 2, hy - hh * .5, F * 15, c.brume, n ? .2 : .26, "source-over"); ctx.fillStyle = c.pre; ctx.beginPath(); ctx.arc(hx, hy - hh * .9, hh * .095, 0, TAU); ctx.fill();
    poly(ctx, [[hx - hh * .1, hy - hh * .8], [hx + hh * .1, hy - hh * .8], [hx + hh * .14, hy - hh * .3], [hx - hh * .36, hy - hh * .04], [hx - hh * .1, hy + hh * .1], [hx + hh * .13, hy + hh * .1]], c.pre); seg(ctx, hx + hh * .2, hy + hh * .1, hx + hh * .24, hy - hh * 1.08, Math.max(1, hh * .035), c.pre);
    G.fog(ctx, B.x0, B.x1, Y(.93), Uu * 4, c.brume, n ? .06 : .08, 93, 8);
    B.part(1, "cendre", { x: B.x0, y: 0, w: B.x1 - B.x0, h: Y(.95) }, { n: 12, col: n ? "#7078a0" : "#d8a890", scale: Uu / 8, alpha: .7 });
  };

  // ====================================================================================================
  // La bataille du Gué : la rue de Valdren en plein assaut. Barricades de chariots, palissade éventrée, maison en feu.
  function roue(ctx, x, y, r, col) { ctx.strokeStyle = col; ctx.lineCap = "round"; ctx.lineWidth = r * .16; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.lineWidth = r * .09; for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + .2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke(); } ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r * .2, 0, TAU); ctx.fill(); }
  // chariot renversé sur le flanc : caisse basculée, une roue en l'air, brancards dressés. (x, y) : appui au sol
  function chariot(ctx, x, y, s, col, sens = 1) { ctx.save(); ctx.translate(x, y); ctx.scale(sens, 1); ctx.save(); ctx.rotate(-.3); ctx.fillStyle = col; ctx.fillRect(-s * 7, -s * 7.6, s * 14, s * 6.6); ctx.fillRect(-s * 7.6, -s * 9, s * .9, s * 8.4); ctx.fillRect(s * 6.7, -s * 9, s * .9, s * 8.4); ctx.fillRect(-s * 7.6, -s * 9, s * 15.2, s * .8); ctx.restore();
    roue(ctx, -s * 3.4, -s * 10.4, s * 3.7, col); roue(ctx, s * 6, -s * 3, s * 3.7, col); seg(ctx, s * 4, -s * 6.4, s * 15, -s * 13.5, s * .7, col); seg(ctx, s * 5.4, -s * 4.6, s * 17, -s * 10, s * .7, col); ctx.restore(); }
  const caisse = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x - w / 2, y - h, w, h); ctx.strokeStyle = rgba("#000000", .3); ctx.lineWidth = Math.max(1, w * .05); ctx.strokeRect(x - w / 2 + w * .08, y - h + w * .08, w * .84, h - w * .16); ctx.beginPath(); ctx.moveTo(x - w * .42, y - h + w * .08); ctx.lineTo(x + w * .42, y - w * .08); ctx.stroke(); };
  function lance(ctx, x, y, len, ang, w, col) { const dx = Math.cos(ang), dy = Math.sin(ang), ex = x + dx * len, ey = y + dy * len; seg(ctx, x, y, ex, ey, w, col); poly(ctx, [[ex - dy * w * 1.5, ey + dx * w * 1.5], [ex + dx * w * 9, ey + dy * w * 9], [ex + dy * w * 1.5, ey - dx * w * 1.5], [ex - dx * w * 2, ey - dy * w * 2]], col); }

  D.bataille = B => { const n = B.nuit, Uu = B.U, R = repere(B, .62, .72), E = R.E, X = R.X, yS = B.Y(.62), g0 = B.X(0), g1 = B.X(1);
    const c = n ? { haut: "#060408", milieu: "#2a1114", bas: "#8c3a20", loin: "#200f12", bati: "#080405", sol: "#170c0b", pre: "#030203", brume: "#b05a30", feu: "#ffa24a" }
                : { haut: "#241618", milieu: "#743628", bas: "#d98448", loin: "#4c2a28", bati: "#150b0a", sol: "#2b1a15", pre: "#070404", brume: "#dc9258", feu: "#ffb060" };
    B.lum = { col: "#ffa45a", dir: 1, amb: n ? "#1c0d0e" : "#2c1614", brume: c.brume };
    // ciel rouge sale, astre étouffé par la fumée
    let ctx = O.ciel(B, { haut: c.haut, milieu: c.milieu, bas: c.bas, astre: n ? [.3, .17, 2.6] : [.31, .25, 4], astreCol: n ? "#c9a090" : "#ffb478", halo: n ? "#7a3024" : "#ff7a3a", nuageCol: n ? "#a04a26" : "#ffa868", nuageA: .2, horizon: .64, seed: 9 });
    const fxm = X(.635), wt = yS + E - E * 13, rsm = rng("panache"); G.glow(ctx, fxm, wt - E * 8, E * 70, "#ff6a2a", n ? .4 : .32);
    for (let i = 0; i < 16; i++) { const q = i / 15; G.glow(ctx, fxm + E * 4 - q * E * (70 + rsm.r(-8, 8)), wt - E * 12 - q * (wt - E * 12 - B.Y(-.05)) + rsm.r(-3, 3) * E, E * (9 + q * 30), "#120808", .5 - q * .14, "source-over"); }
    O.nuages(ctx, B, B.Y(-.04), B.Y(.3), "#0c0606", .55, 8, 44);
    // lointains : bois, toits, tour de la Guilde dans la fumée
    ctx = B.couche(.12); const rl = rng("bat-loin"), colL = mixc(c.loin, c.bas, .3);
    G.ridge(ctx, { x0: B.x0, x1: B.x1, y: B.Y(.56), amp: Uu * 4, freq: 1.3, seed: 15, bottom: B.H, fill: colL });
    for (let x = B.x0; x < B.x1; x += Uu * rl.r(1.6, 3.4)) O.pin(ctx, x, B.Y(.6) + rl.r(-1, 1) * Uu, Uu * rl.r(6, 12), colL, rl);
    O.tour(ctx, X(.37), yS, E * 5.4, E * 27, mixc(c.loin, c.bas, .16), rl, { creneaux: true }); [[.2, 11, 7], [.47, 10, 6.4], [.3, 9, 6]].forEach(([u, w, h]) => O.maison(ctx, X(u), yS, E * w, E * h, mixc(c.loin, c.bas, .16), rl));
    O.voile(ctx, B, B.Y(.36), B.Y(.66), c.brume, n ? .34 : .46); ctx.fillStyle = rgba(c.brume, n ? .34 : .46); ctx.fillRect(B.x0, B.Y(.66) - 1, B.x1 - B.x0, B.H);
    // la rue : maisons en silhouette, l'une en feu ; palissade éventrée à droite
    ctx = B.couche(.3); const rh = rng("bat-rue"), colB = mixc(c.bati, c.bas, .07), feux = [], hb = yS + E, hw = E * 22, hh = E * 13, toit = E * 12.5;
    ctx.fillStyle = G.lin(ctx, 0, yS, 0, B.Y(.9), [[0, mixc(c.sol, c.brume, .62)], [1, mixc(c.sol, c.brume, .3)]]); ctx.fillRect(B.x0, yS, B.x1 - B.x0, B.H - yS);
    [[.045, 20, 13], [.245, 17, 11], [.445, 15, 10], [.875, 18, 12.5], [1.03, 16, 11]].forEach(([u, w, h]) => { const f = O.maison(ctx, X(u), hb, E * w, E * h, colB, rh, { fen: 2 }); ctx.save(); ctx.globalCompositeOperation = "lighter"; f.forEach(q => { ctx.fillStyle = rgba(c.feu, .2); ctx.fillRect(q[0] - q[2] / 2, q[1] - q[3] / 2, q[2], q[3]); }); ctx.restore(); });
    ctx.fillStyle = colB; ctx.fillRect(fxm - hw / 2, hb - hh, hw, hh + 2); poly(ctx, [[fxm - hw * .62, wt + 2], [fxm - hw * .04, wt - toit], [fxm + hw * .06, wt - toit * .98], [fxm + hw * .62, wt + 2]], colB);
    ctx.save(); ctx.globalCompositeOperation = "destination-out"; [[.2, .46, 3.4], [.36, .2, 2.7], [.1, .76, 2.3], [.47, .07, 1.5], [-.2, .3, 1.8]].forEach(([dx, dy, r], i) => { G.blob(ctx, fxm + hw * dx, wt - toit * dy, E * r, E * r * .8, i + 3, .35, 12); ctx.fill(); }); ctx.restore();
    ctx.strokeStyle = colB; ctx.lineCap = "round"; ctx.lineWidth = E * .6; [.2, .46, .7].forEach(q => { ctx.beginPath(); ctx.moveTo(fxm + hw * .02, wt - toit * q); ctx.lineTo(fxm + hw * (.6 - q * .56), wt - toit * q + E * .6); ctx.stroke(); }); ctx.beginPath(); ctx.moveTo(fxm + hw * .22, wt); ctx.lineTo(fxm + hw * .2, wt - toit * .6); ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = "lighter"; [[-.27, .52, 2.6, 3.4], [.24, .52, 2.6, 3.4], [0, .26, 3.4, 6.8]].forEach(([dx, dy, w, h]) => { ctx.fillStyle = "#ffb050"; ctx.fillRect(fxm + hw * dx - E * w / 2, hb - hh * dy - E * h / 2, E * w, E * h); G.glow(ctx, fxm + hw * dx, hb - hh * dy, E * 8, "#ff8a3a", .6); }); ctx.restore();
    [[.2, .44, 7.6], [.36, .16, 6.4], [.09, .76, 6], [-.2, .34, 4.6], [.5, 0, 4]].forEach(([dx, dy, h], i) => feux.push([fxm + hw * dx, wt - toit * dy + E, E * h, i * 1.9])); feux.push([fxm - hw * .27, hb - hh * .42, E * 3.4, 7], [fxm + hw * .24, hb - hh * .42, E * 3.8, 9], [X(.875) + E * 3, hb - E * 22, E * 3.6, 11]);
    // palissade : debout à droite, éventrée devant la brèche
    O.palissade(ctx, X(.9), B.x1, hb + E, E * 13, colB, rh, E * 1.8);
    [[.8, -.5, 9], [.815, -.95, 11], [.835, -1.2, 8], [.852, -.72, 12], [.868, -1.38, 10], [.884, -1.5, 12]].forEach(([u, a, l]) => pieu(ctx, X(u), hb + E, E * l, a, E * 1.5, colB)); [[.735, -.12, 9], [.762, .1, 7]].forEach(([u, a, l]) => pieu(ctx, X(u), hb + E * .6, E * l, a, E * 1.4, colB));
    // le feu éclaire les murs voisins
    eclaire(ctx, fxm + E * 3, wt - E * 4, E * 62, "#ff8438", n ? .5 : .4); G.glow(ctx, fxm + E * 3, wt - E * 9, E * 40, "#ff7a30", n ? .26 : .2);
    O.voile(ctx, B, yS - E * 14, yS + E * 2, c.brume, n ? .4 : .5); G.fog(ctx, B.x0, B.x1, yS + Uu * 4, Uu * 8, c.brume, .34, 47, 14);
    B.dyn(.3, (x, t) => { const f = .78 + .22 * Math.sin(t * 6.7) * Math.sin(t * 2.9 + 1); G.glow(x, fxm + E * 3, wt - E * 8, E * 56, "#ff7a30", (n ? .13 : .1) * f); for (const q of feux) G.flamme(x, q[0], q[1], q[2], t, q[3]); });
    B.part(.3, "fumee", { x: fxm - E * 8, y: wt - toit - E * 30, w: E * 16, h: E * 29 }, { n: 30, col: "#3a2018", scale: E * .5, seed: "bf1", alpha: 1.5 });
    B.part(.3, "braise", { x: fxm - E * 9, y: wt - E * 34, w: E * 22, h: E * 36 }, { n: 34, scale: Uu / 7, seed: "bb1" });
    B.part(.3, "fumee", { x: X(.875), y: hb - E * 48, w: E * 6, h: E * 24 }, { n: 10, col: "#3a2420", scale: E * .36, seed: "bf2", alpha: 1.2 });
    // barricades de chariots renversés, bannière de la Guilde encore debout
    ctx = B.couche(.55); const rb = rng("barricade"), colC = mixc(c.bati, c.sol, .35), yB = B.Y(.835), mx = g0 + Uu * 22, my = B.Y(.2);
    G.ridge(ctx, { x0: B.x0, x1: B.x1, y: B.Y(.822), amp: Uu * 1.2, freq: 1.5, seed: 23, bottom: B.H, fill: G.lin(ctx, 0, B.Y(.8), 0, B.Y(.92), [[0, mixc(c.sol, c.brume, .4)], [1, mixc(c.sol, c.brume, .14)]]) });
    chariot(ctx, g0 + Uu * 5, yB + Uu, Uu * 1.2, colC, 1); tonneau(ctx, g0 + Uu * 17.5, yB + Uu, Uu * 7.5, Uu * 8.6, colC, mixc(c.bati, "#000000", .3)); caisse(ctx, g0 - Uu * 3, yB + Uu, Uu * 8, Uu * 7, colC); caisse(ctx, g0 + Uu * 12, yB + Uu, Uu * 6, Uu * 5, colC);
    [[9, -.62, 13], [14, -.4, 11]].forEach(([d, a, l]) => pieu(ctx, g0 + d * Uu, yB - Uu * 2, Uu * l, a, Uu * 1.2, colC));
    ctx.fillStyle = colC; ctx.fillRect(mx - Uu * .45, my, Uu * .9, yB - my + Uu); G.blob(ctx, mx, yB + Uu, Uu * 4.4, Uu * 2.6, 5, .2, 12); ctx.fill();
    chariot(ctx, g1 - Uu * 6, yB + Uu, Uu * 1.15, colC, -1); caisse(ctx, g1 - Uu * 17, yB + Uu, Uu * 6.4, Uu * 5.4, colC); tonneau(ctx, g1 + Uu * 2, yB + Uu, Uu * 8, Uu * 9, colC, mixc(c.bati, "#000000", .3));
    [[-11, -2.5, 12], [-15, -2.72, 10]].forEach(([d, a, l]) => pieu(ctx, g1 + d * Uu, yB - Uu * 2, Uu * l, a, Uu * 1.2, colC));
    if (B.s.w > Uu * 130) { const dx = B.X(.5); roue(ctx, dx - Uu * 4, yB - Uu * 1.2, Uu * 3, colC); seg(ctx, dx - Uu * 2, yB, dx + Uu * 8, yB - Uu * 3.6, Uu * .8, colC); seg(ctx, dx + Uu * 1, yB, dx + Uu * 5, yB - Uu * 6, Uu * .7, colC); feux.push([dx + Uu * 3.6, yB - Uu * 2.4, Uu * 3.2, 13]); G.glow(ctx, dx + Uu * 3.6, yB - Uu * 2, Uu * 12, c.feu, .3); }
    eclaire(ctx, g0 + Uu * 30, B.Y(.66), Uu * 34, "#ff8a40", n ? .5 : .42); eclaire(ctx, g1 - Uu * 30, B.Y(.6), Uu * 36, "#ff8a40", n ? .6 : .5);
    G.fog(ctx, B.x0, B.x1, B.Y(.8), Uu * 6, c.brume, n ? .22 : .28, 49, 14);
    B.dyn(.55, (x, t) => { O.banniere(x, mx + Uu * .4, my + Uu * 1, Uu * 13, Uu * 7.4, n ? "#5f86a8" : "#7fa6c6", t * 1.2, .7); x.fillStyle = rgba("#0b1a26", .5); x.beginPath(); x.arc(mx + Uu * 5.2, my + Uu * 4.7 + Math.sin(t * 2.9 + 2.6) * Uu * .3, Uu * 1.5, 0, TAU); x.fill(); x.fillStyle = colC; x.fillRect(mx - Uu * .45, my - Uu, Uu * .9, Uu * 10); });
    // le sol piétiné
    ctx = B.couche(.78); G.ridge(ctx, { x0: B.x0, x1: B.x1, y: B.Y(.86), amp: Uu * 1.2, freq: 1.6, seed: 29, bottom: B.H, fill: G.lin(ctx, 0, B.Y(.84), 0, B.Y(1.08), [[0, mixc(c.sol, c.brume, .24)], [.3, c.sol], [1, mixc(c.sol, "#000000", .6)]]) });
    const rg = rng("bat-sol"); O.rochers(ctx, B.x0, B.x1, B.Y(.876), Uu * 1.1, mixc(c.sol, "#000000", .25), rg, 9);
    for (let i = 0; i < 7; i++) { const x = lerp(B.x0, B.x1, rg()), a = -Math.PI / 2 + rg.r(-.5, .5), l = Uu * rg.r(3, 5); const fl = mixc(c.sol, "#000000", .35), y0 = B.Y(.875), ex = x + Math.cos(a) * l, ey = y0 + Math.sin(a) * l; seg(ctx, x, y0, ex, ey, Math.max(1, Uu * .2), fl); [.74, .88].forEach(q => [-1, 1].forEach(sg => seg(ctx, x + Math.cos(a) * l * q, y0 + Math.sin(a) * l * q, x + Math.cos(a) * l * (q + .14) + Math.cos(a + sg * 1.57) * Uu * .5, y0 + Math.sin(a) * l * (q + .14) + Math.sin(a + sg * 1.57) * Uu * .5, Math.max(1, Uu * .16), fl))); }
    B.sol = B.Y(.9);
    B.acteurs();
    // premier plan : lances, pieux, roue brisée ; fumée et braises qui traversent
    ctx = B.couche(1); const yb = Math.min(B.H, B.Y(1.03)), rp = rng("bat-pre");
    ctx.fillStyle = c.pre; ctx.fillRect(B.x0, yb - Uu * 2, B.x1 - B.x0, B.H - yb + Uu * 2);
    [[-3, -1.02, 31], [5, -1.24, 24]].forEach(([d, a, l]) => pieu(ctx, g0 + d * Uu, yb + Uu * 3, Uu * l, a, Uu * 3.2, c.pre)); [[3, -2.12, 32], [-5, -1.9, 24]].forEach(([d, a, l]) => pieu(ctx, g1 + d * Uu, yb + Uu * 3, Uu * l, a, Uu * 3.2, c.pre));
    [[10, -1.42, 50], [15, -1.66, 40], [1, -1.5, 58]].forEach(([d, a, l]) => lance(ctx, g0 + d * Uu, yb + Uu * 2, Uu * l, a, Uu * .7, c.pre)); [[-9, -1.74, 52], [-16, -1.5, 38]].forEach(([d, a, l]) => lance(ctx, g1 + d * Uu, yb + Uu * 2, Uu * l, a, Uu * .7, c.pre));
    roue(ctx, g1 - Uu * 26, yb + Uu * 1.5, Uu * 8, c.pre); O.rochers(ctx, B.x0, B.x1, yb, Uu * 3, c.pre, rp, 6); O.herbe(ctx, B.x0, B.x1, yb + Uu, Uu * 4, c.pre, rp, .4);
    G.fog(ctx, B.x0, B.x1, B.Y(.93), Uu * 6, c.brume, n ? .1 : .13, 53, 10);
    B.part(1, "fumee", { x: B.x0, y: B.Y(.3), w: B.s.w * .8, h: B.Y(.95) - B.Y(.3) }, { n: 12, col: "#1c1210", scale: Uu * .7, seed: "bf3", alpha: 1.3 });
    B.part(1, "braise", { x: B.x0, y: B.Y(.1), w: B.x1 - B.x0, h: B.Y(.95) - B.Y(.1) }, { n: 46, scale: Uu / 6.5, seed: "bb2" });
    B.part(1, "cendre", { x: B.x0, y: 0, w: B.x1 - B.x0, h: B.Y(1) }, { n: 18, col: n ? "#8a6a5a" : "#d8b8a0", scale: Uu / 7.5 });
  };

  // ====================================================================================================
  // La salle de la Guilde : pierre et bois, hautes bannières bleu acier, tableau des contrats, râtelier d'armes, table aux cartes.
  const chope = (ctx, x, y, s, col) => { ctx.fillStyle = col; ctx.fillRect(x - s * .8, y - s * 2, s * 1.6, s * 2); ctx.strokeStyle = col; ctx.lineWidth = s * .3; ctx.beginPath(); ctx.arc(x + s * .9, y - s, s * .6, -1.3, 1.3); ctx.stroke(); ctx.fillStyle = rgba("#000000", .25); ctx.fillRect(x - s * .8, y - s * 1.65, s * 1.6, s * .2); };
  D.guilde = B => { const n = B.nuit, Uu = B.U, R = repere(B, .8, .72), E = R.E, X = R.X, Y = R.Y, T = R.T, yF = B.Y(.8), mx = B.X(.5);
    const c = n ? { mur: "#8f8c86", bois: "#6a5236", sol: "#86806f", amb: "#171b29", jour: "#86a6e2", noir: "#090a0e", pre: "#030305", feu: "#ffab5c", ban: "#3f6283", ban2: "#86b4d6", vit: ["#2c4478", "#35508c", "#28406c"], vitB: "#1c2e54" }
                : { mur: "#a09a8c", bois: "#70573a", sol: "#8e8774", amb: "#35353d", jour: "#ffe8b4", noir: "#0e0e12", pre: "#060607", feu: "#ffb868", ban: "#4a7194", ban2: "#8fc3e8", vit: ["#fff2c8", "#ffe8ae", "#f4ecc4"], vitB: "#f2cf8c" };
    B.lum = { col: n ? "#ffb878" : "#ffe6b4", dir: 1, amb: n ? "#141826" : "#2c2c34", brume: n ? "#5a5a6e" : "#b0a88e" };
    let ctx = B.couche(.4); const feux = [], lustre = [];
    pierres(ctx, B.x0, 0, B.x1, yF + 2, { col: c.mur, h: E * 6, seed: 41, v: .06 }); ctx.fillStyle = rgba("#000000", .16); ctx.fillRect(B.x0, Y(.62), B.x1 - B.x0, E * 1.1); ctx.fillStyle = rgba("#ffffff", .07); ctx.fillRect(B.x0, Y(.62) - E * .5, B.x1 - B.x0, E * .5);
    dallage(ctx, B, yF, c.sol, { seed: 12, pas: 16, j: .32 });
    // tapis d'apparat, fuyant vers le mur
    const vy = yF - Uu * 46, kq = y => (y - vy) / (yF - vy), tap = (w, y0, y1, col) => poly(ctx, [[mx - w * kq(y0), y0], [mx + w * kq(y0), y0], [mx + w * kq(y1), y1], [mx - w * kq(y1), y1]], col);
    tap(E * 30, yF + E * 1.2, B.H, "#6a5a3a"); tap(E * 28.6, yF + E * 1.8, B.H, "#3a5068"); tap(E * 24, yF + E * 3.4, B.H, "#32465c");
    // tableau des contrats (à gauche) : planches, parchemins cloués, sceaux
    const t0 = X(.065), t1 = X(.235), ty0 = Y(.29), ty1 = Y(.575), rc = rng("contrats");
    ctx.fillStyle = ton(c.bois, -.45); ctx.fillRect(t0 - E * 1.4, ty0 - E * 1.4, t1 - t0 + E * 2.8, ty1 - ty0 + E * 2.8); planches(ctx, t0, ty0, t1, ty1, tonA(c.bois, .04), { l: E * 5, horiz: true, seed: 7, j: .22 });
    ctx.fillStyle = ton(c.bois, -.3); ctx.fillRect(X(.1), ty0 - E * 6.4, X(.2) - X(.1), E * 3.2); [X(.112), X(.188)].forEach(x => ctx.fillRect(x - E * .2, ty0 - E * 3.4, E * .4, E * 2.2)); ctx.fillStyle = rgba("#e3c27a", .5); for (let i = 0; i < 6; i++) ctx.fillRect(X(.114) + i * E * 2.3, ty0 - E * 5.3, E * 1.5, E * 1);
    for (let i = 0; i < 9; i++) { const w = E * rc.r(4.4, 7), h = E * rc.r(5, 8.4), x = t0 + E * 1.2 + (i % 5) * (t1 - t0 - E * 2) / 5 + rc.r(-.6, .6) * E, y = i < 5 ? ty0 + E * rc.r(.8, 2.4) : ty0 + E * rc.r(10.5, 12.6); ctx.save(); ctx.translate(x + (i >= 5 ? E * 3 : 0), y); ctx.rotate(rc.r(-.09, .09));
      ctx.fillStyle = mixc("#dccba2", "#a89468", rc() * .5); ctx.fillRect(0, 0, w, h); ctx.fillStyle = rgba("#2a2014", .45); for (let l = 0; l < 5; l++) ctx.fillRect(w * .14, h * (.2 + l * .13), w * rc.r(.4, .72), Math.max(1, E * .22)); if (rc() < .55) { ctx.fillStyle = P.sang; ctx.beginPath(); ctx.arc(w * .72, h * .86, E * .7, 0, TAU); ctx.fill(); }
      ctx.fillStyle = "#1a1612"; ctx.beginPath(); ctx.arc(w * .5, E * .5, E * .32, 0, TAU); ctx.fill(); ctx.restore(); }
    // traverses du râtelier d'armes (à droite)
    const r0 = X(.765), r1 = X(.935), ry0 = Y(.3), ry1 = Y(.53); ctx.fillStyle = ton(c.bois, -.25); [ry0, ry1].forEach(y => ctx.fillRect(r0, y, r1 - r0, E * 1.4)); [r0, r1 - E * 1.2].forEach(x => ctx.fillRect(x, ry0 - E * 2, E * 1.2, ry1 - ry0 + E * 5));
    // lumière : grande baie, torches murales, braseros, lustre
    const w0 = X(.435), w1 = X(.565), wy0 = Y(.1), wy1 = Y(.5), ww = w1 - w0;
    const baie = (g = 0) => { ctx.beginPath(); ctx.moveTo(w0 - g, wy1 + g); ctx.lineTo(w0 - g, wy0 + ww * .5); ctx.quadraticCurveTo(w0 - g, wy0 - g, mx, wy0 - g * 1.2 - ww * .16); ctx.quadraticCurveTo(w1 + g, wy0 - g, w1 + g, wy0 + ww * .5); ctx.lineTo(w1 + g, wy1 + g); ctx.closePath(); };
    const nappe = (x, a) => { x.save(); x.globalCompositeOperation = "lighter"; x.fillStyle = G.lin(x, 0, wy1, 0, B.Y(1), [[0, rgba(c.jour, a)], [1, rgba(c.jour, a * .3)]]); poly(x, [[w0, wy1], [w1, wy1], [mx + E * 34, B.Y(1)], [mx - E * 34, B.Y(1)]]); x.fill(); x.restore(); };
    lumieres(ctx, B, c.amb, [[mx, Y(.3), E * 86, c.jour, n ? .55 : .8], x => nappe(x, n ? .22 : .34), [X(.265), Y(.42), E * 52, c.feu, .85], [X(.735), Y(.42), E * 52, c.feu, .85], [X(.385), Y(.64), E * 44, c.feu, .7], [X(.615), Y(.64), E * 44, c.feu, .7], [mx, T(.1), E * 60, c.feu, .4], [mx, Y(.6), E * 130, "#77747c", .36]]);
    ctx.fillStyle = ton(c.mur, -.6); baie(E * 1.8); ctx.fill(); ctx.save(); baie(); ctx.clip(); carreaux(ctx, w0, wy0 - ww * .2, w1, wy1, { nx: 6, ny: 13, bois: c.noir, cadre: E * 1.1, teintes: c.vit, bas: c.vitB, fondu: .5, seed: "guilde", montants: [.333, .667], traverses: [.3],
      apres: () => { if (n) G.astre(ctx, lerp(w0, w1, .68), lerp(wy0, wy1, .2), E * 2.2, "#eef3ff", "#8fb1ff", true); else G.glow(ctx, mx, lerp(wy0, wy1, .3), E * 20, "#ffffff", .5); } }); ctx.restore();
    ctx.fillStyle = ton(c.mur, -.5); ctx.fillRect(w0 - E * 3, wy1 + E * 1.2, ww + E * 6, E * 1.6); G.glow(ctx, mx, Y(.3), E * 46, c.jour, n ? .2 : .3);
    nappe(ctx, n ? .07 : .1); G.shafts(ctx, mx, wy0, yF + E * 14 - wy0, ww * 1.5, c.jour, n ? .07 : .09, 8, 5, 0);
    ctx.save(); ctx.globalCompositeOperation = "lighter"; for (let i = 0; i < 3; i++) { const a = (i - 1.5) * E * 7.4, b = a + E * 6.4, y0 = yF + E * 3, y1 = yF + E * 13; poly(ctx, [[mx + a * kq(y0), y0], [mx + b * kq(y0), y0], [mx + b * kq(y1) * 1.12, y1], [mx + a * kq(y1) * 1.12, y1]], rgba(c.jour, n ? .1 : .13)); } ctx.restore();
    // hautes bannières de la Guilde
    const etendard = (x, y0, w, h) => { ctx.fillStyle = c.noir; ctx.fillRect(x - w / 2 - E * 1.6, y0 - E * .9, w + E * 3.2, E * .9); const cloth = g => poly(ctx, [[x - w / 2 + g, y0 + g], [x + w / 2 - g, y0 + g], [x + w / 2 - g, y0 + h - g * 2], [x, y0 + h - w * .46 - g], [x - w / 2 + g, y0 + h - g * 2]]);
      ctx.fillStyle = G.lin(ctx, 0, y0, 0, y0 + h, [[0, ton(c.ban, -.3)], [.3, c.ban], [.75, ton(c.ban, -.12)], [1, ton(c.ban, -.4)]]); cloth(0); ctx.fill(); ctx.save(); ctx.clip(); [[-.3, "#000000", .14], [-.05, "#ffffff", .07], [.22, "#000000", .1]].forEach(([k, col, a]) => { ctx.fillStyle = rgba(col, a); ctx.fillRect(x + w * k, y0, w * .16, h); }); ctx.restore();
      ctx.strokeStyle = rgba(c.ban2, .7); ctx.lineWidth = Math.max(1, E * .3); cloth(E * .9); ctx.stroke(); const ey = y0 + h * .34, er = w * .27; ctx.beginPath(); ctx.arc(x, ey, er, 0, TAU); ctx.stroke();
      ctx.fillStyle = rgba(c.ban2, .85); ctx.fillRect(x - er * .32, ey - er * .3, er * .64, er * .9); [-.42, -.1, .22].forEach(k => ctx.fillRect(x + er * k, ey - er * .56, er * .2, er * .3)); ctx.fillRect(x - er * .46, ey - er * .34, er * .92, er * .14); };
    etendard(X(.33), Y(.07), E * 11, E * 45); etendard(X(.67), Y(.07), E * 11, E * 45);
    torche(ctx, feux, X(.265), Y(.43), E * 3.4, c.noir, 1.2); torche(ctx, feux, X(.735), Y(.43), E * 3.4, c.noir, 4.4);
    // armes au râtelier : épées, haches, boucliers
    const rim = rgba("#ffa860", .5); liseré(ctx, -E * .24, 0, rim, c.noir, col => { [.79, .812, .834].forEach((u, i) => epee(ctx, X(u), ry0 - E * 1.6, E * (1 + i * .06), col, 13 + i)); [.862, .888].forEach((u, i) => { ctx.fillStyle = col; ctx.fillRect(X(u) - E * .3, ry0 - E * 2, E * .6, E * 18); ctx.beginPath(); ctx.moveTo(X(u), ry0 - E * 1.4); ctx.quadraticCurveTo(X(u) + E * 3.6, ry0 - E * 2.6, X(u) + E * 3.2, ry0 + E * 3.4); ctx.quadraticCurveTo(X(u) + E * 1.6, ry0 + E * 1.8, X(u), ry0 + E * 2.2); ctx.closePath(); ctx.fill(); }); });
    [[.915, .36], [.75, .2]].forEach(([u, v]) => { const x = X(u), y = Y(v), r = E * 4; ctx.fillStyle = c.noir; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.fillStyle = ton(c.ban, -.25); ctx.beginPath(); ctx.arc(x, y, r * .82, 0, TAU); ctx.fill(); ctx.fillStyle = rgba(c.ban2, .6); ctx.fillRect(x - r * .1, y - r * .8, r * .2, r * 1.6); ctx.fillRect(x - r * .8, y - r * .1, r * 1.6, r * .2); ctx.fillStyle = c.noir; ctx.beginPath(); ctx.arc(x, y, r * .24, 0, TAU); ctx.fill(); });
    // lustre de fer forgé, solives
    chaine(ctx, mx, 0, mx, T(.085), E * .9, c.noir); ctx.strokeStyle = c.noir; ctx.lineWidth = E * 1; ctx.beginPath(); ctx.ellipse(mx, T(.11), E * 12, E * 2.3, 0, 0, TAU); ctx.stroke(); [-1, 1].forEach(sg => seg(ctx, mx, T(.085), mx + sg * E * 11.6, T(.108), E * .4, c.noir));
    [[-11.6, 0], [-7, 1.9], [0, 2.4], [7, 1.9], [11.6, 0], [-5, -1.9], [5, -1.9]].forEach(([dx, dy], i) => { const x = mx + dx * E, y = T(.11) + dy * E - E * .4; ctx.fillStyle = "#d8cba8"; ctx.fillRect(x - E * .3, y - E * 1.8, E * .6, E * 1.8); lustre.push([x, y - E * 1.9, E * 1.5, i * 1.3]); G.glow(ctx, x, y - E * 2.4, E * 6, c.feu, .28); });
    ctx.fillStyle = c.pre; ctx.fillRect(B.x0, -2, B.x1 - B.x0, T(.035) + 2); vignette(ctx, B, n ? .58 : .46);
    ctx.fillStyle = G.lin(ctx, 0, B.Y(1), 0, B.Y(1.25), [[0, rgba(c.pre, 0)], [1, rgba(c.pre, 1)]]); ctx.fillRect(B.x0, B.Y(1), B.x1 - B.x0, B.H);
    B.dyn(.4, (x, t) => { for (const f of feux) G.flamme(x, f[0], f[1], f[2], t, f[3]); for (const f of lustre) G.flamme(x, f[0], f[1], f[2], t, f[3]); });
    // la grande table aux cartes, entre deux braseros
    ctx = B.couche(.55); const yP = yF + E * 5, yT = yP - E * 10.5, bois = "#2a1e14", bra = [], tf = [];
    ctx.fillStyle = G.rad(ctx, 0, 0, 0, 1, [[0, "rgba(0,0,0,.45)"], [1, "rgba(0,0,0,0)"]]); ctx.save(); ctx.translate(mx, yP); ctx.scale(E * 19, E * 1.8); ctx.fillRect(-1, -1, 2, 2); ctx.restore();
    ctx.fillStyle = bois; ctx.fillRect(mx - E * 14, yT, E * 28, E * 1.7); ctx.fillRect(mx - E * 12.4, yT + E * 1.7, E * 24.8, E * 1.5); ctx.fillRect(mx - E * 11, yT + E * 6.6, E * 22, E * .9);
    [-1, 1].forEach(sg => { poly(ctx, [[mx + sg * E * 9.4, yT + E * 3], [mx + sg * E * 11.4, yT + E * 3], [mx + sg * E * 13, yP], [mx + sg * E * 11.4, yP]], bois); poly(ctx, [[mx + sg * E * 11.4, yT + E * 3], [mx + sg * E * 9.4, yT + E * 3], [mx + sg * E * 7.6, yP], [mx + sg * E * 9.2, yP]], bois); });
    brasero(ctx, bra, X(.385), yP, E * 11, "#14110f", 2); brasero(ctx, bra, X(.615), yP, E * 11, "#14110f", 5.5);
    eclaire(ctx, X(.385), yP - E * 10, E * 22, "#ff9a50", .8); eclaire(ctx, X(.615), yP - E * 10, E * 22, "#ff9a50", .8); eclaire(ctx, mx, yT - E * 8, E * 18, c.jour, n ? .25 : .4);
    // cartes déroulées, rouleaux, encrier et plume, bougie
    const pap = n ? "#a8a08c" : "#d8caa2"; ctx.fillStyle = pap; ctx.fillRect(mx - E * 9, yT - E * .5, E * 13, E * .6); poly(ctx, [[mx - E * 5, yT], [mx + E * 3.4, yT], [mx + E * 3.8, yT + E * 5.4], [mx - E * 4.6, yT + E * 5]], pap);
    ctx.strokeStyle = rgba("#3a2a1a", .55); ctx.lineWidth = Math.max(1, E * .2); ctx.beginPath(); ctx.moveTo(mx - E * 4, yT + E * 1.2); ctx.bezierCurveTo(mx - E * 2, yT + E * 3.4, mx, yT + E * .8, mx + E * 3, yT + E * 3); ctx.moveTo(mx - E * 3.4, yT + E * 3.8); ctx.lineTo(mx - E * 1.4, yT + E * 4.2); ctx.stroke(); [[-2.6, 2.2], [1.4, 3.8], [2.2, 1.4]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.moveTo(mx + dx * E - E * .4, yT + dy * E - E * .4); ctx.lineTo(mx + dx * E + E * .4, yT + dy * E + E * .4); ctx.moveTo(mx + dx * E + E * .4, yT + dy * E - E * .4); ctx.lineTo(mx + dx * E - E * .4, yT + dy * E + E * .4); ctx.stroke(); });
    ctx.fillStyle = pap; rrect(ctx, mx + E * 5.6, yT - E * 1.3, E * 6, E * 1.3, E * .6); ctx.fill(); rrect(ctx, mx + E * 6.6, yT - E * 2.3, E * 5, E * 1.2, E * .6); ctx.fill();
    ctx.fillStyle = "#0e0c0a"; ctx.fillRect(mx - E * 12.4, yT - E * 1.4, E * 1.6, E * 1.4); seg(ctx, mx - E * 11.6, yT - E * 1.2, mx - E * 9.6, yT - E * 5.6, E * .3, "#cfc6b0"); bougie(ctx, tf, mx - E * 7.4, yT - E * .5, E * 3, "#d8cba8");
    B.dyn(.55, (x, t) => { for (const f of bra) G.flamme(x, f[0], f[1], f[2] * .62, t, f[3]); for (const f of tf) G.flamme(x, f[0], f[1], f[2], t, f[3]); });
    B.part(.55, "braise", { x: X(.385) - E * 3, y: yP - E * 26, w: E * 6, h: E * 15 }, { n: 7, scale: Uu / 9, seed: "g1" }); B.part(.55, "braise", { x: X(.615) - E * 3, y: yP - E * 26, w: E * 6, h: E * 15 }, { n: 7, scale: Uu / 9, seed: "g2" });
    B.sol = B.Y(.9);
    B.acteurs();
    // premier plan : deux piliers et la retombée de la voûte
    ctx = B.couche(1); const g0 = B.X(0), g1 = B.X(1), yb = Math.min(B.H, B.Y(1.03)), pw = Uu * (R.k < 1 ? 6 : 9.5);
    ctx.fillStyle = c.pre; ctx.beginPath(); ctx.moveTo(B.x0, 0); ctx.lineTo(B.x0, B.Y(.2)); ctx.lineTo(g0 + pw, B.Y(.2)); ctx.quadraticCurveTo(mx, B.Y(-.2), g1 - pw, B.Y(.2)); ctx.lineTo(B.x1, B.Y(.2)); ctx.lineTo(B.x1, 0); ctx.closePath(); ctx.fill();
    [[g0, 1], [g1, -1]].forEach(([gx, sg]) => { const xi = gx + sg * pw; ctx.fillStyle = G.lin(ctx, xi - sg * Uu * 11, 0, xi, 0, [[0, c.pre], [1, n ? "#15151d" : "#211f21"]]); ctx.fillRect(Math.min(gx - sg * Uu * 40, xi), 0, Math.abs(xi - (gx - sg * Uu * 40)), B.H); ctx.fillStyle = n ? "#101016" : "#18171a"; poly(ctx, [[xi, B.Y(.13)], [xi + sg * Uu * 3, B.Y(.15)], [xi + sg * Uu * 3, B.Y(.19)], [xi, B.Y(.23)]], n ? "#101016" : "#18171a"); poly(ctx, [[xi, yb - Uu * 12], [xi + sg * Uu * 2.6, yb - Uu * 9], [xi + sg * Uu * 2.6, B.H], [xi, B.H]], n ? "#101016" : "#18171a");
      ctx.fillStyle = rgba(c.feu, n ? .2 : .16); ctx.fillRect(xi - (sg > 0 ? Uu * .4 : 0), B.Y(.23), Uu * .4, yb - Uu * 12 - B.Y(.23)); });
    ctx.fillStyle = c.pre; ctx.fillRect(B.x0, yb - Uu, B.x1 - B.x0, B.H - yb + Uu);
    B.part(1, "poussiere", { x: B.X(.2), y: B.Y(.1), w: B.s.w * .6, h: B.Y(.9) - B.Y(.1) }, { n: 30, col: n ? "#c9d8ff" : "#fff1c4", scale: Uu / 7.5 });
  };

  // ====================================================================================================
  // L'auberge du Gué (et la boutique d'Odile) : âtre vivant, poutres, tonneaux, comptoir, escalier vers les chambres.
  D.auberge = B => { const n = B.nuit, Uu = B.U, R = repere(B, .8, .72), E = R.E, X = R.X, Y = R.Y, T = R.T, yF = B.Y(.8);
    const c = n ? { mur: "#ac9068", bois: "#6c4c30", sol: "#8a6a48", pierre: "#948978", amb: "#20150f", noir: "#0c0705", pre: "#040302", feu: "#ffaa58", ext: "#6f8fc8", vit: ["#2c4478", "#35508c", "#28406c"], vitB: "#1c2e54" }
                : { mur: "#b89a6e", bois: "#735234", sol: "#92714c", pierre: "#9c907e", amb: "#30221a", noir: "#120b07", pre: "#070403", feu: "#ffb464", ext: "#ffd9a0", vit: ["#f4d8a0", "#eccb8e", "#f8e2b4"], vitB: "#e0a868" };
    B.lum = { col: "#ffb868", dir: -1, amb: n ? "#1a110c" : "#33241a", brume: n ? "#6e4a34" : "#a67c56" };
    let ctx = B.couche(.4); const feux = [], lant = [];
    // torchis et colombages, lambris, plancher
    ctx.fillStyle = c.mur; ctx.fillRect(B.x0, 0, B.x1 - B.x0, yF + 2); const rm = rng("torchis"); for (let i = 0; i < 60; i++) { G.blob(ctx, lerp(B.x0, B.x1, rm()), rm() * yF, E * rm.r(4, 13), E * rm.r(3, 8), i + 1, .3, 12); ctx.fillStyle = rgba(rm() < .5 ? "#2a1a0c" : "#ffffff", rm.r(.02, .05)); ctx.fill(); }
    const colB = ton(c.bois, -.3); ctx.fillStyle = colB; [.235, .52, .645].forEach(u => ctx.fillRect(X(u) - E * 1.3, 0, E * 2.6, yF)); ctx.fillRect(B.x0, Y(.22), B.x1 - B.x0, E * 2.2); seg(ctx, X(.52), Y(.22), X(.57), Y(.06), E * 2, colB); seg(ctx, X(.645), Y(.22), X(.595), Y(.06), E * 2, colB);
    planches(ctx, B.x0, Y(.66), B.x1, yF + 2, tonA(c.bois, .1), { l: E * 4.4, seed: 13, j: .22 }); ctx.fillStyle = colB; ctx.fillRect(B.x0, Y(.66) - E * 1.1, B.x1 - B.x0, E * 1.3);
    dallage(ctx, B, yF, c.sol, { seed: 14, pas: 9, lames: true, j: .26 });
    // l'escalier vers les chambres (à gauche), tonneaux dessous
    const ex = X(.215), pas = E * 3.5, nm = 13; ctx.fillStyle = ton(c.bois, -.12); ctx.beginPath(); ctx.moveTo(ex, yF + 2); for (let i = 0; i < nm; i++) { ctx.lineTo(ex - i * pas, yF - (i + 1) * pas); ctx.lineTo(ex - (i + 1) * pas, yF - (i + 1) * pas); } ctx.lineTo(B.x0 - 4, yF - nm * pas); ctx.lineTo(B.x0 - 4, yF + 2); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = rgba("#000000", .2); for (let x = ex; x > B.x0; x -= E * 4.2) ctx.fillRect(x, 0, Math.max(1, E * .3), yF); ctx.restore();
    ctx.strokeStyle = colB; ctx.lineWidth = E * .7; ctx.lineCap = "butt"; for (let i = 0; i < nm; i++) { const bx = ex - (i + .5) * pas; ctx.beginPath(); ctx.moveTo(bx, yF - (i + 1) * pas); ctx.lineTo(bx, yF - (i + 1) * pas - E * 9.4); ctx.stroke(); }
    seg(ctx, ex + E * .4, yF - E * 10.6, ex - nm * pas, yF - nm * pas - E * 10.4, E * 1.3, colB); ctx.fillStyle = colB; ctx.fillRect(ex - E * 1, yF - E * 12.6, E * 2, E * 12.8); ctx.beginPath(); ctx.arc(ex, yF - E * 13.4, E * 1.4, 0, TAU); ctx.fill();
    tonneau(ctx, X(.075), yF + E, E * 11, E * 12, ton(c.bois, -.2), ton(c.bois, -.6)); tonneau(ctx, X(.135), yF + E, E * 8.4, E * 9, ton(c.bois, -.12), ton(c.bois, -.6));
    // l'âtre : jambages de pierre, linteau, hotte
    const h0 = X(.3), h1 = X(.495), hx = (h0 + h1) / 2, yMan = Y(.555), aw = E * 12.6, ah = E * 19.5;
    pierres(ctx, h0, 0, h1, yF + 2, { col: c.pierre, h: E * 3.8, seed: 51 }); ctx.fillStyle = rgba("#000000", .22); ctx.fillRect(h1, 0, E * 1.6, yF); ctx.fillRect(h0 - E * .5, 0, E * .5, yF);
    const arc = (w, h) => { ctx.beginPath(); ctx.moveTo(hx - w, yF + 2); ctx.lineTo(hx - w, yF - h + w * .5); ctx.quadraticCurveTo(hx - w, yF - h, hx, yF - h); ctx.quadraticCurveTo(hx + w, yF - h, hx + w, yF - h + w * .5); ctx.lineTo(hx + w, yF + 2); ctx.closePath(); };
    ctx.fillStyle = ton(c.pierre, -.25); arc(aw + E * 1.7, ah + E * 1.7); ctx.fill(); ctx.fillStyle = "#3a2a1c"; arc(aw, ah); ctx.fill();
    ctx.fillStyle = ton(c.bois, -.4); ctx.fillRect(h0 - E * 2.6, yMan, h1 - h0 + E * 5.2, E * 2.6); ctx.fillStyle = ton(c.bois, -.15); ctx.fillRect(h0 - E * 2.6, yMan, h1 - h0 + E * 5.2, E * .5);
    // sur le linteau : assiettes d'étain et chopes ; au-dessus, un bouclier rond
    [[-11, 2.4], [-5.6, 2.9], [6.4, 2.6]].forEach(([dx, r]) => { ctx.fillStyle = "#b9b2a0"; ctx.beginPath(); ctx.arc(hx + dx * E, yMan - r * E, r * E, 0, TAU); ctx.fill(); ctx.strokeStyle = rgba("#000000", .2); ctx.lineWidth = E * .3; ctx.beginPath(); ctx.arc(hx + dx * E, yMan - r * E, r * E * .62, 0, TAU); ctx.stroke(); }); chope(ctx, hx + E * 11.4, yMan, E * 1.3, "#8f887a"); chope(ctx, hx - E * .6, yMan, E * 1.15, "#8f887a");
    ctx.fillStyle = ton(c.bois, -.3); ctx.beginPath(); ctx.arc(hx, Y(.33), E * 6.4, 0, TAU); ctx.fill(); ctx.fillStyle = "#8a4a32"; ctx.beginPath(); ctx.arc(hx, Y(.33), E * 5.4, 0, TAU); ctx.fill(); ctx.fillStyle = "#c9b98a"; ctx.beginPath(); ctx.arc(hx, Y(.33), E * 1.5, 0, TAU); ctx.fill(); ctx.fillStyle = rgba("#000000", .22); ctx.fillRect(hx - E * 5.4, Y(.33) - E * .4, E * 10.8, E * .8);
    // panier de bûches
    const px = X(.535); ctx.fillStyle = ton(c.bois, -.2); poly(ctx, [[px - E * 4, yF - E * 4.4], [px + E * 4, yF - E * 4.4], [px + E * 3.2, yF + E], [px - E * 3.2, yF + E]]); ctx.fill(); [[-2.2, -5.6], [.4, -5.8], [2.4, -5.4], [-.8, -7.4], [1.4, -7.2]].forEach(([dx, dy]) => { ctx.fillStyle = "#6a4a2e"; ctx.beginPath(); ctx.arc(px + dx * E, yF + dy * E, E * 1.3, 0, TAU); ctx.fill(); ctx.fillStyle = "#b08a58"; ctx.beginPath(); ctx.arc(px + dx * E, yF + dy * E, E * .8, 0, TAU); ctx.fill(); });
    // le comptoir d'Odile (à droite) : étagères, cruches, tonnelet, chopes ; marchandises pendues
    const c0 = X(.675), yC = Y(.665), e0 = X(.69), e1 = B.x1, rg = rng("auberge-et");
    [.4, .525].forEach(v => { const y = Y(v); ctx.fillStyle = colB; ctx.fillRect(e0, y, e1 - e0, E * 1.2); ctx.fillStyle = rgba("#000000", .16); ctx.fillRect(e0, y + E * 1.2, e1 - e0, E * 1.5);
      for (let x = e0 + E * 2.4; x < X(1.02); ) { const k = rg(), s = E * rg.r(1.1, 1.6); if (k < .34) { fiole(ctx, x + s, y, s, 1, rg.pick(["#3a5a3a", "#6a4a22", "#2a3a4a", "#7a3a2a"]), .95); x += s * 2.6; } else if (k < .6) { ctx.fillStyle = rg.pick(["#8a6a4a", "#9a8468", "#6a5a48"]); ctx.beginPath(); ctx.ellipse(x + s * 1.3, y - s * 1.5, s * 1.3, s * 1.5, 0, 0, TAU); ctx.fill(); ctx.fillRect(x + s * .8, y - s * 3.6, s * 1, s * 1); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = s * .3; ctx.beginPath(); ctx.arc(x + s * 2.5, y - s * 2, s * .8, -1.2, 1.4); ctx.stroke(); x += s * 4.2; }
        else if (k < .8) { ctx.fillStyle = "#c9a85a"; rrect(ctx, x, y - s * 1.5, s * 3.6, s * 1.5, s * .5); ctx.fill(); x += s * 4.6; } else { chope(ctx, x + s, y, s * .9, "#8f887a"); x += s * 3.2; } } });
    ctx.fillStyle = ton(c.bois, -.05); ctx.fillRect(c0, yC, B.x1 - c0, E * 1.9); planches(ctx, c0 + E * 1.6, yC + E * 1.9, B.x1, yF + 2, tonA(c.bois, -.14), { l: E * 4.6, seed: 17, j: .26 }); ctx.fillStyle = ton(c.bois, -.45); ctx.fillRect(c0 + E * 1.6, yC + E * 1.9, B.x1 - c0, E * .9); ctx.fillRect(c0 + E * 1.6, yF - E * 1.6, B.x1 - c0, E * 1.8);
    [[.71, 1.3], [.735, 1.1], [.9, 1.25]].forEach(([u, k]) => chope(ctx, X(u), yC, E * k, "#8f887a")); const kx = X(.815); ctx.fillStyle = ton(c.bois, -.4); poly(ctx, [[kx - E * 4, yC], [kx - E * 2.6, yC - E * 2], [kx + E * 2.6, yC - E * 2], [kx + E * 4, yC]]); ctx.fill(); ctx.fillStyle = ton(c.bois, -.1); ctx.beginPath(); ctx.arc(kx, yC - E * 5, E * 4, 0, TAU); ctx.fill(); ctx.strokeStyle = ton(c.bois, -.6); ctx.lineWidth = E * .6; ctx.beginPath(); ctx.arc(kx, yC - E * 5, E * 3.7, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(kx, yC - E * 5, E * 2.2, 0, TAU); ctx.stroke(); ctx.fillStyle = "#2a2018"; ctx.fillRect(kx - E * .4, yC - E * 3, E * .8, E * 2);
    // la lumière : le feu, les lanternes du comptoir, la fenêtre
    const f0 = X(.552), f1 = X(.615), fy0 = Y(.3), fy1 = Y(.51), yR = Y(.135), lx = [X(.745), X(.905)];
    lumieres(ctx, B, c.amb, [[hx, yF - E * 6, E * 125, "#ff8e40", .95], [hx, yF - E * 5, E * 52, "#ffc880", .7], [lx[0], yR + E * 9, E * 46, c.feu, .75], [lx[1], yR + E * 9, E * 46, c.feu, .75], [X(.955), yC - E * 4, E * 26, c.feu, .5], [(f0 + f1) / 2, Y(.42), E * 30, c.ext, n ? .3 : .45], [X(.5), Y(.62), E * 120, "#8a5a34", .42]]);
    // fenêtre et ses volets
    carreaux(ctx, f0, fy0, f1, fy1, { nx: 4, ny: 6, bois: c.noir, cadre: E * 1.2, teintes: c.vit, bas: c.vitB, fondu: .6, seed: "auberge", montants: [.5], apres: () => { if (n) G.astre(ctx, lerp(f0, f1, .66), lerp(fy0, fy1, .28), E * 1.6, "#eef3ff", "#8fb1ff", true); } }); G.glow(ctx, (f0 + f1) / 2, (fy0 + fy1) / 2, E * 18, c.ext, n ? .16 : .22);
    ctx.fillStyle = c.noir; ctx.fillRect(f0 - E * 2.4, fy1 + E * 1, f1 - f0 + E * 4.8, E * 1.2);
    // l'âtre : suie, bûches, chenets
    ctx.save(); arc(aw, ah); ctx.clip(); ctx.fillStyle = G.lin(ctx, 0, yF - ah, 0, yF, [[0, "#0c0705"], [.55, "#3a1608"], [1, "#b04c1a"]]); ctx.fillRect(hx - aw, yF - ah, aw * 2, ah + 2); G.glow(ctx, hx, yF - E * 2, E * 16, "#ffb050", .85);
    ctx.fillStyle = "#1a0d08"; [[-1.5, .14, 15], [1.5, -.12, 14], [0, .03, 11]].forEach(([dx, a, l], i) => { ctx.save(); ctx.translate(hx + dx * E, yF - E * (1.2 + (i === 2 ? 2.2 : 0))); ctx.rotate(a); ctx.fillRect(-E * l / 2, -E * 1, E * l, E * 2); ctx.restore(); });
    ctx.fillStyle = "#0b0907"; [-1, 1].forEach(sg => { ctx.fillRect(hx + sg * E * 8.6 - E * .4, yF - E * 7, E * .8, E * 7.2); ctx.beginPath(); ctx.arc(hx + sg * E * 8.6, yF - E * 7.4, E * 1, 0, TAU); ctx.fill(); }); ctx.restore();
    // marchandises pendues à la tringle : cordes, lanternes, carquois, jambon, poêle
    ctx.fillStyle = c.noir; ctx.fillRect(c0 - E * 1, yR, B.x1 - c0 + E, E * .9); const fil = (x, l) => seg(ctx, x, yR + E * .8, x, yR + l, Math.max(1, E * .22), c.noir);
    [[.7, 5.2], [.86, 4.6]].forEach(([u, r]) => { const x = X(u), y = yR + E * (3 + r); fil(x, E * 3); ctx.strokeStyle = n ? "#8a7850" : "#a89060"; ctx.lineWidth = E * .7; [1, .78, .56].forEach(q => { ctx.beginPath(); ctx.ellipse(x, y, E * r * q * .8, E * r * q, 0, 0, TAU); ctx.stroke(); }); ctx.fillStyle = c.noir; ctx.fillRect(x - E * 1.1, y - E * r - E * .5, E * 2.2, E * 1.1); });
    lx.forEach((x, i) => { const y = yR + E * 4; fil(x, E * 4); ctx.strokeStyle = c.noir; ctx.lineWidth = E * .35; ctx.beginPath(); ctx.arc(x, y + E * .6, E * 1.2, Math.PI, TAU); ctx.stroke(); ctx.fillStyle = c.noir; poly(ctx, [[x - E * 2, y + E * 1.6], [x, y + E * .2], [x + E * 2, y + E * 1.6]]); ctx.fill(); ctx.fillRect(x - E * 1.9, y + E * 6.6, E * 3.8, E * .9);
      ctx.fillStyle = "#ffd890"; ctx.fillRect(x - E * 1.5, y + E * 1.6, E * 3, E * 5); ctx.fillStyle = c.noir; [-1.6, -.2, 1.2].forEach(d => ctx.fillRect(x + d * E, y + E * 1.6, E * .4, E * 5)); lant.push([x, y + E * 4.2, i * 2.2]); G.glow(ctx, x, y + E * 4.2, E * 13, c.feu, .5); });
    { const x = X(.79), y = yR + E * 2.4; fil(x, E * 2.6); ctx.save(); ctx.translate(x, y); ctx.rotate(.2); ctx.fillStyle = "#3a281a"; rrect(ctx, -E * 1.5, 0, E * 3, E * 9.4, E * 1.2); ctx.fill(); ctx.fillStyle = c.noir; ctx.fillRect(-E * 1.6, E * 1.2, E * 3.2, E * .6); [-.9, -.2, .5, 1].forEach((d, i) => { seg(ctx, d * E, 0, d * E * 1.3, -E * (2.6 + (i % 2)), Math.max(1, E * .2), "#2a2018"); poly(ctx, [[d * E * 1.3 - E * .5, -E * (2 + (i % 2))], [d * E * 1.3, -E * (3.6 + (i % 2))], [d * E * 1.3 + E * .5, -E * (2 + (i % 2))]], n ? "#8a8a98" : "#c9c0a8"); }); ctx.restore(); }
    { const x = X(.955), y = yR + E * 3; fil(x, E * 3); ctx.fillStyle = "#5a2a1e"; ctx.beginPath(); ctx.moveTo(x - E * .5, y); ctx.quadraticCurveTo(x - E * 3.4, y + E * 5, x - E * 1.6, y + E * 8.4); ctx.quadraticCurveTo(x, y + E * 9.6, x + E * 1.6, y + E * 8.4); ctx.quadraticCurveTo(x + E * 3.4, y + E * 5, x + E * .5, y); ctx.closePath(); ctx.fill(); }
    { const x = X(.99), y = yR + E * 2; fil(x, E * 2); ctx.fillStyle = c.noir; ctx.fillRect(x - E * .4, y, E * .8, E * 5); ctx.beginPath(); ctx.arc(x, y + E * 7.6, E * 3, 0, TAU); ctx.fill(); }
    tresseAil(ctx, X(.665), yR + E * .6, E * 9, E * 1, n ? "#8a6a4a" : "#b88a52", c.noir);
    bougie(ctx, feux, X(.955), yC, E * 3.2, "#d8cba8");
    // solives et saucissons pendus
    ctx.fillStyle = c.pre; ctx.fillRect(B.x0, -2, B.x1 - B.x0, T(.05) + 2); for (let x = B.X(.5) - E * 104; x < B.x1; x += E * 19) ctx.fillRect(x, 0, E * 3, T(.1));
    [[-28, 7], [-25.4, 5.6], [-22.6, 6.6], [16, 6], [18.6, 7.4]].forEach(([dx, l]) => { const x = B.X(.5) + dx * E; seg(ctx, x, T(.05), x, T(.075), Math.max(1, E * .2), c.pre); ctx.fillStyle = "#3a1c14"; rrect(ctx, x - E * .9, T(.075), E * 1.8, E * l, E * .9); ctx.fill(); });
    vignette(ctx, B, n ? .58 : .48);
    ctx.fillStyle = G.lin(ctx, 0, B.Y(1), 0, B.Y(1.25), [[0, rgba(c.pre, 0)], [1, rgba(c.pre, 1)]]); ctx.fillRect(B.x0, B.Y(1), B.x1 - B.x0, B.H);
    const hl = G.glowTile(c.feu);
    B.dyn(.4, (x, t) => { const f = .8 + .2 * Math.sin(t * 6.9) * Math.sin(t * 2.3 + 1); G.glow(x, hx, yF - E * 5, E * 62, "#ff8a3c", (n ? .15 : .12) * f);
      G.flamme(x, hx - E * 4, yF - E * 2.2, E * 7, t, 1.1); G.flamme(x, hx + E * .6, yF - E * 3.8, E * 9.4, t, 3.3); G.flamme(x, hx + E * 4.6, yF - E * 2.2, E * 6.2, t, 5.2); for (const q of feux) G.flamme(x, q[0], q[1], q[2], t, q[3]);
      x.save(); x.globalCompositeOperation = "lighter"; lant.forEach(([px, py, ph]) => { const d = E * (7 + Math.sin(t * 5.3 + ph) * .7); x.globalAlpha = .34 + .08 * Math.sin(t * 7 + ph); x.drawImage(hl, px - d, py - d, d * 2, d * 2); }); x.globalAlpha = 1; x.restore(); });
    B.part(.4, "braise", { x: hx - E * 8, y: yF - E * 30, w: E * 16, h: E * 27 }, { n: 12, scale: Uu / 8.5, seed: "au1" });
    // une petite table et son tabouret, devant la fenêtre
    ctx = B.couche(.55); const tx = X(.59), yP = yF + E * 5.5, bois = "#2a1a10", tf = [];
    ctx.fillStyle = G.rad(ctx, 0, 0, 0, 1, [[0, "rgba(0,0,0,.45)"], [1, "rgba(0,0,0,0)"]]); ctx.save(); ctx.translate(tx, yP); ctx.scale(E * 11, E * 1.5); ctx.fillRect(-1, -1, 2, 2); ctx.restore();
    ctx.fillStyle = bois; ctx.fillRect(tx - E * 7, yP - E * 9.4, E * 14, E * 1.4); ctx.fillRect(tx - E * .9, yP - E * 8, E * 1.8, E * 7.4); poly(ctx, [[tx - E * 4.6, yP], [tx - E * .9, yP - E * 2.4], [tx + E * .9, yP - E * 2.4], [tx + E * 4.6, yP]], bois);
    chope(ctx, tx - E * 3.4, yP - E * 9.4, E * 1.2, "#3a342c"); chope(ctx, tx + E * 4, yP - E * 9.4, E * 1.1, "#3a342c"); bougie(ctx, tf, tx + E * .4, yP - E * 9.4, E * 2.6, "#d8cba8");
    eclaire(ctx, tx - E * 16, yP - E * 10, E * 24, "#ff9a50", .8);
    flammes(B, .55, tf);
    B.sol = B.Y(.9);
    B.acteurs();
    // premier plan : poutre et lanterne, poteau, coin de table, tonneau
    ctx = B.couche(1); const g0 = B.X(0), g1 = B.X(1), yb = Math.min(B.H, B.Y(1.03)), fp = [];
    ctx.fillStyle = c.pre; ctx.fillRect(B.x0, -2, B.x1 - B.x0, B.Y(.04) + 2); ctx.fillRect(g1 - Uu * (R.k < 1 ? 1.4 : 3.6), 0, B.x1 - g1 + Uu * 4, B.H); if (R.k >= 1) seg(ctx, g1 - Uu * 3, B.Y(.22), g1 - Uu * 17, B.Y(.03), Uu * 2.6, c.pre);
    const qx = g0 + Uu * (R.k < 1 ? 8 : 20), qy = B.Y(.17); chaine(ctx, qx, B.Y(.03), qx, qy - Uu * 1.4, Uu * 1, c.pre); poly(ctx, [[qx - Uu * 3, qy], [qx, qy - Uu * 2.2], [qx + Uu * 3, qy]], c.pre); ctx.fillRect(qx - Uu * 2.8, qy + Uu * 7.6, Uu * 5.6, Uu * 1.2); [-2.6, 2].forEach(d => ctx.fillRect(qx + d * Uu, qy, Uu * .6, Uu * 8));
    ctx.fillStyle = rgba("#ffd890", .9); ctx.fillRect(qx - Uu * 2, qy, Uu * 4, Uu * 7.6); ctx.fillStyle = c.pre; ctx.fillRect(qx - Uu * .3, qy, Uu * .6, Uu * 7.6); G.glow(ctx, qx, qy + Uu * 4, Uu * 20, c.feu, .42);
    poly(ctx, [[B.x0, yb - Uu * 9.4], [g0 + Uu * 19, yb - Uu * 8], [g0 + Uu * 22, yb - Uu * 6], [g0 + Uu * 22, B.H], [B.x0, B.H]], c.pre); chope(ctx, g0 + Uu * 5, yb - Uu * 9, Uu * 2.3, c.pre); chope(ctx, g0 + Uu * 10.6, yb - Uu * 8.7, Uu * 1.9, c.pre); bougie(ctx, fp, g0 + Uu * 16.4, yb - Uu * 8.2, Uu * 4.6, c.pre);
    tonneau(ctx, g1 - Uu * 6, yb + Uu * 3, Uu * 17, Uu * 15, c.pre, c.pre); ctx.fillStyle = c.pre; ctx.fillRect(B.x0, yb - Uu, B.x1 - B.x0, B.H - yb + Uu);
    flammes(B, 1, fp);
    B.part(1, "poussiere", { x: B.X(.1), y: B.Y(.15), w: B.s.w * .8, h: B.Y(.9) - B.Y(.15) }, { n: 22, col: "#ffd9a0", scale: Uu / 7.5 });
  };
})();
