// Décors de nature : marais, gorge, crête, antre, camp, route.
(() => { const G = VG.gfx, U = VG.u, O = VG.decors.outils, D = VG.decors.D, P = G.PAL; const { clamp, lerp, rng, rgba, mix, mixc, TAU, fbm1 } = U;

  // ---------- outils propres aux décors de nature ----------
  // point d'une courbe quadratique
  const qp = (a, c, b, k) => [(1 - k) * (1 - k) * a[0] + 2 * (1 - k) * k * c[0] + k * k * b[0], (1 - k) * (1 - k) * a[1] + 2 * (1 - k) * k * c[1] + k * k * b[1]];
  const courbe = (a, c, b, n = 10) => { const p = []; for (let i = 0; i <= n; i++) p.push(qp(a, c, b, i / n)); return p; };

  // ruban plein de largeur variable le long d'une ligne (sentier, route) : un seul aplat
  function ruban(ctx, pts, w0, w1, col) { const g = [], d = [], n = pts.length; for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1, w = lerp(w0, w1, i / (n - 1)) / 2; g.push([pts[i][0] - ty / tl * w, pts[i][1] + tx / tl * w]); d.push([pts[i][0] + ty / tl * w, pts[i][1] - tx / tl * w]); }
    ctx.fillStyle = col; ctx.beginPath(); g.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); d.reverse().forEach(q => ctx.lineTo(q[0], q[1])); ctx.closePath(); ctx.fill(); }
  // ligne brisée adoucie : passe par les milieux, les sommets servent de points de contrôle
  const lisse = (P0, n = 6) => { const out = [P0[0]]; for (let i = 1; i < P0.length - 1; i++) { const a = [(P0[i - 1][0] + P0[i][0]) / 2, (P0[i - 1][1] + P0[i][1]) / 2], b = [(P0[i][0] + P0[i + 1][0]) / 2, (P0[i][1] + P0[i + 1][1]) / 2]; courbe(a, P0[i], b, n).forEach(q => out.push(q)); } out.push(P0[P0.length - 1]); return out; };

  // sol : crête douce remplie jusqu'en bas ; le dégradé court du sommet au bas de la fenêtre utile
  const terre = (ctx, B, v, amp, seed, stops, freq = 1.2, jag = 0) => G.ridge(ctx, { x0: B.x0, x1: B.x1, y: B.Y(v), amp: B.U * amp, freq, seed, jag: B.U * jag, bottom: B.H, fill: G.lin(ctx, 0, B.Y(v) - B.U * amp, 0, B.Y(1), stops) });
  // socle sombre sous la fenêtre utile (là où l'interface recouvre l'image)
  const socle = (ctx, B, col) => { const y = B.Y(1) - 1; if (B.H > y) { ctx.fillStyle = col; ctx.fillRect(B.x0, y, B.x1 - B.x0, B.H - y + 2); } };
  // halo ovale
  const ovale = (ctx, x, y, rx, ry, col, a) => { ctx.save(); ctx.translate(x, y); ctx.scale(rx / ry, 1); G.glow(ctx, 0, 0, ry, col, a); ctx.restore(); };

  // arbre mort tordu : membres en segments qui dévient, mousse pendante en option
  function membre(ctx, x, y, len, ang, w, r, prof, o, bouts) { const seg = 4, l = len / seg, pts = [[x, y]], mi = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; let a = ang;
    for (let i = 0; i < seg; i++) { a += r.r(-.3, .3) * o.tors; if (o.leve) a = lerp(a, -Math.PI / 2, o.leve); pts.push([pts[i][0] + Math.cos(a) * l, pts[i][1] + Math.sin(a) * l]); }
    // tracé lissé : chaque tronçon va d'un milieu au suivant en passant par le sommet
    for (let i = 1; i < seg; i++) { const s = i === 1 ? pts[0] : mi(pts[i - 1], pts[i]), e = i === seg - 1 ? pts[seg] : mi(pts[i], pts[i + 1]);
      ctx.lineWidth = Math.max(.7, w * lerp(1, .64, i / (seg - 1))); ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.quadraticCurveTo(pts[i][0], pts[i][1], e[0], e[1]); ctx.stroke();
      if (prof > 2 && i < seg - 1 && r() < .45) membre(ctx, e[0], e[1], len * r.r(.35, .55), a + (r() < .5 ? -1 : 1) * r.r(.6, 1.2), w * .34, r, prof - 2, o, bouts); }
    const px = pts[seg][0], py = pts[seg][1];
    if (prof <= 1) { bouts.push([px, py]); return; }
    const n = r() < .75 ? 2 : 3; for (let i = 0; i < n; i++) membre(ctx, px, py, len * r.r(.56, .8), a + lerp(-.7, .7, i / (n - 1)) + r.r(-.25, .25), w * .62, r, prof - 1, o, bouts); }
  const mousse = (ctx, bouts, r, h, p, k = 1) => { ctx.lineWidth = Math.max(.6, h * .003); bouts.forEach(b => { if (r() >= p) return; const m = r.i(1, 3); for (let j = 0; j < m; j++) { const l = h * r.r(.03, .1) * k, dx = r.r(-1, 1) * h * .012;
    ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.quadraticCurveTo(b[0] + dx, b[1] + l * .3, b[0] + dx * 1.3 + r.r(-1, 1) * l * .06, b[1] + l); ctx.stroke(); } }); };
  function arbreTors(ctx, x, y, h, col, r, o = {}) { o = Object.assign({ tors: 1, penche: 0, mousse: 0, prof: 5, gros: .075, pend: 1 }, o); const w = h * o.gros, bouts = [];
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(x - w * 1.6, y + 2); ctx.quadraticCurveTo(x - w * .55, y - w * .4, x - w * .5, y - w * 2.4); ctx.lineTo(x + w * .5, y - w * 2.4); ctx.quadraticCurveTo(x + w * .6, y - w * .4, x + w * 1.8, y + 2); ctx.closePath(); ctx.fill();
    membre(ctx, x, y - w * .5, h * .4, -Math.PI / 2 + o.penche, w, r, o.prof, o, bouts);
    if (o.mousse) mousse(ctx, bouts, r, h, o.mousse, o.pend);
    return bouts; }
  // bande de brume horizontale, fondue en haut et en bas
  const nappe = (ctx, B, y0, y1, col, a, k = .5) => { ctx.fillStyle = G.lin(ctx, 0, y0, 0, y1, [[0, rgba(col, 0)], [k, rgba(col, a)], [1, rgba(col, 0)]]); ctx.fillRect(B.x0, y0, B.x1 - B.x0, y1 - y0); };

  // roseaux : tiges, massettes et lames
  function roseaux(ctx, x0, x1, y, h, col, r, dens = 1) { ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = "round"; const pas = Math.max(2.5, h * .1 / dens), w = Math.max(.8, h * .02);
    for (let x = x0; x < x1; x += pas * r.r(.4, 1.8)) { const hh = h * r.r(.45, 1), lean = r.r(-.25, .25) * hh, a = [x, y + 2], cc = [x + lean * .2, y - hh * .6], b = [x + lean, y - hh], q = r();
      ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(cc[0], cc[1], b[0], b[1]); ctx.stroke();
      if (q < .38) { const m0 = qp(a, cc, b, .74), m1 = qp(a, cc, b, .92); ctx.lineWidth = w * 3.4; ctx.beginPath(); ctx.moveTo(m0[0], m0[1]); ctx.lineTo(m1[0], m1[1]); ctx.stroke(); }
      else if (q < .72) { const s = r() < .5 ? -1 : 1, l = hh * r.r(.5, .9); ctx.beginPath(); ctx.moveTo(x - w, y + 2); ctx.quadraticCurveTo(x + s * l * .1, y - l * .8, x + s * l * .55, y - l * r.r(.55, .95)); ctx.quadraticCurveTo(x + s * l * .12, y - l * .6, x + w, y + 2); ctx.closePath(); ctx.fill(); } } }

  function souche(ctx, x, y, w, h, col, r) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - w * 1.15, y + 2); ctx.quadraticCurveTo(x - w * .55, y - h * .15, x - w * .5, y - h * .8);
    const n = 5; for (let i = 0; i <= n; i++) ctx.lineTo(x - w * .5 + w * i / n, y - h * (i % 2 ? r.r(.72, .92) : r.r(1, 1.4)));
    ctx.quadraticCurveTo(x + w * .55, y - h * .15, x + w * 1.25, y + 2); ctx.closePath(); ctx.fill(); }

  // oiseau en vol (bat : -1 ailes basses … 1 ailes hautes)
  function oiseau(ctx, x, y, s, col, bat = 0, tilt = 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.fillStyle = col; const d = bat * s * .5;
    ctx.beginPath(); ctx.moveTo(-s, -d); ctx.quadraticCurveTo(-s * .5, -s * .3 - d * .5, 0, -s * .04); ctx.quadraticCurveTo(s * .5, -s * .3 - d * .5, s, -d); ctx.quadraticCurveTo(s * .45, -s * .02 - d * .2, s * .1, s * .12); ctx.lineTo(0, s * .24); ctx.lineTo(-s * .1, s * .12); ctx.quadraticCurveTo(-s * .45, -s * .02 - d * .2, -s, -d); ctx.closePath(); ctx.fill(); ctx.restore(); }
  // corbeau posé
  function corbeau(ctx, x, y, s, col, sens = 1) { ctx.save(); ctx.translate(x, y); ctx.scale(sens, 1); ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(0, -s * .55, s * .56, s * .32, -.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(s * .38, -s * .95, s * .22, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s * .5, -s * 1.06); ctx.lineTo(s * .95, -s * .9); ctx.lineTo(s * .5, -s * .82); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-s * .3, -s * .55); ctx.lineTo(-s * 1.1, -s * .1); ctx.lineTo(-s * .88, 0); ctx.lineTo(-s * .1, -s * .3); ctx.closePath(); ctx.fill();
    ctx.fillRect(-s * .06, -s * .3, s * .07, s * .32); ctx.fillRect(s * .12, -s * .3, s * .07, s * .32); ctx.restore(); }

  // cage thoracique d'une grande bête couchée : échine et côtes arquées
  function cotes(ctx, x, y, L, h, col, r, n = 7, ep = 1, aH = .5) { const A = [x - L * .5, y - h * aH], C = [x, y - h * 1.25], Bq = [x + L * .5, y - h * .72];
    G.trait(ctx, courbe(A, C, Bq, 12), h * .1 * ep, h * .06 * ep, col);
    for (let i = 0; i < n; i++) { const k = (i + .7) / (n + .4), s = qp(A, C, Bq, k), fin = r() < .22 ? r.r(.45, .75) : 1, pts = courbe(s, [s[0] - L * .15, lerp(s[1], y, .4)], [s[0] + L * .05, y + h * .04], 9);
      G.trait(ctx, pts.slice(0, Math.max(3, Math.round(pts.length * fin))), h * .075 * ep, h * .028 * ep, col); } }
  // crâne cornu posé au sol (s = longueur du crâne)
  function crane(ctx, x, y, s, col, sens = 1) { ctx.save(); ctx.translate(x, y); ctx.scale(sens * s, s); ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(-.5, .02); ctx.quadraticCurveTo(-.64, -.36, -.3, -.5); ctx.quadraticCurveTo(-.1, -.58, .08, -.46); ctx.quadraticCurveTo(.42, -.36, .74, -.2); ctx.lineTo(.76, -.06);
    for (let i = 0; i < 6; i++) { ctx.lineTo(.7 - i * .085, .04); ctx.lineTo(.66 - i * .085, -.05); } ctx.lineTo(.1, .02); ctx.closePath(); ctx.fill();
    G.trait(ctx, courbe([-.26, -.46], [-.72, -.62], [-.82, -1.2], 10), .15, .02, col); G.trait(ctx, courbe([-.1, -.5], [-.44, -.86], [-.4, -1.3], 10), .12, .02, col);
    ctx.globalCompositeOperation = "destination-out"; ctx.beginPath(); ctx.ellipse(.04, -.29, .1, .075, -.2, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(.6, -.17, .035, .02, -.3, 0, TAU); ctx.fill(); ctx.restore(); }

  // stalactites (ou stalagmites si haut = true)
  function stalactites(ctx, x0, x1, y, h, col, r, n, haut = false) { ctx.fillStyle = col; for (let i = 0; i < n; i++) { const x = lerp(x0, x1, (i + r()) / n), hh = h * r.r(.25, 1) * (haut ? -1 : 1), w = Math.abs(hh) * r.r(.1, .2) + h * .03, dx = r.r(-.1, .1) * hh, yy = (typeof y === "function" ? y(x) : y) - hh * .06;
      ctx.beginPath(); ctx.moveTo(x - w, yy); ctx.quadraticCurveTo(x - w * .3, yy + hh * .35, x + dx, yy + hh); ctx.quadraticCurveTo(x + w * .35, yy + hh * .35, x + w, yy); ctx.closePath(); ctx.fill(); } }

  // fougères : touffes de frondes dentelées
  function fougeres(ctx, x0, x1, y, h, col, r, n) { ctx.fillStyle = col; for (let i = 0; i < n; i++) { const bx = lerp(x0, x1, r()), nf = r.i(3, 5), a = [bx, y + 2];
    for (let f = 0; f < nf; f++) { const s = (f / (nf - 1) - .5) * 2 + r.r(-.2, .2), l = h * r.r(.6, 1), b = [bx + s * l * .9, y - l * (1 - Math.abs(s) * .55)], cc = [bx + s * l * .25, y - l * 1.05], g = [], d = [], m = 10;
      for (let j = 1; j < m; j++) { const k = j / m, p = qp(a, cc, b, k), tx = 2 * (1 - k) * (cc[0] - a[0]) + 2 * k * (b[0] - cc[0]), ty = 2 * (1 - k) * (cc[1] - a[1]) + 2 * k * (b[1] - cc[1]), tl = Math.hypot(tx, ty) || 1, w = l * .15 * Math.sin(Math.PI * Math.min(1, k * 1.05 + .06)) * (j % 2 ? 1 : .4);
        g.push([p[0] - ty / tl * w, p[1] + tx / tl * w]); d.push([p[0] + ty / tl * w, p[1] - tx / tl * w]); }
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); g.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(b[0], b[1]); d.reverse().forEach(p => ctx.lineTo(p[0], p[1])); ctx.closePath(); ctx.fill(); } } }

  // clôture de pieux et de perches ; renvoie le sommet des pieux
  function cloture(ctx, x0, x1, y, h, col, r, pas) { ctx.fillStyle = col; ctx.strokeStyle = col; pas = pas || h * 1.5; const tops = [];
    for (let x = x0; x <= x1; x += pas * r.r(.85, 1.15)) { const hh = h * r.r(.85, 1.1), lean = r.r(-.1, .1) * h, w = h * .08; ctx.beginPath(); ctx.moveTo(x - w, y + 2); ctx.lineTo(x - w + lean, y - hh); ctx.lineTo(x + w + lean, y - hh - w); ctx.lineTo(x + w, y + 2); ctx.closePath(); ctx.fill(); tops.push([x + lean, y - hh]); }
    ctx.lineWidth = Math.max(1, h * .07); ctx.lineCap = "round"; for (let i = 1; i < tops.length; i++) { const a = tops[i - 1], b = tops[i]; [.22, .6].forEach(k => { if (r() < .1) return; ctx.beginPath(); ctx.moveTo(a[0], lerp(a[1], y, k) + r.r(-1, 1) * h * .04); ctx.lineTo(b[0], lerp(b[1], y, k) + r.r(-1, 1) * h * .04); ctx.stroke(); }); }
    return tops; }

  function haie(ctx, x0, x1, y, h, col, r) { ctx.fillStyle = col; for (let x = x0; x < x1; x += h * r.r(.5, 1.1)) { G.blob(ctx, x, y - h * r.r(.3, .5), h * r.r(.6, 1.1), h * r.r(.45, .75), r.i(1, 999), .25, 12); ctx.fill(); } ctx.fillRect(x0, y - h * .3, x1 - x0, h * .3 + 2); }

  // reflets mouvants sur une eau calme (léger : une quarantaine de traits)
  const ondes = (B, p, y0, y1, col, a, seed, nb = 40) => B.dyn(p, (x, t) => { x.save(); x.globalCompositeOperation = "lighter"; const rr = rng(seed), e = Math.max(1, B.U * .14);
    for (let i = 0; i < nb; i++) { const k = rr(), px = lerp(B.x0, B.x1, rr()), py = lerp(y0, y1, k * k), w = B.U * rr.r(1.5, 7) * (.5 + k), al = .5 + .5 * Math.sin(t * rr.r(.5, 1.4) + i * 3);
      x.fillStyle = rgba(col, a * al); x.fillRect(px + Math.sin(t * .3 + i) * B.U, py, w, e); } x.restore(); });

  // ---------- Marais de la Guivre ----------
  D.marais = B => { const n = B.nuit, Uu = B.U, X = B.X, Y = B.Y, x0 = B.x0, x1 = B.x1, L = x1 - x0;
    const c = n ? { haut: "#04080b", milieu: "#0c1a1d", bas: "#28443f", loin: "#183030", arbre: "#081214", eau: "#050b0d", sol: "#070f10", pre: "#020506", brume: "#5a9384", lueur: "#9fe0c8" }
                : { haut: "#283026", milieu: "#6b724e", bas: "#c8c17e", loin: "#727a58", arbre: "#232c22", eau: "#0e150e", sol: "#182017", pre: "#080c08", brume: "#c2cb90", lueur: "#eee9a8" };
    B.lum = { col: n ? "#bfe9da" : "#e2df9c", dir: 1, amb: n ? "#0e2326" : "#2b3321", brume: c.brume };
    const yE = Y(.6), au = n ? .68 : .66;
    let ctx = O.ciel(B, { haut: c.haut, milieu: c.milieu, bas: c.bas, astre: n ? [au, .2, 3.2] : [au, .3, 4.4], astreCol: n ? "#e4f6ef" : "#f6f2c4", halo: n ? "#63c8ac" : "#ece48e", nuageCol: n ? "#2f504c" : "#dedb9e", nuageA: n ? .22 : .25, nuagesN: 9, horizon: .6, seed: 2 });
    // l'astre est voilé : nuées par-dessus, ciel plombé
    G.fog(ctx, X(.42), X(.94), Y(n ? .21 : .31), Uu * 9, n ? "#1c3432" : "#8f9366", n ? .6 : .5, 41, 8);
    O.nuages(ctx, B, Y(.04), Y(.42), n ? "#071214" : "#333a2d", .3, 5, 77);
    // lointain : la rive d'en face, arbres morts noyés
    ctx = B.couche(.1); const cl = mixc(c.loin, c.bas, .5);
    G.ridge(ctx, { x0, x1, y: Y(.575), amp: Uu * 2.2, freq: 1.6, seed: 31, bottom: B.H, fill: cl, jag: Uu * 1.4 });
    const rl = rng("m-loin"); for (let x = x0; x < x1; x += Uu * rl.r(5, 12)) O.arbreMort(ctx, x, Y(.59), Uu * rl.r(7, 15), cl, rl);
    O.voile(ctx, B, Y(.4), yE, c.brume, n ? .3 : .42);
    // l'eau noire : miroir du ciel au loin, encre au près
    ctx = B.couche(.25);
    ctx.fillStyle = G.lin(ctx, 0, yE, 0, Y(.92), [[0, mixc(c.bas, c.eau, .2)], [.22, mixc(c.milieu, c.eau, .35)], [.6, mixc(c.milieu, c.eau, .68)], [1, mixc(c.milieu, c.eau, .92)]]); ctx.fillRect(x0, yE, L, B.H - yE);
    ctx.save(); ctx.beginPath(); ctx.rect(x0, yE, L, B.H - yE); ctx.clip(); ovale(ctx, X(au), yE, Uu * 7, Uu * 30, c.lueur, n ? .3 : .34); ctx.restore();
    const ar1 = mixc(c.arbre, c.bas, .3), re1 = mixc(mix(c.arbre, c.bas, .22), c.eau, .35);
    [[.11, .655, 23], [.34, .64, 15], [.46, .652, 19], [.59, .64, 14], [.87, .655, 25], [.71, .636, 11]].forEach(([u, v, h], i) => { const bx = X(u), by = Y(v), o = { mousse: .5 };
      ctx.save(); ctx.translate(0, by); ctx.scale(1, -.7); ctx.translate(0, -by); arbreTors(ctx, bx, by, Uu * h, re1, rng("ma" + i), o); ctx.restore();
      arbreTors(ctx, bx, by, Uu * h, ar1, rng("ma" + i), o);
      ctx.fillStyle = ar1; ctx.beginPath(); ctx.ellipse(bx, by, Uu * h * .22, Uu * .55, 0, 0, TAU); ctx.fill(); });
    const rs = rng("m-stries"); for (let i = 0; i < 70; i++) { const k = rs(), y = lerp(yE + Uu * .5, Y(.86), k); ctx.fillStyle = i % 3 ? rgba(c.lueur, rs.r(.03, .1)) : rgba(c.eau, rs.r(.2, .5)); ctx.fillRect(lerp(x0, x1, rs()), y, Uu * rs.r(3, 16) * (.4 + k), Math.max(1, Uu * .12)); }
    nappe(ctx, B, Y(.56), Y(.69), c.brume, n ? .3 : .4, .45);
    G.fog(ctx, x0, x1, Y(.65), Uu * 5, c.brume, n ? .28 : .34, 12, 14);
    // plan moyen : grands arbres tordus sur les bords, souches, touffes de roseaux, nénuphars
    ctx = B.couche(.5); const ar2 = mixc(c.arbre, c.bas, .1), re2 = mixc(c.arbre, c.eau, .55), rm = rng("m-moy");
    [[.025, .745, 50, .1], [.975, .735, 44, -.12], [.5, .715, 25, .03]].forEach(([u, v, h, pe], i) => { const bx = X(u), by = Y(v), o = { mousse: .7, penche: pe, prof: i < 2 ? 6 : 5 };
      ctx.save(); ctx.translate(0, by); ctx.scale(1, -.6); ctx.translate(0, -by); arbreTors(ctx, bx, by, Uu * h, re2, rng("mb" + i), o); ctx.restore();
      arbreTors(ctx, bx, by, Uu * h, ar2, rng("mb" + i), o);
      ctx.fillStyle = ar2; ctx.beginPath(); ctx.ellipse(bx, by + Uu * .2, Uu * h * .2, Uu * .8, 0, 0, TAU); ctx.fill(); });
    ctx.fillStyle = mixc(c.arbre, c.milieu, .3); for (let i = 0; i < 18; i++) { const k = rm(); ctx.beginPath(); ctx.ellipse(lerp(x0, x1, rm()), lerp(Y(.73), Y(.84), k), Uu * rm.r(.8, 1.6) * (.6 + k), Uu * rm.r(.18, .3), 0, 0, TAU); ctx.fill(); }
    G.fog(ctx, x0, x1, Y(.745), Uu * 7, c.brume, n ? .26 : .32, 5, 16);
    [[.4, .775, 1.8, 4.2], [.615, .79, 2.3, 3.4], [.19, .765, 1.4, 2.8], [.83, .78, 1.6, 3.8]].forEach(([u, v, w, h]) => { const bx = X(u), by = Y(v), k = rm.i(1, 999);
      ctx.save(); ctx.translate(0, by); ctx.scale(1, -.6); ctx.translate(0, -by); souche(ctx, bx, by, Uu * w, Uu * h, re2, rng(k)); ctx.restore(); souche(ctx, bx, by, Uu * w, Uu * h, ar2, rng(k)); });
    [[-.02, .13, .78, 8], [.88, 1.03, .785, 9], [.54, .6, .77, 5], [.3, .345, .795, 4.5]].forEach(([u0, u1, v, h]) => { const by = Y(v);
      ctx.fillStyle = ar2; ctx.beginPath(); ctx.ellipse((X(u0) + X(u1)) / 2, by + Uu * .3, (X(u1) - X(u0)) * .56, Uu * .9, 0, 0, TAU); ctx.fill();
      roseaux(ctx, X(u0), X(u1), by, Uu * h, ar2, rm, 1.3); });
    nappe(ctx, B, Y(.68), Y(.9), c.brume, n ? .26 : .36, .62); G.fog(ctx, x0, x1, Y(.81), Uu * 6, c.brume, n ? .2 : .26, 19, 12);
    ondes(B, .5, yE + Uu, Y(.85), c.lueur, n ? .1 : .09, "m-ondes", 38);
    B.part(.5, "brume", { x: x0, y: Y(.62), w: L, h: Uu * 18 }, { n: 8, col: c.brume, scale: Uu * .09 });
    // la berge de vase où l'on se tient
    ctx = B.couche(.75); terre(ctx, B, .855, 1.2, 23, [[0, mixc(c.sol, c.bas, .16)], [.3, c.sol], [1, mixc(c.sol, "#000", .6)]], 1.5);
    O.herbe(ctx, x0, x1, Y(.86), Uu * 2.2, mixc(c.sol, c.bas, .1), rng("m-h"), .9);
    const rb = rng("m-berge"); roseaux(ctx, x0, X(.1), Y(.865), Uu * 9, c.sol, rb, 1); roseaux(ctx, X(.9), x1, Y(.865), Uu * 10, c.sol, rb, 1); roseaux(ctx, X(.46), X(.54), Y(.865), Uu * 5, c.sol, rb, .8);
    B.sol = Y(.9);
    B.acteurs();
    // premier plan : l'arbre penché, les roseaux, la brume qui rampe, les feux follets
    ctx = B.couche(1); const rp = rng("m-pre"), yB = B.Y(1);
    arbreTors(ctx, x0 + Uu * 3, yB + Uu * 3, Uu * 150, c.pre, rng("m-grand2"), { penche: .1, mousse: .8, prof: 6, gros: .05, tors: .8, pend: .6, leve: .1 });
    ctx.strokeStyle = c.pre; ctx.lineCap = "round"; const bouts = []; membre(ctx, x1 + Uu * 3, Y(.05), Uu * 20, Math.PI * .95, Uu * 2.4, rng("m-br"), 4, { tors: 1 }, bouts); mousse(ctx, bouts, rp, Uu * 90, .9);
    souche(ctx, X(.9), yB + Uu, Uu * 4.5, Uu * 8, c.pre, rp);
    roseaux(ctx, X(.8), x1, yB + Uu, Uu * 24, c.pre, rp, .8); roseaux(ctx, x0, X(.2), yB + Uu, Uu * 15, c.pre, rp, .7); roseaux(ctx, x0, x1, yB + Uu, Uu * 8, c.pre, rp, .7);
    socle(ctx, B, c.pre);
    G.fog(ctx, x0, x1, Y(.9), Uu * 6, c.brume, n ? .12 : .15, 33, 12);
    B.part(1, "follet", { x: X(.04), y: Y(.56), w: X(.96) - X(.04), h: Y(.84) - Y(.56) }, { n: n ? 16 : 6, scale: Uu / 7.2, alpha: n ? 1 : .55, col: n ? "#8fe6c8" : "#d9f0b0" });
    if (!n) B.part(1, "poussiere", { x: x0, y: Y(.3), w: L, h: Y(.9) - Y(.3) }, { n: 22, col: "#eef0c0" });
  };

  // paroi rocheuse en gradins. cote = -1 : paroi de gauche, 1 : de droite. Son bord intérieur va de uH (en haut) à uB (en bas).
  // o = {bas, gradin, jag, pli, strates: couleur des lits, arete: couleur du liseré éclairé}. Renvoie {pts, cor} (cor : les corniches).
  function paroi(ctx, B, cote, uH, uB, fill, seed, o = {}) { const Uu = B.U, y0 = -Uu * 6, y1 = B.Y(o.bas == null ? .9 : o.bas), pas = Uu * (o.pas || 1.9), pts = [], cor = [], g = o.gradin == null ? 7 : o.gradin, xe = cote < 0 ? B.x0 - 4 : B.x1 + 4;
    for (let y = y0; y <= y1 + pas; y += pas) { const k = (y - y0) / (y1 - y0), q = Math.round((fbm1(y / (Uu * 30), seed, 3) - .5) * 9) / 4.5;
      pts.push([B.X(lerp(uH, uB, Math.pow(k, o.pli || 1))) - cote * Uu * (q * g + (fbm1(y / (Uu * 6), seed + 7, 3) - .5) * (o.jag == null ? 3 : o.jag)), y]); }
    // corniches voulues : la paroi recule juste au-dessus, puis revient d'un coup
    const corn = (o.corn || []).map(v => { const yc = B.Y(v); pts.forEach(q => { const d = yc - q[1]; if (d > 0 && d < Uu * 13) q[0] += cote * Uu * 5 * (1 - d / (Uu * 13)); }); return pts.find(q => q[1] >= yc); });
    for (let i = 1; i < pts.length; i++) if ((pts[i][0] - pts[i - 1][0]) * cote < -Uu * 2) cor.push(pts[i]);
    const tracer = () => { ctx.beginPath(); ctx.moveTo(xe, y0); pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(pts[pts.length - 1][0], B.H); ctx.lineTo(xe, B.H); ctx.closePath(); };
    tracer(); ctx.fillStyle = fill; ctx.fill();
    if (o.strates || o.arete) { ctx.save(); tracer(); ctx.clip(); const r = rng(seed + 3), xs = pts.map(p => p[0]), xa = Math.min(xe, ...xs), xb = Math.max(xe, ...xs);
      if (o.strates) { ctx.strokeStyle = o.strates; ctx.lineWidth = Math.max(1, Uu * .2); ctx.lineCap = "round";
        for (let y = y0; y < y1; y += Uu * r.r(2.5, 7)) { const pen = r.r(-.05, .05) + (o.pente || 0) * cote; ctx.globalAlpha = r.r(.25, .9); ctx.beginPath(); for (let x = xa; x <= xb + Uu * 4; x += Uu * 4) { const yy = y + (x - xa) * pen + (fbm1(x / (Uu * 9), seed + Math.round(y), 2) - .5) * Uu * 1.6; x === xa ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); } ctx.stroke(); }
        // failles : traits presque verticaux
        for (let i = 0; i < 7; i++) { let x = lerp(xa, xb, r()), y = lerp(y0, y1, r()); ctx.globalAlpha = r.r(.3, .8); ctx.beginPath(); ctx.moveTo(x, y); for (let j = 0; j < 6; j++) { x += r.r(-1, 1) * Uu * 1.2; y += Uu * r.r(2, 5); ctx.lineTo(x, y); } ctx.stroke(); } ctx.globalAlpha = 1; }
      if (o.arete) { ctx.strokeStyle = o.arete; ctx.lineJoin = "round"; [[7, .07], [.7, .32]].forEach(([w, a]) => { ctx.lineWidth = Uu * w; ctx.globalAlpha = a * (o.areteA || 1); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); }); }
      ctx.restore(); }
    return { pts, cor, corn }; }

  // passerelle de cordes tendue entre deux points (quelques planches manquent)
  function passerelle(ctx, a, b, fleche, col, Uu, r) { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + fleche * 2], n = 30, bas = courbe(a, m, b, n), h = Uu * 1.5; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = "round";
    ctx.lineWidth = Math.max(.8, Uu * .14); ctx.beginPath(); bas.forEach((p, i) => i ? ctx.lineTo(p[0], p[1] - h) : ctx.moveTo(p[0], p[1] - h)); ctx.stroke();
    ctx.lineWidth = Math.max(.6, Uu * .08); ctx.beginPath(); bas.forEach(p => { ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - h); }); ctx.stroke();
    ctx.lineWidth = Math.max(1, Uu * .34); for (let i = 1; i <= n; i++) { if (r() < .12) continue; ctx.beginPath(); ctx.moveTo(bas[i - 1][0], bas[i - 1][1]); ctx.lineTo(bas[i][0], bas[i][1]); ctx.stroke(); } }
  // éboulis : talus qui descend d'un bord vers le milieu
  function eboulis(ctx, B, cote, vH, uFin, vBas, fill, seed) { const Uu = B.U, xa = cote < 0 ? B.x0 : B.x1, xb = B.X(uFin); ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(xa, B.H);
    for (let i = 0; i <= 24; i++) { const k = i / 24, x = lerp(xa, xb, k); ctx.lineTo(x, lerp(B.Y(vH), B.Y(vBas), Math.pow(k, .75)) + (fbm1(x / (Uu * 4), seed, 3) - .5) * Uu * 3.4 * (1 - k * .8)); } ctx.lineTo(xb, B.H); ctx.closePath(); ctx.fill(); }
  // aiguille de roche à facettes
  function aiguille(ctx, x, y, w, h, col, r, lean = 0) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - w, y + 2); const n = 4;
    for (let i = 1; i <= n; i++) { const k = i / n; ctx.lineTo(x - w * (1 - k) * r.r(.7, 1.1) + lean * h * k, y - h * k * r.r(.9, 1)); }
    for (let i = n - 1; i >= 1; i--) { const k = i / n; ctx.lineTo(x + w * (1 - k) * r.r(.7, 1.15) + lean * h * k + w * .14, y - h * k * r.r(.84, .98)); }
    ctx.lineTo(x + w, y + 2); ctx.closePath(); ctx.fill(); }

  // guetteur accroupi sur une corniche, l'arc dressé
  function guetteur(ctx, x, y, s, col, sens = 1) { ctx.save(); ctx.translate(x, y); ctx.scale(sens * s, s); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-.55, .05); ctx.quadraticCurveTo(-.66, -.75, -.12, -.95); ctx.quadraticCurveTo(.3, -.9, .34, -.5); ctx.lineTo(.5, .05); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(.08, -1.1, .24, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-.2, -1.1); ctx.lineTo(-.02, -1.5); ctx.lineTo(.32, -1.16); ctx.closePath(); ctx.fill();
    ctx.lineWidth = .075; ctx.beginPath(); ctx.moveTo(.62, .02); ctx.quadraticCurveTo(1, -.85, .56, -1.75); ctx.stroke(); ctx.lineWidth = .03; ctx.beginPath(); ctx.moveTo(.62, .02); ctx.lineTo(.56, -1.75); ctx.stroke(); ctx.restore(); }

  // ---------- Gorge des Traqueurs ----------
  D.gorge = B => { const n = B.nuit, Uu = B.U, X = B.X, Y = B.Y, x0 = B.x0, x1 = B.x1, L = x1 - x0;
    const c = n ? { haut: "#050913", milieu: "#121e36", bas: "#33486c", roc: "#1b2538", pres: "#0d131e", sol: "#0b1019", pre: "#03050a", brume: "#6a88b4", rai: "#9cc0ff" }
                : { haut: "#56666c", milieu: "#bdb48e", bas: "#f3dba0", roc: "#62594b", pres: "#2f2b26", sol: "#262520", pre: "#0b0b0a", brume: "#ecd9a8", rai: "#ffe8b0" };
    B.lum = { col: n ? P.lune : "#ffe2a8", dir: 1, amb: n ? "#141f36" : "#3a3226", brume: c.brume };
    // la bande de ciel
    let ctx = O.ciel(B, { haut: c.haut, milieu: c.milieu, bas: c.bas, astre: n ? [.555, .15, 3] : null, astreCol: "#eef3ff", halo: "#8fb1ff", nuageCol: n ? "#3d5278" : "#f8e6bc", nuageA: n ? .2 : .3, nuagesN: 6, horizon: .62, seed: 6 });
    G.glow(ctx, X(.52), Y(.5), Uu * 55, c.rai, n ? .2 : .4);
    if (!n) G.glow(ctx, X(.4), Y(.02), Uu * 40, "#fff3d0", .5);
    // le fond du défilé : parois lointaines presque dissoutes
    ctx = B.couche(.08); const f0 = mixc(c.roc, c.bas, .72), f1 = mixc(c.roc, c.bas, .55);
    G.ridge(ctx, { x0, x1, y: Y(.5), amp: Uu * 7, freq: 2.2, seed: 12, bottom: B.H, fill: f0, jag: Uu * 2 });
    paroi(ctx, B, -1, .47, .43, f1, 21, { gradin: 4, jag: 2 }); paroi(ctx, B, 1, .6, .66, f1, 22, { gradin: 4, jag: 2 });
    O.voile(ctx, B, Y(.3), Y(.86), c.brume, n ? .4 : .55);
    if (!n) B.dyn(.08, (x, t) => { for (let i = 0; i < 3; i++) { const a = t * (.15 + i * .04) + i * 2.1; oiseau(x, X(.51 + i * .012) + Math.cos(a) * Uu * (8 + i * 3), Y(.17 + i * .04) + Math.sin(a) * Uu * (2.4 + i), Uu * (1.3 + .35 * Math.sin(a + 1) + i * .25), mixc(c.pres, c.bas, .25), .3 + .12 * Math.sin(t * .7 + i * 2), Math.cos(a) * .22); } });
    // parois du plan moyen, litées, le pied noyé de brume
    ctx = B.couche(.22); const m1 = mixc(c.roc, c.bas, .22), st = n ? "rgba(4,8,16,.3)" : "rgba(30,24,16,.2)";
    passerelle(ctx, [X(.3), Y(.27)], [X(.72), Y(.305)], Uu * 3.2, mixc(c.pres, c.bas, .3), Uu, rng("g-pont"));
    paroi(ctx, B, -1, .36, .27, G.lin(ctx, 0, 0, 0, Y(.86), [[0, mixc(c.roc, "#000", .1)], [.5, m1], [1, mixc(c.roc, c.brume, .5)]]), 33, { gradin: 7, strates: st, pente: .05 });
    paroi(ctx, B, 1, .665, .74, G.lin(ctx, 0, 0, 0, Y(.86), [[0, m1], [.5, mixc(c.roc, c.bas, .3)], [1, mixc(c.roc, c.brume, .55)]]), 34, { gradin: 8, strates: st, pente: .05, arete: c.rai, areteA: n ? .5 : 1 });
    G.shafts(ctx, X(.36), -Uu * 14, B.H * 1.15, Uu * 46, c.rai, n ? .07 : .15, 7, 5, -.3);
    O.voile(ctx, B, Y(.42), Y(.87), c.brume, n ? .3 : .42);
    // parois proches : corniches, pins accrochés, guetteurs
    ctx = B.couche(.42); const p1 = mixc(c.pres, c.bas, .1), rg = rng("g-pins");
    const pg = paroi(ctx, B, -1, .2, .1, G.lin(ctx, 0, 0, 0, Y(.88), [[0, mixc(c.pres, "#000", .15)], [.6, p1], [1, mixc(c.pres, c.brume, .34)]]), 45, { gradin: 8, strates: st, pente: .04, corn: [.2, .47] });
    const pd = paroi(ctx, B, 1, .815, .9, G.lin(ctx, 0, 0, 0, Y(.88), [[0, mixc(c.pres, "#000", .1)], [.6, p1], [1, mixc(c.pres, c.brume, .36)]]), 46, { gradin: 8, strates: st, pente: .04, arete: c.rai, areteA: n ? .4 : .7, corn: [.13, .38] });
    const poser = (w, cote) => { w.corn.forEach((q, i) => { if (!q) return; const cp = mixc(c.pres, "#000", .25); O.pin(ctx, q[0] + cote * Uu * rg.r(3.4, 4.2), q[1] + Uu * .4, Uu * rg.r(7, 10), cp, rg); if (i) O.pin(ctx, q[0] + cote * Uu * 1.6, q[1] + Uu * .4, Uu * rg.r(4, 6), cp, rg); else guetteur(ctx, q[0] + cote * Uu * 1.5, q[1] + Uu * .3, Uu * 2.6, cp, -cote); });
      w.cor.filter(q => q[1] > Y(.04) && q[1] < Y(.6)).forEach(q => { if (rg() < .5) O.pin(ctx, q[0] + cote * Uu * rg.r(.6, 2), q[1] + Uu * .5, Uu * rg.r(4, 8), mixc(c.pres, "#000", .2), rg); }); };
    poser(pg, -1); poser(pd, 1);
    O.voile(ctx, B, Y(.5), Y(.88), c.brume, n ? .16 : .22);
    // le fond de la gorge : éboulis et brume
    ctx = B.couche(.62); const re = rng("g-eboulis"), ce = mixc(c.sol, c.brume, .1), ge = G.lin(ctx, 0, Y(.7), 0, Y(.88), [[0, mixc(c.sol, c.brume, .34)], [1, mixc(c.sol, c.brume, .1)]]);
    eboulis(ctx, B, -1, .73, .24, .87, ge, 71); eboulis(ctx, B, 1, .715, .77, .87, ge, 72);
    O.rochers(ctx, x0, X(.17), Y(.84), Uu * 5, ce, re, 7); O.rochers(ctx, X(.83), x1, Y(.84), Uu * 6, ce, re, 7);
    terre(ctx, B, .845, 1.6, 44, [[0, mixc(c.sol, c.brume, .38)], [.3, mixc(c.sol, c.brume, .08)], [1, mixc(c.sol, "#000", .6)]], 1.5, .8);
    O.rochers(ctx, X(.18), X(.82), Y(.862), Uu * 1.6, ce, re, 9); O.rochers(ctx, X(.42), X(.6), Y(.86), Uu * 3.2, ce, re, 3);
    G.fog(ctx, x0, x1, Y(.82), Uu * 8, c.brume, n ? .24 : .32, 9, 14);
    B.part(.62, "brume", { x: x0, y: Y(.66), w: L, h: Uu * 18 }, { n: 8, col: c.brume, scale: Uu * .1 });
    B.sol = Y(.9);
    B.acteurs();
    // premier plan : les deux lèvres du défilé, blocs éboulés
    ctx = B.couche(1); const rp = rng("g-pre"), yB = Y(1);
    paroi(ctx, B, -1, .085, -.02, c.pre, 61, { bas: 1.05, gradin: 5, jag: 4 }); paroi(ctx, B, 1, .93, 1.03, c.pre, 62, { bas: 1.05, gradin: 5, jag: 4 });
    O.rochers(ctx, x0, X(.22), yB + Uu, Uu * 10, c.pre, rp, 5); O.rochers(ctx, X(.74), x1, yB + Uu, Uu * 12, c.pre, rp, 5); O.rochers(ctx, x0, x1, yB + Uu, Uu * 4, c.pre, rp, 12);
    O.herbe(ctx, x0, x1, yB + Uu, Uu * 5, c.pre, rp, .35);
    ctx.strokeStyle = c.pre; ctx.lineCap = "round"; membre(ctx, x0 - Uu * 2, Y(.1), Uu * 17, -.1, Uu * 2, rng("g-br"), 4, { tors: 1.1 }, []);
    socle(ctx, B, c.pre);
    G.fog(ctx, x0, x1, Y(.91), Uu * 6, c.brume, n ? .1 : .14, 35, 12);
    if (!n) B.part(1, "poussiere", { x: X(.2), y: Y(.1), w: X(.85) - X(.2), h: Y(.9) - Y(.1) }, { n: 34 });
  };

  // ---------- Crête de cendre ----------
  D.crete = B => { const n = B.nuit, Uu = B.U, X = B.X, Y = B.Y, x0 = B.x0, x1 = B.x1, L = x1 - x0;
    const c = n ? { haut: "#060509", milieu: "#1a1016", bas: "#5a281c", loin: "#261b25", roc: "#0e0b0d", sol: "#151113", cendre: "#4d4248", pre: "#040304", brume: "#8a4a3a", os: "#3a2f2e" }
                : { haut: "#2a2523", milieu: "#6e5a4c", bas: "#d3a070", loin: "#7c6c62", roc: "#231e1c", sol: "#2b2624", cendre: "#91867a", pre: "#0a0808", brume: "#c9a583", os: "#51483f" };
    B.lum = { col: n ? "#ff9a62" : "#ffc890", dir: 1, amb: n ? "#2a1418" : "#3a2c26", brume: c.brume };
    // ciel de cendre : astre rougi, panache derrière la crête
    let ctx = O.ciel(B, { haut: c.haut, milieu: c.milieu, bas: c.bas, astre: n ? [.2, .16, 2.6] : [.23, .3, 3.8], astreCol: n ? "#e6c0a4" : "#f6c9a0", halo: n ? "#b8553a" : "#e8825a", nuageCol: n ? "#2c1b1f" : "#4c3d37", nuageA: n ? .45 : .4, nuagesN: 10, horizon: .6, seed: 9 });
    G.glow(ctx, X(.8), Y(.26), Uu * 60, P.braise, n ? .5 : .34); G.glow(ctx, X(.87), Y(.2), Uu * 26, P.feu, n ? .3 : .2);
    G.fog(ctx, X(.55), X(1.1), Y(.07), Uu * 11, n ? "#120c10" : "#3a2f2b", .55, 3, 10);
    // très loin en contrebas : la vallée, le fleuve, les lumières de Valdren
    ctx = B.couche(.06);
    G.ridge(ctx, { x0, x1, y: Y(.5), amp: Uu * 9, freq: .8, seed: 3, bottom: B.H, fill: mixc(c.loin, c.bas, .55), jag: Uu * 1.5 });
    G.ridge(ctx, { x0, x1, y: Y(.59), amp: Uu * 4, freq: 1.2, seed: 8, bottom: B.H, fill: mixc(c.loin, c.bas, .4), jag: Uu * .8 });
    G.ridge(ctx, { x0, x1, y: Y(.655), amp: Uu * 2.4, freq: 1.5, seed: 14, bottom: B.H, fill: mixc(c.loin, c.bas, .28) });
    ruban(ctx, lisse([[-.06, .712], [.03, .7], [.09, .708], [.15, .694], [.2, .7], [.27, .688], [.36, .694]].map(([u, v]) => [X(u), Y(v)]), 8), Uu * .7, Uu * .2, rgba(n ? "#8e9cc0" : "#f4d8ae", n ? .3 : .45));
    const rv = rng("c-village"), vx = X(.13), vy = Y(.69);
    for (let i = 0; i < 9; i++) { const lx = vx + rv.r(-2.6, 2.6) * Uu, ly = vy - rv.r(-.3, .7) * Uu - (i === 0 ? Uu * 1.2 : 0), e = Math.max(1, Uu * .15); ctx.fillStyle = "#ffd596"; ctx.fillRect(lx, ly, e, e); G.glow(ctx, lx, ly, Uu * .9, "#ffb766", n ? .6 : .4); }
    G.glow(ctx, vx, vy, Uu * 6, "#ffb766", n ? .16 : .08);
    O.voile(ctx, B, Y(.4), Y(.8), c.brume, n ? .25 : .36);
    // la crête : arête noire qui monte vers l'antre, liseré de braise
    ctx = B.couche(.2); const xG = X(.08), pasC = Uu * 1.4, cr = [];
    for (let x = xG; x <= x1 + pasC; x += pasC) { const k = (x - xG) / (x1 - xG); cr.push([x, Y(lerp(.9, .13, Math.pow(k, .9))) + (fbm1(x / (Uu * 16), 5, 4) - .5) * Uu * 11 * (.1 + k) + (fbm1(x / (Uu * 2.6), 6, 2) - .5) * Uu * 2.2 * Math.min(1, k * 4)]); }
    const crY = x => cr[clamp(Math.round((x - xG) / pasC), 0, cr.length - 1)][1];
    ctx.beginPath(); ctx.moveTo(xG, B.H); cr.forEach(q => ctx.lineTo(q[0], q[1])); ctx.lineTo(x1 + pasC, B.H); ctx.closePath();
    ctx.fillStyle = G.lin(ctx, 0, Y(.15), 0, Y(.88), [[0, c.roc], [.45, mixc(c.roc, c.brume, .16)], [1, mixc(c.roc, c.brume, .6)]]); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineJoin = "round"; ctx.strokeStyle = rgba(P.braise, n ? .5 : .36); ctx.lineWidth = Math.max(1, Uu * .4); ctx.beginPath(); let levee = true; cr.forEach(q => { if (q[0] < X(.4)) return; levee ? ctx.moveTo(q[0], q[1] + Uu * .2) : ctx.lineTo(q[0], q[1] + Uu * .2); levee = false; }); ctx.stroke(); ctx.restore();
    // la gueule de l'antre, tout en haut
    const gx = X(.835), gw = Uu * 6.4, gh = Uu * 7.6, gy = crY(gx) + gh + Uu * 3.5;
    // le sentier en lacets, pâle de cendre
    ruban(ctx, lisse([[.5, .88], [.64, .77], [.5, .69], [.69, .61], [.58, .535], [.76, .47], [.69, .415]].map(([u, v]) => [X(u), Y(v)]).concat([[gx - gw * 1.6, gy + gh * .62], [gx, gy + gh * .6]]), 7), Uu * 3.2, Uu * .6, rgba(mix(c.cendre, c.bas, .35), n ? .3 : .42));
    // coulées qui rougeoient dans les failles
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round"; ctx.lineJoin = "round"; const rf = rng("c-failles");
    [[.93, .32], [.9, .47], [.8, .53], [.97, .57]].forEach(([u, v]) => { let x = X(u), y = Y(v); ctx.beginPath(); ctx.moveTo(x, y); for (let j = 0; j < 7; j++) { x += rf.r(-1.6, .8) * Uu; y += rf.r(1.2, 3) * Uu; ctx.lineTo(x, y); }
      ctx.strokeStyle = rgba(P.feu2, .08); ctx.lineWidth = Uu * 1.4; ctx.stroke(); ctx.strokeStyle = rgba(P.feu2, n ? .55 : .34); ctx.lineWidth = Math.max(1, Uu * .26); ctx.stroke(); }); ctx.restore();
    const antre = () => { ctx.beginPath(); ctx.moveTo(gx - gw, gy + gh * .62); ctx.bezierCurveTo(gx - gw * 1.2, gy - gh * .2, gx - gw * .62, gy - gh * 1.02, gx - gw * .05, gy - gh * .86); ctx.bezierCurveTo(gx + gw * .5, gy - gh * .74, gx + gw * 1.14, gy - gh * .3, gx + gw * .96, gy + gh * .62); ctx.closePath(); };
    antre(); ctx.fillStyle = G.rad(ctx, gx, gy + gh * .5, 0, gh * 1.5, [[0, "#ffc888"], [.22, P.feu], [.5, P.feu2], [.8, "#7a2414"], [1, "#2a0c0a"]]); ctx.fill();
    ctx.save(); antre(); ctx.clip(); stalactites(ctx, gx - gw * 1.1, gx + gw * 1.1, gy - gh * .95, gh * .9, c.roc, rng("c-dents"), 7); stalactites(ctx, gx - gw * 1.1, gx + gw * 1.1, gy + gh * .66, gh * .34, c.roc, rng("c-dents2"), 6, true); ctx.restore();
    G.glow(ctx, gx, gy, Uu * 19, P.feu2, n ? .5 : .36); ovale(ctx, gx - Uu * 3, gy + gh * 1.1, Uu * 15, Uu * 5, P.feu2, n ? .22 : .14);
    // évents du versant
    const ev = [[.57, .6], [.7, .5], [.9, .62]]; ev.forEach(([u, v]) => G.glow(ctx, X(u), Y(v), Uu * 2.4, P.feu2, n ? .5 : .3));
    O.voile(ctx, B, Y(.44), Y(.88), c.brume, n ? .4 : .5);
    B.dyn(.2, (x, t) => { G.glow(x, gx, gy + Uu, Uu * (10 + Math.sin(t * 1.3) * 1.2), P.feu, (n ? .3 : .2) * (.75 + .25 * Math.sin(t * 2.3) * Math.sin(t * .7))); G.glow(x, X(.86), Y(.16), Uu * (22 + Math.sin(t * .6) * 2), P.braise, (n ? .2 : .12) * (.8 + .2 * Math.sin(t * .9))); });
    ev.forEach(([u, v], i) => B.part(.2, "fumee", { x: X(u) - Uu, y: Y(v) - Uu * 9, w: Uu * 2, h: Uu * 9 }, { n: 6, col: n ? "#4a3238" : "#9a8a7e", scale: Uu * .13, seed: "ev" + i }));
    // plan moyen : aiguilles de basalte sur les bords, cônes fumants
    ctx = B.couche(.45); const ra = rng("c-aig"), ca = mixc(c.roc, c.brume, .2);
    [[-.01, 30, 7], [.05, 19, 5], [.1, 11, 4], [.955, 34, 8], [1.02, 24, 7], [.9, 14, 5]].forEach(([u, h, w]) => aiguille(ctx, X(u), Y(.87), Uu * w, Uu * h, G.lin(ctx, 0, Y(.87) - Uu * h, 0, Y(.87), [[0, c.roc], [1, ca]]), ra, ra.r(-.08, .08)));
    const ce = mixc(c.sol, c.brume, .2); [[.4, .85, 2.6], [.62, .855, 1.8]].forEach(([u, v, s]) => { ctx.fillStyle = ce; ctx.beginPath(); ctx.moveTo(X(u) - Uu * s * 2.6, Y(v) + Uu); ctx.lineTo(X(u) - Uu * s * .4, Y(v) - Uu * s * .7); ctx.lineTo(X(u) + Uu * s * .5, Y(v) - Uu * s * .62); ctx.lineTo(X(u) + Uu * s * 2.8, Y(v) + Uu); ctx.closePath(); ctx.fill(); G.glow(ctx, X(u), Y(v) - Uu * s * .7, Uu * s * 1.2, P.feu2, n ? .5 : .3); });
    G.fog(ctx, x0, x1, Y(.8), Uu * 8, c.brume, n ? .22 : .28, 17, 14);
    B.part(.45, "fumee", { x: X(.4) - Uu, y: Y(.85) - Uu * 12, w: Uu * 2, h: Uu * 10 }, { n: 7, col: n ? "#4a3238" : "#9a8a7e", scale: Uu * .16, seed: "ev9" });
    // le sol de cendre
    ctx = B.couche(.7); terre(ctx, B, .85, 1.4, 52, [[0, mixc(c.cendre, c.brume, .3)], [.22, mixc(c.sol, c.cendre, .25)], [1, mixc(c.sol, "#000", .6)]], 1.3, .5);
    const rs = rng("c-sol"); O.rochers(ctx, x0, x1, Y(.865), Uu * 1.5, mixc(c.sol, c.cendre, .1), rs, 12);
    cotes(ctx, X(.49), Y(.878), Uu * 8, Uu * 3.2, mixc(c.os, c.cendre, .4), rs, 6); crane(ctx, X(.56), Y(.88), Uu * 3, mixc(c.os, c.cendre, .4), 1);
    B.sol = Y(.9);
    B.acteurs();
    // premier plan : la carcasse d'une grande bête, un crâne cornu, des blocs noirs
    ctx = B.couche(1); const rp = rng("c-pre"), yB = Y(1), osC = mixc(c.os, c.pre, .3), osL = mixc(c.os, c.bas, .32);
    aiguille(ctx, x0 + Uu * 2, yB + Uu, Uu * 8, Uu * 44, c.pre, rp, .05); aiguille(ctx, x1 - Uu, yB + Uu, Uu * 7, Uu * 30, c.pre, rp, -.06);
    cotes(ctx, X(.95), yB + Uu * 2, Uu * 44, Uu * 24, osC, rng("c-cotes"), 8, 1, .1); cotes(ctx, X(.95) - Uu * .3, yB + Uu * 1.6, Uu * 44, Uu * 24, osL, rng("c-cotes"), 8, .35, .1);
    crane(ctx, X(.13) - Uu * .25, yB - Uu * 1.4, Uu * 16, osL, 1); crane(ctx, X(.13), yB - Uu, Uu * 16, osC, 1);
    O.rochers(ctx, x0, x1, yB + Uu, Uu * 4, c.pre, rp, 14);
    socle(ctx, B, c.pre);
    G.fog(ctx, x0, x1, Y(.9), Uu * 6, c.brume, n ? .12 : .15, 29, 12);
    B.part(1, "cendre", { x: x0, y: 0, w: L, h: Y(1) }, { n: 54, col: n ? "#8d8088" : "#cfc6ba", scale: Uu / 7.2 });
    B.part(1, "braise", { x: X(.55), y: Y(.45), w: X(1.02) - X(.55), h: Y(.92) - Y(.45) }, { n: n ? 16 : 9, scale: Uu / 7.2 });
  };
})();
