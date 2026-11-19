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
    if (T.avant) T.avant(ctx, c, t, ph, jaw);
    oreille(ctx, T, c.corps2, c.corps2, couche, t, ph, 1);
    // fond de la gueule
    if (ja > .03) { ctx.fillStyle = c.gueule; ctx.beginPath(); ctx.moveTo(hx - r * .25, ml - 1); ctx.lineTo(tip - 2, ml - 1); ctx.lineTo(hx + cos(ja) * (lj - 1), ml + sin(ja) * (lj - 1)); ctx.closePath(); ctx.fill(); }
    // mâchoire inférieure
    ctx.save(); ctx.translate(hx, ml); ctx.rotate(ja); ctx.fillStyle = c.machoire || c.corps;
    ctx.beginPath(); ctx.moveTo(-r * .6, -r * .3); ctx.lineTo(lj - 1, .3); ctx.quadraticCurveTo(lj + 1.4, jw * .5, lj - 2, jw); ctx.quadraticCurveTo(lj * .45, jw * 1.3, -r * .55, r * .66); ctx.closePath(); ctx.fill();
    if (T.crocs && ja > .05) { ctx.fillStyle = P.os; croc(ctx, lj - 3.2, .6, T.crocs * .85, T.crocs * .22, -PI / 2 - .12); for (let i = 1; i < 5; i++) croc(ctx, lj - 3.2 - i * T.crocs * .62, .6, T.crocs * .34, T.crocs * .16, -PI / 2); }
    if (T.machoire) T.machoire(ctx, c, t, ph, jaw, lj);
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
    if (T.apres) T.apres(ctx, c, t, ph, jaw);
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
    const cEy = -(o.rE[1] + 1.5), cHy = -(o.rH[1] + 2), cCou = Math.asin(clamp((cEy + T.r * .75) / C.L, -1, 1)) * -1;

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
      for (const n in w) { const ww = w[n] * (1 - ch), q = poses[n]; if (!ww) continue; for (const k in q) p[k] += q[k] * ww * (DIST[k] ? u : 1); }
      const souf = sin(t * 1.9 + ph) * (1 - mort * .9), trem = (st.charge || 0) > .5 ? sin(t * 46) * .6 * u * (1 - ch) : 0, calme = (1 - ch) * (1 - Math.min(1, w.elan + w.frappe + w.charge + w.touche));
      if (o.gratte && w.charge > .05) { const g = t * 7 + ph; p.a1x += (sin(g) * 9 - 2) * u * w.charge; p.a1y -= Math.max(0, cos(g)) * 7 * u * w.charge; }
      // échine
      const ex = o.L / 2 + p.ex + trem + sin(t * .6 + ph) * .7 * calme, ey = lerp(-o.hE + p.ey - souf * .5 * u, cEy - souf * .3, ch), hx = -o.L / 2 + p.hx + trem * .6 - sin(t * .6 + ph) * .5 * calme, hy = lerp(-o.hH + p.hy, cHy, ch);
      const aN = lerp(C.a + p.cou + sin(t * .9 + ph * 1.3) * .035 * calme, cCou, ch), LN = C.L * (1 + p.couL), nx = ex + cos(aN) * LN, ny = ey - sin(aN) * LN;
      const aT = lerp(T.a + p.tete + sin(t * .9 + ph * 1.3 + .9) * .04 * calme, T.aC == null ? .12 : T.aC, ch), jaw = clamp(p.gueule + (o.halete || 0) * Math.max(0, sin(t * 1.9 + ph)) * calme + mort * (T.beant == null ? .16 : T.beant), 0, 1);
      const br = 1 + souf * .028, rE = o.rE, rH = o.rH, rM = o.rM, rR = o.rR, bos = (o.bosse || 0) * (1 - ch * .3);
      const pts = [[hx - (o.croupe == null ? 8 * u : o.croupe), hy + (o.croupeY == null ? 5 * u : o.croupeY), rR[0], rR[1]], [hx, hy, rH[0], rH[1]],
        [(hx + ex) / 2, (hy + ey) / 2 + (o.creux || 0) * (1 - ch) - p.arc, rM[0], rM[1] * br], [ex, ey, rE[0] + bos, rE[1] * br],
        [ex + cos(aN) * LN * .52 + sin(aN) * (C.galbe || 0), ey - sin(aN) * LN * .52 + cos(aN) * (C.galbe || 0), C.r0[0], C.r0[1]], [nx, ny, C.r1[0], C.r1[1]]];
      const sp = courbe(pts, 6), heris = clamp(p.heris + (o.herisRepos || 0), 0, 1) * (1 - ch * .7);
      // attaches et pieds
      const jAv = [ex + AV.jx, ey + rE[1] * AV.jy], jAr = [hx + AR.jx, hy + rH[1] * AR.jy], sol = y => Math.min(-3, y);
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

  S_.def("loup", o => quadrupede(bete(LOUP, o)));
})();
