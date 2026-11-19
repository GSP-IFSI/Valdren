// Personnages : registre des sprites, et le pantin humain articulé (héros, soldats, renégats, Varek, rivaux, ogre).
//
// CONTRAT D'UN SPRITE
//   VG.sprites.def("nom", opts => ({ larg, haut, sous, ech, draw(ctx, t, st, lum) }))
//   draw dessine en unités locales : pieds en (0,0), y vers le bas (le haut du corps est en y négatif),
//   le personnage REGARDE VERS LA DROITE (le rendu le retourne pour les adversaires).
//   larg × haut : boîte englobante (centrée sur x=0, au-dessus des pieds), sous : marge sous les pieds.
//   ech : taille à l'écran, en fraction de la hauteur utile pour 100 unités locales (humain : 100 u, ech .34).
//   st : état d'animation, chaque valeur de 0 à 1 (absente = 0) :
//     att (attaque : élan puis frappe), garde, esq (esquive), touche (encaisse), chute (tombe / à terre),
//     charge (prépare un coup lourd, tremble), tir (arc : bande puis lâche), souffle (dragon), dort, joie.
//   Les teintes de base restent sombres et sourdes (le rendu ajoute lumière rasante, liseré clair et brume aux pieds) ;
//   les accents (acier, yeux, braise) peuvent être vifs.
VG.sprites = (() => {
  const G = VG.gfx, { clamp, lerp, smooth, bell, rgba, mixc, TAU, rng } = VG.u, P = G.PAL;
  const defs = {};
  const def = (nom, fab) => { defs[nom] = fab; };
  const creer = (nom, o = {}) => { const a = (defs[nom] || defs.soldat)(o); a.nom = nom; a.st = {}; a.sens = 1; a.flash = 0; a.alpha = 1; return a; };

  // ---------- outils ----------
  // membre effilé entre deux points
  function membre(ctx, x0, y0, x1, y1, w0, w1) { const a = Math.atan2(y1 - y0, x1 - x0), s = Math.sin(a), c = Math.cos(a);
    ctx.beginPath(); ctx.moveTo(x0 + s * w0, y0 - c * w0); ctx.lineTo(x1 + s * w1, y1 - c * w1); ctx.arc(x1, y1, w1, a - Math.PI / 2, a + Math.PI / 2); ctx.lineTo(x0 - s * w0, y0 + c * w0); ctx.arc(x0, y0, w0, a + Math.PI / 2, a - Math.PI / 2); ctx.closePath(); ctx.fill(); }
  // cinématique inverse à deux os : renvoie l'articulation
  function ik(ax, ay, bx, by, l1, l2, dir) { let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy); const m = l1 + l2 - .01;
    if (d > m) { dx *= m / d; dy *= m / d; d = m; bx = ax + dx; by = ay + dy; } d = Math.max(d, Math.abs(l1 - l2) + .01);
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)), mx = ax + dx * a / d, my = ay + dy * a / d;
    return [mx - dir * h * dy / d, my + dir * h * dx / d, bx, by]; }

  // ---------- armes (dessinées le long de l'axe +x, poignée en 0) ----------
  const acier = (ctx, x0, x1) => G.lin(ctx, x0, 0, x1, 0, [[0, "#8e9ba3"], [.5, "#dfe8ec"], [1, "#aab6bd"]]);
  const ARMES = {
    epee(ctx, c) { ctx.fillStyle = c.cuir; ctx.fillRect(-5, -1.3, 8, 2.6); ctx.beginPath(); ctx.arc(-5.5, 0, 2, 0, TAU); ctx.fill(); ctx.fillStyle = c.metal2; ctx.fillRect(2.4, -5, 1.8, 10);
      ctx.fillStyle = acier(ctx, 4, 44); ctx.beginPath(); ctx.moveTo(4, -2.1); ctx.lineTo(39, -1.5); ctx.lineTo(45, 0); ctx.lineTo(39, 1.5); ctx.lineTo(4, 2.1); ctx.closePath(); ctx.fill(); ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(4, -.3, 36, .6); },
    espadon(ctx, c) { ctx.fillStyle = c.cuir; ctx.fillRect(-9, -1.5, 13, 3); ctx.beginPath(); ctx.arc(-9.5, 0, 2.4, 0, TAU); ctx.fill(); ctx.fillStyle = c.metal2; ctx.fillRect(3, -7.5, 2.2, 15);
      ctx.fillStyle = acier(ctx, 5, 62); ctx.beginPath(); ctx.moveTo(5, -3.4); ctx.lineTo(54, -2.6); ctx.lineTo(63, 0); ctx.lineTo(54, 2.6); ctx.lineTo(5, 3.4); ctx.closePath(); ctx.fill(); ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.fillRect(5, -.5, 50, 1); },
    sabre(ctx, c) { ctx.fillStyle = c.cuir; ctx.fillRect(-5, -1.3, 8, 2.6); ctx.fillStyle = c.metal2; ctx.beginPath(); ctx.ellipse(3, 0, 1.4, 4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = acier(ctx, 4, 42); ctx.beginPath(); ctx.moveTo(4, -1.8); ctx.quadraticCurveTo(26, -3.6, 43, -11); ctx.quadraticCurveTo(30, 1.5, 4, 2); ctx.closePath(); ctx.fill(); },
    dague(ctx, c) { ctx.fillStyle = c.cuir; ctx.fillRect(-4, -1.2, 6, 2.4); ctx.fillStyle = c.metal2; ctx.fillRect(1.6, -3.4, 1.5, 6.8);
      ctx.fillStyle = acier(ctx, 3, 20); ctx.beginPath(); ctx.moveTo(3, -1.7); ctx.lineTo(16, -1.1); ctx.lineTo(20, 0); ctx.lineTo(16, 1.1); ctx.lineTo(3, 1.7); ctx.closePath(); ctx.fill(); },
    hache(ctx, c) { ctx.fillStyle = c.bois; ctx.fillRect(-9, -1.4, 46, 2.8); ctx.fillStyle = acier(ctx, 24, 38); ctx.beginPath(); ctx.moveTo(27, -1.5); ctx.quadraticCurveTo(30, -9, 38, -13); ctx.quadraticCurveTo(34, -4, 37, 1.5); ctx.lineTo(27, 1.5); ctx.closePath(); ctx.fill(); },
    masse(ctx, c) { ctx.fillStyle = c.bois; ctx.fillRect(-7, -1.4, 37, 2.8); ctx.fillStyle = "#7d8a92"; ctx.beginPath(); ctx.arc(32, 0, 5, 0, TAU); ctx.fill(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.moveTo(32 + Math.cos(a - .3) * 4.5, Math.sin(a - .3) * 4.5); ctx.lineTo(32 + Math.cos(a) * 8.5, Math.sin(a) * 8.5); ctx.lineTo(32 + Math.cos(a + .3) * 4.5, Math.sin(a + .3) * 4.5); ctx.fill(); } },
    gourdin(ctx, c) { ctx.fillStyle = c.bois; ctx.beginPath(); ctx.moveTo(-7, -1.6); ctx.lineTo(18, -3); ctx.quadraticCurveTo(40, -7.5, 44, 0); ctx.quadraticCurveTo(40, 7.5, 18, 3); ctx.lineTo(-7, 1.6); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#7d8a92"; [[30, -5.5], [37, 4.8], [41, -3]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill(); }); },
    lance(ctx, c) { ctx.fillStyle = c.bois; ctx.fillRect(-24, -1.1, 76, 2.2); ctx.fillStyle = acier(ctx, 50, 64); ctx.beginPath(); ctx.moveTo(50, -3); ctx.lineTo(64, 0); ctx.lineTo(50, 3); ctx.lineTo(53, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = c.accent; ctx.fillRect(46, -1.8, 3.5, 3.6); },
    rien() {},
  };

  // ---------- poses (toutes relatives ; mélangées par pondération) ----------
  // hx,hy : hanche ; tor : buste penché (rad, + vers l'avant) ; hd : tête ; fF,fB : pieds avant/arrière ;
  // w : main d'arme (relative à l'épaule), wa : angle de l'arme ; o : main libre ; cl : cape soulevée
  const REPOS = { hx: 0, hy: -45, tor: .13, hd: 0, fFx: 13, fFy: 0, fBx: -11, fBy: 0, wx: 13, wy: 1, wa: -1.0, ox: 7, oy: 12, cl: 0 };
  const POSES = {
    elan: { hx: -6, hy: -44, tor: -.2, hd: -.08, fFx: 12, fBx: -14, wx: -9, wy: -17, wa: -2.5, ox: 13, oy: 2, cl: -.3 },
    frappe: { hx: 11, hy: -40, tor: .5, hd: .12, fFx: 25, fBx: -15, wx: 23, wy: 3, wa: .42, ox: -6, oy: 9, cl: 1 },
    garde: { hx: -2, hy: -40, tor: .04, hd: .05, fFx: 15, fBx: -13, wx: 12, wy: -9, wa: -1.75, ox: 12, oy: 1, cl: .1 },
    esq: { hx: -12, hy: -39, tor: -.38, hd: -.1, fFx: 6, fBx: -22, wx: 2, wy: 8, wa: -.3, ox: -8, oy: 6, cl: .8 },
    touche: { hx: -6, hy: -43, tor: -.42, hd: -.35, fFx: 10, fBx: -16, wx: -5, wy: 11, wa: .5, ox: -11, oy: 8, cl: .7 },
    chute: { hx: -4, hy: -21, tor: 1.05, hd: .55, fFx: 17, fBx: -20, fBy: 0, wx: 17, wy: 17, wa: .12, ox: 9, oy: 18, cl: -.2 },
    charge: { hx: -8, hy: -41, tor: -.26, hd: -.05, fFx: 15, fBx: -16, wx: -12, wy: -21, wa: -2.75, ox: 14, oy: -1, cl: -.4 },
    joie: { hx: 0, hy: -46, tor: -.04, hd: -.18, wx: 5, wy: -27, wa: -1.5, ox: 5, oy: 13, cl: 0 },
    // arc : la main libre tient l'arc tendu devant, la main d'arme tire la corde
    viser: { hx: -1, hy: -45, tor: .02, hd: 0, fFx: 15, fBx: -13, wx: -5, wy: -3, wa: 0, ox: 22, oy: -4, cl: 0 },
    civil: { hx: 0, hy: -47, tor: .03, hd: 0, fFx: 6, fBx: -5, wx: 2, wy: 25, wa: 1.25, ox: -1, oy: 26, cl: 0 },
    lache: { hx: 0, hy: -45, tor: .06, hd: 0, fFx: 15, fBx: -13, wx: -12, wy: -4, wa: 0, ox: 23, oy: -4, cl: .3 },
  };
  const CLES = Object.keys(REPOS);
  function melange(poids) { const o = Object.assign({}, REPOS); for (const k in poids) { const w = poids[k], p = POSES[k]; if (!w || !p) continue; for (const c of CLES) if (p[c] != null) o[c] += (p[c] - REPOS[c]) * w; } return o; }

  // ---------- le pantin ----------
  function humain(o) { const taille = o.taille || 1, b = o.carrure || 1, arc = o.arme === "arc", r = rng(o.seed == null ? 1 : o.seed + 7), ph = r() * 6;
    const c = Object.assign({ corps: "#1f2a2b", corps2: "#141c1d", peau: "#4a3a30", cuir: "#2a2019", metal: "#5f6a70", metal2: "#8a8f8a", bois: "#33271c", accent: P.or, cape: null, cheveux: "#17120f" }, o.col || {});
    const LT = 31, LB = 15, LA = 14, LC = 24, LJ = 24; // tronc, bras, avant-bras, cuisse, jambe
    function draw(ctx, t, st) { st = st || {}; const A = st.att || 0;
      const w = { civil: Math.max(o.civil ? 1 : 0, st.calme || 0) * (1 - smooth(Math.max(st.garde || 0, st.touche || 0, st.chute || 0, st.joie || 0, A, st.charge || 0))), garde: smooth(st.garde || 0), esq: bell(st.esq || 0, .35), touche: bell(st.touche || 0, .25), chute: smooth(st.chute || 0), charge: smooth(st.charge || 0), joie: smooth(st.joie || 0) };
      if (arc) { const T = st.tir || A; w.viser = bell(T, .55) * (T < .62 ? 1 : 0) + (T >= .62 ? 0 : 0); w.viser = T > 0 && T < .62 ? smooth(T / .25) : 0; w.lache = T >= .62 ? 1 - smooth((T - .62) / .38) : 0; }
      else { w.elan = bell(clamp(A / .42, 0, 1), .6) * (A < .42 ? 1 : 0); w.frappe = A >= .3 ? bell(clamp((A - .3) / .7, 0, 1), .22) : 0; }
      const p = melange(w), vivant = 1 - w.chute; if (o.bouclier) { p.ox += 7 * vivant; p.oy -= 8 * vivant; } else if (o.arme2) { p.ox += 6 * vivant; p.oy -= 5 * vivant; }
      const souffle = Math.sin(t * 1.7 + ph) * vivant, trem = (st.charge || 0) > .5 ? Math.sin(t * 46) * .5 : 0;
      p.hy += souffle * .7; p.tor += souffle * .012; p.wy += Math.sin(t * 1.7 + ph + .8) * .9 * vivant; p.wx += trem;
      ctx.save(); ctx.scale(taille, taille); ctx.lineJoin = "round";
      const hx = p.hx, hy = p.hy, sT = Math.sin(p.tor), cT = Math.cos(p.tor), ex = hx + sT * LT, ey = hy - cT * LT; // épaule
      const tx = hx + sT * (LT + 4), ty = hy - cT * (LT + 4), aH = p.tor + p.hd, kx = tx + Math.sin(aH) * 8.5, ky = ty - Math.cos(aH) * 8.5; // tête
      const epF = [ex + cT * 2.5, ey + sT * 2.5 + 1], epB = [ex - cT * 4, ey - sT * 4 + 1];
      const mW = [epF[0] + p.wx, epF[1] + p.wy], mO = [epB[0] + p.ox, epB[1] + p.oy];
      const cF = ik(epF[0], epF[1], mW[0], mW[1], LB, LA, 1), cB = ik(epB[0], epB[1], mO[0], mO[1], LB, LA, 1);
      const gF = ik(hx + 2, hy, p.fFx, p.fFy, LC, LJ, -1), gB = ik(hx - 2, hy, p.fBx, p.fBy, LC, LJ, -1);

      // cape
      if (c.cape) { const sw = Math.sin(t * 1.3 + ph) * 2.2 + p.cl * 9, bas = Math.min(-9, hy + 34); ctx.fillStyle = c.cape; ctx.beginPath(); ctx.moveTo(ex + 3, ey - 2);
        ctx.quadraticCurveTo(ex - 9 * b, ey + 2, ex - 11 * b - sw * .3, ey + 14); ctx.quadraticCurveTo(hx - 15 * b - sw * .8, hy + 6, hx - 15 - sw * 1.6, bas);
        ctx.lineTo(hx - 9 - sw * 1.2 + Math.sin(t * 2.1 + ph) * 1.2, bas + 2.5); ctx.lineTo(hx - 4 - sw * .7, bas - .5); ctx.lineTo(hx + 1 - sw * .3, bas + 2); ctx.quadraticCurveTo(hx + 4, hy - 4, ex + 4, ey + 6); ctx.closePath(); ctx.fill();
        if (c.capeBord) { ctx.strokeStyle = c.capeBord; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(hx - 15 - sw * 1.6, bas); ctx.lineTo(hx - 9 - sw * 1.2, bas + 2.5); ctx.lineTo(hx - 4 - sw * .7, bas - .5); ctx.lineTo(hx + 1 - sw * .3, bas + 2); ctx.stroke(); } }
      // jambe arrière
      ctx.fillStyle = c.corps2; membre(ctx, hx - 2, hy, gB[0], gB[1], 5 * b, 3.9 * b); membre(ctx, gB[0], gB[1], gB[2], gB[3] - 2.5, 3.9 * b, 3.1); botte(ctx, gB[2], gB[3], c.corps2);
      // bras libre (derrière le buste) et arc
      ctx.fillStyle = c.corps2; membre(ctx, epB[0], epB[1], cB[0], cB[1], 3.7 * b, 3.1 * b); membre(ctx, cB[0], cB[1], cB[2], cB[3], 3.1 * b, 2.6);
      if (arc) dessinArc(ctx, cB[2], cB[3], mW, w, c);
      // buste
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(p.tor); ctx.fillStyle = c.corps; ctx.beginPath(); ctx.moveTo(-6 * b, 2); ctx.quadraticCurveTo(-8.6 * b, -14, -8.2 * b, -LT + 2); ctx.quadraticCurveTo(-6 * b, -LT - 3.5, -2.6, -LT - 4.5); ctx.lineTo(2.8, -LT - 4.5);
      ctx.quadraticCurveTo(8 * b, -LT - 2.5, 8.6 * b, -LT + 5); ctx.quadraticCurveTo(8.4 * b, -13, 6.2 * b, 2); ctx.closePath(); ctx.fill();
      if (o.plastron) { ctx.fillStyle = c.metal; ctx.beginPath(); ctx.moveTo(-5.5 * b, -8); ctx.quadraticCurveTo(-8 * b, -18, -7 * b, -LT + 3); ctx.lineTo(7.6 * b, -LT + 4); ctx.quadraticCurveTo(8.2 * b, -17, 5.6 * b, -8); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = c.accent; ctx.fillRect(-6.6 * b, -3.6, 13 * b, 1.6); // ceinture
      ctx.restore();
      // tunique
      ctx.fillStyle = c.corps; ctx.beginPath(); ctx.moveTo(hx - 6.4 * b, hy - 2); ctx.lineTo(hx - 8 * b, hy + 13); ctx.lineTo(hx + 8.5 * b, hy + 12); ctx.lineTo(hx + 6.4 * b, hy - 2); ctx.closePath(); ctx.fill();
      if (o.tabard) { ctx.fillStyle = o.tabard; ctx.beginPath(); ctx.moveTo(hx + 1, hy - 4); ctx.lineTo(hx + 6.2 * b, hy - 3); ctx.lineTo(hx + 8.3 * b, hy + 12); ctx.lineTo(hx + 2.5, hy + 13.5); ctx.closePath(); ctx.fill(); }
      // tête
      tete(ctx, kx, ky, aH, t, ph, o, c, ex, ey);
      // bouclier (tenu par la main libre, devant le buste)
      if (o.bouclier) { const bx = cB[2] + 2, by = cB[3] - 1, lev = w.garde * 5; ctx.save(); ctx.translate(bx + lev * .4, by - lev); ctx.rotate(-.12 + w.garde * .1);
        ctx.fillStyle = c.ecu || "#3d3128"; if (o.bouclier === "ecu") { ctx.beginPath(); ctx.moveTo(-7, -11); ctx.lineTo(7, -11); ctx.quadraticCurveTo(8, 4, 0, 14); ctx.quadraticCurveTo(-8, 4, -7, -11); ctx.closePath(); ctx.fill(); ctx.fillStyle = c.accent; ctx.fillRect(-1, -11, 2, 23); ctx.fillRect(-7, -3, 14, 2); }
        else { ctx.beginPath(); ctx.ellipse(0, 0, 8.5, 11.5, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = c.metal2; ctx.lineWidth = 1.4; ctx.stroke(); ctx.fillStyle = c.metal2; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU); ctx.fill(); }
        ctx.restore(); }
      // jambe avant
      ctx.fillStyle = c.corps; membre(ctx, hx + 2, hy, gF[0], gF[1], 5.2 * b, 4.1 * b); membre(ctx, gF[0], gF[1], gF[2], gF[3] - 2.5, 4.1 * b, 3.2); botte(ctx, gF[2], gF[3], c.cuir);
      // seconde dague dans la main libre
      if (o.arme2) { ctx.save(); ctx.translate(cB[2], cB[3]); ctx.rotate(-.6 - w.garde * .9); (ARMES[o.arme2] || ARMES.dague)(ctx, c); ctx.restore(); }
      // arme, puis bras d'arme par-dessus
      if (!arc) { ctx.save(); ctx.translate(mW[0], mW[1]); ctx.rotate(p.wa + (o.armeBiais || 0)); (ARMES[o.arme] || ARMES.epee)(ctx, c); ctx.restore(); }
      ctx.fillStyle = c.corps; membre(ctx, epF[0], epF[1], cF[0], cF[1], 4 * b, 3.3 * b); membre(ctx, cF[0], cF[1], cF[2], cF[3], 3.3 * b, 2.7); ctx.fillStyle = c.cuir; ctx.beginPath(); ctx.arc(cF[2], cF[3], 2.9, 0, TAU); ctx.fill();
      // épaulière ou fourrure
      if (o.fourrure) { ctx.fillStyle = o.fourrure; const n = 9; ctx.beginPath(); for (let i = 0; i <= n; i++) { const a = Math.PI + i / n * Math.PI, rr = (i % 2 ? 9.5 : 6.5) * b; ctx.lineTo(ex - 1 + Math.cos(a) * rr * 1.25, ey + 2 + Math.sin(a) * rr * .8); } ctx.lineTo(ex + 9 * b, ey + 6); ctx.lineTo(ex - 11 * b, ey + 7); ctx.closePath(); ctx.fill(); }
      else if (o.epauliere) { ctx.fillStyle = c.metal; ctx.beginPath(); ctx.ellipse(epF[0] - .5, epF[1] - .5, 5.6 * b, 4.4 * b, -.3, Math.PI, TAU); ctx.lineTo(epF[0] + 5 * b, epF[1] + 2); ctx.lineTo(epF[0] - 6 * b, epF[1] + 2); ctx.closePath(); ctx.fill(); }
      ctx.restore(); }
    return { draw, larg: 190 * taille, haut: 150 * taille, sous: 16 * taille, ech: o.ech || .34, humain: true, arc,
      points: { tete: [5 * taille, -90 * taille], coeur: [4 * taille, -62 * taille], bouche: [10 * taille, -86 * taille] } }; }

  function botte(ctx, x, y, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - 3.2, y - 4.5); ctx.lineTo(x + 3, y - 4.5); ctx.quadraticCurveTo(x + 7.5, y - 2.5, x + 8, y); ctx.lineTo(x - 3.6, y); ctx.closePath(); ctx.fill(); }

  function dessinArc(ctx, x, y, mW, w, c) { const tend = (w.viser || 0), h = 21; ctx.save(); ctx.strokeStyle = c.bois; ctx.lineWidth = 2.1; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x - 5 - tend * 2, y - h); ctx.quadraticCurveTo(x + 9, y, x - 5 - tend * 2, y + h); ctx.stroke();
    ctx.strokeStyle = "rgba(230,225,205,.8)"; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(x - 5 - tend * 2, y - h); if (tend > .05) ctx.lineTo(mW[0], mW[1]); ctx.lineTo(x - 5 - tend * 2, y + h); ctx.stroke();
    if (tend > .05) { ctx.strokeStyle = c.bois; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(mW[0], mW[1]); ctx.lineTo(x + 12, y); ctx.stroke(); ctx.fillStyle = "#dfe8ec"; ctx.beginPath(); ctx.moveTo(x + 11, y - 1.8); ctx.lineTo(x + 16, y); ctx.lineTo(x + 11, y + 1.8); ctx.closePath(); ctx.fill(); }
    ctx.restore(); }

  function tete(ctx, kx, ky, aH, t, ph, o, c, ex, ey) { ctx.save(); ctx.translate(kx, ky); ctx.rotate(aH);
    const R = 7.4;
    // cheveux longs / tresse derrière la tête
    if (o.cheveux === "long" || o.cheveux === "tresse") { ctx.fillStyle = c.cheveux; ctx.beginPath(); ctx.moveTo(-2, -R); ctx.quadraticCurveTo(-R - 4, -R + 2, -R - 2.5, 7); ctx.quadraticCurveTo(-R, 12, -3.5, 10); ctx.lineTo(1, -2); ctx.closePath(); ctx.fill(); }
    if (o.cheveux === "tresse") { ctx.fillStyle = c.cheveux; for (let i = 0; i < 6; i++) { const sw = Math.sin(t * 1.6 + ph + i * .5) * (.5 + i * .35); ctx.beginPath(); ctx.ellipse(-R - 1.5 - i * .5 + sw, 10 + i * 4.2, 2.3 - i * .12, 2.9, .2, 0, TAU); ctx.fill(); } }
    // capuche (arrière)
    if (o.capuche) { ctx.fillStyle = c.cape || c.corps; ctx.beginPath(); ctx.moveTo(3, -R - 2.4); ctx.quadraticCurveTo(-R - 5, -R - 3, -R - 4.5, 4); ctx.quadraticCurveTo(-R - 3, 11, -2, 12); ctx.lineTo(5, 9); ctx.closePath(); ctx.fill(); }
    // visage
    ctx.fillStyle = c.peau; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(R - 1.2, -1.5); ctx.lineTo(R + 2, 1.2); ctx.lineTo(R - 1, 3); ctx.closePath(); ctx.fill(); // nez
    ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(2.6, -2.1, 3.4, 1.1); // regard
    if (o.barbe) { ctx.fillStyle = c.cheveux; ctx.beginPath(); ctx.moveTo(-1, 2.5); ctx.quadraticCurveTo(6, 3, R, 3.5); ctx.quadraticCurveTo(6, R + 3.5, 1, R + .5); ctx.closePath(); ctx.fill(); }
    // coiffes
    const k = o.casque;
    if (k === "bassinet") { ctx.fillStyle = c.metal; ctx.beginPath(); ctx.arc(0, -.6, R + 1.4, Math.PI * .92, TAU + .25); ctx.lineTo(R + 1, 1); ctx.lineTo(-R - 1.4, 2); ctx.closePath(); ctx.fill(); ctx.fillRect(R - 1.4, -1.5, 1.8, 6.5); }
    else if (k === "chapel") { ctx.fillStyle = c.metal; ctx.beginPath(); ctx.arc(0, -1.6, R + .6, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, -1.6, R + 5.2, 2, -.05, 0, TAU); ctx.fill(); }
    else if (k === "heaume") { ctx.fillStyle = c.metal; ctx.beginPath(); ctx.moveTo(-R - 1.2, -R + 1); ctx.quadraticCurveTo(0, -R - 5, R + 1.2, -R + 1); ctx.lineTo(R + 1.6, R - .5); ctx.lineTo(-R - 1, R + .5); ctx.closePath(); ctx.fill(); ctx.fillStyle = "rgba(0,0,0,.75)"; ctx.fillRect(1.5, -2.4, R, 1.7); if (o.yeux) G.glow(ctx, 5, -1.6, 5, o.yeux, .9); }
    else if (k === "cornes") { ctx.fillStyle = c.metal; ctx.beginPath(); ctx.arc(0, -.8, R + 1.3, Math.PI * .95, TAU + .2); ctx.lineTo(R + 1.2, .5); ctx.lineTo(-R - 1.2, 1.6); ctx.closePath(); ctx.fill(); ctx.fillRect(R - 1.5, -1.5, 1.9, 6);
      ctx.fillStyle = P.os; [[-4.5, -1], [3.5, 1]].forEach(([x0, s]) => { ctx.beginPath(); ctx.moveTo(x0 - 2, -R - .2); ctx.quadraticCurveTo(x0 - 5 * s - 2, -R - 9, x0 + 3 * s, -R - 13.5); ctx.quadraticCurveTo(x0 - 1, -R - 7, x0 + 2.4, -R - .6); ctx.closePath(); ctx.fill(); }); }
    else if (k === "chapeau") { ctx.fillStyle = c.cuir; ctx.beginPath(); ctx.ellipse(.5, -R + 1.4, R + 7, 2.3, -.1, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-R + .5, -R + 1.5); ctx.quadraticCurveTo(-1, -R - 9.5, R - 1, -R + 1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = c.accent; ctx.lineWidth = 1.3; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-2, -R - 3); ctx.quadraticCurveTo(-9, -R - 12 + Math.sin(t * 2 + ph), -15, -R - 7); ctx.stroke(); }
    else if (o.capuche) { ctx.fillStyle = c.cape || c.corps; ctx.beginPath(); ctx.moveTo(R + 1.6, -3.4); ctx.quadraticCurveTo(R - 1, -R - 3.6, -1, -R - 2.6); ctx.quadraticCurveTo(-R - 2, -R, -R - 2, 0); ctx.lineTo(-1.5, -1.2); ctx.quadraticCurveTo(2, -4.2, R + 1.6, -3.4); ctx.closePath(); ctx.fill();
      if (o.masque) { ctx.fillStyle = c.corps2; ctx.beginPath(); ctx.arc(0, 0, R + .2, -.5, 1.9); ctx.closePath(); ctx.fill(); } }
    else if (o.cheveux !== "ras") { ctx.fillStyle = c.cheveux; ctx.beginPath(); ctx.arc(0, -.4, R + .9, Math.PI * .86, TAU - .12); ctx.quadraticCurveTo(3, -4.2, -1.5, -2.6); ctx.quadraticCurveTo(-4, 1, -R - .4, 3.4); ctx.closePath(); ctx.fill();
      if (o.cheveux === "fou") { for (let i = 0; i < 5; i++) { const a = Math.PI * 1.05 + i * .32; ctx.beginPath(); ctx.moveTo(Math.cos(a - .2) * R, Math.sin(a - .2) * R); ctx.lineTo(Math.cos(a) * (R + 4.6), Math.sin(a) * (R + 4.6)); ctx.lineTo(Math.cos(a + .2) * R, Math.sin(a + .2) * R); ctx.fill(); } } }
    if (o.bandeau) { ctx.fillStyle = o.bandeau; ctx.save(); ctx.rotate(-.1); ctx.fillRect(-R - .6, -4.3, R * 2 + 1.2, 2.3); ctx.restore(); }
    if (o.yeux && k !== "heaume") { G.glow(ctx, 4.6, -1.5, 4.5, o.yeux, .95); ctx.fillStyle = "#fff"; ctx.fillRect(3.6, -2, 2.2, .9); }
    ctx.restore(); }

  // ---------- la troupe ----------
  const T = { ember: "#a8452f", acier: "#3d6f91", noir: "#0e0f12", cuir: "#2a2019" };
  const H = (nom, o) => def(nom, x => humain(Object.assign({}, o, x, { col: Object.assign({}, o.col, x.col) })));
  // le héros : l'académicien porte le tabard de la Guilde, l'aventurier la cape de route
  H("heros-acad", { arme: "epee", tabard: T.acier, epauliere: true, plastron: true, cheveux: "court", col: { corps: "#1c272c", corps2: "#131b1f", metal: "#56666f", cape: "#22384a", capeBord: P.or, accent: P.or, peau: "#5a4638", cheveux: "#2b1f17" } });
  H("heros-aven", { arme: "epee", capuche: false, cheveux: "court", bandeau: null, col: { corps: "#262a20", corps2: "#181b14", cape: "#2d3a2a", capeBord: P.or, accent: P.or, peau: "#5a4638", cheveux: "#3a2516" } });
  // gens de Varek
  H("rodeur", { arme: "gourdin", capuche: true, carrure: .95, col: { corps: "#23201b", corps2: "#161411", cape: "#2b261f", accent: "#6b5a3a" } });
  H("pillard", { arme: "hache", cheveux: "fou", barbe: true, fourrure: "#2a211b", col: { corps: "#241c19", corps2: "#171110", accent: T.ember, cheveux: "#1a1410" } });
  H("deserteur", { arme: "epee", bouclier: "rond", casque: "chapel", plastron: true, col: { corps: "#20262a", corps2: "#14191c", metal: "#4d585e", accent: "#7c6a4a" } });
  H("bretteur", { arme: "sabre", casque: "chapeau", carrure: .9, col: { corps: "#2a1f24", corps2: "#1a1317", cape: "#3a2228", capeBord: "#c98a5a", accent: "#c98a5a", cuir: "#231a18" } });
  H("garde", { arme: "lance", bouclier: "ecu", casque: "bassinet", plastron: true, col: { corps: "#221c1b", corps2: "#151110", metal: "#474d52", accent: T.ember, cape: "#3a1d18" } });
  H("geolier", { arme: "masse", carrure: 1.22, cheveux: "ras", barbe: true, col: { corps: "#231f1c", corps2: "#151211", accent: T.ember, cheveux: "#17120f" } });
  H("chasseur", { arme: "sabre", arme2: "dague", casque: "chapeau", col: { corps: "#1c1f1d", corps2: "#111312", cape: "#1f2623", capeBord: "#56605a", accent: "#8c8f7a" } });
  H("sicaire", { arme: "dague", arme2: "dague", capuche: true, masque: true, carrure: .92, col: { corps: "#15161a", corps2: "#0c0d10", cape: "#111216", accent: "#44464e" } });
  H("lieutenant", { arme: "espadon", casque: "cornes", plastron: true, epauliere: true, carrure: 1.12, taille: 1.06, col: { corps: "#1f1a1a", corps2: "#131010", metal: "#3f4448", cape: "#5a231a", capeBord: "#b3382c", accent: T.ember } });
  H("capitaine", { arme: "epee", bouclier: "ecu", casque: "heaume", plastron: true, epauliere: true, carrure: 1.1, taille: 1.05, col: { corps: "#17171a", corps2: "#0e0e10", metal: "#33373b", cape: "#3d1512", capeBord: "#b3382c", accent: T.ember } });
  H("maitre", { arme: "epee", arme2: "dague", cheveux: "long", barbe: true, col: { corps: "#262220", corps2: "#171413", cape: "#2a2a2e", accent: "#b8a37a", cheveux: "#8d8a84" } });
  // ceux d'outre-Faille : masques, yeux violets
  H("exile", { arme: "sabre", capuche: true, masque: true, yeux: P.nuit, taille: 1.08, col: { corps: "#1b1826", corps2: "#110f19", cape: "#241f36", capeBord: P.nuit, accent: P.nuit } });
  H("traqueur", { arme: "dague", arme2: "dague", capuche: true, masque: true, yeux: P.nuit, carrure: .88, taille: 1.04, col: { corps: "#171a22", corps2: "#0e1016", cape: "#1b1f2c", accent: "#6f66a8" } });
  // figures
  H("varek", { arme: "espadon", cheveux: "long", barbe: true, fourrure: "#15110f", plastron: true, carrure: 1.2, taille: 1.13, col: { corps: "#1d1a1b", corps2: "#110f10", metal: "#3a3d42", cape: "#4a1a15", capeBord: "#b3382c", accent: "#b3382c", peau: "#59483b", cheveux: "#0f0c0b" } });
  H("selena", { arme: "epee", cheveux: "tresse", epauliere: true, carrure: .9, col: { corps: "#1b2233", corps2: "#111624", cape: "#232c44", capeBord: "#c9a45c", accent: "#c9a45c", peau: "#6a5546", cheveux: "#b9a06a", metal: "#59636e" } });
  H("kael", { arme: "dague", arme2: "dague", cheveux: "fou", bandeau: "#3a3f3c", carrure: .95, col: { corps: "#2a2119", corps2: "#1a140f", cape: "#3a2a1d", capeBord: "#7a3a28", accent: "#a8452f", peau: "#6a5546", cheveux: "#8a3a1c" } });
  H("orsan", { arme: "espadon", cheveux: "court", barbe: true, plastron: true, epauliere: true, tabard: T.acier, carrure: 1.12, taille: 1.08, col: { corps: "#1b242b", corps2: "#11181d", metal: "#62727c", cape: "#284862", capeBord: P.or, accent: P.or, cheveux: "#8f8a80" } });
  H("guilde", { arme: "epee", bouclier: "ecu", casque: "bassinet", plastron: true, tabard: T.acier, col: { corps: "#1c252b", corps2: "#12181d", metal: "#55656e", accent: P.acier, cape: "#223a4e" } });
  H("guilde-lance", { arme: "lance", casque: "chapel", plastron: true, tabard: T.acier, col: { corps: "#1c252b", corps2: "#12181d", metal: "#55656e", accent: P.acier } });
  H("soldat", { arme: "epee", casque: "chapel", col: { corps: "#22201d", corps2: "#151412", accent: "#7c6a4a" } });
  // gens de Valdren
  H("ivan", { civil: true, arme: "masse", cheveux: "ras", barbe: true, carrure: 1.25, taille: 1.04, tabard: "#3a2a1c", col: { corps: "#2a231d", corps2: "#1a1511", accent: "#8a6a3a", cheveux: "#1c1611", peau: "#5e4a3a" } });
  H("hilda", { civil: true, arme: "rien", cheveux: "tresse", carrure: .9, taille: .96, col: { corps: "#27301f", corps2: "#181e13", cape: "#33402a", capeBord: "#8aa06a", accent: "#8aa06a", cheveux: "#231a14", peau: "#63503f" } });
  H("odile", { civil: true, arme: "rien", cheveux: "long", carrure: .95, taille: .97, tabard: "#4a2f2a", col: { corps: "#2c2226", corps2: "#1b1517", accent: "#c9a45c", cheveux: "#5a3a26", peau: "#63503f" } });
  // l'ogre des Failles : un colosse voûté
  H("ogre", { arme: "gourdin", cheveux: "ras", carrure: 1.75, taille: 1.6, yeux: "#ffb35a", fourrure: "#1b1612", col: { corps: "#262019", corps2: "#17130f", peau: "#3b3a2c", accent: "#5a4a32", bois: "#2a2018" } });

  return { def, creer, defs, humain, membre, ik, ARMES };
})();
