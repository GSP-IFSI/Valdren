// Bêtes : loups, sanglier, ours, cerf, lynx, crapaud-bouclier, guivre.
//
// Trois pantins : quadrupede(o) (loups, sanglier, ours, cerf, lynx), le crapaud et la guivre.
// Le quadrupède est une échine (spline de la croupe à la nuque, épaisse côté dos et côté ventre),
// quatre pattes posées au sol par cinématique inverse, une tête de profil à mâchoire mobile, une queue et des crins.
// Toutes les mesures sont en unités locales du sprite (pieds en 0,0 ; y négatif vers le haut ; regard vers +x).
(() => { const G = VG.gfx, U = VG.u, S_ = VG.sprites, P = G.PAL; const { clamp, lerp, smooth, bell, rng, rgba, TAU } = U;
  const membre = S_.membre, ik = S_.ik, PI = Math.PI, sin = Math.sin, cos = Math.cos;

  // ---------- outils ----------
  // spline de Catmull-Rom passant par pts ([x, y, dos, ventre]) : n échantillons par tronçon, chacun avec sa normale (nx, ny : côté dos)
  function courbe(pts, n) { const out = [], m = pts.length, d = pts[0].length;
    for (let i = 0; i < m - 1; i++) { const a = pts[Math.max(0, i - 1)], b = pts[i], e = pts[i + 1], f = pts[Math.min(m - 1, i + 2)], nn = i === m - 2 ? n + 1 : n;
      for (let j = 0; j < nn; j++) { const v = j / n, v2 = v * v, v3 = v2 * v, q = [];
        for (let k = 0; k < d; k++) q.push(.5 * (2 * b[k] + (e[k] - a[k]) * v + (2 * a[k] - 5 * b[k] + 4 * e[k] - f[k]) * v2 + (3 * b[k] - a[k] - 3 * e[k] + f[k]) * v3));
        out.push(q); } }
    for (let i = 0; i < out.length; i++) { const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; out[i].nx = (b[1] - a[1]) / l; out[i].ny = -(b[0] - a[0]) / l; }
    return out; }
  const bord = (q, cote, rentre = 0) => cote === 2 ? [q[0] + q.nx * (q[2] - rentre), q[1] + q.ny * (q[2] - rentre)] : [q[0] - q.nx * (q[3] - rentre), q[1] - q.ny * (q[3] - rentre)];
  // remplit la peau d'une courbe échantillonnée (bouts arrondis)
  function peau(ctx, sp) { const n = sp.length, a = sp[0], z = sp[n - 1]; ctx.beginPath();
    for (let i = 0; i < n; i++) { const b = bord(sp[i], 2); ctx.lineTo(b[0], b[1]); }
    { const b = bord(z, 3), ra = (z[2] + z[3]) / 2, mx = z[0] + z.nx * (z[2] - z[3]) / 2, my = z[1] + z.ny * (z[2] - z[3]) / 2; ctx.quadraticCurveTo(mx - z.ny * ra * 1.3 + z.nx * ra, my + z.nx * ra * 1.3 + z.ny * ra, mx - z.ny * ra, my + z.nx * ra); ctx.quadraticCurveTo(mx - z.ny * ra * 1.3 - z.nx * ra, my + z.nx * ra * 1.3 - z.ny * ra, b[0], b[1]); }
    for (let i = n - 1; i >= 0; i--) { const b = bord(sp[i], 3); ctx.lineTo(b[0], b[1]); }
    { const b = bord(a, 2), ra = (a[2] + a[3]) / 2, mx = a[0] + a.nx * (a[2] - a[3]) / 2, my = a[1] + a.ny * (a[2] - a[3]) / 2; ctx.quadraticCurveTo(mx + a.ny * ra * 1.3 - a.nx * ra, my - a.nx * ra * 1.3 - a.ny * ra, mx + a.ny * ra, my - a.nx * ra); ctx.quadraticCurveTo(mx + a.ny * ra * 1.3 + a.nx * ra, my - a.nx * ra * 1.3 + a.ny * ra, b[0], b[1]); }
    ctx.closePath(); ctx.fill(); }
  // ruban d'épaisseur variable le long de points [x, y, demi-largeur]
  function ruban(ctx, pts, n = 5) { peau(ctx, courbe(pts.map(q => [q[0], q[1], q[2], q[2]]), n)); }
  // crins dressés le long d'un bord (cote 2 : dos, 3 : ventre) entre les échantillons i0 et i1 ; len(k) : longueur pour k de 0 à 1 ;
  // ep : épaisseur de la bande de poil sous les pointes ; penche : couché vers l'arrière (0 à 1) ; pas : largeur d'une mèche
  function crins(ctx, sp, cote, i0, i1, len, ep, penche, jit, pas) { const sg = cote === 2 ? 1 : -1, B = []; let tot = 0;
    for (let i = i0; i <= i1; i++) { const q = sp[i], b = bord(q, cote, -.3); if (B.length) tot += Math.hypot(b[0] - B[B.length - 1][0], b[1] - B[B.length - 1][1]); b.push(tot, sg * q.nx, sg * q.ny, -q.ny, q.nx); B.push(b); }
    let ii = 1; const at = s => { while (ii < B.length - 1 && B[ii][2] < s) ii++; const a = B[ii - 1], b = B[ii], k = clamp((s - a[2]) / ((b[2] - a[2]) || 1), 0, 1); return a.map((v, j) => lerp(v, b[j], k)); };
    ctx.beginPath(); ctx.moveTo(B[0][0], B[0][1]); let s = 0, j = 0;
    while (s < tot - .05) { const d = Math.min(pas * (.75 + .4 * jit[j % jit.length]), tot - s), m = at(s + d * .55), e = at(s + d), l = len((s + d * .5) / tot) * jit[(j * 7 + 3) % jit.length];
      ctx.lineTo(m[0] + m[3] * l - m[5] * l * penche, m[1] + m[4] * l - m[6] * l * penche); ctx.lineTo(e[0], e[1]); s += d; j++; }
    for (let i = i1; i >= i0; i--) { const k = (i - i0) / (i1 - i0), b = bord(sp[i], cote, ep * Math.min(1, Math.sin(k * PI) * 2.2 + .15)); ctx.lineTo(b[0], b[1]); }
    ctx.closePath(); ctx.fill(); }
  // croc : triangle effilé, base en (x,y), pointe à l'angle a
  function croc(ctx, x, y, l, w, a) { ctx.beginPath(); ctx.moveTo(x - cos(a + PI / 2) * w, y - sin(a + PI / 2) * w); ctx.lineTo(x + cos(a) * l, y + sin(a) * l); ctx.lineTo(x + cos(a + PI / 2) * w, y + sin(a + PI / 2) * w); ctx.closePath(); ctx.fill(); }
  function oeil(ctx, x, y, rg, col, a, fente) { if (a <= .02) return; G.glow(ctx, x, y, rg, col, .95 * a); ctx.fillStyle = rgba("#ffffff", .9 * a); ctx.beginPath(); ctx.ellipse(x, y, rg * .2, rg * .11, fente || 0, 0, TAU); ctx.fill(); }
  const clign = (t, ph) => 1 - Math.pow(Math.max(0, sin(t * .53 + ph * 3 + 1.3)), 400);

  // ---------- pieds ----------
  const PIEDS = {
    // patte de loup ou de félin : (x,y) = cheville, le sol est 3 plus bas
    patte(ctx, l, col, c, griffes) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-2.4, -1.9); ctx.quadraticCurveTo(l * .45, -2.9, l, 0); ctx.quadraticCurveTo(l + 1, 2.5, l - .6, 3); ctx.lineTo(-2.6, 3); ctx.closePath(); ctx.fill();
      if (griffes > .05) { ctx.fillStyle = c.griffe; for (let i = 0; i < 3; i++) croc(ctx, l - .6 - i * 1.7, 1.4 + i * .3, 2.6 * griffes + 1, .75, .5 + i * .12); } },
    ours(ctx, l, col, c, griffes) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-4.5, -3.2); ctx.quadraticCurveTo(l * .5, -5.2, l, -1); ctx.quadraticCurveTo(l + 2, 2, l, 3); ctx.lineTo(-4.5, 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.griffe; for (let i = 0; i < 4; i++) croc(ctx, l + .2 - i * 2.2, .6 + i * .5, 4.2 + griffes * 2, 1, .42 + i * .1); },
    sabot(ctx, l, col, c) { ctx.fillStyle = c.sabot; ctx.beginPath(); ctx.moveTo(-2.2, -3.4); ctx.lineTo(2.4, -3.4); ctx.lineTo(l, 3); ctx.lineTo(-2.6, 3); ctx.closePath(); ctx.fill(); },
  };

  // ---------- tête de profil ----------
  // Repère : origine à la nuque, +x vers le museau. T : r (crâne), mus (longueur du museau), m0/m1 (hauteur du chanfrein à la base / au bout),
  // nez, jw (épaisseur de la mâchoire), jl (sa longueur relative), crocs, oe [x,y,rayon], or (oreilles), ouv (ouverture maxi).
  function oreille(ctx, T, col, col2, couche, t, ph, loin) { const O = T.or; if (!O) return; const fl = Math.pow(Math.max(0, sin(t * .83 + ph * 2 + loin * 1.7)), 30) * .4;
    ctx.save(); ctx.translate(O.x + (loin ? (O.dx == null ? 3 : O.dx) : 0), O.y - (loin ? .6 : 0)); ctx.rotate(O.a - couche * (O.rab == null ? 1.1 : O.rab) - fl + (loin ? .12 : 0)); ctx.fillStyle = col; const l = O.l, w = O.w;
    if (O.type === "ronde") { ctx.beginPath(); ctx.ellipse(0, -l * .45, w / 2, l * .62, 0, 0, TAU); ctx.fill(); if (!loin) { ctx.fillStyle = col2; ctx.beginPath(); ctx.ellipse(.6, -l * .42, w * .26, l * .34, 0, 0, TAU); ctx.fill(); } }
    else if (O.type === "feuille") { ctx.beginPath(); ctx.moveTo(-w * .2, 1); ctx.bezierCurveTo(-w * .75, -l * .35, -w * .45, -l * .8, 0, -l); ctx.bezierCurveTo(w * .6, -l * .7, w * .55, -l * .25, w * .25, 1); ctx.closePath(); ctx.fill();
      if (!loin) { ctx.fillStyle = col2; ctx.beginPath(); ctx.moveTo(0, -1); ctx.quadraticCurveTo(-w * .3, -l * .5, .2, -l * .82); ctx.quadraticCurveTo(w * .3, -l * .45, 0, -1); ctx.fill(); } }
    else { ctx.beginPath(); ctx.moveTo(-w * .5, 1.5); ctx.quadraticCurveTo(-w * .5, -l * .62, w * .08, -l); ctx.quadraticCurveTo(w * .62, -l * .45, w * .5, 1.5); ctx.closePath(); ctx.fill();
      if (!loin) { ctx.fillStyle = col2; ctx.beginPath(); ctx.moveTo(-w * .12, 0); ctx.quadraticCurveTo(-w * .2, -l * .5, w * .1, -l * .78); ctx.quadraticCurveTo(w * .36, -l * .4, w * .3, 0); ctx.closePath(); ctx.fill(); }
      if (O.type === "pinceau") { ctx.fillStyle = O.col || "#08080a"; ctx.beginPath(); ctx.moveTo(-w * .16, -l * .8); ctx.quadraticCurveTo(-w * .1, -l * 1.25, w * .3 + sin(t * 2.3 + ph + loin) * .6, -l * 1.62); ctx.quadraticCurveTo(w * .3, -l * 1.2, w * .3, -l * .78); ctx.closePath(); ctx.fill(); } }
    ctx.restore(); }

  function tete(ctx, T, c, jaw, couche, t, ph, vie) {
    const r = T.r, cx = T.cx == null ? r * .55 : T.cx, cy = T.cy || 0, mx = cx + r * .7, tip = mx + T.mus, ml = T.ml == null ? r * .36 : T.ml, hx = cx + r * .05, ja = jaw * (T.ouv || .62), lj = mx + T.mus * (T.jl || .87) - hx, jw = T.jw;
    const inf = { jaw, ja, hx, ml, lj, tip, mx, cx, cy, r, couche, vie };
    if (T.avant) T.avant(ctx, c, t, ph, inf);
    oreille(ctx, T, c.corps2, c.corps2, couche, t, ph, 1);
    // fond de la gueule
    if (ja > .03) { ctx.fillStyle = c.gueule; ctx.beginPath(); ctx.moveTo(hx - r * .25, ml - 1); ctx.lineTo(tip - 2, ml - 1); ctx.lineTo(hx + cos(ja) * (lj - 1), ml + sin(ja) * (lj - 1)); ctx.closePath(); ctx.fill(); }
    // mâchoire inférieure
    ctx.save(); ctx.translate(hx, ml); ctx.rotate(ja); ctx.fillStyle = c.machoire || c.corps;
    ctx.beginPath(); ctx.moveTo(-r * .6, -r * .3); ctx.lineTo(lj - 1, .3); ctx.quadraticCurveTo(lj + 1.4, jw * .5, lj - 2, jw); ctx.quadraticCurveTo(lj * .45, jw * 1.3, -r * .55, r * .66); ctx.closePath(); ctx.fill();
    if (T.crocs && ja > .05) { ctx.fillStyle = P.os; croc(ctx, lj - 3.2, .6, T.crocs * .85, T.crocs * .22, -PI / 2 - .12); for (let i = 1; i < 5; i++) croc(ctx, lj - 3.2 - i * T.crocs * .62, .6, T.crocs * .34, T.crocs * .16, -PI / 2); }
        ctx.restore();
    // crâne et chanfrein
    ctx.fillStyle = c.corps; ctx.beginPath(); ctx.moveTo(cx - r * .62, cy + r * .82); ctx.arc(cx, cy, r, PI * .7, PI * 1.7);
    ctx.quadraticCurveTo(mx + T.mus * .08, -T.m0 - (T.stop || 0), mx + T.mus * .34, -T.m0); ctx.lineTo(tip, -T.m1);
    ctx.quadraticCurveTo(tip + T.nez * 1.2, -T.m1 + .4, tip + T.nez, ml * .15); ctx.quadraticCurveTo(tip + T.nez * .7, ml * .9, tip - 1.5, ml + (T.babine || 0)); ctx.lineTo(hx + r * .2, ml + 1.2 + (T.babine || 0) * .5);
    ctx.quadraticCurveTo(cx - r * .2, cy + r * 1.05, cx - r * .62, cy + r * .82); ctx.closePath(); ctx.fill();
    // truffe
    if (T.truffe !== false) { ctx.fillStyle = "#070707"; ctx.beginPath(); ctx.ellipse(tip + T.nez * .5, -T.m1 * .45, T.nez * .6 + .5, T.m1 * .42 + .3, .3, 0, TAU); ctx.fill(); }
    // crocs du haut
    if (T.crocs) { const v = clamp(ja / .12, T.crocVu || 0, 1); if (v > .02) { ctx.fillStyle = P.os; croc(ctx, tip - 3.4, ml - .4 + (T.babine || 0), T.crocs * v, T.crocs * .24, PI / 2 + .1); if (ja > .05) for (let i = 1; i < 5; i++) croc(ctx, tip - 3.4 - i * T.crocs * .66, ml + .2, T.crocs * .36, T.crocs * .16, PI / 2); } }
    // joue (favoris)
    if (T.joue) { ctx.fillStyle = c.crin2 || c.corps; ctx.beginPath(); ctx.moveTo(cx - r * .9, cy - r * .2); for (let i = 0; i < 4; i++) { const a = PI * .92 - i * .26, a2 = a - .13; ctx.lineTo(cx + cos(a) * (r + T.joue), cy + sin(a) * (r + T.joue)); ctx.lineTo(cx + cos(a2) * r * .98, cy + sin(a2) * r * .98); } ctx.lineTo(cx + r * .2, cy + r * .6); ctx.closePath(); ctx.fill(); }
    // œil
    const oe = T.oe; ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.beginPath(); ctx.ellipse(oe[0], oe[1], oe[2] * .34, oe[2] * .2, T.fente || -.2, 0, TAU); ctx.fill();
    oeil(ctx, oe[0], oe[1], oe[2], c.oeil, vie * clign(t, ph), T.fente || -.2);
    oreille(ctx, T, c.oreille || c.corps, c.corps2, couche, t, ph, 0);
    if (T.apres) T.apres(ctx, c, t, ph, inf);
  }

  // ---------- poses du quadrupède (écarts au repos, pour un loup de 55 au garrot ; mises à l'échelle de chaque bête) ----------
  // ex,ey : épaules ; hx,hy : hanches ; arc : dos rond ; cou : encolure (rad, + = relevée), couL : étirée ; tete : (rad, + = nez baissé) ;
  // gueule 0-1 ; a1,a2 : pattes avant (proche, éloignée) ; r1,r2 : pattes arrière ; queue (rad, − = levée) ; oreil : couchées ; heris : échine dressée
  const POSES = {
    elan: { ex: -11, ey: 10, hx: -7, hy: 12, arc: 4, cou: -.35, tete: .05, gueule: .3, oreil: 1, heris: 1, queue: -.5, a1x: 5, a2x: 3, r1x: 3, r2x: 2 },
    frappe: { ex: 24, ey: -9, hx: 13, hy: 1, arc: -3, cou: -.1, couL: .15, tete: -.3, gueule: 1, oreil: .7, heris: 1, queue: -.9, a1x: 30, a1y: -26, a2x: 36, a2y: -17, r1x: -5, r2x: -7 },
    garde: { ex: -5, ey: 8, hx: -1, hy: 3, arc: 2, cou: -.4, tete: .2, gueule: .4, oreil: 1, heris: .9, queue: .5, a1x: 6, a2x: 3 },
    esq: { ex: -16, ey: 6, hx: -14, hy: 9, cou: .15, tete: -.1, oreil: 1, a1x: -10, a1y: -6, a2x: -8, r1x: -12, r2x: -10, queue: -.3 },
    touche: { ex: -10, ey: -2, hx: -5, hy: 6, arc: -2, cou: .5, tete: -.55, gueule: .55, oreil: 1, queue: .6, a1x: -4, a1y: -10, a2x: -2 },
    charge: { ex: -8, ey: 9, hx: -6, hy: 11, arc: 5, cou: -.3, tete: .12, gueule: .45, oreil: 1, heris: 1, queue: -.7, a1x: 6, a2x: 3, r1x: 2 },
    joie: { cou: .5, tete: -.7, gueule: .5, queue: -.8 },
  };
  const DIST = { ex: 1, ey: 1, hx: 1, hy: 1, arc: 1, a1x: 1, a1y: 1, a2x: 1, a2y: 1, r1x: 1, r1y: 1, r2x: 1, r2y: 1 }; // clés en unités de longueur
  const CLES = ["ex", "ey", "hx", "hy", "arc", "cou", "couL", "tete", "gueule", "a1x", "a1y", "a2x", "a2y", "r1x", "r1y", "r2x", "r2y", "queue", "oreil", "heris"];

  // ---------- le pantin à quatre pattes ----------
  function quadrupede(o) {
    const r = rng(1009 * ((o.seed == null ? 1 : o.seed) + 3)), ph = r() * 6, u = o.hE / 55, T = o.tete, C = o.cou, AV = o.av, AR = o.ar, Q = o.queue, CR = o.crin;
    const c = Object.assign({ corps: "#2a2c2d", corps2: "#191b1c", crin: "#141516", oeil: "#dfe9f2", gueule: "#4a1512", sabot: "#0d0c0b", griffe: P.os }, o.col || {});
    const poses = {}; for (const n in POSES) poses[n] = Object.assign({}, POSES[n], (o.poses || {})[n]);
    const jit = []; for (let i = 0; i < 37; i++) jit.push(r.r(.55, 1.3));
    const xAv = [o.L / 2 + AV.jx + AV.px, o.L / 2 + AV.jx + AV.ec + AV.px + (AV.dec == null ? 7 : AV.dec)], xAr = [-o.L / 2 + AR.jx + AR.px, -o.L / 2 + AR.jx + AR.ec + AR.px + (AR.dec == null ? 8 : AR.dec)];
    const pied = PIEDS[o.pied || "patte"], pl = o.pl || 7;
    // couché : le poitrail et le ventre au sol, la tête posée entre les pattes
    const cEy = -(o.rE[1] + 1.5), cHy = -(o.rH[1] + 2), cCou = Math.max(-.75, Math.asin(clamp((cEy + T.r * .75) / C.L, -1, 1))),
      cTete = T.aC == null ? Math.asin(clamp((-(cEy - sin(cCou) * C.L) - (T.ml == null ? T.r * .36 : T.ml) - T.jw * .8) / (T.r * 1.25 + T.mus), 0, .8)) : T.aC;

    function patteAv(ctx, jx, jy, fx, fy, col, griffes) { const g = ik(jx, jy, fx, fy, AV.L1, AV.L2, 1), w = AV.w; g[1] = Math.min(g[1], -w[1]);
      ctx.fillStyle = col; membre(ctx, jx, jy, g[0], g[1], w[0], w[1]); membre(ctx, g[0], g[1], fx, fy, w[1], w[2]);
      const lev = clamp((-3 - fy) / (8 * u), 0, 1), a = lev * ((Math.atan2(fy - g[1], fx - g[0]) - PI / 2) * .7 + .55);
      ctx.save(); ctx.translate(fx, fy); ctx.rotate(a); pied(ctx, pl, col, c, griffes); ctx.restore(); }
    function patteAr(ctx, jx, jy, fx, fy, col, griffes) { const tot = AR.Lc + AR.L1 + AR.L2, d = Math.hypot(fx - jx, fy - jy), aC = clamp(Math.atan2(fy - jy, fx - jx) - .7 - (.85 - d / tot) * 1.3, .15, 2.2), w = AR.w;
      let gx = jx + cos(aC) * AR.Lc, gy = Math.min(jy + sin(aC) * AR.Lc, -w[1]); const g = ik(gx, gy, fx, fy, AR.L1, AR.L2, 1); g[1] = Math.min(g[1], -w[2]);
      ctx.fillStyle = col; membre(ctx, jx, jy, gx, gy, w[0], w[1]); membre(ctx, gx, gy, g[0], g[1], w[1], w[2]); membre(ctx, g[0], g[1], fx, fy, w[2], w[3]);
      const lev = clamp((-3 - fy) / (8 * u), 0, 1), a = lev * ((Math.atan2(fy - g[1], fx - g[0]) - PI / 2) * .7 + .7);
      ctx.save(); ctx.translate(fx, fy); ctx.rotate(a); pied(ctx, pl, col, c, griffes * .5); ctx.restore(); }

    function draw(ctx, t, st) { st = st || {}; const A = st.att || 0, mort = smooth(st.chute || 0), ch = Math.max(mort, smooth(st.dort || 0)), vie = 1 - mort;
      const w = { garde: smooth(st.garde || 0), esq: bell(st.esq || 0, .35), touche: bell(st.touche || 0, .25), charge: smooth(st.charge || 0), joie: smooth(st.joie || 0),
        elan: A > 0 && A < .42 ? bell(clamp(A / .42, 0, 1), .6) : 0, frappe: A >= .3 ? bell(clamp((A - .3) / .7, 0, 1), .22) : 0 };
      const p = {}; for (const k of CLES) p[k] = 0;
      if (o.repos) for (const k in o.repos) p[k] += o.repos[k] * (1 - ch) * (DIST[k] ? u : 1);
      for (const n in w) { const ww = w[n] * (1 - ch), q = poses[n]; if (!ww) continue; for (const k in q) p[k] += q[k] * ww * (DIST[k] ? u : 1); }
      const souf = sin(t * 1.9 + ph) * (1 - mort * .9), trem = (st.charge || 0) > .5 ? sin(t * 46) * .6 * u * (1 - ch) : 0, calme = (1 - ch) * (1 - Math.min(1, w.elan + w.frappe + w.charge + w.touche));
      if (o.gratte && w.charge > .05) { const g = t * 7 + ph; p.a1x += (sin(g) * 9 - 2) * u * w.charge; p.a1y -= Math.max(0, cos(g)) * 7 * u * w.charge; }
      // échine
      const ex = o.L / 2 + p.ex + trem + sin(t * .6 + ph) * .7 * calme, ey = lerp(-o.hE + p.ey - souf * .5 * u, cEy - souf * .3, ch), hx = -o.L / 2 + p.hx + trem * .6 - sin(t * .6 + ph) * .5 * calme, hy = lerp(-o.hH + p.hy, cHy, ch);
      const aN = lerp(C.a + p.cou + sin(t * .9 + ph * 1.3) * .035 * calme, cCou, ch), LN = C.L * (1 + p.couL), nx = ex + cos(aN) * LN, ny = ey - sin(aN) * LN;
      const aT = lerp(T.a + p.tete + sin(t * .9 + ph * 1.3 + .9) * .04 * calme, cTete, ch), jaw = clamp(p.gueule + (o.halete || 0) * Math.max(0, sin(t * 1.9 + ph)) * calme + mort * (T.beant == null ? .16 : T.beant), 0, 1);
      const br = 1 + souf * .028, rE = o.rE, rH = o.rH, rM = o.rM, rR = o.rR, bos = (o.bosse || 0) * (1 - ch * .3);
      const pts = [[hx - (o.croupe == null ? 8 * u : o.croupe), hy + (o.croupeY == null ? 5 * u : o.croupeY), rR[0], rR[1]], [hx, hy, rH[0], rH[1]],
        [(hx + ex) / 2, (hy + ey) / 2 + (o.creux || 0) * (1 - ch) - p.arc, rM[0], rM[1] * br], [ex, ey, rE[0] + bos, rE[1] * br],
        [ex + cos(aN) * LN * .52 + sin(aN) * (C.galbe || 0), ey - sin(aN) * LN * .52 + cos(aN) * (C.galbe || 0), C.r0[0], C.r0[1]], [nx, ny, C.r1[0], C.r1[1]]];
      const sp = courbe(pts, 6), heris = clamp(p.heris + (o.herisRepos || 0), 0, 1) * (1 - ch * .7);
      // attaches et pieds
      const dl = Math.hypot(ex - hx, ey - hy) || 1, ax = (ex - hx) / dl, ay = (ey - hy) / dl, sol = y => Math.min(-3, y); // axe du corps : les attaches des pattes le suivent (ours dressé)
      const jAv = [ex + ax * AV.jx - ay * rE[1] * AV.jy, ey + ay * AV.jx + ax * rE[1] * AV.jy], jAr = [hx + ax * AR.jx - ay * rH[1] * AR.jy, hy + ay * AR.jx + ax * rH[1] * AR.jy];
      const f1 = [lerp(xAv[0] + p.a1x, jAv[0] + (AV.L1 + AV.L2) * .62, ch), sol(-3 + p.a1y)], f2 = [lerp(xAv[1] + p.a2x, jAv[0] + AV.ec + (AV.L1 + AV.L2) * .5, ch), sol(-3 + p.a2y)];
      const g1 = [lerp(xAr[0] + p.r1x, jAr[0] + AR.Lc * .9 + 6 * u, ch), sol(-3 + p.r1y)], g2 = [lerp(xAr[1] + p.r2x, jAr[0] + AR.ec + AR.Lc * .9 + 12 * u, ch), sol(-3 + p.r2y)];
      const griffes = clamp(w.frappe + w.elan * .5 + w.charge * .6, 0, 1);
      ctx.save(); ctx.lineJoin = "round";
      // queue
      if (Q) { const q0 = bord(sp[0], 2, Q.w[0] * .9), bal = sin(t * (Q.vit || 1.3) + ph) * Q.bal * (1 - ch) * (1 + w.charge * 2), qa = lerp(Q.a + p.queue, Q.aC == null ? 1.25 : Q.aC, ch) + bal, cb = Q.courbe * (1 - ch * .6), pq = [[q0[0] + 1, q0[1], Q.w[0]]];
        for (let i = 1; i < Q.w.length; i++) { const k = i / (Q.w.length - 1), a = qa + cb * k + bal * k * 1.5, pr = pq[i - 1]; let y = pr[1] + sin(a) * Q.L / (Q.w.length - 1); y = Math.min(y, -Q.w[i]); pq.push([pr[0] - cos(a) * Q.L / (Q.w.length - 1), y, Q.w[i]]); }
        ctx.fillStyle = Q.col || c.corps2; ruban(ctx, pq, 5);
        if (Q.bout) { const z = pq[pq.length - 1], y = pq[pq.length - 2]; ctx.fillStyle = Q.bout; ctx.beginPath(); ctx.ellipse((z[0] + y[0]) / 2, (z[1] + y[1]) / 2, Q.boutR || 3, (Q.boutR || 3) * .8, 0, 0, TAU); ctx.fill(); } }
      // pattes éloignées
      patteAr(ctx, jAr[0] + AR.ec, jAr[1] - 1, g2[0], g2[1], c.corps2, griffes); patteAv(ctx, jAv[0] + AV.ec, jAv[1] - 1, f2[0], f2[1], c.corps2, griffes);
      // corps
      ctx.fillStyle = c.corps; peau(ctx, sp);
      if (o.sur) o.sur(ctx, sp, c, t, ph, { heris, ch, souf, w, jit });
      // crins
      if (CR) { const n = sp.length - 1, i0 = Math.round(CR.de * n), i1 = Math.round(CR.a * n); ctx.fillStyle = c.crin;
        crins(ctx, sp, 2, i0, i1, k => (lerp(CR.l0, CR.l1, heris) * (CR.profil ? CR.profil(k) : .45 + .55 * sin(k * PI))), CR.ep, (CR.penche == null ? .6 : CR.penche) * (1 - heris * .45), jit, CR.pas || 4.2);
        if (CR.ventre) { ctx.fillStyle = c.crin2 || c.corps; crins(ctx, sp, 3, Math.round(CR.ventre[0] * n), Math.round(CR.ventre[1] * n), k => CR.ventre[2] * (.5 + .5 * sin(k * PI)), 2, .6, jit, CR.pas || 4.2); }
        if (CR.gorge) { const j0 = Math.round(CR.gorge[0] * n), j1 = Math.round(CR.gorge[1] * n); ctx.fillStyle = c.crin2 || c.crin; crins(ctx, sp, 3, j0, j1, k => CR.gorge[2] * (.4 + .6 * sin(k * PI)), CR.gorge[3] || 2, .5, jit, CR.pas || 4.2); } }
      // pattes proches
      patteAr(ctx, jAr[0], jAr[1], g1[0], g1[1], c.patte || c.corps, griffes); patteAv(ctx, jAv[0], jAv[1], f1[0], f1[1], c.patte || c.corps, griffes);
      // tête
      ctx.save(); ctx.translate(nx, ny); ctx.rotate(aT); tete(ctx, T, c, jaw, clamp(p.oreil + ch * .6, 0, 1), t, ph, vie * (1 - smooth(st.dort || 0))); ctx.restore();
      ctx.restore(); }

    const nx0 = o.L / 2 + cos(C.a) * C.L, ny0 = -o.hE - sin(C.a) * C.L, lt = T.r * 1.25 + T.mus;
    return { draw, larg: o.larg, haut: o.haut, sous: o.sous || 12, ech: o.ech, ombreK: o.ombreK || .24,
      points: { tete: [nx0 + T.r * cos(T.a), ny0 + T.r * sin(T.a)], coeur: [o.L / 2 - o.rE[1] * .3, -o.hE + o.rE[1] * .45], bouche: [nx0 + lt * cos(T.a), ny0 + lt * sin(T.a) + 2] } }; }

  // ---------- la meute ----------
  const LOUP = { L: 54, hE: 56, hH: 51, rR: [4.5, 6], rH: [7, 11], rM: [6, 13.5], rE: [8, 22], creux: 1.5, croupe: 7, croupeY: 4, herisRepos: .3,
    cou: { L: 23, a: .32, r0: [10, 14.5], r1: [8.5, 10] },
    tete: { a: .3, r: 10.5, cx: 5.5, cy: -2.5, mus: 19, m0: 4.6, m1: 3, ml: 3.8, nez: 1.7, jw: 3.9, jl: .88, crocs: 4.6, oe: [12, -5.2, 5.5], or: { type: "pointe", x: 2.5, y: -10, l: 14, w: 9, a: -.2 }, joue: 6 },
    av: { L1: 20, L2: 24.5, w: [7.4, 3.8, 2.3], jx: -2, jy: .42, px: -4, ec: 5, dec: 9 },
    ar: { Lc: 18, L1: 22, L2: 15.5, w: [10.5, 6, 3.2, 2.3], jx: 2, jy: .3, px: -9, ec: 6 },
    queue: { L: 33, a: 1.1, w: [3.6, 5.6, 5, 1.2], courbe: -.3, bal: .07 },
    crin: { de: .2, a: .96, l0: 3.5, l1: 8.5, ep: 3, gorge: [.66, .93, 4.5, 2.5] },
    larg: 250, haut: 128, sous: 12, ech: .21 };
  const bete = (base, x) => { const o = Object.assign({}, base, x); o.col = Object.assign({}, base.col, x.col); return o; };
  const variante = (base, x) => { const o = Object.assign({}, base, x); for (const k of ["cou", "tete", "av", "ar", "queue", "crin", "col", "poses"]) if (x[k]) o[k] = Object.assign({}, base[k], x[k]); return o; };
  const balafres = (ctx, x, y, a, l, col) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.lineCap = "round"; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 3.6, -l * (i ? .38 : .5)); ctx.lineTo(i * 3.6 + 1.5, l * (i ? .38 : .5)); ctx.stroke(); } ctx.restore(); };

  // le Vieux-Gris : haut comme un poulain, crinière d'argent, balafres, yeux d'or
  const VIEUX = variante(LOUP, { rH: [8, 12.5], rM: [7.5, 15.5], rE: [10, 25], herisRepos: .45, ech: .3, haut: 136,
    cou: { r0: [13.5, 18], r1: [10.5, 12] },
    tete: { r: 11.5, cx: 6, mus: 20, m0: 5.4, m1: 3.7, jw: 4.5, crocs: 5.4, crocVu: .35, oe: [12.8, -5.4, 6.2], joue: 8, or: { type: "pointe", x: 2.5, y: -10.5, l: 13.5, w: 9.5, a: -.25 },
      apres(ctx, c) { ctx.strokeStyle = c.balafre; ctx.lineWidth = 1.2; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(10, -10.5); ctx.lineTo(16.5, -1); ctx.moveTo(21, -5.2); ctx.lineTo(24, .5); ctx.stroke(); } },
    av: { w: [8.8, 4.6, 2.8] }, ar: { w: [12.5, 7.2, 3.8, 2.7] },
    queue: { w: [4.4, 7, 6.2, 1.4] },
    crin: { de: .1, a: .97, l0: 7, l1: 12.5, ep: 5, pas: 4.8, profil: k => .4 + .6 * bell(k, .68), gorge: [.6, .95, 9, 4], ventre: [.3, .6, 3.5] },
    col: { corps: "#34383b", corps2: "#1f2225", crin: "#555b61", crin2: "#474c52", oeil: P.or, balafre: "#8c6a62" },
    sur(ctx, sp, c) { const q = sp[15], z = sp[8]; balafres(ctx, q[0] - 2, q[1] + 15, .35, 15, c.balafre); balafres(ctx, z[0] + 4, z[1] + 9, -.5, 10, c.balafre); } });

  // sanglier des ronces : une masse basse, la hure en coin, les défenses claires
  const defenses = d => (ctx, c, t, ph, h) => { ctx.fillStyle = P.os; croc(ctx, h.tip - 9, h.ml - 1.5, d * .45, 1.5, -PI / 2 - .55);
    ctx.save(); ctx.translate(h.hx, h.ml); ctx.rotate(h.ja); const x = h.lj - 8; ctx.beginPath(); ctx.moveTo(x + 2.6, 1.6); ctx.quadraticCurveTo(x + 6.5, -d * .55, x - 2.2, -d); ctx.quadraticCurveTo(x + 1.2, -d * .5, x - 2.6, 1); ctx.closePath(); ctx.fill(); ctx.restore(); };
  const SANGLIER = { L: 48, hE: 50, hH: 41, rR: [5, 9], rH: [8.5, 18], rM: [10.5, 24], rE: [13.5, 28], bosse: 5.5, creux: 0, croupe: 9, croupeY: 6, herisRepos: .35, pied: "sabot", pl: 3.6, gratte: true,
    cou: { L: 15, a: -.3, r0: [15, 19], r1: [11.5, 12.5] },
    tete: { a: .34, r: 12.5, cx: 6, cy: -1.5, mus: 27, m0: 6.6, m1: 4.8, ml: 4.6, nez: 2.2, jw: 5, jl: .8, ouv: .42, oe: [13.5, -6, 4.6], or: { type: "pointe", x: 1, y: -11, l: 10, w: 8.5, a: -.55, rab: .5 }, apres: defenses(10) },
    av: { L1: 15.5, L2: 17.5, w: [8.5, 4.4, 2.5], jx: -3, jy: .58, px: -2, ec: 5, dec: 8 },
    ar: { Lc: 13, L1: 15, L2: 11.5, w: [12, 6.5, 3.2, 2.5], jx: 2, jy: .45, px: -7, ec: 5 },
    queue: { L: 15, a: .7, w: [1.7, 1.2, 1, .9], courbe: -1.1, bal: .3, vit: 3.1, bout: "#120d0a", boutR: 2.3 },
    crin: { de: .08, a: .94, l0: 8.5, l1: 14, ep: 4.5, pas: 3.6, penche: .4, profil: k => .3 + .7 * bell(k, .66), ventre: [.25, .62, 3.5] },
    col: { corps: "#2c231d", corps2: "#1a1410", crin: "#110c0a", crin2: "#231b16", oeil: P.braise, sabot: "#0b0908" },
    poses: { elan: { tete: .22, cou: -.2, gueule: .15 }, frappe: { tete: -.5, cou: .25, gueule: .5, ey: -4, a1y: -14, a2y: -8 }, charge: { tete: .2, gueule: .2 }, garde: { gueule: .15 } },
    larg: 236, haut: 112, sous: 12, ech: .25 };

  // ours des Failles : la bosse, la tête basse ; il se dresse pour frapper
  const OURS = { L: 60, hE: 62, hH: 56, rR: [8, 12], rH: [12, 23], rM: [12, 27], rE: [13, 29], bosse: 7, creux: 2, croupe: 10, croupeY: 8, pied: "ours", pl: 10.5,
    cou: { L: 21, a: -.2, r0: [15, 18], r1: [12.5, 13] },
    tete: { a: .34, r: 13, cx: 7, cy: -1.5, mus: 16, m0: 6.2, m1: 4.8, ml: 5, nez: 2.2, jw: 5.2, jl: .86, crocs: 5.2, oe: [14, -5.6, 4.8], or: { type: "ronde", x: 2.5, y: -12, l: 7.5, w: 8.5, a: -.35, rab: .5, dx: 4 } },
    av: { L1: 23, L2: 25, w: [11.5, 8, 5.6], jx: -3, jy: .45, px: -2, ec: 7, dec: 10 },
    ar: { Lc: 18, L1: 20, L2: 14.5, w: [16.5, 10.5, 6.6, 5.4], jx: 3, jy: .3, px: -8, ec: 8, dec: 10 },
    queue: { L: 7, a: .8, w: [4.5, 3.4, 2], courbe: 0, bal: .03 },
    crin: { de: .04, a: .97, l0: 3, l1: 4.6, ep: 2.5, pas: 5.5, profil: k => .5 + .5 * bell(k, .62), gorge: [.6, .93, 5.5, 3], ventre: [.2, .58, 4.5] },
    col: { corps: "#2b2119", corps2: "#19130e", crin: "#1c1510", crin2: "#231a13", oeil: P.feu, machoire: "#30251c" },
    poses: { // dressé sur l'arrière-train, puis il s'abat
      elan: { ex: -29, ey: -41, hx: 9, hy: 5, arc: 0, cou: .7, tete: -.1, gueule: .6, a1x: 10, a1y: -104, a2x: -2, a2y: -86, r1x: 0, r2x: 0, queue: 0 },
      charge: { ex: -31, ey: -43, hx: 8, hy: 4, arc: 0, cou: .8, tete: -.15, gueule: .85, a1x: 13, a1y: -112, a2x: -4, a2y: -92, r1x: 0 },
      frappe: { ex: 13, ey: -14, hx: 9, hy: 0, arc: -2, cou: .3, couL: .08, tete: -.1, a1x: 30, a1y: -30, a2x: 37, a2y: -44, r1x: -3, r2x: -4 },
      touche: { cou: .35, tete: -.4 }, garde: { ey: 9, cou: -.25 } },
    larg: 270, haut: 196, sous: 14, ech: .36, ombreK: .2 };

  // cerf aux bois de fer : la ramure est d'acier, du fer sombre de la meule à la pointe polie
  function ramure(ctx, x, y, k, loin) { ctx.save(); ctx.translate(x, y); if (loin) { ctx.translate(3.5, -.5); ctx.rotate(.2); } ctx.scale(k, k);
    ctx.fillStyle = G.lin(ctx, -10, 0, 8, -60, loin ? [[0, "#2b3237"], [.6, "#586369"], [1, "#8a959c"]] : [[0, "#444e55"], [.45, "#8f9ba3"], [1, "#eaf1f4"]]);
    ruban(ctx, [[1, 2, 3], [-6, -13, 2.6], [-10.5, -28, 2.3], [-8, -42, 1.9], [1, -52, 1.4], [9, -57, .5]], 4);
    ruban(ctx, [[-1, -3, 2.1], [8, -6, 1.7], [14.5, -12, 1.1], [16.5, -19, .4]], 3);
    ruban(ctx, [[-6, -14, 2], [3, -18.5, 1.6], [8.5, -26, 1], [9.5, -33, .4]], 3);
    ruban(ctx, [[-10.5, -28, 1.9], [-2, -32.5, 1.5], [3, -40, .9], [3.5, -46, .4]], 3);
    ruban(ctx, [[-8, -42, 1.7], [-13, -50, 1.2], [-14, -59, .4]], 3);
    ruban(ctx, [[-2.5, -48.5, 1.5], [-4, -58, 1], [-2.5, -66, .4]], 3);
    ctx.restore(); }
  const CERF = { L: 60, hE: 80, hH: 79, rR: [6, 10], rH: [9, 17.5], rM: [8, 21], rE: [9, 27], creux: 1.5, croupe: 9, croupeY: 6, pied: "sabot", pl: 3.8, gratte: true,
    cou: { L: 40, a: 1.02, r0: [12, 17], r1: [8.2, 9.2], galbe: 1.5 },
    tete: { a: .32, r: 8.6, cx: 5, cy: -1, mus: 22, m0: 5, m1: 3.6, ml: 3.2, nez: 1.8, jw: 3, jl: .85, ouv: .28, oe: [9.5, -3.4, 4.6], fente: 0, or: { type: "feuille", x: .5, y: -5, l: 15, w: 8.5, a: -1.25, rab: .5, dx: 1 },
      avant(ctx) { ramure(ctx, 3.5, -8.5, 1, 1); }, apres(ctx) { ramure(ctx, 3.5, -8.5, 1, 0); } },
    av: { L1: 30, L2: 36, w: [8, 3.8, 2.2], jx: -2, jy: .5, px: -3, ec: 5, dec: 10 },
    ar: { Lc: 22, L1: 30, L2: 26.5, w: [13.5, 6.8, 3.2, 2.2], jx: 3, jy: .35, px: -9, ec: 6, dec: 10 },
    queue: { L: 10, a: 1.1, w: [3.2, 2.8, 1.4], courbe: .2, bal: .12, vit: 2.2, col: "#4d3f30" },
    crin: { de: .58, a: .96, l0: 2.5, l1: 4.5, ep: 2.5, gorge: [.63, .95, 8, 3.5] },
    col: { corps: "#33271e", corps2: "#1e160f", crin: "#221912", crin2: "#271d16", oeil: P.acier, sabot: "#0c0a09" },
    poses: { // il baisse la ramure, pointes en avant, et charge
      elan: { ex: -10, ey: 6, hx: -8, hy: 8, cou: -.8, tete: .8, gueule: 0, a1x: 4 },
      frappe: { ex: 20, ey: 3, hx: 12, hy: -2, cou: -1.02, couL: .06, tete: .95, gueule: 0, a1x: 28, a1y: -18, a2x: 32, a2y: -8, r1x: -6, r2x: -8 },
      charge: { ex: -5, ey: 4, hx: -4, hy: 5, arc: 2, cou: -.62, tete: .62, gueule: 0 },
      garde: { cou: -.55, tete: .62, gueule: 0, ex: -5, ey: 3 }, touche: { gueule: .6 } },
    larg: 336, haut: 206, sous: 12, ech: .3, ombreK: .18 };

  // lynx des Failles : ramassé sur ses épaules, l'arrière-train haut, prêt à bondir
  const LYNX = { L: 46, hE: 46, hH: 50, rR: [6, 9], rH: [8.5, 13], rM: [7, 14], rE: [8.5, 18], creux: 1, croupe: 7, croupeY: 6, pl: 8.6, herisRepos: .2,
    repos: { ey: 6, hy: 2, arc: 2, cou: -.3, tete: .04, a1x: 5, a2x: 3 },
    cou: { L: 15, a: .5, r0: [10.5, 12.5], r1: [9.5, 10] },
    tete: { a: .2, r: 10.8, cx: 6, cy: -1.2, mus: 8, m0: 6.2, m1: 4.8, ml: 4, nez: 1.3, jw: 3.8, jl: .86, crocs: 4.6, ouv: .75, oe: [11.8, -3.6, 6.4], fente: -.25, joue: 7.5,
      or: { type: "pinceau", x: 2.8, y: -9.6, l: 11.5, w: 8.5, a: -.18, rab: .9 } },
    av: { L1: 17, L2: 20, w: [7.8, 4.8, 3.4], jx: -2, jy: .45, px: -1, ec: 5, dec: 7 },
    ar: { Lc: 17, L1: 20, L2: 15, w: [12.5, 7.2, 4.1, 3.2], jx: 2, jy: .3, px: -8, ec: 6 },
    queue: { L: 11, a: .35, w: [3.3, 3.5, 2.6], courbe: -.5, bal: .22, vit: 2.6, bout: "#08080b", boutR: 2.9 },
    crin: { de: .12, a: .95, l0: 2.2, l1: 6, ep: 2, pas: 3.6, ventre: [.28, .6, 3.5] },
    col: { corps: "#2e2b39", corps2: "#1a1823", crin: "#16141d", crin2: "#27243a", oeil: P.nuit, tache: "rgba(12,10,18,.55)" },
    sur(ctx, sp, c) { ctx.fillStyle = c.tache; for (const [i, k, rr] of [[7, .5, 2.1], [9, 1.1, 1.7], [11, .45, 2.3], [13, 1.2, 1.9], [15, .6, 2.1], [17, 1.25, 1.7], [10, 1.8, 1.5], [14, 1.9, 1.6], [19, .7, 1.8]]) { const q = sp[i]; ctx.beginPath(); ctx.ellipse(q[0] - q.nx * q[3] * k * .42, q[1] - q.ny * q[3] * k * .42, rr * 1.35, rr, .25, 0, TAU); ctx.fill(); } },
    poses: { frappe: { a1y: -30, a2y: -24, ey: -12, cou: .1 }, elan: { hy: 8, ey: 12 } },
    larg: 216, haut: 112, sous: 12, ech: .24 };

  // ---------- crapaud-bouclier ----------
  // Un dôme posé au sol, des plaques d'os qui se chevauchent sur le dos, la gorge qui palpite. En garde il rentre la tête
  // et les plaques descendent sur ses flancs ; à l'attaque il se détend et darde la langue.
  function crapaud(o) { const r = rng(733 * ((o.seed == null ? 1 : o.seed) + 5)), ph = r() * 6;
    const c = Object.assign({ corps: "#2e3525", corps2: "#1b2016", ventre: "#4b4a33", plaque: "#575241", plaque2: "#3c382d", pointe: "#958b6e", oeil: "#ffb347", langue: "#a8524e", gueule: "#3d1214" }, o.col || {});
    const POS = { elan: { bx: -8, by: 6, gon: .6, tx: -3, ty: 2 }, frappe: { bx: 15, by: -7, gueule: 1, langue: 1, tx: 6, ty: -4 }, garde: { by: 9, tx: -12, ty: 9, plaq: 1, ferme: .75 },
      esq: { bx: -14, by: 3 }, touche: { bx: -9, by: 1, tx: -5, ty: -6, ferme: 1, gueule: .3 }, charge: { bx: -5, by: 2, gon: 1, gueule: .3, ty: -2 } };
    const CL = ["bx", "by", "gon", "tx", "ty", "gueule", "langue", "plaq", "ferme"], verrues = [];
    for (let i = 0; i < 8; i++) verrues.push([r.i(4, 20), r.r(.2, .85), r.r(1.1, 2.1)]);
    function patte(ctx, hx, hy, fx, fy, col, arriere) { ctx.fillStyle = col;
      if (arriere) { const g = ik(hx, hy, fx, fy, 20, 31, -1); g[1] = Math.min(g[1], -6); membre(ctx, hx, hy, g[0], g[1], 10.5, 7); membre(ctx, g[0], g[1], fx, fy, 6.5, 3.4);
        ctx.beginPath(); ctx.moveTo(fx - 3, fy - 3); ctx.quadraticCurveTo(fx + 12, fy - 3.5, fx + 23, fy + .5); ctx.lineTo(fx + 26, fy + 3); ctx.lineTo(fx + 18, fy + 1.8); ctx.lineTo(fx + 19, fy + 3); ctx.lineTo(fx - 3.5, fy + 3); ctx.closePath(); ctx.fill(); }
      else { const g = ik(hx, hy, fx, fy, 13, 14, 1); g[1] = Math.min(g[1], -4.5); membre(ctx, hx, hy, g[0], g[1], 7.5, 5); membre(ctx, g[0], g[1], fx, fy, 4.8, 3.2);
        ctx.beginPath(); ctx.moveTo(fx - 3.4, fy - 1.5); ctx.lineTo(fx + 5, fy - 2); ctx.lineTo(fx + 11, fy + 1); ctx.lineTo(fx + 6.5, fy + 1.4); ctx.lineTo(fx + 9.5, fy + 3); ctx.lineTo(fx + 4, fy + 2.2); ctx.lineTo(fx + 5, fy + 3); ctx.lineTo(fx - 3.6, fy + 3); ctx.closePath(); ctx.fill(); } }

    function draw(ctx, t, st) { st = st || {}; const A = st.att || 0, mort = smooth(st.chute || 0), ch = Math.max(mort, smooth(st.dort || 0));
      const w = { garde: smooth(st.garde || 0), esq: bell(st.esq || 0, .35), touche: bell(st.touche || 0, .25), charge: smooth(st.charge || 0),
        elan: A > 0 && A < .42 ? bell(clamp(A / .42, 0, 1), .6) : 0, frappe: A >= .3 ? bell(clamp((A - .3) / .7, 0, 1), .22) : 0 };
      const p = {}; for (const k of CL) p[k] = 0; for (const n in w) { const ww = w[n] * (1 - ch), q = POS[n]; if (!ww) continue; for (const k in q) p[k] += q[k] * ww; }
      const souf = sin(t * 1.6 + ph) * (1 - mort), palp = (.5 + .5 * sin(t * 5.6 + ph)) * (1 - ch), trem = (st.charge || 0) > .5 ? sin(t * 46) * .6 * (1 - ch) : 0;
      const bx = p.bx + trem, by = p.by + ch * 11 - souf * .7, gon = 1 + p.gon * .13 + souf * .025, plaq = p.plaq, ja = clamp(p.gueule + mort * .12, 0, 1) * .8;
      const y1 = -36 + by, y2 = -40 + by, X = 30 + bx + p.tx + ch * 3, Y = -37 + by + p.ty + ch * 9;
      const sp = courbe([[-37 + bx * .35, -13 + by * .5, 9, 11], [-15 + bx * .75, y1, 21 * gon, Math.max(8, -y1 - 3)], [11 + bx, y2, 17 * gon, Math.max(8, -y2 - 8 + ch * 5)], [X - 2, Y - 1, 11, 12]], 8), n = sp.length - 1;
      const hH = [-25 + bx * .6, -25 + by * .7], hF = [-38, -3], eA = [15 + bx, y2 + 19], mA = [27 + bx * .3 + ch * 9, -3];
      ctx.save(); ctx.lineJoin = "round";
      patte(ctx, hH[0] + 9, hH[1] - 1, hF[0] + 10, hF[1], c.corps2, 1); patte(ctx, eA[0] + 9, eA[1] - 1, mA[0] + 9, mA[1], c.corps2, 0);
      // corps, ventre pâle, verrues
      ctx.fillStyle = c.corps; peau(ctx, sp);
      ctx.fillStyle = c.ventre; ctx.beginPath(); for (let i = 5; i <= n - 1; i++) { const b = bord(sp[i], 3, .3); ctx.lineTo(b[0], b[1]); } for (let i = n - 1; i >= 5; i--) { const k = (i - 5) / (n - 6), b = bord(sp[i], 3, sp[i][3] * .5 * sin(k * PI) + .3); ctx.lineTo(b[0], b[1]); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.corps2; for (const v of verrues) { const q = sp[v[0]]; ctx.beginPath(); ctx.arc(q[0] - q.nx * q[3] * v[1] * .55, q[1] - q.ny * q[3] * v[1] * .55, v[2], 0, TAU); ctx.fill(); }
      patte(ctx, hH[0], hH[1], hF[0], hF[1], c.corps, 1);
      // tête : gorge et mâchoire, gueule, langue, crâne, œil
      const gx = X - 2, gy = Y + 7, gf = palp * .5 + p.gon * .9;
      if (ja > .03) { ctx.fillStyle = c.gueule; ctx.beginPath(); ctx.moveTo(gx - 6, gy - 3); ctx.lineTo(X + 23, Y + 2.5); ctx.lineTo(gx + cos(ja - .17) * 24, gy + sin(ja - .17) * 24); ctx.closePath(); ctx.fill(); }
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(ja); ctx.fillStyle = c.ventre; ctx.beginPath(); ctx.ellipse(8, 5.5 + gf * 2, 11.5 * (.9 + gf * .25), 6.5 * (.8 + gf * .55), 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(24, -4.2); ctx.quadraticCurveTo(27.5, -.5, 22, 3); ctx.quadraticCurveTo(8, 8.5, -10, 7); ctx.closePath(); ctx.fill(); ctx.restore();
      if (p.langue > .02) { const l = p.langue, x0 = X + 4, y0 = Y + 4, x1 = X + 24 + l * 38, y1l = Y + 1 - l * 3; ctx.fillStyle = c.langue; ruban(ctx, [[x0, y0, 2.8], [(x0 + x1) / 2, (y0 + y1l) / 2 - sin(l * PI) * 5 + 2, 2.1], [x1, y1l, 1.8]], 5); ctx.beginPath(); ctx.arc(x1 + 1, y1l, 3.8, 0, TAU); ctx.fill(); }
      ctx.fillStyle = c.corps; ctx.beginPath(); ctx.moveTo(X - 11, Y - 10); ctx.quadraticCurveTo(X + 3, Y - 16, X + 11, Y - 10.5); ctx.quadraticCurveTo(X + 21, Y - 8, X + 25.5, Y - 2.5); ctx.quadraticCurveTo(X + 27, Y + 1.5, X + 22.5, Y + 3); ctx.lineTo(X - 2, Y + 7.8); ctx.lineTo(X - 13, Y + 6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(X + 6.5, Y - 11.5, 6.2, 0, TAU); ctx.fill(); ctx.fillStyle = "#0a0c08"; ctx.beginPath(); ctx.arc(X + 22.5, Y - 2.6, .9, 0, TAU); ctx.fill();
      const ouv = clamp((1 - p.ferme) * (1 - ch) * clign(t, ph), 0, 1), ox = X + 7.5, oy = Y - 11.8;
      if (ouv > .08) { G.glow(ctx, ox, oy, 10, c.oeil, .55 * ouv); ctx.fillStyle = c.oeil; ctx.beginPath(); ctx.ellipse(ox, oy, 4.2, 4.2 * ouv, 0, 0, TAU); ctx.fill(); ctx.fillStyle = "#120c06"; ctx.beginPath(); ctx.ellipse(ox + .4, oy, 3, 1.15 * ouv, 0, 0, TAU); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.fillRect(ox + 1.2, oy - 2.4 * ouv, 1.3, .9); }
      else { ctx.strokeStyle = "#0a0c08"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ox - 4, oy + .5); ctx.quadraticCurveTo(ox, oy + 2, ox + 4, oy + .5); ctx.stroke(); }
      // plaques d'os, de la croupe à la nuque (celle de devant recouvre la suivante)
      for (let j = 0; j < 5; j++) { const i0 = Math.round(1 + j * 4.3), i1 = Math.min(n, Math.round(1 + j * 4.3 + 5.7)), ext = [], dedans = [], haut = [];
        for (let i = i0; i <= i1; i++) { const q = sp[i], k = (i - i0) / (i1 - i0); ext.push(bord(q, 2, -(1.5 + sin(k * PI) * 3.4 + plaq * 1.5))); dedans.push(bord(q, 2, q[2] * (.72 + .55 * plaq) + 3 + 7 * plaq)); haut.push(bord(q, 2, q[2] * .32)); }
        const trace = B => { ctx.beginPath(); ext.forEach(b => ctx.lineTo(b[0], b[1])); for (let i = B.length - 1; i >= 0; i--) ctx.lineTo(B[i][0], B[i][1]); ctx.closePath(); };
        ctx.fillStyle = c.plaque2; trace(dedans); ctx.fill(); ctx.strokeStyle = c.corps2; ctx.lineWidth = 1.1; ctx.stroke(); ctx.fillStyle = c.plaque; trace(haut); ctx.fill();
        const im = Math.round((i0 + i1) / 2) - 1, q = sp[im], b = bord(q, 2, -3.5 - plaq * 1.5); ctx.fillStyle = c.pointe; croc(ctx, b[0], b[1], 5.5 + plaq * 3 + (j === 3 ? 2 : 0), 2.4, Math.atan2(q.ny, q.nx) - .35); }
      patte(ctx, eA[0], eA[1], mA[0], mA[1], c.corps, 0);
      ctx.restore(); }
    return { draw, larg: 244, haut: 100, sous: 10, ech: o.ech || .3, ombreK: .2, points: { tete: [38, -42], coeur: [0, -24], bouche: [55, -33] } }; }

  // ---------- guivre des marais ----------
  // Un grand serpent d'eau dressé : l'échine est une courbe animée (une onde remonte le corps en permanence),
  // la base se fond vers le sol comme si elle sortait de l'eau. Crête dorsale, collerette, ventre écaillé plus pâle.
  function guivre(o) { const r = rng(577 * ((o.seed == null ? 1 : o.seed) + 9)), ph = r() * 6, jit = []; for (let i = 0; i < 31; i++) jit.push(r.r(.6, 1.25));
    const c = Object.assign({ corps: "#1e3631", corps2: "#12221f", ventre: "#566549", crete: "#2e6052", oeil: "#86ffb0", gueule: "#4a1512", langue: "#a8524e", eau: "#cfe4dc" }, o.col || {});
    const REP = [[-6, 16], [-15, -16], [7, -46], [-13, -80], [-3, -112], [15, -134]], RAY = [14, 13.5, 12.5, 11, 9.2, 7.4], AMP = [0, 3, 5.5, 6, 4.5, 2.5], COUCHE = [[-10, 14], [-20, -5], [0, -12], [22, -10.5], [42, -10], [60, -9.5]];
    const POS = { elan: { d: [[0, 0], [-2, 0], [-6, 2], [-14, 0], [-18, -4], [-17, -8]], tete: -.25, gueule: .35, crete: 1 },
      frappe: { d: [[0, 0], [2, 0], [8, 2], [18, 10], [32, 26], [46, 44]], tete: .4, gueule: 1, crete: 1 },
      garde: { d: [[0, 0], [1, 4], [-4, 12], [2, 26], [-8, 40], [-12, 50]], tete: .3, gueule: .3, crete: .6 },
      esq: { d: [[0, 0], [-3, 0], [-9, 0], [-16, 4], [-22, 8], [-26, 12]], tete: 0 },
      touche: { d: [[0, 0], [0, 0], [-4, 0], [-11, -2], [-20, 2], [-27, 8]], tete: -.7, gueule: .5 },
      charge: { d: [[0, 0], [0, 0], [-3, -2], [-9, -5], [-13, -11], [-11, -17]], tete: .3, gueule: .5, crete: 1 } };
    let evase = 0, calme = 1;
    const T = { a: .15, r: 8.5, cx: 4.5, cy: -1, mus: 21, m0: 5, m1: 3.4, ml: 3.2, nez: 1.4, jw: 3.4, jl: .92, crocs: 6.5, crocVu: .45, ouv: .85, truffe: false, oe: [10.5, -3.8, 6.5], fente: 1.2,
      avant(ctx, cc) { const op = .45 + evase * .55; ctx.fillStyle = cc.crete; ctx.beginPath(); ctx.moveTo(5, -7); // collerette
        for (let i = 0; i < 5; i++) { const a = PI * (1 + (2 - i) * .2 * op), l = (17 - Math.abs(i - 2) * 2.5) * (.8 + evase * .35); ctx.lineTo(2 + cos(a) * l, -1 + sin(a) * l); if (i < 4) { const a2 = a - .1 * op * PI; ctx.lineTo(2 + cos(a2) * l * .66, -1 + sin(a2) * l * .66); } } ctx.lineTo(5, 6); ctx.closePath(); ctx.fill(); },
      apres(ctx, cc, t, ph2, h) { const f = Math.pow(Math.max(0, sin(t * 1.3 + ph)), 10) * calme; if (f < .05) return; // langue fourchue
        ctx.strokeStyle = cc.langue; ctx.lineWidth = 1; ctx.lineCap = "round"; const x = h.tip - 1, y = h.ml + .6, l = 9 * f; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l, y + 1); ctx.lineTo(x + l + 3.5, y - 1.2); ctx.moveTo(x + l, y + 1); ctx.lineTo(x + l + 3.5, y + 3); ctx.stroke(); } };

    function draw(ctx, t, st) { st = st || {}; const A = st.att || 0, mort = smooth(st.chute || 0), ch = Math.max(mort, smooth(st.dort || 0));
      const w = { garde: smooth(st.garde || 0), esq: bell(st.esq || 0, .35), touche: bell(st.touche || 0, .25), charge: smooth(st.charge || 0),
        elan: A > 0 && A < .42 ? bell(clamp(A / .42, 0, 1), .6) : 0, frappe: A >= .3 ? bell(clamp((A - .3) / .7, 0, 1), .22) : 0 };
      let aT = T.a, jaw = 0; evase = 0; for (const n in w) { const q = POS[n], ww = w[n] * (1 - ch); aT += (q.tete || 0) * ww; jaw += (q.gueule || 0) * ww; evase += (q.crete || 0) * ww; } evase = clamp(evase, 0, 1);
      calme = (1 - ch) * (1 - Math.min(1, w.elan + w.frappe + w.charge + w.touche + w.garde));
      const souf = sin(t * 1.7 + ph) * (1 - mort), trem = (st.charge || 0) > .5 ? sin(t * 46) * .7 * (1 - ch) : 0, onde = (1 - ch) * (1 - w.frappe * .6);
      const pts = REP.map((q, i) => { let x = q[0], y = q[1]; for (const n in w) { const ww = w[n] * (1 - ch), d = POS[n].d[i]; x += d[0] * ww; y += d[1] * ww; }
        const a = t * 1.5 - i * .95 + ph; x += sin(a) * AMP[i] * onde + trem * i / 5; y += cos(a) * AMP[i] * .3 * onde;
        return [lerp(x, COUCHE[i][0], ch), lerp(y, COUCHE[i][1], ch), RAY[i] * (1 + souf * .02) * (1 - ch * .12), RAY[i] * (1 - ch * .12)]; });
      aT = lerp(aT + sin(t * .8 + ph) * .06 * calme, .06, ch); jaw = clamp(jaw + mort * .22, 0, 1);
      const sp = courbe(pts, 7), n = sp.length - 1, fondu = col => G.lin(ctx, 0, -11, 0, 9, [[0, col], [1, rgba(col, 0)]]);
      ctx.save(); ctx.lineJoin = "round";
      // un anneau du corps émerge derrière
      const bob = sin(t * 1.1 + ph + 2) * 2.5 * (1 - ch); ctx.fillStyle = fondu(c.corps2); ruban(ctx, [[-60, 13, 7], [-52, -7 + bob, 8.5], [-40, -10 + bob, 8.5], [-29, 11, 7.5]], 6);
      // crête dorsale
      ctx.fillStyle = fondu(c.crete); crins(ctx, sp, 2, 4, n - 2, k => (6 + 8 * sin(k * PI)) * (1 + evase * .4), 1.5, .62 - evase * .25, jit, 9.5);
      // corps, puis ventre écaillé (côté de l'adversaire)
      ctx.fillStyle = fondu(c.corps); peau(ctx, sp);
      ctx.fillStyle = fondu(c.ventre); ctx.beginPath(); for (let i = 1; i <= n - 1; i++) { const b = bord(sp[i], 3, .4); ctx.lineTo(b[0], b[1]); } for (let i = n - 1; i >= 1; i--) { const b = bord(sp[i], 3, sp[i][3] * .58); ctx.lineTo(b[0], b[1]); } ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba(c.corps, .8); ctx.lineWidth = .9; ctx.beginPath(); for (let i = 3; i < n - 1; i++) { const q = sp[i]; if (q[1] > -8) continue; const a = bord(q, 3, .4), b = bord(q, 3, q[3] * .58); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0] + q.ny * 1.5, b[1] - q.nx * 1.5); } ctx.stroke();
      // tête
      const z = pts[5]; ctx.save(); ctx.translate(z[0], z[1]); ctx.rotate(aT); tete(ctx, T, c, jaw, 0, t, ph, 1 - mort); ctx.restore();
      // rides à la surface de l'eau
      ctx.lineWidth = 1.1; for (let i = 0; i < 3; i++) { const k = (t * .45 + i / 3 + ph) % 1, rx = 15 + k * 24; ctx.strokeStyle = rgba(c.eau, (1 - k) * .38); ctx.beginPath(); ctx.ellipse(pts[1][0] + 6, 3, rx, rx * .15, 0, 0, TAU); ctx.stroke();
        if (i < 2) { ctx.beginPath(); ctx.ellipse(-45, 4, 9 + k * 12, (9 + k * 12) * .15, 0, 0, TAU); ctx.stroke(); } }
      ctx.restore(); }
    return { draw, larg: 208, haut: 196, sous: 18, ech: o.ech || .36, ombreK: .14, points: { tete: [24, -136], coeur: [-6, -76], bouche: [45, -129] } }; }

  S_.def("loup", o => quadrupede(bete(LOUP, o)));
  S_.def("vieux-gris", o => quadrupede(bete(VIEUX, o)));
  S_.def("sanglier", o => quadrupede(bete(o.geant ? variante(SANGLIER, { ech: .34, bosse: 7, tete: { apres: defenses(15), oe: [13.5, -6, 5.4] }, crin: { l0: 10, l1: 16 }, col: { corps: "#272019", crin: "#0e0a08" } }) : SANGLIER, o)));
  S_.def("ours", o => quadrupede(bete(OURS, o)));
  S_.def("cerf", o => quadrupede(bete(CERF, o)));
  S_.def("lynx", o => quadrupede(bete(LYNX, o)));
  S_.def("crapaud", crapaud);
  S_.def("guivre", guivre);
})();
