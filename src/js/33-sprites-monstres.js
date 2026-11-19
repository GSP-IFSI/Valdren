// Grands monstres : le dragon de la Crête, le Morghal, la Chimère de Faille.
// Même contrat que les autres sprites (voir 30-sprites.js) : pieds en (0,0), regard vers +x, teintes sourdes.
// Chaque monstre est un squelette paramétré : une pose de repos, des poses d'état mélangées par pondération,
// puis une peau dessinée par-dessus (rubans d'épaisseur variable, membres effilés, cinématique inverse).
(() => { const G = VG.gfx, U = VG.u, S_ = VG.sprites, P = G.PAL; const { clamp, lerp, smooth, bell, rng, rgba, TAU } = U;
  const { membre, ik } = S_, mixc = U.mixc;

  // ---------- outils communs ----------
  // pose = repos + somme pondérée des écarts de chaque pose d'état
  const melange = (base, poses, poids) => { const p = Object.assign({}, base); for (const k in poids) { const w = poids[k], q = poses[k]; if (!w || !q) continue; for (const i in q) p[i] += (q[i] - base[i]) * w; } return p; };
  const bez = (a, b, c, d, u) => { const v = 1 - u; return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d; };
  // bords d'un ruban le long de points [x, y, rayon] : g = côté gauche du sens de marche (le dos), d = côté droit (le ventre)
  function ruban(pts) { const n = pts.length, g = [], d = [], nx = [], ny = [];
    for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l; const r = pts[i][2];
      nx.push(ty); ny.push(-tx); g.push([pts[i][0] + ty * r, pts[i][1] - tx * r]); d.push([pts[i][0] - ty * r, pts[i][1] + tx * r]); }
    return { g, d, nx, ny, n }; }
  function remplirRuban(ctx, rb, pts) { const n = rb.n; ctx.beginPath(); ctx.moveTo(rb.g[0][0], rb.g[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(rb.g[i][0], rb.g[i][1]);
    const z = pts[n - 1], a = Math.atan2(rb.g[n - 1][1] - z[1], rb.g[n - 1][0] - z[0]); ctx.arc(z[0], z[1], z[2], a, a + Math.PI);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(rb.d[i][0], rb.d[i][1]); ctx.closePath(); ctx.fill(); }

  // =====================================================================================
  // AZHAREL, le dragon de la Crête de cendre
  // =====================================================================================
  S_.def("dragon", o => { const ph = rng((o && o.seed) == null ? 3 : o.seed + 11)() * 6;
    const c = { loin: "#1a0d0b", corps: "#2c1510", pres: "#3a1c16", machoire: "#33180f", aile: "#43201a", aileLoin: "#20100d", plaque: "#8a2f1c", chaud: "#e8825a", os: "#5f5040", osLoin: "#352b22", dent: "#b9ad92", oeil: "#ff9a3a" };
    const LB = 60, L1 = 32, L2 = 44, DG = [62, 66, 60, 48], NQ = 15;
    // px,py : bassin ; ba : angle du tronc ; kx,ky,ka : tête (base du crâne) ; n1,n2 : départ et arrivée du cou ; jaw : gueule
    // fx,fy / gx,gy : pied avant / arrière ; q0,qc,qo,ql : queue (cap, enroulement, ondulation, longueur)
    // w1,w2 : bras de l'aile proche, w3 : premier doigt, ws : écart des doigts ; v* : aile lointaine
    const REPOS = { px: -32, py: -44, ba: -.5, kx: 44, ky: -140, ka: .1, n1: -1.95, n2: -.35, jaw: .04, fx: 30, fy: 0, gx: -18, gy: 0, q0: 2.3, qc: 2.3, qo: 1, ql: 1,
      w1: -2.2, w2: -1.55, w3: 2.3, ws: .22, v1: -2.02, v2: -1.42, v3: 2.2, vs: .2 };
    const POSES = {
      dort: { px: -18, py: -21, ba: -.08, kx: 64, ky: -13, ka: 0, n1: -1.2, n2: 1.0, jaw: 0, fx: 60, gx: 6, q0: 2.9, qc: 3.4, qo: .15, ql: .8, w1: -2.5, w2: -2.9, w3: 2.45, ws: .42, v1: -2.35, v2: -2.75, v3: 2.35, vs: .4 },
      blesse: { px: -34, py: -40, ba: -.38, kx: 50, ky: -116, ka: .28, n1: -1.7, jaw: .12, w1: -2.9, w2: 2.2, w3: 2.6, ws: .25, qo: .5 },
      elan: { px: -38, py: -43, ba: -.56, kx: 18, ky: -150, ka: -.25, n1: -2.2, jaw: .35, q0: 2.1, ws: .3, vs: .28 },
      frappe: { px: -30, py: -40, ba: -.3, kx: 76, ky: -60, ka: .35, n1: -1.0, n2: .4, jaw: .6, q0: 3.2, qc: 1.2, w3: 2.7, ws: .3, v3: 2.6, vs: .28 },
      souffle: { px: -34, py: -38, ba: -.3, kx: 68, ky: -92, ka: -.15, n1: -1.2, n2: -.1, jaw: 1, q0: 2.9, qc: .8, w1: -2.3, w2: -1.9, w3: 2.9, ws: .32, v1: -2.15, v2: -1.75, v3: 2.8, vs: .3 },
      charge: { px: -34, py: -48, ba: -1.0, kx: 22, ky: -158, ka: .5, n1: -2.0, jaw: .3, fx: 26, fy: -52, q0: 2.2, w1: -2.2, w2: -1.75, w3: 3.4, ws: .45, v1: -2.0, v2: -1.6, v3: 3.2, vs: .4 },
      recule: { px: -44, py: -36, ba: -.35, kx: 14, ky: -112, ka: .22, n1: -2.3, jaw: .25, fx: 22, gx: -30, w1: -2.9, w2: -2.1, w3: 5.18, ws: .65, v1: -2.3, v2: -1.8, v3: 3.3, vs: .4 },
      touche: { px: -36, py: -42, ba: -.58, kx: 28, ky: -146, ka: -.4, n1: -2.2, jaw: .3 },
      chute: { px: -24, py: -20, ba: -.06, kx: 70, ky: -12, ka: .1, n1: -.7, n2: .8, jaw: .15, fx: 62, gx: 0, q0: 2.9, qc: .6, qo: 0, ql: .8, w1: -2.95, w2: 2.9, w3: 2.9, ws: .3, v1: -2.6, v2: -2.6, v3: 2.6, vs: .3 },
    };

    function corne(ctx, x, y, rot, len) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath(); ctx.moveTo(4, 3.5); ctx.quadraticCurveTo(-len * .45, -1, -len, -11); ctx.quadraticCurveTo(-len * .5, -13, 5, -4.5); ctx.closePath(); ctx.fill(); ctx.restore(); }

    function pied(ctx, x, y, rot, col, colOs, s) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-5, -2); ctx.quadraticCurveTo(4, -3, 10, 2); ctx.lineTo(15, 7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 3; i++) { const tx = 1 + i * 5.5; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(tx + 2, 4.2, 4.6, 3, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = colOs; ctx.beginPath(); ctx.moveTo(tx + 4.5, 2.6); ctx.quadraticCurveTo(tx + 10.5, 2.6, tx + 11.5, 7); ctx.lineTo(tx + 5, 6.2); ctx.closePath(); ctx.fill(); }
      ctx.restore(); }
    function patteAv(ctx, jx, jy, fx, fy, col, colOs) { const lev = clamp(-fy / 40, 0, 1), q = ik(jx, jy, fx - 5, fy - 7, 34, 34, 1);
      ctx.fillStyle = col; membre(ctx, jx, jy, q[0], q[1], 11.5, 7.5); membre(ctx, q[0], q[1], q[2], q[3], 7.5, 5); pied(ctx, q[2], q[3], lev * .8, col, colOs, 1); }
    function patteAr(ctx, hx, hy, gx, gy, col, colOs) { const q = ik(hx, hy, gx - 14, gy - 17, 31, 29, -1);
      ctx.fillStyle = col; membre(ctx, hx, hy, q[0], q[1], 19, 10.5); membre(ctx, q[0], q[1], q[2], q[3], 9.5, 5.2); membre(ctx, q[2], q[3], gx - 4, gy - 7, 5.2, 4.6); pied(ctx, gx - 4, gy - 7, 0, col, colOs, 1.05); }

    // une aile : racine (rx,ry), bras (a1,a2), éventail de quatre doigts à partir de a3, membrane rattachée au dos en (ax,ay)
    function aile(ctx, rx, ry, a1, a2, a3, es, ax, ay, col, colM, colOs) {
      const ex = rx + Math.cos(a1) * L1, ey = ry + Math.sin(a1) * L1, wx = ex + Math.cos(a2) * L2, wy = Math.min(ey + Math.sin(a2) * L2, -4), tp = [];
      for (let i = 0; i < 4; i++) { const a = a3 - i * es; tp.push([wx + Math.cos(a) * DG[i], Math.min(wy + Math.sin(a) * DG[i], -1.5)]); }
      const feston = (a, b) => { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, k = .34 * clamp(Math.hypot(a[0] - b[0], a[1] - b[1]) / 45, 0, 1); ctx.quadraticCurveTo(mx + (wx - mx) * k, my + (wy - my) * k, b[0], b[1]); };
      ctx.fillStyle = colM; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(tp[0][0], tp[0][1]); for (let i = 1; i < 4; i++) feston(tp[i - 1], tp[i]); feston(tp[3], [ax, ay]); ctx.lineTo(rx, ry); ctx.lineTo(ex, ey); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.quadraticCurveTo((rx + wx) / 2 + 3, (ry + wy) / 2, wx, wy); ctx.lineTo(ex, ey); ctx.closePath(); ctx.fill();
      ctx.fillStyle = col; membre(ctx, rx, ry, ex, ey, 6.5, 4.4); membre(ctx, ex, ey, wx, wy, 4.4, 2.8);
      for (let i = 0; i < 4; i++) membre(ctx, wx, wy, tp[i][0], tp[i][1], 2.1, .45);
      // griffe du poignet
      const ag = a2 - .5; ctx.fillStyle = colOs; ctx.beginPath(); ctx.moveTo(wx - Math.sin(ag) * 2.2, wy + Math.cos(ag) * 2.2); ctx.lineTo(wx + Math.cos(ag) * 10, wy + Math.sin(ag) * 10); ctx.lineTo(wx + Math.sin(ag) * 2.2, wy - Math.cos(ag) * 2.2); ctx.closePath(); ctx.fill(); }

    function tete(ctx, hx, hy, ha, jaw, oeil, feu) { ctx.save(); ctx.translate(hx, hy); ctx.rotate(ha); const jo = jaw * .8;
      // corne et épines du côté lointain
      ctx.fillStyle = c.osLoin; corne(ctx, 3, -6.5, .2, 38);
      ctx.fillStyle = c.corps; ctx.beginPath(); ctx.moveTo(-5, -7); ctx.lineTo(-23, -8); ctx.lineTo(-6, -1); ctx.lineTo(-21, 2.5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); for (let i = 0; i < 3; i++) { const x = -4 + i * 5; ctx.moveTo(x - 2.5, -9); ctx.lineTo(x - 3.5, -14.5 + i); ctx.lineTo(x + 2.5, -9.5); } ctx.fill();
      // fond de la gueule
      if (jaw > .06) { ctx.fillStyle = "#170706"; ctx.beginPath(); ctx.moveTo(1, 5); ctx.lineTo(37, 4); ctx.lineTo(3 + Math.cos(jo) * 31, 6 + Math.sin(jo) * 31); ctx.closePath(); ctx.fill();
        if (feu > .03) { G.glow(ctx, 12, 9 + jo * 9, 13 + 9 * feu, P.feu2, feu * .9); G.glow(ctx, 20, 8 + jo * 12, 8 + 8 * feu, "#ffe2a0", feu * .8); } }
      // mâchoire inférieure, articulée
      ctx.save(); ctx.translate(3, 6); ctx.rotate(jo);
      ctx.fillStyle = c.dent; ctx.beginPath(); for (let i = 0; i < 5; i++) { const x = 9 + i * 5; ctx.moveTo(x - 1.5, 0); ctx.lineTo(x + .4, -3.6 - (i % 2)); ctx.lineTo(x + 1.9, 0); } ctx.moveTo(30, 0); ctx.lineTo(32.4, -5.5); ctx.lineTo(33.6, 0); ctx.fill();
      ctx.fillStyle = c.machoire; ctx.beginPath(); ctx.moveTo(-7, -3); ctx.lineTo(-19, 5); ctx.lineTo(-8, 4); ctx.lineTo(-11, 9.5); ctx.quadraticCurveTo(6, 8.5, 22, 6.5); ctx.lineTo(19.5, 11); ctx.lineTo(26, 6); ctx.lineTo(33.5, 3.4); ctx.lineTo(35.5, -1.2); ctx.lineTo(30, .2); ctx.lineTo(5, -.8); ctx.closePath(); ctx.fill();
      ctx.restore();
      // crâne et mâchoire supérieure, bec crochu
      ctx.fillStyle = c.pres; ctx.beginPath(); ctx.moveTo(-7, 7); ctx.lineTo(-8.5, -6); ctx.quadraticCurveTo(-4, -10, 4, -10.5); ctx.lineTo(11, -11.8); ctx.lineTo(15.5, -8); ctx.quadraticCurveTo(24, -6.5, 31, -5.6); ctx.quadraticCurveTo(34, -7.6, 37, -5.2);
      ctx.quadraticCurveTo(41.2, -2.5, 40.6, 3); ctx.lineTo(39.6, 8.2); ctx.quadraticCurveTo(38, 4.6, 34, 4.3); ctx.lineTo(18, 5.2); ctx.lineTo(4, 6.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.dent; ctx.beginPath(); for (let i = 0; i < 6; i++) { const x = 9 + i * 4.4; ctx.moveTo(x - 1.4, 5.6 - i * .2); ctx.lineTo(x + .2, 8.8 - i * .2 + (i % 2)); ctx.lineTo(x + 1.7, 5.5 - i * .2); } ctx.moveTo(33, 4.2); ctx.lineTo(34.8, 9.8); ctx.lineTo(36.4, 4.3); ctx.fill();
      // arcade, naseau, pli de la joue
      ctx.fillStyle = c.corps; ctx.beginPath(); ctx.moveTo(2, -10.4); ctx.lineTo(11, -11.8); ctx.lineTo(16.5, -7.6); ctx.lineTo(12.5, -6); ctx.lineTo(4, -6.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(10,3,2,.75)"; ctx.beginPath(); ctx.ellipse(36.4, -3.2, 1.5, .9, .5, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(10,3,2,.45)"; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(-2, 1); ctx.quadraticCurveTo(2, 5, 4, 6.6); ctx.stroke();
      // corne proche
      ctx.fillStyle = G.lin(ctx, 2, -7, -42, -18, [[0, c.os], [.6, c.os], [1, "#8d7b60"]]); corne(ctx, -2, -6, 0, 44);
      // œil
      if (oeil > .12) { G.glow(ctx, 10.4, -4.4, 9, c.oeil, .8 * oeil); ctx.fillStyle = "#ffb648"; ctx.beginPath(); ctx.ellipse(10.4, -4.4, 3, 1.7 * oeil, .12, 0, TAU); ctx.fill(); ctx.fillStyle = "#2a0a00"; ctx.fillRect(10, -4.4 - 1.6 * oeil, .9, 3.2 * oeil); }
      else { ctx.strokeStyle = "rgba(10,3,2,.7)"; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(7.6, -4.4); ctx.quadraticCurveTo(10.4, -3.2, 13.4, -4.2); ctx.stroke(); }
      ctx.restore(); }

    function draw(ctx, t, st) { st = st || {}; const A = st.att || 0;
      const w = { dort: smooth(st.dort || 0), blesse: clamp(st.blesse || 0, 0, 1), souffle: smooth(st.souffle || 0), charge: smooth(st.charge || 0), recule: smooth(st.recule || 0), touche: bell(st.touche || 0, .25), chute: smooth(st.chute || 0),
        elan: A > 0 && A < .42 ? bell(A / .42, .6) : 0, frappe: A >= .3 ? bell((A - .3) / .7, .22) : 0 };
      const p = melange(REPOS, POSES, w), calme = Math.max(w.dort, w.chute), eveil = 1 - calme, bouge = eveil * (1 - w.souffle * .6);
      const resp = lerp(Math.sin(t * 1.15 + ph), Math.sin(t * .62 + ph), w.dort) * (1 - w.chute * .8), trem = (st.charge || 0) > .5 ? Math.sin(t * 46) * .5 : 0;
      const heat = clamp(w.souffle + w.charge * .75 + w.elan * .3, 0, 1) * (1 - w.chute);
      p.ba -= resp * .012 * eveil; p.kx += Math.sin(t * .5 + ph) * 2.4 * bouge + trem; p.ky += Math.sin(t * .8 + ph * 2) * 1.6 * bouge + resp * 1.2 * eveil; p.ka += Math.sin(t * .43 + ph) * .035 * bouge;
      p.w2 += resp * .015; p.v2 += resp * .012;
      ctx.save(); ctx.lineJoin = "round";
      const px = p.px, py = p.py - resp * .6 * eveil, cb = Math.cos(p.ba), sb = Math.sin(p.ba), sx = px + cb * LB, sy = py + sb * LB; // épaules
      // --- l'échine : queue (de la pointe au bassin), tronc, cou ---
      const ech = []; { let a = p.q0, x = px, y = py; const q = [];
        for (let i = 1; i <= NQ; i++) { const u = i / NQ, l = (9 - i * .24) * p.ql, r = 1.6 + 15.5 * Math.pow(1 - u, 1.25);
          a = p.q0 + p.qc * Math.pow(u, 2.2) + (Math.sin(t * 1.05 + ph - i * .42) * .1 * u + Math.sin(t * .47 + ph) * .04) * p.qo * eveil;
          x += Math.cos(a) * l; y = Math.min(y + Math.sin(a) * l, 1 - r); q.push([x, y, r]); }
        for (let i = NQ - 1; i >= 0; i--) ech.push(q[i]); }
      const iBassin = ech.length, gonfle = 1 + resp * lerp(.03, .055, w.dort);
      for (let i = 0; i <= 7; i++) { const u = i / 7, arc = Math.sin(u * Math.PI) * 4; ech.push([px + cb * LB * u + sb * arc, py + sb * LB * u - cb * arc, (20 + 5 * u - 1.5 * Math.sin(u * Math.PI)) * (1 + (gonfle - 1) * (.4 + .6 * u))]); }
      const iCou = ech.length, hk = 30, on = Math.sin(t * .6 + ph) * 2.6 * bouge, on2 = Math.sin(t * .6 + ph + 1.4) * 2.2 * bouge;
      const c1x = sx + Math.cos(p.n1) * hk - Math.sin(p.n1) * on, c1y = sy + Math.sin(p.n1) * hk + Math.cos(p.n1) * on, a2 = p.ka + p.n2, c2x = p.kx - Math.cos(a2) * hk - Math.sin(a2) * on2, c2y = p.ky - Math.sin(a2) * hk + Math.cos(a2) * on2;
      for (let i = 1; i <= 12; i++) { const u = i / 12; ech.push([bez(sx, c1x, c2x, p.kx, u), bez(sy, c1y, c2y, p.ky, u), 9 + 16 * gonfle * Math.pow(1 - u, 2.4)]); }
      const rb = ruban(ech), n = rb.n;
      // points utiles
      const rx = px + cb * 43 + sb * 18, ry = py + sb * 43 - cb * 18, ax = px + cb * 10 + sb * 17, ay = py + sb * 10 - cb * 17; // racine de l'aile, attache de la membrane
      const jx = sx + 2, jy = sy + 8, hjx = px + 6, hjy = py + 6;

      // --- plan lointain : aile, pattes ---
      aile(ctx, rx + 9, ry - 2, p.v1, p.v2, p.v3, p.vs, ax + 9, ay - 2, c.loin, c.aileLoin, c.osLoin);
      patteAr(ctx, hjx + 8, hjy - 1, p.gx + 15, p.gy, c.loin, c.osLoin); patteAv(ctx, jx + 7, jy - 1, p.fx + 13, p.fy * 1.12, c.loin, c.osLoin);

      // --- épines dorsales (dessinées avant le corps, qui cache leur pied) ---
      ctx.fillStyle = c.corps; ctx.beginPath();
      for (let i = 3; i < n - 1; i++) { const u = i < iBassin ? i / iBassin : 1, h = i < iBassin ? 1.5 + 5.5 * u : i < iCou ? 7.5 + 2 * (i - iBassin) / (iCou - iBassin) : lerp(9.5, 5.5, (i - iCou) / (n - iCou));
        const gx = rb.g[i][0], gy = rb.g[i][1], nx = rb.nx[i], ny = rb.ny[i], tx = -ny, ty = nx, b = h * .55;
        ctx.moveTo(gx - tx * b - nx * 2, gy - ty * b - ny * 2); ctx.lineTo(gx + nx * h - tx * h * .75, gy + ny * h - ty * h * .75); ctx.lineTo(gx + tx * b - nx * 2, gy + ty * b - ny * 2); }
      ctx.fill();
      // --- corps ---
      ctx.fillStyle = c.corps; remplirRuban(ctx, rb, ech);
      // pointe de la queue
      { const z = ech[0], z1 = ech[1], a = Math.atan2(z[1] - z1[1], z[0] - z1[0]), ca = Math.cos(a), sa = Math.sin(a); ctx.beginPath(); ctx.moveTo(z[0] - ca * 2, z[1] - sa * 2); ctx.lineTo(z[0] + ca * 3 - sa * 5.5, z[1] + sa * 3 + ca * 5.5); ctx.lineTo(z[0] + ca * 15, z[1] + sa * 15); ctx.lineTo(z[0] + ca * 3 + sa * 5.5, z[1] + sa * 3 - ca * 5.5); ctx.closePath(); ctx.fill(); }
      // --- plaques ventrales : de la gorge au premier tiers de la queue ---
      { const i0 = Math.round(iBassin * .45), lueur = clamp(.12 + resp * .1 + heat, 0, 1), k = .52;
        ctx.fillStyle = G.lin(ctx, px, py, p.kx, p.ky, [[0, mixc("#571d13", c.chaud, lueur * .45)], [.45, mixc(c.plaque, c.chaud, lueur * .8)], [1, mixc(c.plaque, "#ffc98a", clamp(lueur * 1.1, 0, 1))]]);
        ctx.beginPath(); ctx.moveTo(rb.d[i0][0], rb.d[i0][1]); for (let i = i0 + 1; i < n; i++) ctx.lineTo(rb.d[i][0], rb.d[i][1]);
        for (let i = n - 1; i >= i0; i--) { const kk = i === i0 ? 0 : k * ech[i][2]; ctx.lineTo(rb.d[i][0] + rb.nx[i] * kk, rb.d[i][1] + rb.ny[i] * kk); } ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(22,6,4,.6)"; ctx.lineWidth = 1; ctx.beginPath(); for (let i = i0 + 1; i < n; i++) { const kk = k * ech[i][2]; ctx.moveTo(rb.d[i][0], rb.d[i][1]); ctx.lineTo(rb.d[i][0] + rb.nx[i] * kk, rb.d[i][1] + rb.ny[i] * kk); } ctx.stroke();
        const ip = iCou + 1; G.glow(ctx, rb.d[ip][0] + rb.nx[ip] * 6, rb.d[ip][1] + rb.ny[ip] * 6, 30, P.braise, .1 + .07 * resp + .45 * heat);
        if (heat > .02) { const ig = n - 4; G.glow(ctx, rb.d[ig][0] + rb.nx[ig] * 4, rb.d[ig][1] + rb.ny[ig] * 4, 22, P.feu, heat * .6); } }
      // --- entaille au flanc ---
      if (w.blesse > .01) { const bx = px + cb * 36 - sb * 5, by = py + sb * 36 + cb * 5; ctx.save(); ctx.translate(bx, by); ctx.rotate(p.ba + .9); ctx.globalAlpha = w.blesse;
        ctx.fillStyle = "#120504"; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(0, -4.5, 11, -1); ctx.quadraticCurveTo(1, 3.5, -10, 0); ctx.fill();
        ctx.strokeStyle = P.sang; ctx.lineWidth = 1.3; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-7, .2); ctx.quadraticCurveTo(1, -1.6, 8, -.6); ctx.stroke(); ctx.restore();
        ctx.strokeStyle = rgba(P.sang, .8 * w.blesse); ctx.lineWidth = 1.2; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(bx - 1, by + 2); ctx.lineTo(bx - 2, by + 13); ctx.moveTo(bx + 4, by + 3); ctx.lineTo(bx + 3.4, by + 8); ctx.stroke(); }
      // --- tête ---
      const cligne = bell(clamp(((t * .21 + ph) % 1) / .035, 0, 1), .5), oeil = clamp(1 - calme * 1.2, 0, 1) * (1 - cligne) * (1 - w.touche * .6);
      const jaw = clamp(p.jaw + Math.max(0, resp) * .03 * eveil, 0, 1);
      tete(ctx, p.kx, p.ky, p.ka, jaw, oeil, w.souffle);
      // --- plan proche : pattes, aile ---
      patteAr(ctx, hjx, hjy, p.gx, p.gy, c.pres, c.os);
      patteAv(ctx, jx, jy, p.fx, p.fy, c.pres, c.os);
      aile(ctx, rx, ry, p.w1, p.w2, p.w3, p.ws, ax, ay, c.pres, c.aile, c.os);
      // --- fumée aux naseaux ---
      { const ck = Math.cos(p.ka), sk = Math.sin(p.ka), nx = p.kx + ck * 38 + sk * 5, ny = p.ky + sk * 38 - ck * 5, f = (1 - w.souffle) * (1 - w.chute * .7);
        if (f > .02) for (let i = 0; i < 4; i++) { const u = (t * lerp(.3, .16, w.dort) + i / 4 + ph) % 1, a = Math.sin(u * Math.PI) * .2 * f;
          G.glow(ctx, nx + u * 5 + Math.sin(u * 5 + i * 2 + t * .7) * (1 + u * 3.5), ny - u * 24, 2.2 + u * 6.5, "#a39a92", a, "source-over"); } }
      ctx.restore(); }
    return { draw, larg: 232, haut: 188, sous: 8, ech: .43, points: { tete: [56, -144], coeur: [20, -68], bouche: [84, -132] }, pointsSouffle: { tete: [80, -98], coeur: [22, -52], bouche: [104, -76] } }; });
})();
