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
    const REPOS = { px: -32, py: -44, ba: -.5, kx: 44, ky: -140, ka: .1, n1: -1.95, n2: -.35, jaw: .04, fx: 30, fy: 0, gx: -18, gy: 0, q0: 2.3, qc: 2.3, qo: 1, ql: .93,
      w1: -2.2, w2: -1.55, w3: 2.3, ws: .22, v1: -2.02, v2: -1.42, v3: 2.2, vs: .2 };
    const POSES = {
      dort: { px: -18, py: -21, ba: -.08, kx: 64, ky: -13, ka: 0, n1: -1.2, n2: 1.0, jaw: 0, fx: 86, gx: 6, q0: 2.9, qc: 3.4, qo: .15, ql: .7, w1: -2.5, w2: -2.9, w3: 2.45, ws: .42, v1: -2.35, v2: -2.75, v3: 2.35, vs: .4 },
      blesse: { px: -34, py: -40, ba: -.38, kx: 50, ky: -116, ka: .28, n1: -1.7, jaw: .12, w1: -2.9, w2: 2.2, w3: 2.6, ws: .25, qo: .5 },
      elan: { px: -38, py: -43, ba: -.56, kx: 18, ky: -150, ka: -.25, n1: -2.2, jaw: .35, q0: 2.1, ws: .3, vs: .28 },
      frappe: { px: -30, py: -40, ba: -.3, kx: 76, ky: -60, ka: .35, n1: -1.0, n2: .4, jaw: .6, q0: 3.0, qc: 2.6, ql: .82, w3: 2.7, ws: .3, v3: 2.6, vs: .28 },
      souffle: { px: -34, py: -38, ba: -.3, kx: 68, ky: -92, ka: -.15, n1: -1.2, n2: -.1, jaw: 1, q0: 2.75, qc: 2.4, ql: .82, w1: -2.3, w2: -1.9, w3: 2.9, ws: .32, v1: -2.15, v2: -1.75, v3: 2.8, vs: .3 },
      charge: { px: -32, py: -46, ba: -.92, kx: 26, ky: -138, ka: .5, n1: -2.0, jaw: .3, fx: 26, fy: -52, q0: 2.2, w1: -2.35, w2: -1.95, w3: 3.3, ws: .45, v1: -2.15, v2: -1.8, v3: 3.1, vs: .4 },
      recule: { px: -44, py: -36, ba: -.35, kx: 14, ky: -112, ka: .22, n1: -2.3, jaw: .25, fx: 22, gx: -30, w1: -2.9, w2: -2.1, w3: 5.18, ws: .65, v1: -2.3, v2: -1.8, v3: 3.3, vs: .4 },
      touche: { px: -36, py: -42, ba: -.58, kx: 28, ky: -146, ka: -.4, n1: -2.2, jaw: .3 },
      chute: { px: -24, py: -20, ba: -.06, kx: 70, ky: -12, ka: .1, n1: -.7, n2: .8, jaw: .15, fx: 88, gx: 0, q0: 2.9, qc: 1.6, qo: 0, ql: .72, w1: -2.95, w2: 2.9, w3: 2.9, ws: .3, v1: -2.6, v2: -2.6, v3: 2.6, vs: .3 },
    };

    function corne(ctx, x, y, rot, len) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath(); ctx.moveTo(4, 3.5); ctx.quadraticCurveTo(-len * .45, -1, -len, -11); ctx.quadraticCurveTo(-len * .5, -13, 5, -4.5); ctx.closePath(); ctx.fill(); ctx.restore(); }

    function pied(ctx, x, y, rot, col, colOs, s) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-5, -2); ctx.quadraticCurveTo(4, -3, 10, 2); ctx.lineTo(15, 7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 3; i++) { const tx = 1 + i * 5.5; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(tx + 2, 4.2, 4.6, 3, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = colOs; ctx.beginPath(); ctx.moveTo(tx + 4.5, 2.6); ctx.quadraticCurveTo(tx + 10.5, 2.6, tx + 11.5, 7); ctx.lineTo(tx + 5, 6.2); ctx.closePath(); ctx.fill(); }
      ctx.restore(); }
    function patteAv(ctx, jx, jy, fx, fy, col, colOs) { const lev = clamp(-fy / 40, 0, 1); let q = ik(jx, jy, fx - 5, fy - 7, 34, 34, 1); if (q[1] > -5) q = ik(jx, jy, fx - 5, fy - 7, 34, 34, -1);
      ctx.fillStyle = col; membre(ctx, jx, jy, q[0], q[1], 11.5, 7.5); membre(ctx, q[0], q[1], q[2], q[3], 7.5, 5); pied(ctx, q[2], q[3], lev * .8, col, colOs, 1); }
    function patteAr(ctx, hx, hy, gx, gy, col, colOs) { let q = ik(hx, hy, gx - 14, gy - 17, 31, 29, -1); if (q[1] > -5) q = ik(hx, hy, gx - 14, gy - 17, 31, 29, 1);
      ctx.fillStyle = col; membre(ctx, hx, hy, q[0], q[1], 19, 10.5); membre(ctx, q[0], q[1], q[2], q[3], 9.5, 5.2); membre(ctx, q[2], q[3], gx - 4, gy - 7, 5.2, 4.6); pied(ctx, gx - 4, gy - 7, 0, col, colOs, 1.05); }

    // une aile : racine (rx,ry), bras (a1,a2), éventail de quatre doigts à partir de a3, membrane rattachée au dos en (ax,ay)
    function aile(ctx, rx, ry, a1, a2, a3, es, ax, ay, col, colM, colOs) {
      const ex = rx + Math.cos(a1) * L1, ey = ry + Math.sin(a1) * L1, wx = Math.max(ex + Math.cos(a2) * L2, -108), wy = clamp(ey + Math.sin(a2) * L2, -170, -4), tp = [];
      for (let i = 0; i < 4; i++) { const a = a3 - i * es; tp.push([Math.max(wx + Math.cos(a) * DG[i], -113), clamp(wy + Math.sin(a) * DG[i], -177, -1.5)]); }
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
          x = Math.max(x + Math.cos(a) * l, -111 + r); y = Math.min(y + Math.sin(a) * l, 1 - r); q.push([x, y, r]); }
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

  // =====================================================================================
  // LE MORGHAL, le Veilleur d'écorce : mi-cervidé, mi-arbre mort
  // =====================================================================================
  S_.def("morghal", o => { const ph = rng((o && o.seed) == null ? 5 : o.seed + 23)() * 6;
    const c = { loin: "#12100e", corps: "#241f1a", pres: "#312a23", noeud: "#191512", bois: "#0e0c0b", boisLoin: "#080707", crane: "#8f8972", crane2: "#5d5849", mousse: "#2b3323", mousse2: "#1a1f16", pale: "#e4ebff" };
    const LT = 56, LA = 44, LV = 48, LC = 38, LJ = 36;
    // hx,hy : hanche ; tor : buste penché ; bo : voussure du dos ; hd : tête ; ax,ay / bx,by : mains (relatives aux épaules) ;
    // dg : doigts écartés ; fFx,fBx : sabots ; jar : hauteur des jarrets
    const REPOS = { hx: -4, hy: -78, tor: .24, bo: 9, hd: 0, ax: 4, ay: 78, bx: 14, by: 70, dg: .25, fFx: 10, fBx: -12, jar: 1 };
    const POSES = {
      phase2: { hy: -73, tor: .05, bo: 4, hd: -.22, ax: 28, ay: 56, bx: 36, by: 44, dg: 1, fFx: 16, fBx: -18 },
      elan: { hx: -9, tor: -.12, hd: -.15, ax: -30, ay: -40, bx: 18, by: 52, dg: 1 },
      frappe: { hx: 6, hy: -74, tor: .6, hd: .12, ax: 52, ay: 34, bx: -10, by: 60, dg: 1, fFx: 26 },
      charge: { hy: -76, tor: .48, bo: 12, hd: .7, ax: 8, ay: -44, bx: 22, by: -38, dg: 1 },
      garde: { hy: -74, tor: .34, bo: 14, hd: .4, ax: 12, ay: 8, bx: 14, by: 2, dg: 0, fFx: 4, fBx: -5 },
      touche: { hx: -11, tor: -.2, hd: -.4, ax: -14, ay: 66, bx: -4, by: 62, dg: .8 },
      genoux: { hy: -44, tor: .34, hd: .5, bo: 12, ax: 20, ay: 62, bx: 26, by: 58, fFx: 18, fBx: -8, dg: .6 },
      sol: { hx: -16, hy: -9, tor: 1.48, hd: -.9, bo: 3, ax: 30, ay: 16, bx: 22, by: 14, dg: .5, fFx: -44, fBx: -58, jar: .25 },
    };
    // un bois : merrain courbe et andouillers, tirés une fois pour toutes
    function ramure(r) { const br = [], m = []; let a = -2.9, x = 0, y = 0;
      for (let i = 0; i <= 7; i++) { m.push([x, y]); a += .2 + r.r(-.06, .06); const l = 7.6 - i * .35; x += Math.cos(a) * l; y += Math.sin(a) * l; }
      br.push([m, 4.4, .9]);
      for (let i = 1; i <= 6; i++) { const b = m[i], cote = i % 2 ? -1 : 1, a0 = Math.atan2(m[i + 1][1] - b[1], m[i + 1][0] - b[0]) + cote * r.r(.75, 1.15), l = r.r(11, 17) * (1 - i * .06);
        const e = [b[0] + Math.cos(a0) * l * .5, b[1] + Math.sin(a0) * l * .5], a1 = a0 - cote * .55, z = [e[0] + Math.cos(a1) * l * .55, e[1] + Math.sin(a1) * l * .55];
        br.push([[b, e, z], 2.9 - i * .2, .55]);
        if (i % 2 === 0 || i === 1) { const a2 = a0 + cote * .7; br.push([[e, [e[0] + Math.cos(a2) * l * .4, e[1] + Math.sin(a2) * l * .4]], 1.6, .5]); } }
      return br; }
    const BOIS = [ramure(rng(31)), ramure(rng(47))];

    function jambe(ctx, x0, y0, fx, jar, col) { const jx = fx - 9 * jar, jy = -3 - 21 * jar; let q = ik(x0, y0, jx, jy, LC, LJ, -1); if (q[1] > -4) q = ik(x0, y0, jx, jy, LC, LJ, 1);
      ctx.fillStyle = col; membre(ctx, x0, y0, q[0], q[1], 6.4, 4.2); membre(ctx, q[0], q[1], q[2], q[3], 4.2, 2.8); membre(ctx, q[2], q[3], fx, -3.5, 2.8, 2.3);
      ctx.beginPath(); ctx.arc(q[0], q[1], 4.8, 0, TAU); ctx.fill();
      ctx.fillStyle = c.bois; ctx.beginPath(); ctx.moveTo(fx - 2.8, -4.5); ctx.lineTo(fx + 2.4, -5); ctx.lineTo(fx + 6, 0); ctx.lineTo(fx - 3.2, 0); ctx.closePath(); ctx.fill(); }
    function bras(ctx, ep, q, col, dg) { ctx.fillStyle = col; membre(ctx, ep[0], ep[1], q[0], q[1], 4.8, 3.3); membre(ctx, q[0], q[1], q[2], q[3], 3.3, 2.3); ctx.beginPath(); ctx.arc(q[0], q[1], 4.1, 0, TAU); ctx.fill();
      const af = Math.atan2(q[3] - q[1], q[2] - q[0]), ec = .1 + .32 * dg, sg = Math.sin(af) > .3 ? -1 : 1, tp = []; ctx.strokeStyle = col; ctx.lineWidth = 1.9; ctx.beginPath();
      for (let i = 0; i < 4; i++) { const a = af + (i - 1.5) * ec, l = 9 + (i % 3) * 2.4, x1 = q[2] + Math.cos(a) * l, y1 = Math.min(q[3] + Math.sin(a) * l, -1); ctx.moveTo(q[2], q[3]); ctx.lineTo(x1, y1); tp.push([x1, y1, a + sg * (.4 - dg * .15)]); } ctx.stroke();
      ctx.lineWidth = 1.05; ctx.beginPath(); for (const [x1, y1, a] of tp) { ctx.moveTo(x1, y1); ctx.lineTo(x1 + Math.cos(a) * 10, Math.min(y1 + Math.sin(a) * 10, -.5)); } ctx.stroke(); }
    function crane(ctx) { // museau vers +x, origine au sommet du cou
      ctx.fillStyle = c.crane2; ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(9, 6.6); ctx.lineTo(24, 5.8); ctx.lineTo(26.5, 4.2); ctx.lineTo(13, 4.4); ctx.lineTo(3, 3.6); ctx.closePath(); ctx.fill(); // mandibule
      ctx.fillStyle = c.crane; ctx.beginPath(); ctx.moveTo(-6, -2.5); ctx.quadraticCurveTo(-4, -8, 3, -7.6); ctx.lineTo(9.5, -6); ctx.quadraticCurveTo(18, -4.6, 27, -1.6); ctx.lineTo(29, 1.4); ctx.lineTo(26, 3); ctx.lineTo(14, 3.6); ctx.lineTo(8, 5); ctx.lineTo(1.5, 4); ctx.quadraticCurveTo(-5, 3, -6, -2.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#0a0908"; ctx.beginPath(); ctx.ellipse(7.5, -2.2, 3.1, 2.7, .2, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(19.5, -1.6); ctx.lineTo(27.2, -.2); ctx.lineTo(21, 1.3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(10,9,8,.55)"; ctx.lineWidth = .7; ctx.beginPath(); for (let i = 0; i < 5; i++) { ctx.moveTo(11.5 + i * 2.6, 3.9 - i * .12); ctx.lineTo(11.5 + i * 2.6, 2.2); } ctx.moveTo(-2, -6.4); ctx.lineTo(1, -1.5); ctx.stroke(); }

    function draw(ctx, t, st) { st = st || {}; const A = st.att || 0, ch = clamp(st.chute || 0, 0, 1), f2 = smooth(st.phase2 || 0);
      const w = { phase2: f2, garde: smooth(st.garde || 0), charge: smooth(st.charge || 0), touche: bell(st.touche || 0, .25), elan: A > 0 && A < .42 ? bell(A / .42, .6) : 0, frappe: A >= .3 ? bell((A - .3) / .7, .22) : 0,
        genoux: ch < .5 ? smooth(ch / .5) : 1 - smooth((ch - .5) / .5), sol: smooth((ch - .5) / .5) };
      const p = melange(REPOS, POSES, w), vie = 1 - smooth(ch), vent = Math.sin(t * .55 + ph), vent2 = Math.sin(t * .9 + ph * 2), trem = ((st.charge || 0) > .5 ? Math.sin(t * 40) * .5 : 0) + f2 * Math.sin(t * 23) * .15;
      p.tor += vent * .022 * vie; p.hx += vent * 1.3 * vie + trem; p.hy += Math.sin(t * .8 + ph) * .6 * vie; p.hd += Math.sin(t * .41 + ph) * .045 * vie; p.ax += vent * 1.6 * vie; p.bx += vent * 1.6 * vie; p.ay += vent2 * 1.2 * vie; p.by -= vent2 * 1.1 * vie;
      ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round";
      const hx = p.hx, hy = p.hy, sT = Math.sin(p.tor), cT = Math.cos(p.tor), ex = hx + sT * LT, ey = hy - cT * LT, mx = (hx + ex) / 2 - cT * p.bo * 2, my = (hy + ey) / 2 - sT * p.bo * 2;
      const ech = [[hx - sT * 9, hy + cT * 9, 5.5]];
      for (let i = 0; i <= 8; i++) { const u = i / 8, v = 1 - u, r = u < .3 ? lerp(7.5, 5.6, u / .3) : u < .72 ? lerp(5.6, 10.5, smooth((u - .3) / .42)) : lerp(10.5, 8, (u - .72) / .28); ech.push([v * v * hx + 2 * v * u * mx + u * u * ex, v * v * hy + 2 * v * u * my + u * u * ey, r]); }
      const aN = p.tor + .45 + p.hd * .5, nx = ex + Math.sin(aN) * 13, ny = Math.min(ey - Math.cos(aN) * 13, -7), aH = .4 + p.tor * .5 + p.hd, cH = Math.cos(aH), sH = Math.sin(aH);
      ech.push([(ex + nx) / 2, (ey + ny) / 2, 5.2]); ech.push([nx, ny, 3.8]);
      const rb = ruban(ech), monde = (lx, ly) => [nx + lx * cH - ly * sH, ny + lx * sH + ly * cH];
      const epF = [ex + cT, ey + sT + 3], epB = [ex + cT * 5, ey + sT * 5 + 2], mF = [epF[0] + p.ax, Math.min(epF[1] + p.ay, -2)], mB = [epB[0] + p.bx, Math.min(epB[1] + p.by, -2)];
      const cF = ik(epF[0], epF[1], mF[0], mF[1], LA, LV, 1), cB = ik(epB[0], epB[1], mB[0], mB[1], LA, LV, 1);
      // ce qui pend : mousses et lambeaux, balancés par le vent
      const pend = (x, y, l, k) => { const sw = (vent2 * 1.4 + Math.sin(t * 1.3 + k)) * l * .09 * vie; ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sw * .3, y + l * .6, x + sw, Math.min(y + l, -.5)); };
      const boisDessin = (k, bx, by, rot, col) => { ctx.save(); ctx.translate(nx, ny); ctx.rotate(aH); ctx.translate(bx, by); ctx.rotate(rot); for (const b of BOIS[k]) G.trait(ctx, b[0], b[1], b[2], col); ctx.restore(); };

      // --- plan lointain ---
      boisDessin(1, 4, -6.5, .34, c.boisLoin);
      bras(ctx, epB, cB, c.loin, p.dg);
      ctx.strokeStyle = c.mousse2; ctx.lineWidth = 1.3; ctx.beginPath(); pend(cB[0], cB[1], 15, 1); pend(lerp(cB[0], cB[2], .5), lerp(cB[1], cB[3], .5), 11, 2); ctx.stroke();
      jambe(ctx, hx + 3, hy, p.fBx, p.jar, c.loin);
      // --- tronc : chicots du dos, buste décharné, côtes, gerçures ---
      ctx.fillStyle = c.corps;
      [[9, 17, -.5], [7, 11, -.2], [10, 13, .35]].forEach(([i, l, da]) => { const a = Math.atan2(rb.ny[i], rb.nx[i]) + da, x0 = rb.g[i][0] - rb.nx[i] * 3, y0 = rb.g[i][1] - rb.ny[i] * 3, x1 = x0 + Math.cos(a) * (l + 3), y1 = y0 + Math.sin(a) * (l + 3);
        membre(ctx, x0, y0, x1, y1, 2.8, .8); membre(ctx, lerp(x0, x1, .55), lerp(y0, y1, .55), lerp(x0, x1, .55) + Math.cos(a - .9) * l * .45, lerp(y0, y1, .55) + Math.sin(a - .9) * l * .45, 1.3, .4); });
      remplirRuban(ctx, rb, ech);
      ctx.strokeStyle = "rgba(6,5,4,.45)"; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 6; i <= 8; i++) { ctx.moveTo(rb.d[i][0], rb.d[i][1]); ctx.quadraticCurveTo(ech[i][0] - rb.nx[i] * 2, ech[i][1] + 3, ech[i][0] + rb.nx[i] * ech[i][2] * .3, ech[i][1] + 5); }
      for (let i = 1; i <= 9; i++) { const k = (i % 2 ? .3 : -.2) * ech[i][2], x = ech[i][0] + rb.nx[i] * k, y = ech[i][1] + rb.ny[i] * k; i === 1 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
      // pagne de lambeaux
      ctx.fillStyle = c.noeud; ctx.beginPath(); [22, 30, 17, 27, 14].forEach((l, i) => { const x = hx - 7.5 + i * 3.8, y = hy + 3, sw = (vent2 * 1.4 + Math.sin(t * 1.2 + i)) * l * .08 * vie; ctx.moveTo(x - 2.6, y); ctx.lineTo(x + 2.6, y); ctx.lineTo(x + sw, Math.min(y + l, -.5)); }); ctx.fill();
      ctx.strokeStyle = c.mousse; ctx.lineWidth = 1.4; ctx.beginPath(); pend(rb.g[8][0], rb.g[8][1], 20, 3); pend(rb.g[6][0], rb.g[6][1], 14, 4); pend(rb.g[9][0] + 2, rb.g[9][1], 11, 5); ctx.stroke();
      jambe(ctx, hx - 1, hy, p.fFx, p.jar, c.pres);
      // --- tête : bois proche, crâne de cerf ---
      boisDessin(0, 1, -6, 0, c.bois);
      ctx.save(); ctx.translate(nx, ny); ctx.rotate(aH); ctx.scale(1.18, 1.18); crane(ctx); ctx.restore();
      { const m1 = BOIS[0][3][0][2], m2 = BOIS[0][6][0][2], q1 = monde(1 + m1[0], -6 + m1[1]), q2 = monde(1 + m2[0], -6 + m2[1]); ctx.strokeStyle = c.mousse; ctx.lineWidth = 1.2; ctx.beginPath(); pend(q1[0], q1[1], 13, 6); pend(q2[0], q2[1], 9, 7); ctx.stroke(); }
      // --- bras proche ---
      bras(ctx, epF, cF, c.pres, p.dg);
      ctx.strokeStyle = c.mousse; ctx.lineWidth = 1.4; ctx.beginPath(); pend(cF[0], cF[1], 18, 8); pend(lerp(cF[0], cF[2], .4), lerp(cF[1], cF[3], .4), 12, 9); pend(lerp(cF[0], cF[2], .75), lerp(cF[1], cF[3], .75), 8, 10); pend(lerp(epF[0], cF[0], .5), lerp(epF[1], cF[1], .5), 10, 11); ctx.stroke();
      // --- seconde phase : l'écorce se fend, une lueur pâle en sort ---
      if (f2 > .01) { const puls = .8 + .2 * Math.sin(t * 3.1 + ph), pt = (i, k) => [ech[i][0] + rb.nx[i] * ech[i][2] * k, ech[i][1] + rb.ny[i] * ech[i][2] * k];
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.beginPath();
        for (let i = 2; i <= 9; i++) { const q = pt(i, i % 2 ? .8 : .4); i === 2 ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1]); }
        [[4, -.25], [6, -.5], [8, -.35]].forEach(([i, k2]) => { const a = pt(i, .4), b = pt(i, (.4 + k2) / 2), z = pt(i, k2); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0] + 1, b[1] + 3); ctx.lineTo(z[0], z[1] + 5); });
        ctx.moveTo(epF[0], epF[1] + 2); ctx.lineTo(lerp(epF[0], cF[0], .4) + 1.3, lerp(epF[1], cF[1], .4)); ctx.lineTo(lerp(epF[0], cF[0], .8) - 1, lerp(epF[1], cF[1], .8));
        ctx.strokeStyle = rgba(P.nuit, .3 * f2 * puls); ctx.lineWidth = 5.5; ctx.stroke(); ctx.strokeStyle = rgba(P.nuit, .75 * f2); ctx.lineWidth = 2.1; ctx.stroke(); ctx.strokeStyle = rgba("#ffffff", .9 * f2); ctx.lineWidth = .8; ctx.stroke(); ctx.restore();
        const g1 = pt(8, .9), g2 = pt(5, .7); G.glow(ctx, g1[0], g1[1], 30, P.nuit, .34 * f2 * puls); G.glow(ctx, g2[0], g2[1], 20, P.nuit, .26 * f2 * puls); }
      // --- yeux pâles, au fond de l'orbite ---
      { const q = monde(8.85, -2.6), a = (.62 + .38 * f2) * (1 - smooth(ch) * .85) * (.9 + .1 * Math.sin(t * 1.7 + ph)); G.glow(ctx, q[0], q[1], 5 + 4.5 * f2, mixc(c.pale, P.nuit, f2 * .45), a); ctx.fillStyle = rgba("#ffffff", a); ctx.beginPath(); ctx.arc(q[0], q[1], .9 + .5 * f2, 0, TAU); ctx.fill(); }
      ctx.restore(); }
    return { draw, larg: 220, haut: 200, sous: 6, ech: .375, points: { tete: [29, -139], coeur: [8, -116], bouche: [46, -127] } }; });

  // =====================================================================================
  // LA CHIMÈRE DE FAILLE : un fauve mal assemblé, venu d'ailleurs
  // =====================================================================================
  S_.def("chimere", o => { const r0 = rng((o && o.seed) == null ? 7 : o.seed + 41), ph = r0() * 6, MH = []; for (let i = 0; i < 17; i++) MH.push(r0());
    const c = { loin: "#17110d", fauve: "#3a2a1c", arriere: "#28231f", pres: "#42301f", presAr: "#2f2924", criniere: "#1c140f", os: "#6a5c48", osLoin: "#3a3128", sabot: "#0e0c0b", serpent: "#222a22", ventre: "#3b4a36", vert: "#8dff9a" };
    const LB = 62, NS = 11;
    // px,py : hanches ; ba : angle du tronc ; kx,ky,ka : tête ; fx,fy / gx : pattes ; s0,sc : queue-serpent (cap, courbure) ; cr : crinière hérissée
    const REPOS = { px: -32, py: -56, ba: -.12, kx: 50, ky: -72, ka: .2, jaw: .12, fx: 32, fy: 0, gx: -36, s0: -2.2, sc: 2.3, cr: 0 };
    const POSES = {
      elan: { px: -40, py: -48, ba: .05, kx: 40, ky: -58, ka: .1, jaw: .3, s0: -2.5, sc: 1.6, cr: .5 },
      frappe: { px: -12, py: -60, ba: -.46, kx: 72, ky: -82, ka: .3, jaw: .9, fx: 66, fy: -32, gx: -26, s0: -1.35, sc: 1.2, cr: .7 },
      charge: { px: -38, py: -46, ba: .1, kx: 44, ky: -52, ka: .05, jaw: .5, fx: 36, gx: -38, s0: -1.9, sc: 1.5, cr: 1 },
      garde: { px: -40, py: -50, ba: -.02, kx: 38, ky: -62, ka: .45, jaw: 0, fx: 26, gx: -42, s0: -1.6, sc: 2.2, cr: .6 },
      touche: { px: -40, py: -56, ba: -.22, kx: 36, ky: -84, ka: -.35, jaw: .5, s0: -2.6, sc: 1.4, cr: .4 },
      chute: { px: -30, py: -19, ba: 0, kx: 46, ky: -11, ka: .1, jaw: .25, fx: 62, gx: -6, s0: -3.0, sc: -.5, cr: 0 },
    };
    function patteAv(ctx, jx, jy, fx, fy, col, colOs) { let q = ik(jx, jy, fx - 3, fy - 6, 30, 30, 1); if (q[1] > -5) q = ik(jx, jy, fx - 3, fy - 6, 30, 30, -1);
      ctx.fillStyle = col; membre(ctx, jx, jy, q[0], q[1], 11, 7.6); membre(ctx, q[0], q[1], q[2], q[3], 7.6, 6);
      ctx.save(); ctx.translate(q[2], q[3]); ctx.rotate(clamp(-fy / 30, 0, 1) * .9); ctx.beginPath(); ctx.moveTo(-6, -3); ctx.quadraticCurveTo(4, -6, 11, -1); ctx.quadraticCurveTo(15, 3, 13, 6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = colOs; ctx.beginPath(); for (let i = 0; i < 3; i++) { const x = 5 + i * 3.6; ctx.moveTo(x, 2.6); ctx.quadraticCurveTo(x + 5, 3, x + 5.6, 7.6); ctx.lineTo(x + 1, 5.6); ctx.closePath(); } ctx.fill(); ctx.restore(); return q; }
    function patteAr(ctx, hx, hy, gx, col) { let q = ik(hx, hy, gx - 10, -20, 27, 26, -1); if (q[1] > -5) q = ik(hx, hy, gx - 10, -20, 27, 26, 1);
      ctx.fillStyle = col; membre(ctx, hx, hy, q[0], q[1], 14, 7); membre(ctx, q[0], q[1], q[2], q[3], 6.6, 3.6); membre(ctx, q[2], q[3], gx, -4, 3.6, 3.2);
      ctx.fillStyle = c.sabot; ctx.beginPath(); ctx.moveTo(gx - 3.6, -5); ctx.lineTo(gx + 3, -5.6); ctx.lineTo(gx + 7, 0); ctx.lineTo(gx - 4, 0); ctx.closePath(); ctx.fill(); return q; }
    function moignon(ctx, x, y, a, col, colM) { ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = colM; ctx.beginPath(); ctx.moveTo(1, 2); ctx.lineTo(-5, -24); ctx.lineTo(-12, -16); ctx.lineTo(-9, -12); ctx.lineTo(-18, -9); ctx.lineTo(-10, -4); ctx.lineTo(-14, 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = col; membre(ctx, 0, 3, -3, -14, 3.6, 2.2); membre(ctx, -3, -14, -5.5, -26, 2.2, .6); membre(ctx, -3, -14, -16, -19, 1.6, .5); membre(ctx, -2, -6, -20, -9, 1.5, .5); ctx.restore(); }
    function corne(ctx, x, y) { ctx.beginPath(); ctx.moveTo(x + 7, y + .5); ctx.quadraticCurveTo(x + 7, y - 17, x - 13, y - 25); ctx.quadraticCurveTo(x - 1, y - 14, x, y); ctx.closePath(); ctx.fill(); }
    function tete(ctx, hx, hy, ha, jaw, vie) { ctx.save(); ctx.translate(hx, hy); ctx.rotate(ha); const jo = jaw * .7;
      ctx.fillStyle = c.osLoin; corne(ctx, 8, -11);
      if (jaw > .08) { ctx.fillStyle = "#1c0707"; ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(28, 3.5); ctx.lineTo(2 + Math.cos(jo) * 22, 6 + Math.sin(jo) * 22); ctx.closePath(); ctx.fill(); }
      ctx.save(); ctx.translate(2, 6); ctx.rotate(jo);
      ctx.fillStyle = "#b9ad92"; ctx.beginPath(); ctx.moveTo(17, .5); ctx.lineTo(18.6, -5); ctx.lineTo(20.2, .5); ctx.moveTo(12, 0); ctx.lineTo(13, -2.6); ctx.lineTo(14.2, 0); ctx.fill();
      ctx.fillStyle = c.fauve; ctx.beginPath(); ctx.moveTo(-6, -1); ctx.lineTo(-4, 6.5); ctx.quadraticCurveTo(10, 9, 20, 5); ctx.lineTo(23.5, 1); ctx.lineTo(19, .4); ctx.lineTo(4, -.6); ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.fillStyle = c.pres; ctx.beginPath(); ctx.moveTo(-8, 8); ctx.lineTo(-8, -8); ctx.quadraticCurveTo(2, -15, 12, -11); ctx.lineTo(19.5, -7); ctx.quadraticCurveTo(27, -6.5, 30, -2.5); ctx.lineTo(30.6, 2); ctx.lineTo(27, 4.2); ctx.lineTo(12, 5.6); ctx.lineTo(2, 7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#b9ad92"; ctx.beginPath(); ctx.moveTo(23.4, 4.2); ctx.lineTo(25, 11); ctx.lineTo(26.8, 4); ctx.moveTo(18, 4.9); ctx.lineTo(19, 8); ctx.lineTo(20.4, 4.7); ctx.moveTo(13.4, 5.4); ctx.lineTo(14.2, 7.8); ctx.lineTo(15.4, 5.2); ctx.fill();
      ctx.fillStyle = c.criniere; ctx.beginPath(); ctx.moveTo(9, -11.6); ctx.lineTo(20, -7); ctx.lineTo(16.5, -4.6); ctx.lineTo(9, -6.4); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.ellipse(29.4, -1, 1.8, 1.9, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = c.pres; ctx.beginPath(); ctx.moveTo(-5, -9); ctx.quadraticCurveTo(-9, -18, -3, -17); ctx.quadraticCurveTo(1, -14, 1, -11); ctx.closePath(); ctx.fill(); // oreille
      ctx.fillStyle = c.os; corne(ctx, 3, -12);
      G.glow(ctx, 14.6, -5.6, 7, P.nuit, .85 * vie); ctx.fillStyle = rgba("#efeaff", vie); ctx.beginPath(); ctx.ellipse(14.6, -5.6, 2.2, 1 * vie + .1, .3, 0, TAU); ctx.fill();
      ctx.restore(); }

    function draw(ctx, t, st) { st = st || {}; const A = st.att || 0;
      const w = { garde: smooth(st.garde || 0), charge: smooth(st.charge || 0), touche: bell(st.touche || 0, .25), chute: smooth(st.chute || 0), elan: A > 0 && A < .42 ? bell(A / .42, .6) : 0, frappe: A >= .3 ? bell((A - .3) / .7, .22) : 0 };
      const p = melange(REPOS, POSES, w), vie = 1 - w.chute, resp = Math.sin(t * 1.5 + ph) * vie, trem = (st.charge || 0) > .5 ? Math.sin(t * 44) * .5 : 0;
      p.py -= resp * .7; p.kx += Math.sin(t * .7 + ph) * 1.6 * vie + trem; p.ky += Math.sin(t * 1.1 + ph) * 1.1 * vie - resp * .5; p.ka += Math.sin(t * .6 + ph * 2) * .04 * vie; p.jaw += Math.max(0, resp) * .05;
      ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round";
      const px = p.px, py = p.py, cb = Math.cos(p.ba), sb = Math.sin(p.ba), sx = px + cb * LB, sy = py + sb * LB;
      // échine : croupe, tronc (taille creusée, poitrail massif), encolure
      const ech = [[px - cb * 13, py - sb * 13 + 2, 11]];
      for (let i = 0; i <= 6; i++) { const u = i / 6, arc = Math.sin(u * Math.PI) * 3; ech.push([px + cb * LB * u + sb * arc, py + sb * LB * u - cb * arc, (17 - 6 * Math.sin(u * Math.PI) * (1 - u * .6) + 4 * u * u) * (1 + resp * .025)]); }
      for (let i = 1; i <= 4; i++) { const u = i / 4; ech.push([lerp(sx, p.kx, u) + Math.sin(u * Math.PI) * 2, lerp(sy, p.ky, u) - Math.sin(u * Math.PI) * 4, lerp(21, 12, u)]); }
      const rb = ruban(ech), n = rb.n, pt = (i, k) => [ech[i][0] + rb.nx[i] * ech[i][2] * k, ech[i][1] + rb.ny[i] * ech[i][2] * k];
      const jx = sx + 2, jy = sy + 8, hjx = px + 4, hjy = py + 6, sw = Math.sin(t * 1.9 + ph) * .05 * vie;
      // --- plan lointain ---
      moignon(ctx, sx - 4, sy - 17, -.05 + sw, c.loin, "#120d0a");
      patteAr(ctx, hjx + 7, hjy - 1, p.gx + 14, c.loin); patteAv(ctx, jx + 6, jy - 1, p.fx + 12, p.fy * 1.15, c.loin, c.osLoin);
      // --- crête dorsale, puis le corps : arrière-train d'une autre bête, avant-train de fauve, couture en dents de scie ---
      ctx.fillStyle = c.criniere; ctx.beginPath(); for (let i = 1; i <= 7; i++) { const h = 4 + (i % 2) * 2.5 + i * .5, gx = rb.g[i][0], gy = rb.g[i][1], nx = rb.nx[i], ny = rb.ny[i]; ctx.moveTo(gx + ny * 3.5 - nx * 2, gy - nx * 3.5 - ny * 2); ctx.lineTo(gx + nx * h + ny * h * .7, gy + ny * h - nx * h * .7); ctx.lineTo(gx - ny * 3.5 - nx * 2, gy + nx * 3.5 - ny * 2); } ctx.fill();
      ctx.fillStyle = c.arriere; remplirRuban(ctx, rb, ech);
      { const i0 = 4; ctx.fillStyle = c.fauve; ctx.beginPath(); ctx.moveTo(rb.g[i0][0], rb.g[i0][1]); for (let i = i0 + 1; i < n; i++) ctx.lineTo(rb.g[i][0], rb.g[i][1]); for (let i = n - 1; i >= i0; i--) ctx.lineTo(rb.d[i][0], rb.d[i][1]);
        for (let j = 1; j < 6; j++) { const q = pt(i0, -1 + j / 3); ctx.lineTo(q[0] + (j % 2 ? -5 : 2) * cb, q[1] + (j % 2 ? -5 : 2) * sb); } ctx.closePath(); ctx.fill(); }
      // --- pattes proches : sabots derrière, griffes devant ---
      const qr = patteAr(ctx, hjx, hjy, p.gx, c.presAr), qv = patteAv(ctx, jx, jy, p.fx, p.fy, c.pres, c.os);
      // --- crinière hérissée, tête cornue ---
      { const mx = lerp(sx, p.kx, .5) - 2, my = lerp(sy, p.ky, .5) - 3, nb = 16; ctx.fillStyle = c.criniere; ctx.beginPath();
        for (let i = 0; i <= nb; i++) { const u = i / nb, a = 2.2 + u * 5, a0 = a - 2.5 / nb, rr = (19 + 8 * MH[i] + 7 * Math.sin(u * Math.PI)) * (1 + .32 * p.cr) + Math.sin(t * 2.3 + i * 1.7) * .8 * vie;
          ctx.lineTo(mx + Math.cos(a0) * 15, my + Math.sin(a0) * 13); ctx.lineTo(mx + Math.cos(a) * rr * 1.05, my + Math.sin(a) * rr * .94); } ctx.closePath(); ctx.fill(); }
      tete(ctx, p.kx, p.ky, p.ka, clamp(p.jaw, 0, 1), clamp(1 - w.chute * 1.1, 0, 1));
      moignon(ctx, sx - 12, sy - 16, -.3 - sw, c.presAr, "#211a15");
      // --- queue-serpent : dressée au-dessus du dos, la tête siffle ---
      { const sn = [[px - cb * 9, py - sb * 9 - 8, 6.2]]; let a = p.s0, x = sn[0][0], y = sn[0][1];
        for (let i = 1; i <= NS; i++) { const u = i / NS; a = p.s0 + p.sc * u + Math.sin(t * 1.5 + ph - i * .55) * .13 * u * vie; x = Math.max(x + Math.cos(a) * 7.3, -102); y = clamp(y + Math.sin(a) * 7.3, -122, -3.5); sn.push([x, y, 5.6 - 2.3 * u]); }
        const rs = ruban(sn); ctx.fillStyle = c.serpent; remplirRuban(ctx, rs, sn);
        ctx.fillStyle = c.ventre; ctx.beginPath(); ctx.moveTo(rs.d[2][0], rs.d[2][1]); for (let i = 3; i <= NS; i++) ctx.lineTo(rs.d[i][0], rs.d[i][1]); for (let i = NS; i >= 2; i--) ctx.lineTo(rs.d[i][0] + rs.nx[i] * sn[i][2] * .55, rs.d[i][1] + rs.ny[i] * sn[i][2] * .55); ctx.closePath(); ctx.fill();
        const siffle = vie * (.35 + .25 * Math.sin(t * 5 + ph) + w.frappe * .5 + w.charge * .3), lang = Math.max(0, Math.sin(t * 7 + ph)) * vie;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.fillStyle = c.serpent; ctx.beginPath(); ctx.ellipse(-3, 0, 7.5, 6.2, 0, 0, TAU); ctx.fill(); // coiffe
        ctx.strokeStyle = P.sang; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(8, 1.5); ctx.lineTo(15 + lang * 5, 2); ctx.lineTo(18 + lang * 6, .6); ctx.moveTo(15 + lang * 5, 2); ctx.lineTo(18 + lang * 6, 3.6); ctx.stroke();
        ctx.save(); ctx.rotate(siffle * .7); ctx.fillStyle = c.ventre; ctx.beginPath(); ctx.moveTo(-1, .6); ctx.lineTo(12, 1.2); ctx.lineTo(11, 3.2); ctx.lineTo(-2, 4); ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.fillStyle = "#d8d2bd"; ctx.beginPath(); ctx.moveTo(10.2, -.4); ctx.lineTo(11, 4.4); ctx.lineTo(12.2, -.4); ctx.moveTo(7, -.2); ctx.lineTo(7.6, 2.6); ctx.lineTo(8.6, -.2); ctx.fill();
        ctx.fillStyle = c.serpent; ctx.beginPath(); ctx.moveTo(-3, -4.6); ctx.quadraticCurveTo(6, -6.6, 14, -2.4); ctx.lineTo(15.2, -.5); ctx.lineTo(3, .3); ctx.lineTo(-3, 1); ctx.closePath(); ctx.fill();
        G.glow(ctx, 7.6, -3, 5.5, c.vert, .9 * vie); ctx.fillStyle = rgba("#eaffea", vie); ctx.beginPath(); ctx.arc(7.6, -3, .9, 0, TAU); ctx.fill(); ctx.restore(); }
      // --- veines de lumière violette, sous la peau ---
      { const iv = clamp(.5 + .3 * Math.sin(t * 2.6 + ph) + w.charge * .5 + w.frappe * .3, 0, 1.2) * (1 - w.chute * .75), v1 = [[2, .2], [3, -.1], [4, .15], [5, -.2], [6, .05], [7, -.15], [8, .1], [9, .4], [10, .2]];
        const lig = l => l.forEach(([i, k], j) => { const q = pt(i, k); j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.beginPath(); lig(v1); lig([[4, .15], [4, .55], [5, .85]]); lig([[6, .05], [6, -.5], [7, -.85]]); lig([[2, .2], [1, -.3], [1, -.75]]); lig([[4, -.95], [4, -.4], [4, .15], [4, .95]]);
        ctx.moveTo(jx - 2, jy + 2); ctx.lineTo(lerp(jx, qv[0], .55) + 2, lerp(jy, qv[1], .55)); ctx.lineTo(qv[0] - 1, qv[1]); ctx.lineTo(lerp(qv[0], qv[2], .6) + 1.5, lerp(qv[1], qv[3], .6));
        ctx.moveTo(hjx, hjy); ctx.lineTo(lerp(hjx, qr[0], .5) - 2, lerp(hjy, qr[1], .5) + 2); ctx.lineTo(qr[0], qr[1]);
        ctx.strokeStyle = rgba(P.nuit, .3 * iv); ctx.lineWidth = 3.2; ctx.stroke(); ctx.strokeStyle = rgba("#b3a2ff", .5 * iv); ctx.lineWidth = .7; ctx.stroke(); ctx.restore();
        const q0 = pt(4, 0); G.glow(ctx, q0[0], q0[1], 17, P.nuit, .22 * iv);
        const up = (t * .45 + ph) % 1 * (v1.length - 1), ia = Math.floor(up), a = pt(v1[ia][0], v1[ia][1]), b = pt(v1[Math.min(ia + 1, v1.length - 1)][0], v1[Math.min(ia + 1, v1.length - 1)][1]); G.glow(ctx, lerp(a[0], b[0], up - ia), lerp(a[1], b[1], up - ia), 7, "#dcd3ff", .6 * iv); }
      ctx.restore(); }
    return { draw, larg: 220, haut: 138, sous: 6, ech: .3, points: { tete: [62, -76], coeur: [26, -58], bouche: [80, -66] } }; });
})();
