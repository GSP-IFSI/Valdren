// La carte de la vallée : peinte à l'encre d'or sur fond sombre, avec ses lieux à toucher.
// Le moteur fournit la liste des lieux et de leurs actions (rCarte) ; on la redistribue sur la carte.
VG.carte = (() => {
  const G = VG.gfx, U = VG.u, { clamp, lerp, rng, rgba, mixc, TAU, noise2, fbm1 } = U, P = G.PAL, ic = n => `<svg class="ic"><use href="#i-${n}"/></svg>`;
  let sel = null, lieux = [], alertes = [];

  // ---------- disposition ----------
  const DISPO = {
    paysage: { village: [.5, .68], bois: [.2, .56], crete: [.82, .3], fort: [.45, .22], moulin: [.68, .5], ferme: [.3, .82], marais: [.1, .8], gorge: [.12, .28] },
    portrait: { village: [.57, .7], bois: [.24, .53], crete: [.76, .3], fort: [.33, .16], moulin: [.8, .54], ferme: [.24, .84], marais: [.1, .72], gorge: [.1, .32] },
  };
  const dispo = z => DISPO[z.w / z.h > 1.1 ? "paysage" : "portrait"];

  // ---------- peinture ----------
  VG.decors.D.carte = B => { const n = B.nuit, Uu = Math.min(B.s.h, B.s.w * 1.2) / 100, d = B.donnees || {}, N = d.noeuds || DISPO.paysage, et = d.etat || {};
    const c = n ? { f1: "#101a2e", f2: "#060a14", enc: "#b7c6ea", eau: "#2b4a70", bois: "#1d3a4a", roche: "#27324a", terre: "#18233a" }
                : { f1: "#232d22", f2: "#0c120e", enc: "#e3c27a", eau: "#3f6474", bois: "#2f5444", roche: "#3b3a30", terre: "#2a3326" };
    B.lum = { col: n ? P.lune : "#ffd9a0", dir: 1, amb: "#1a2030", brume: "#8fa5b0" }; B.sol = B.Y(2);
    const X = B.X, Y = B.Y, p = k => [X(N[k][0]), Y(N[k][1])], r = rng("carte"), enc = a => rgba(c.enc, a);
    let ctx = B.couche(0);
    // le fond : cuir sombre, taches, relief diffus
    ctx.fillStyle = G.rad(ctx, X(.5), Y(.5), 0, Math.max(B.W, B.H) * .75, [[0, c.f1], [1, c.f2]]); ctx.fillRect(B.x0, 0, B.x1 - B.x0, B.H);
    for (let i = 0; i < 70; i++) { const x = lerp(B.x0, B.x1, r()), y = r() * B.H, rr = Uu * r.r(6, 22); G.glow(ctx, x, y, rr, r() < .5 ? "#000000" : c.terre, r.r(.1, .3), "source-over"); }
    // les Failles : lueurs violettes aux confins
    G.glow(ctx, X(-.02), Y(.05), Uu * 30, P.nuit, .26); G.glow(ctx, X(1.03), Y(.72), Uu * 26, P.nuit, .2); G.glow(ctx, X(.02), Y(1), Uu * 20, P.nuit, .14);
    ctx = B.couche(.15);
    // la rivière et le gué
    const v = p("village"), riv = [[X(.63), Y(-.06)], [X(.6), Y(.2)], [v[0] + Uu * 13, v[1] - Uu * 16], [v[0] + Uu * 9, v[1] + Uu * 1], [v[0] + Uu * 4, v[1] + Uu * 16], [X(.62), Y(1.08)]];
    const courbe = (pts, f) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); } ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); f(); };
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    courbe(riv, () => { ctx.strokeStyle = rgba(c.eau, .95); ctx.lineWidth = Uu * 2.6; ctx.stroke(); ctx.strokeStyle = rgba("#ffffff", .12); ctx.lineWidth = Uu * .5; ctx.stroke(); ctx.strokeStyle = enc(.28); ctx.lineWidth = Uu * 3.1; ctx.setLineDash([Uu * .3, Uu * 1.4]); ctx.stroke(); ctx.setLineDash([]); });
    // les routes
    const route = (a, b, courb, tirets) => { const mx = (a[0] + b[0]) / 2 + (b[1] - a[1]) * courb, my = (a[1] + b[1]) / 2 - (b[0] - a[0]) * courb; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(mx, my, b[0], b[1]); ctx.strokeStyle = enc(.42); ctx.lineWidth = Math.max(1.2, Uu * .32); ctx.setLineDash(tirets); ctx.stroke(); ctx.setLineDash([]); };
    route(p("village"), p("fort"), .16, [Uu * 1.2, Uu * .8]); route(p("village"), p("bois"), -.12, [Uu * 1.2, Uu * .8]); route(p("village"), p("crete"), -.1, [Uu * .4, Uu * .9]); route(p("fort"), p("moulin"), -.3, [Uu * 1.2, Uu * .8]); route(p("moulin"), [X(1.06), Y(.42)], .1, [Uu * 1.2, Uu * .8]); route(p("village"), p("ferme"), .1, [Uu * .4, Uu * .9]);
    // les montagnes : une chaîne au nord-est, et la Crête
    const pic = (x, y, h, w, feu) => { ctx.fillStyle = mixc(c.roche, c.f2, .25); ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x - w * .12, y - h); ctx.lineTo(x + w * .08, y - h * .93); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rgba("#000", .3); ctx.beginPath(); ctx.moveTo(x - w * .12, y - h); ctx.lineTo(x + w * .08, y - h * .93); ctx.lineTo(x + w, y); ctx.lineTo(x + w * .15, y); ctx.lineTo(x - w * .02, y - h * .5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = enc(.6); ctx.lineWidth = Math.max(1, Uu * .22); ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x - w * .12, y - h); ctx.lineTo(x + w * .08, y - h * .93); ctx.lineTo(x + w, y); ctx.stroke();
      ctx.strokeStyle = enc(.22); for (let i = 1; i < 5; i++) { const k = i / 5; ctx.beginPath(); ctx.moveTo(x + w * (.1 + k * .7), y - h * (1 - k) * .86); ctx.lineTo(x + w * (.02 + k * .55), y - h * (1 - k) * .5); ctx.stroke(); }
      if (feu) G.glow(ctx, x, y - h * .96, h * .7, P.braise, .5); };
    const cr = p("crete"), ft = p("fort"), rm = rng("monts"); const monts = [];
    for (let i = 0; i < 26; i++) { const a = rm(), x = lerp(X(.54), X(1.08), a) + rm.r(-3, 3) * Uu, y = lerp(Y(.04), Y(.5), Math.pow(a, 1.25)) + rm.r(-9, 7) * Uu; if (Math.hypot(x - cr[0], (y - cr[1])) < Uu * 11 || Math.hypot(x - ft[0], y - ft[1]) < Uu * 13) continue; monts.push([x, y, Uu * rm.r(5, 10)]); }
    for (let i = 0; i < 9; i++) monts.push([lerp(X(-.05), X(.5), rm()), Y(rm.r(-.06, .06)), Uu * rm.r(5, 9)]);
    monts.sort((a, b) => a[1] - b[1]).forEach(([x, y, h]) => pic(x, y, h, h * .8));
    pic(cr[0], cr[1] + Uu * 6, Uu * 16, Uu * 12, !et.dragonMort);
    // la forêt : semis de petits arbres autour du Bois profond, plus clairsemé ailleurs
    const bo = p("bois"), ma = p("marais"), go = p("gorge"), arbres = [];
    const rf = rng("foret"); for (let i = 0; i < 900; i++) { const x = lerp(B.x0, X(.44), rf()), y = lerp(Y(.1), Y(1.04), rf()), dx = (x - bo[0]) / (Uu * 26), dy = (y - bo[1]) / (Uu * 30), dd = dx * dx + dy * dy, m = noise2(x / (Uu * 9), y / (Uu * 9), 3);
      if (dd + (m - .5) * .9 > 1 || Math.hypot(x - ma[0], y - ma[1]) < Uu * 7 || Math.hypot(x - bo[0], y - bo[1]) < Uu * 5.5 || Math.hypot(x - ft[0], y - ft[1]) < Uu * 11) continue; arbres.push([x, y, Uu * rf.r(1.5, 2.6)]); }
    const rf2 = rng("bosquets"); for (let i = 0; i < 150; i++) { const x = lerp(B.x0, B.x1, rf2()), y = lerp(Y(.45), Y(1.05), rf2()); if (noise2(x / (Uu * 12), y / (Uu * 12), 9) < .66 || Math.hypot(x - v[0], y - v[1]) < Uu * 13) continue; arbres.push([x, y, Uu * rf2.r(1.2, 2)]); }
    arbres.sort((a, b) => a[1] - b[1]).forEach(([x, y, h]) => { ctx.fillStyle = mixc(c.bois, c.f2, .2); ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + h * .5, y); ctx.lineTo(x - h * .5, y); ctx.closePath(); ctx.fill(); ctx.fillStyle = enc(.2); ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x - h * .5, y); ctx.lineTo(x - h * .2, y); ctx.closePath(); ctx.fill(); });
    // le marais : mares et roseaux ; la gorge : deux lèvres de roche
    const rma = rng("marais"); for (let i = 0; i < 9; i++) { const x = ma[0] + rma.r(-7, 7) * Uu, y = ma[1] + rma.r(-5, 5) * Uu; ctx.fillStyle = rgba(c.eau, .6); ctx.beginPath(); ctx.ellipse(x, y, Uu * rma.r(1.2, 2.6), Uu * rma.r(.4, .8), 0, 0, TAU); ctx.fill(); ctx.strokeStyle = enc(.4); ctx.lineWidth = 1; for (let k = 0; k < 3; k++) { const rx = x + rma.r(-2, 2) * Uu; ctx.beginPath(); ctx.moveTo(rx, y - Uu * .2); ctx.lineTo(rx + rma.r(-.3, .3) * Uu, y - Uu * rma.r(1, 1.8)); ctx.stroke(); } }
    ctx.strokeStyle = enc(.55); ctx.lineWidth = Math.max(1, Uu * .26); [-1, 1].forEach(s => { ctx.beginPath(); for (let i = 0; i <= 12; i++) { const k = i / 12, x = go[0] - Uu * 9 + k * Uu * 18, y = go[1] + s * Uu * (1.6 + Math.sin(k * 5) * .8) + (fbm1(k * 6, 3 + s) - .5) * Uu * 2; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); if (i % 2 === 0) { ctx.lineTo(x + Uu * .3, y - s * Uu * 1.3); ctx.moveTo(x, y); } } ctx.stroke(); });
    // collines autour du fort
    ctx.strokeStyle = enc(.3); ctx.lineWidth = 1; const rc = rng("coll"); for (let i = 0; i < 12; i++) { const x = ft[0] + rc.r(-13, 13) * Uu, y = ft[1] + rc.r(-3, 9) * Uu, w = Uu * rc.r(2, 4); if (Math.hypot(x - ft[0], y - ft[1]) < Uu * 5) continue; ctx.beginPath(); ctx.arc(x, y, w, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    ctx = B.couche(.3);
    // les lieux bâtis, à la plume
    const trait = (a = .9) => { ctx.strokeStyle = enc(a); ctx.lineWidth = Math.max(1, Uu * .24); ctx.lineJoin = "round"; };
    const maisonnette = (x, y, w) => { ctx.fillStyle = mixc(c.f2, c.enc, .1); ctx.fillRect(x - w / 2, y - w * .55, w, w * .55); ctx.beginPath(); ctx.moveTo(x - w * .66, y - w * .52); ctx.lineTo(x, y - w * 1.15); ctx.lineTo(x + w * .66, y - w * .52); ctx.closePath(); ctx.fill(); trait(.75); ctx.stroke(); ctx.strokeRect(x - w / 2, y - w * .55, w, w * .55); };
    // Valdren
    [[-6, 1, 2.6], [-3.2, 2.2, 2.9], [3.4, 2.4, 2.8], [6.2, .8, 2.5], [-1, 4, 2.6], [2.2, -.6, 2.4]].forEach(([dx, dy, w]) => maisonnette(v[0] + dx * Uu, v[1] + dy * Uu + Uu * 2, w * Uu));
    ctx.fillStyle = mixc(c.f2, c.enc, .12); ctx.fillRect(v[0] - Uu * 1.3, v[1] - Uu * 4.6, Uu * 2.6, Uu * 6.4); trait(); ctx.strokeRect(v[0] - Uu * 1.3, v[1] - Uu * 4.6, Uu * 2.6, Uu * 6.4); for (let i = 0; i < 3; i++) ctx.fillRect(v[0] - Uu * 1.5 + i * Uu * 1.15, v[1] - Uu * 5.3, Uu * .7, Uu * .8);
    // le gué
    ctx.fillStyle = enc(.7); for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(v[0] + Uu * (7.8 + i * .9), v[1] + Uu * (1 + (i % 2) * .5), Uu * .32, 0, TAU); ctx.fill(); }
    // le fort : enceinte de pieux, tour
    if (!et.fortTombe || true) { trait(); ctx.fillStyle = mixc(c.f2, c.enc, .08); ctx.beginPath(); for (let i = 0; i <= 16; i++) { const a = i / 16 * TAU, rr = Uu * (4.4 + (i % 2) * .5); ctx.lineTo(ft[0] + Math.cos(a) * rr * 1.25, ft[1] + Uu * 1.5 + Math.sin(a) * rr * .62); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillRect(ft[0] - Uu * 1.4, ft[1] - Uu * 4.4, Uu * 2.8, Uu * 6); ctx.strokeRect(ft[0] - Uu * 1.4, ft[1] - Uu * 4.4, Uu * 2.8, Uu * 6); ctx.beginPath(); ctx.moveTo(ft[0] - Uu * 1.9, ft[1] - Uu * 4.3); ctx.lineTo(ft[0], ft[1] - Uu * 6.8); ctx.lineTo(ft[0] + Uu * 1.9, ft[1] - Uu * 4.3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    // le moulin, la ferme
    const mo = p("moulin"), fe = p("ferme"); trait(.8); ctx.fillStyle = mixc(c.f2, c.enc, .1); ctx.beginPath(); ctx.moveTo(mo[0] - Uu * 1.2, mo[1] + Uu * 2.4); ctx.lineTo(mo[0] - Uu * .7, mo[1] - Uu * 1.2); ctx.lineTo(mo[0] + Uu * .7, mo[1] - Uu * 1.2); ctx.lineTo(mo[0] + Uu * 1.2, mo[1] + Uu * 2.4); ctx.closePath(); ctx.fill(); ctx.stroke();
    maisonnette(fe[0], fe[1] + Uu, Uu * 2.6); ctx.strokeStyle = enc(.4); ctx.strokeRect(fe[0] + Uu * 1.8, fe[1] - Uu * .2, Uu * 3, Uu * 1.4);
    // rose des vents
    const rx = X(n ? .93 : .93), ry = Y(.9), rr = Uu * 4.2; trait(.55); ctx.beginPath(); ctx.arc(rx, ry, rr, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(rx, ry, rr * .78, 0, TAU); ctx.globalAlpha = .5; ctx.stroke(); ctx.globalAlpha = 1;
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU - Math.PI / 2, l = i % 2 ? rr * .55 : rr * 1.18; ctx.fillStyle = enc(i % 2 ? .35 : .8); ctx.beginPath(); ctx.moveTo(rx + Math.cos(a) * l, ry + Math.sin(a) * l); ctx.lineTo(rx + Math.cos(a + 1.57) * rr * .16, ry + Math.sin(a + 1.57) * rr * .16); ctx.lineTo(rx + Math.cos(a - 1.57) * rr * .16, ry + Math.sin(a - 1.57) * rr * .16); ctx.closePath(); ctx.fill(); }
    // légendes
    const mot = (t, x, y, s, a = .62, ang = 0) => { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.font = `italic 500 ${Math.max(10, Uu * s)}px Fraunces, Georgia, serif`; ctx.textAlign = "center"; ctx.fillStyle = "rgba(4,6,5,.7)"; ctx.fillText(t, 1, 1.5); ctx.fillStyle = enc(a); ctx.fillText(t, 0, 0); ctx.restore(); };
    mot("N", rx, ry - rr * 1.36, 2.2, .8);
    mot("Marais de la Guivre", ma[0] + Uu * 2, ma[1] + Uu * 8, 2.1, .5); mot("Gorge des Traqueurs", go[0] + Uu * 3, go[1] - Uu * 4.4, 2.1, .5); mot("le Gué", v[0] + Uu * 13.5, v[1] + Uu * 4.6, 2, .55, -.2);
    mot("vieux moulin", mo[0], mo[1] + Uu * 5.3, 1.9, .5); mot("route du nord", (mo[0] + X(1)) / 2 + Uu * 2, mo[1] - Uu * 5, 1.9, .42, -.12); mot("les Failles", X(.06), Y(.1), 2.3, .55, -.3);
    // cadre
    const m = Uu * 1.6; ctx.strokeStyle = enc(.4); ctx.lineWidth = Math.max(1, Uu * .2); ctx.strokeRect(B.s.x + m, B.s.y + m, B.s.w - 2 * m, B.s.h - 2 * m); ctx.strokeStyle = enc(.18); ctx.strokeRect(B.s.x + m * 1.6, B.s.y + m * 1.6, B.s.w - 3.2 * m, B.s.h - 3.2 * m);
    // ce qui vit : braise de la Crête, fanions, ailes du moulin, fenêtres la nuit, ombres de nuages
    B.dyn(.3, (x, t) => {
      if (!et.dragonMort) { G.glow(x, cr[0] - Uu * .6, cr[1] - Uu * 9.4, Uu * (4.4 + Math.sin(t * 1.3) * .7), P.braise, .5 + .15 * Math.sin(t * 2.1)); }
      VG.decors.outils.banniere(x, v[0] + Uu * .1, v[1] - Uu * 7.4, Uu * 2.6, Uu * 1.5, rgba(P.acier, .95), t); x.fillStyle = enc(.9); x.fillRect(v[0] - Uu * .1, v[1] - Uu * 7.6, Uu * .22, Uu * 2.6);
      if (!et.fortTombe) { VG.decors.outils.banniere(x, ft[0] + Uu * .1, ft[1] - Uu * 9, Uu * 2.6, Uu * 1.5, rgba(P.braise, .95), t, 2); x.fillStyle = enc(.9); x.fillRect(ft[0] - Uu * .1, ft[1] - Uu * 9.2, Uu * .22, Uu * 2.6); G.glow(x, ft[0] - Uu * 5, ft[1] + Uu * 2, Uu * (2 + .4 * Math.sin(t * 9)), P.feu, .5); G.glow(x, ft[0] + Uu * 5.2, ft[1] + Uu * 2.2, Uu * (2 + .4 * Math.sin(t * 8 + 2)), P.feu, .5); }
      x.save(); x.translate(mo[0], mo[1] - Uu * 1.2); x.rotate(t * .25); x.strokeStyle = enc(.85); x.lineWidth = Math.max(1, Uu * .26); for (let i = 0; i < 4; i++) { x.rotate(Math.PI / 2); x.beginPath(); x.moveTo(0, 0); x.lineTo(Uu * 3.2, 0); x.stroke(); x.strokeRect(Uu * 1.2, 0, Uu * 2, Uu * .8); } x.restore();
      if (n) { [[-6, 2.4], [-3.2, 3.6], [3.4, 3.8], [6.2, 2.2], [0, -2]].forEach(([dx, dy], i) => G.glow(x, v[0] + dx * Uu, v[1] + dy * Uu, Uu * (1.6 + .2 * Math.sin(t * 4 + i * 2)), P.feu, .75)); G.glow(x, fe[0], fe[1] + Uu * .3, Uu * 1.4, P.feu, .6); }
      if (et.moulin) G.glow(x, mo[0], mo[1] + Uu * .6, Uu * (1.8 + .3 * Math.sin(t * 5)), P.feu, .9);
      if (et.fumeeVillage) G.glow(x, v[0], v[1], Uu * (9 + Math.sin(t * 3)), P.braise, .45);
    });
    if (!et.dragonMort) B.part(.3, "fumee", { x: cr[0] - Uu * 1.4, y: cr[1] - Uu * 18, w: Uu * 2, h: Uu * 8 }, { n: 7, col: n ? "#3a4058" : "#6a6258", scale: Uu * .14 });
    B.dyn(.6, (x, t) => { for (let i = 0; i < 3; i++) { const px = ((t * Uu * (1.2 + i * .5) + i * B.W * .45) % (B.W * 1.5)) - B.W * .25, py = Y(.2 + i * .28); x.save(); x.translate(px, py); x.scale(2.4, 1); G.glow(x, 0, 0, Uu * 15, "#000000", .16, "source-over"); x.restore(); } });
    B.acteurs();
  };

  // ---------- lecture de ce que le moteur propose ----------
  const PINS = [
    { cle: "village", re: /^Village de Valdren/i, ic: "maison", ton: "gold", nom: "Valdren" },
    { cle: "bois", re: /^(Bois profond|Hors les murs)/i, ic: "arbre", ton: "ok" },
    { cle: "crete", re: /^Crête de cendre/i, ic: "dragon", ton: "ember" },
    { cle: "fort", re: /fort/i, ic: "tour", ton: "steel" },
    { cle: "moulin", re: /^Voir Varek en face/i, ic: "moulin", ton: "night", nom: "Le vieux moulin" },
  ];
  const PISTES = [[/^Remèdes/i, "fiole"], [/journal de Varek/i, "parchemin"], [/^Ysolde/i, "masque"], [/renseigne Varek/i, "loupe"], [/^Bram/i, "cle"], [/Cellules/i, "cle"]];
  const GROUPES = [["La Guilde", "tour", /^(mission-|orsan-visite|lecon|cellules)/], ["La forge d'Ivan", "enclume", /^(atelier|forge-pub|forge-sec|interroger-forgeron)/], ["Chez Hilda", "feuille", /^(ilva|herbo|interroger-guerisseuse)/],
    ["L'auberge du Gué", "lit", /^(repos|ecouter-aubergiste)/], ["La boutique d'Odile", "piece", /^boutique/], ["La cour d'armes", "epee", /^entrainer/], ["Vos papiers", "parchemin", /^archives/]];

  function lire(html) { const tmp = document.createElement("div"); tmp.innerHTML = html; lieux = []; alertes = [];
    [...tmp.children].forEach(e => { if (e.classList.contains("lieu")) { const titre = (e.querySelector("h3") || {}).textContent || "", sur = (e.querySelector(".eyebrow") || {}).textContent || "", pin = PINS.find(q => q.re.test(titre));
        const actifs = e.querySelectorAll(".act:not([disabled])").length, cle = pin ? pin.cle : "p:" + titre; let L = lieux.find(x => x.cle === cle);
        if (!L) lieux.push(L = { cle, pin, titre: pin && pin.nom || titre, sur, els: [], actifs: 0, classe: e.className }); L.els.push(e); L.actifs += actifs; }
      else alertes.push(e); }); }

  // regroupe les actions du village par bâtiment
  function grouper(e) { const acts = e.querySelector(".acts"); if (!acts) return; const boutons = [...acts.children], reste = []; const blocs = GROUPES.map(g => ({ g, b: [] }));
    boutons.forEach(b => { const a = b.dataset && b.dataset.a || "", k = blocs.find(x => x.g[2].test(a)); (k ? k.b : reste).push(b); });
    acts.innerHTML = ""; acts.classList.add("groupes"); blocs.filter(x => x.b.length).forEach(x => { const d = document.createElement("div"); d.className = "groupe"; d.innerHTML = `<div class="g-t">${ic(x.g[1])}${x.g[0]}</div>`; x.b.forEach(b => d.appendChild(b)); acts.appendChild(d); });
    if (reste.length) { const d = document.createElement("div"); d.className = "groupe"; d.innerHTML = `<div class="g-t">${ic("fleche-d")}Ailleurs</div>`; reste.forEach(b => d.appendChild(b)); acts.appendChild(d); } }

  // ---------- affichage ----------
  // Renvoie {zone, donnees} pour la scène.
  function rendre(html, o = {}) { lire(html); const ui = VG.ui, jeu = ui.el("jeu");
    if (sel && !lieux.some(l => l.cle === sel)) sel = null;
    jeu.classList.toggle("lieu-ouvert", !!sel);
    const z = ui.zone("carte", { lieu: !!sel }), N = dispo(z), D = S.dragon;
    const donnees = { noeuds: N, etat: { dragonMort: D.mort, fortTombe: S.varek.vaincu, moulin: lieux.some(l => l.cle === "moulin") } };
    // lieux principaux
    const pins = lieux.filter(l => l.pin).map(l => { const q = N[l.cle], x = z.x + q[0] * z.w, y = z.y + q[1] * z.h, urgent = l.els.some(e => /risqué|urgence|décisif/.test(e.textContent)) && false;
      return `<button class="pin t-${l.pin.ton}${sel === l.cle ? " actif" : ""}${l.actifs ? "" : " vide"}" data-lieu="${escA(l.cle)}" style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px"><span class="med">${ic(l.pin.ic)}</span><span class="nom">${esc(l.titre)}</span><span class="sous">${esc(l.sur.split("·")[0].trim())}</span></button>`; }).join("");
    ui.el("carte-pins").innerHTML = pins + `<div class="pion" style="left:${(z.x + N.village[0] * z.w).toFixed(1)}px;top:${(z.y + N.village[1] * z.h).toFixed(1)}px"></div>`;
    // pistes secondaires
    ui.el("carte-pistes").innerHTML = lieux.filter(l => !l.pin).map(l => { const k = PISTES.find(q => q[0].test(l.titre)); return `<button class="piste${sel === l.cle ? " actif" : ""}" data-lieu="${escA(l.cle)}">${ic(k ? k[1] : "oeil")}<span>${esc(l.titre)}</span></button>`; }).join("");
    // alertes
    ui.el("carte-alertes").innerHTML = alertes.map(a => `<div class="alerte" data-ui="alerte">${a.innerHTML}</div>`).join("");
    // feuille du lieu choisi
    if (sel) { const L = lieux.find(l => l.cle === sel); const h = L.els.map(e => { const c = e.cloneNode(true); if (L.cle === "village") grouper(c); return c.outerHTML; }).join(""); ui.panneau(h, { garder: o.garder && rendre.dernier === sel, ton: { village: "gold", crete: "", fort: "", bois: "ok", moulin: "night" }[sel] || "" }); rendre.dernier = sel; }
    else { ui.cacherPortrait(); rendre.dernier = null; }
    return { zone: z, donnees }; }

  function ouvrir(cle) { sel = sel === cle ? null : cle; VG.son.jouer(sel ? "page" : "clic"); VG.main.rendre({}); }
  function fermer() { if (!sel) return false; sel = null; VG.main.rendre({}); return true; }

  return { rendre, ouvrir, fermer, get sel() { return sel; }, oublier() { sel = null; } };
})();
