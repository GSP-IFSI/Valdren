// Le combat tour par tour. Les règles restent celles du moteur (agir, intentions adverses, ripostes…) :
// ce module met le duel en scène. Chaque ligne du journal de combat devient un geste : un élan, un coup,
// une parade, une esquive, un souffle de flammes, avec ses chiffres, ses étincelles et ses sons.
VG.combat = (() => {
  const { clamp, lerp, smooth, easeOut, easeIn } = VG.u, P = VG.gfx.PAL, ic = n => `<svg class="ic"><use href="#i-${n}"/></svg>`;
  let courant = null, aff = { h: 0, e: 0 }, joue = false, accel = false, heros = null, enn = null, allies = [], figurants = [], journal = [];
  const SC = () => VG.scene, FX = () => VG.scene.FX;

  // ---------- petites animations ----------
  const tw = []; let dernier = 0;
  const vit = () => (VG.reglages.get("vitesse") || 1) * (accel ? 3.2 : 1);
  function tic(now) { requestAnimationFrame(tic); const dt = Math.min(50, now - dernier) * vit(); dernier = now;
    for (let i = tw.length - 1; i >= 0; i--) { const a = tw[i]; a.t += dt; if (a.t < 0) continue; if (a.de == null && a.o) a.de = a.o[a.k] || 0; const p = clamp(a.t / a.ms, 0, 1); if (a.o) a.o[a.k] = lerp(a.de, a.a, a.ease(p)); if (p >= 1) { tw.splice(i, 1); a.res(); } } }
  requestAnimationFrame(t => { dernier = t; tic(t); });
  const anim = (o, k, a, ms, ease = smooth, delai = 0) => new Promise(res => tw.push({ o, k, a, ms, ease, t: -delai, res, de: null }));
  const pause = ms => new Promise(res => tw.push({ o: null, ms, t: 0, ease: x => x, res }));
  // aller-retour (0 → a → 0)
  const elan = async (o, k, a, aller, retour, delai = 0) => { await anim(o, k, a, aller, easeOut, delai); await anim(o, k, 0, retour, smooth); };

  // ---------- qui est qui ----------
  function decorPour(c) { const k = c.kind, n = (c.nom || "").toLowerCase();
    if (k === "dragon") return "antre"; if (k === "morghal") return "camp"; if (k === "varek") return c.final ? "bataille" : "fort";
    if (k === "geolier") return "cellule"; if (k === "traque" || k === "convoi" || k === "secours") return "route"; if (k === "raid") return "bataille"; if (k === "assaut") return c.final ? "bataille" : "fort";
    if (k === "sentinelle" || k === "bramjour") return "fort"; if (k === "adjoint") return "guilde"; if (k === "sicaire" || k === "lieutenant") return "village"; if (k === "rival") return acad() ? "lisiere" : "village";
    if (k === "secteur") return c.secteur || "lisiere";
    if (/chimère|exilé/.test(n)) return "gorge"; if (/loup|sanglier|ours|cerf/.test(n)) return "lisiere"; return "route"; }
  function spritesEnnemi(c) { const k = c.kind, n = (c.nom || "").toLowerCase(), un = (nom, opts) => [{ nom, opts: opts || {} }];
    if (k === "dragon") return un("dragon"); if (k === "morghal") return un("morghal"); if (k === "varek") return un("varek"); if (k === "rival") return un(acad() ? "kael" : "selena");
    if (/vieux gris/.test(n)) return un("vieux-gris"); if (/meute/.test(n)) return [{ nom: "loup" }, { nom: "loup", opts: { seed: 2 } }, { nom: "loup", opts: { seed: 3 } }]; if (/loup/.test(n)) return un("loup");
    if (/sanglier/.test(n)) return un("sanglier", { geant: /géant/.test(n) }); if (/ours/.test(n)) return un("ours"); if (/cerf/.test(n)) return un("cerf"); if (/guivre/.test(n)) return un("guivre"); if (/crapaud/.test(n)) return un("crapaud");
    if (/lynx/.test(n)) return un("lynx"); if (/ogre/.test(n)) return un("ogre"); if (/chimère/.test(n)) return un("chimere"); if (/exilé/.test(n)) return un("exile"); if (/traqueur/.test(n)) return un("traqueur");
    if (/rôdeur/.test(n)) return un("rodeur"); if (/pillard/.test(n)) return un("pillard"); if (/déserteur/.test(n)) return un("deserteur"); if (/bretteur/.test(n)) return un("bretteur"); if (/maître d'armes/.test(n)) return un("maitre");
    if (/chasseur/.test(n)) return un("chasseur"); if (/tueur/.test(n)) return un("sicaire"); if (/geôliers/.test(n)) return [{ nom: "geolier" }, { nom: "garde", opts: { seed: 2 } }]; if (/geôlier/.test(n)) return un("geolier");
    if (/lieutenant|second|bras droit/.test(n)) return un("lieutenant"); if (/capitaine|avant-garde|garde noire/.test(n)) return [{ nom: "capitaine" }, { nom: "garde", opts: { seed: 2 } }];
    if (/escorte|milice|sbires|hommes|renégats|pillards|gardes/.test(n)) return [{ nom: "pillard" }, { nom: "garde", opts: { seed: 2 } }, { nom: "deserteur", opts: { seed: 3 } }];
    if (/sentinelle|garde/.test(n)) return un("garde"); if (k === "adjoint") return un("guilde"); if (k === "assaut" || k === "raid") return [{ nom: "capitaine" }, { nom: "pillard", opts: { seed: 2 } }];
    return un(c.style === "brut" && k !== "guilde" ? "loup" : "soldat"); }
  function spriteHeros() { const q = S.equip || {}; return { nom: acad() ? "heros-acad" : "heros-aven", opts: { arme: S.arme, bouclier: S.arme === "epee" && q.bouclier ? "rond" : null, arme2: S.arme === "dague" && q.dague2 ? "dague" : null } }; }
  function spriteAllie(a) { const n = a.nom.toLowerCase(); if (/meute/.test(n)) return ["loup", "loup"]; if (/loup/.test(n)) return ["loup"]; if (/ours/.test(n)) return ["ours"]; if (/séléna/.test(n)) return ["selena"]; if (/kael/.test(n)) return ["kael"]; if (/orsan/.test(n)) return ["orsan"]; if (/escouade|garnison|milice/.test(n)) return ["guilde", "guilde-lance"]; return [a.h ? "guilde" : "loup"]; }

  // ---------- entrée en combat ----------
  function entrer(c) { courant = c; aff = { h: S.pv, e: c.pv }; joue = false; accel = false; journal = c.lignes.slice();
    const es = spritesEnnemi(c), L = [], h = spriteHeros(); let ia = 0;
    c.allies.slice(0, 4).forEach((a, i) => spriteAllie(a).forEach((nom, j) => { if (ia >= 4) return; L.push({ nom, cle: "allie" + i + "-" + j, opts: { seed: 10 + ia }, u: .13 - ia * .055 + (ia % 2 ? .02 : 0), sens: 1, k: .8, plan: -2 - ia, yDec: -1.2 - (ia % 2) * 1.2, allie: i }); ia++; }));
    L.push({ nom: h.nom, cle: "heros", opts: h.opts, u: ia ? .3 : .26, sens: 1, plan: 2 });
    es.slice(1).forEach((e, i) => L.push({ nom: e.nom, cle: "fig" + i, opts: e.opts || {}, u: .86 + i * .07, sens: -1, k: .86, plan: -1 - i, yDec: -1.5 - i }));
    L.push({ nom: es[0].nom, cle: "ennemi", opts: es[0].opts || {}, u: es.length > 1 ? .7 : .73, sens: -1, plan: 1 });
    cadrer(); const A = SC().poser(L); heros = A.find(a => a.cle === "heros"); enn = A.find(a => a.cle === "ennemi"); allies = A.filter(a => a.cle.startsWith("allie")); figurants = A.filter(a => a.cle.startsWith("fig"));
    L.forEach(d => { if (d.allie != null) A.find(a => a.cle === d.cle).allieIdx = d.allie; });
    [heros, enn].concat(allies, figurants).forEach(a => { a.dx = 0; a.dy = 0; a.st = {}; });
    posture(c); VG.son.ambiance(c.kind === "dragon" ? "antre" : c.kind === "assaut" || c.kind === "raid" ? "bataille" : S.moment ? "nuit" : "dehors");
    if (c.tour === 0 && !c.vu) { c.vu = true; annonceDuel(c); } }
  function cadrer() { const c = courant; if (!c) return; VG.scene.montrer(decorPour(c), { nuit: S.moment === 1, zone: VG.ui.zone("combat") }); SC().placer(); }
  function annonceDuel(c) { const d = document.createElement("div"); d.className = "duel-annonce"; d.innerHTML = `<span>${esc(lieuNom(c))}</span><b>${esc(c.nom)}</b><i>${c.kind === "morghal" ? "force inconnue" : "niveau " + c.niv}</i>`; VG.ui.el("combat-ui").appendChild(d); setTimeout(() => d.remove(), 2300);
    VG.son.jouer(c.kind === "dragon" || c.kind === "morghal" ? "rugir" : "annonce"); if (enn) { enn.dx = 26; anim(enn, "dx", 0, 700, easeOut); } }
  // posture durable de l'adversaire : ce qu'il prépare se voit sur son corps
  function posture(c) { if (!enn) return; const st = enn.st, vu = c.kind !== "dragon" && tellVisible(c) && c.pv > 0;
    st.charge = vu && c.intent === "lourd" ? 1 : 0; st.garde = vu && c.intent === "garde" ? 1 : 0;
    if (c.kind === "dragon") { st.dort = c.endormi ? 1 : 0; st.blesse = c.blesse ? 1 : 0; st.recule = c.choix === "recule" ? 1 : 0; st.chute = c.choix === "grace" ? .75 : 0; st.charge = c.humeur === "colere" || c.humeur === "accule" ? .5 : 0; }
    if (c.kind === "morghal") st.phase2 = c.phase2 ? 1 : 0; }

  const lieuNom = c => c.kind === "dragon" ? "Crête de cendre" : c.kind === "varek" ? (c.final ? "Valdren · la charge" : "Fort de Varek") : c.kind === "geolier" ? "Fort de Varek · les cellules" : c.kind === "traque" ? "Chemin de Valdren" : c.kind === "raid" ? "Valdren · le raid" : c.kind === "assaut" ? (c.final ? "Valdren · bataille du Gué" : "Fort de Varek · l'assaut") : c.kind === "morghal" ? "Bois profond" : c.kind === "guilde" ? "Contrat de rang " + RANGS[c.rang].k : c.kind === "rival" ? "Duel nocturne" : c.kind === "sicaire" ? "Ruelle du Gué" : SECTEURS[c.secteur] ? SECTEURS[c.secteur].nom : "Combat";

  // ---------- interface ----------
  const ICONES = { att: "epee", def: "bouclier", esq: "esquive", obs: "oeil", desespere: "fatal", braise: "flamme", fuir: "fuite", baume: "fiole", tisane: "fiole", laisser: "esquive", barrer: "bouclier", epargner: "coeur", achever: "crane", surprise: "fatal", retirer: "fuite" };
  const icone = a => ICONES[a] || (a.startsWith("fl-") ? "fleche" : a.startsWith("arme-") ? "echange" : "cible");
  const INTENT = { frappe: ["epee", "Coup direct"], lourd: ["lourd", "Coup lourd"], brise: ["brise", "Brise-garde"], feinte: ["masque", "Feinte"], garde: ["bouclier", "Garde fermée"] };

  function rendre(o = {}) { const c = S.scene.c; if (c !== courant) entrer(c); const ui = VG.ui, dr = c.kind === "dragon";
    const tmp = document.createElement("div"); tmp.innerHTML = rCombat(); const boutons = [...tmp.querySelectorAll(".cbtns .act")], lect = tmp.querySelector(".intent"), pills = [...tmp.querySelectorAll(".head .row .pill")].slice(1);
    // les deux plaques
    const pm = pvMax(), etats = []; if (c.riposte) etats.push(`<span class="pill ok">riposte prête</span>`); if ((c.chg || 0) > 0) etats.push(`<span class="pill ember">charge ×${c.chg}</span>`); if (S.blessure) etats.push(`<span class="pill bad">blessé</span>`); if (persev()) etats.push(`<span class="pill mid">à bout · XP +${persev()} %</span>`);
    ui.el("c-duel").innerHTML = `<div class="plaque h"><div class="p-nom"><b>Vous</b><span class="pill">niv. ${S.niv}</span><span class="p-arme">${ARMES[S.arme].nom}</span></div><div class="jauge pv${S.pv / pm < .35 ? " bas" : ""}"><i id="c-pvh" style="width:${clamp(aff.h / pm, 0, 1) * 100}%"></i></div><div class="p-bas"><span class="mono" id="c-pvht">${Math.max(0, Math.round(aff.h))} / ${pm}</span><span class="p-etats">${etats.join("")}</span></div></div>
      <div class="tour"><span>tour</span><b>${c.tour}</b></div>
      <div class="plaque e"><div class="p-nom"><b>${esc(c.nom)}</b><span class="pill ember">${c.kind === "morghal" ? (morghalNomme() ? "≈ Varek" : "?") : "niv. " + c.niv}</span></div><div class="jauge foe"><i id="c-pve" style="width:${clamp(aff.e / c.pvMax, 0, 1) * 100}%"></i></div><div class="p-bas"><span class="mono" id="c-pvet">${Math.max(0, Math.round(aff.e))} / ${c.pvMax}</span><span class="p-etats">${pills.map(p => p.outerHTML).join("")}</span></div></div>`;
    // ce qu'il prépare
    let bulle = ""; if (!dr && c.pv > 0) { const vu = tellVisible(c), I = vu ? INTENT[c.intent] : null; bulle = `<div class="bulle ${vu ? "vu i-" + c.intent : "cache"}">${ic(I ? I[0] : "doute")}<div><b>${I ? I[1] : "Intention cachée"}</b><span>${vu ? "Réponse sûre : " + esc(PARADE[c.intent]) : "Observer révèle ses coups"}</span></div></div>`; }
    const extra = lect ? [...lect.children].filter((x, i) => dr || i >= 2).map(x => x.outerHTML).join("") : "";
    ui.el("c-lecture").innerHTML = bulle + (extra ? `<div class="note">${dr && lect ? lect.innerHTML : extra}</div>` : "");
    // commandes
    const B = boutons.map(b => ({ a: b.dataset.a, k: b.dataset.a.slice(2), t: (b.querySelector(".t") || {}).textContent || "", d: (b.querySelector(".d") || {}).innerHTML || "", c: (b.querySelector(".c") || {}).textContent || "", off: b.disabled }));
    const coeur = ["att", "def", "esq", "obs"], princ = B.filter(b => coeur.includes(b.k)), autres = B.filter(b => !coeur.includes(b.k));
    const bouton = (b, cls) => `<button class="cmd ${cls} k-${b.k.split("-")[0]}" data-a="${b.a}" ${b.off || joue ? "disabled" : ""}>${ic(icone(b.k))}<span class="t">${esc(b.t)}</span>${b.c ? `<span class="c">${esc(b.c)}</span>` : ""}<span class="d">${b.d}</span></button>`;
    ui.el("c-cmd").innerHTML = (princ.length ? `<div class="cmd-p n${princ.length}">${princ.map(b => bouton(b, "p")).join("")}</div>` : "") + (autres.length ? `<div class="cmd-s${princ.length ? "" : " seul"}">${autres.map(b => bouton(b, princ.length ? "s" : "p choix")).join("")}</div>` : "");
    ui.el("combat-ui").classList.toggle("joue", joue);
    if (!o.sansJournal) ecrireJournal();
    if (!joue) posture(c);
    cadrer(); }
  function ecrireJournal(n) { const J = VG.ui.el("c-journal"), L = n == null ? journal : journal.slice(0, n); J.innerHTML = L.map((l, i) => `<p class="${l[0] || "nar"}${i === L.length - 1 ? " dernier" : ""}">${esc(l[1])}</p>`).join(""); J.scrollTop = J.scrollHeight; }
  function jauges(c) { const pm = pvMax(), h = document.getElementById("c-pvh"), e = document.getElementById("c-pve"); if (!h || !e) return;
    h.style.width = clamp(aff.h / pm, 0, 1) * 100 + "%"; e.style.width = clamp(aff.e / c.pvMax, 0, 1) * 100 + "%"; h.parentNode.classList.toggle("bas", aff.h / pm < .35);
    document.getElementById("c-pvht").textContent = Math.max(0, Math.round(aff.h)) + " / " + pm; document.getElementById("c-pvet").textContent = Math.max(0, Math.round(aff.e)) + " / " + c.pvMax; }

  // ---------- un tour, geste par geste ----------
  function lire(lignes, c) { return lignes.map(([cls, txt]) => { const m = txt.match(/(\d+)\s*dégâts/), dmg = m ? +m[1] : 0, s = txt.match(/\+(\d+)\s*PV/), soin = s ? +s[1] : 0, b = { cls, txt, dmg, soin, type: "texte" };
      if (cls === "you") { if (dmg) { b.type = "hAtt"; b.glisse = /glisse/.test(txt); } else if (/couvrez|dague levée/.test(txt)) b.type = "hGarde"; else if (/appuis|esquiver/.test(txt)) b.type = "hPret"; else if (/lisez|étudiez|apprenez|voyez/.test(txt)) b.type = "obs"; else if (/Braise/.test(txt)) b.type = "braise"; else if (/passez à/.test(txt)) b.type = "arme"; else if (/issue/.test(txt)) b.type = "fuiteRatee"; }
      else if (cls === "them") { if (/eau noire/.test(txt) && dmg) b.type = "poisonH"; else if (dmg) { b.type = "eAtt"; b.lourd = /lourd|mur de braise|tombe sur vous/i.test(txt); b.brise = /brise/i.test(txt); b.feinte = /feinte/i.test(txt); b.couvert = /couvert/.test(txt) && !/brise/.test(txt); b.flammes = /flammes/i.test(txt); b.manque = /esquive manquée/.test(txt); }
        else if (/derrière sa garde/.test(txt)) b.type = "eGarde"; else if (/pare à moitié/.test(txt)) b.type = "ePare"; else if (/hurlement|s'éveille|paupière|ombre couvre/.test(txt)) b.type = "eCri"; else b.type = "eTexte"; }
      else if (cls === "ally") { if (dmg) { b.type = "aAtt"; b.qui = c.allies.findIndex(a => txt.startsWith(a.nom)); } }
      else if (cls === "good") { if (/esquivez|roulez|vous manque|à distance/.test(txt)) b.type = "hEsq"; else if (soin) b.type = "soin"; else if (dmg) b.type = "dot"; else if (/coupez sa feinte/.test(txt)) b.type = "coupe"; else b.type = "bon"; }
      else if (cls === "tell") b.type = "annonce";
      return b; }); }

  const dist = () => (enn.bx - heros.bx) / SC().B.U;
  const tete = a => SC().ancre(a, "tete"), coeur = a => SC().ancre(a, "coeur");
  function frappeSur(cible, dmg, max, o = {}) { const [x, y] = coeur(cible), k = clamp(dmg / Math.max(1, max), .04, 1), gros = k > .22;
    cible.flash = 1; cible.flashCol = o.col || "#ffffff"; anim(cible.st, "touche", 1, 90, easeOut).then(() => anim(cible.st, "touche", 0, 300));
    elan(cible, "dx", (cible === heros ? -1 : 1) * (2 + k * 9), 80, 260);
    FX().gerbe(x, y, o.gerbe || (cible === heros ? "#ff9d7a" : P.feu), gros ? 20 : 11, .7 + k * 1.2);
    const [tx, ty] = tete(cible); FX().texte(tx, ty, String(dmg), o.txt || (cible === heros ? "#ff8c74" : "#fff3c9"), .8 + k * 1.3);
    SC().secouer(.25 + k * 1.6); if (gros) { SC().coupDeZoom(.012 + k * .03); SC().eclair(cible === heros ? "#7a1a10" : "#fff6dc", .08 + k * .2); } }

  async function geste(b, c, i) { ecrireJournal(i + 1); const U = SC().B.U, pm = pvMax(), arc = heros.arc;
    switch (b.type) {
      case "hAtt": { const [ex, ey] = coeur(enn), rapide = b.suite;
        if (arc) { VG.son.jouer("fleche"); anim(heros.st, "tir", 1, rapide ? 200 : 360, x => x).then(() => { heros.st.tir = 0; }); await pause(rapide ? 120 : 230); const [hx, hy] = coeur(heros); await new Promise(r => FX().trait(hx + 6 * U, hy - 3 * U, ex, ey, "#e9e2cf", .13, r)); }
        else { const D = dist() * .5; anim(heros.st, "att", 1, rapide ? 240 : 430, x => x).then(() => { heros.st.att = 0; }); if (!rapide) { anim(heros, "dx", D, 190, easeIn, 60).then(() => anim(heros, "dx", 0, 300, smooth, 150)); await pause(215); } else await pause(110);
          VG.son.jouer(b.glisse ? "parade" : "lame"); FX().taille(ex, ey - 2 * U, 1, "#fff6dc", S.arme === "dague" ? .7 : 1.05); }
        aff.e = Math.max(0, aff.e - b.dmg); jauges(c); if (b.glisse) { FX().parade(ex, ey, -1); const [tx, ty] = tete(enn); FX().texte(tx, ty, String(b.dmg), "#c9d6dc", .7); SC().secouer(.2); } else { frappeSur(enn, b.dmg, c.pvMax); VG.son.jouer(b.dmg / c.pvMax > .22 ? "lourd" : "coup"); }
        await pause(rapide ? 170 : 400); break; }
      case "braise": { const [hx, hy] = SC().ancre(heros, "bouche"), [ex, ey] = coeur(enn); VG.son.jouer("feu"); anim(heros.st, "charge", 1, 200); FX().flammes(hx, hy, ex, ey, .75); SC().eclair(P.feu2, .18); await pause(520); anim(heros.st, "charge", 0, 200); break; }
      case "hGarde": VG.son.jouer("clic"); await anim(heros.st, "garde", 1, 180); await pause(160); break;
      case "hPret": VG.son.jouer("clic"); anim(heros.st, "garde", .35, 160); await pause(260); break;
      case "obs": { const [x, y] = tete(enn); VG.son.jouer("regard"); FX().regard(x, y); await pause(620); break; }
      case "arme": { const h = spriteHeros(), L = SC().acteurs.map(a => ({ nom: a.cle === "heros" ? h.nom : a.nom, cle: a.cle, opts: a.cle === "heros" ? h.opts : JSON.parse(a.sig), u: a.u, sens: a.sens, k: a.k, plan: a.plan, yDec: a.yDec, st: a.st }));
        const A = SC().poser(L); heros = A.find(a => a.cle === "heros"); heros.alpha = .4; VG.son.jouer("lame"); await pause(260); break; }
      case "fuiteRatee": await elan(heros, "dx", -12, 200, 260); break;
      case "eGarde": VG.son.jouer("clic"); await anim(enn.st, "garde", 1, 220); await pause(300); break;
      case "ePare": VG.son.jouer("parade"); anim(enn.st, "garde", 1, 120); await pause(120); break;
      case "eCri": { const [x, y] = tete(enn); VG.son.jouer("rugir"); enn.st.dort = 0; FX().onde(x, y, P.braise, 1.6); SC().secouer(1.2); await pause(700); break; }
      case "eTexte": await pause(520); break;
      case "eAtt": { const [hx, hy] = coeur(heros), dr = c.kind === "dragon";
        if (dr && b.flammes) { VG.son.jouer("feu"); await anim(enn.st, "souffle", 1, 260); const [bx, by] = SC().ancre(enn, "bouche"); FX().flammes(bx, by, hx, hy, .85); SC().eclair(P.feu2, .16); await pause(330); }
        else { const D = -dist() * (enn.humain ? .5 : .34); enn.st.charge = 0; anim(enn.st, "att", 1, 460, x => x).then(() => { enn.st.att = 0; }); anim(enn, "dx", D, 200, easeIn, 70).then(() => anim(enn, "dx", 0, 320, smooth, 140)); await pause(240); FX().taille(hx, hy - 2 * U, -1, b.lourd ? "#ffc9a0" : "#f3f6ff", b.lourd ? 1.35 : 1); }
        aff.h = Math.max(0, aff.h - b.dmg); jauges(c);
        if (b.couvert) { VG.son.jouer("parade"); FX().parade(hx + 3 * U, hy, 1); const [tx, ty] = tete(heros); FX().texte(tx, ty, String(b.dmg), "#bcd7ea", .75); FX().texte(tx, ty - 5 * U, "Paré", P.acier, .55); SC().secouer(.35); elan(heros, "dx", -3, 70, 200); }
        else { frappeSur(heros, b.dmg, pm, { col: b.flammes ? "#ffb35a" : "#ffffff" }); VG.son.jouer(b.brise ? "brise" : b.lourd || b.dmg / pm > .25 ? "lourd" : "coup"); const [tx, ty] = tete(heros); if (b.brise) FX().texte(tx, ty - 6 * U, "Garde brisée", P.bad, .55); else if (b.feinte) FX().texte(tx, ty - 6 * U, "Feinte !", P.nuit, .55); anim(heros.st, "garde", 0, 120); }
        if (dr && b.flammes) { await pause(300); anim(enn.st, "souffle", 0, 300); }
        await pause(430); break; }
      case "poisonH": { const [x, y] = coeur(heros); VG.son.jouer("poison"); FX().miasme(x, y, "#6fae8a"); aff.h = Math.max(0, aff.h - b.dmg); jauges(c); const [tx, ty] = tete(heros); FX().texte(tx, ty, String(b.dmg), "#9fd6b4", .7); heros.flash = .5; heros.flashCol = "#3f8a66"; await pause(520); break; }
      case "hEsq": { const D = -dist() * (enn.humain ? .45 : .3); VG.son.jouer("esquive"); if (!/distance|manque/.test(b.txt) || true) { anim(enn.st, "att", 1, 420, x => x).then(() => { enn.st.att = 0; }); anim(enn, "dx", D, 190, easeIn, 40).then(() => anim(enn, "dx", 0, 300, smooth, 120)); }
        anim(heros.st, "esq", 1, 520, x => x).then(() => { heros.st.esq = 0; }); elan(heros, "dx", -13, 200, 330, 60); await pause(240); const [tx, ty] = tete(heros); FX().texte(tx, ty, "Esquive !", P.acier, .62); VG.son.jouer("rate"); anim(heros.st, "garde", 0, 120); await pause(420); break; }
      case "soin": { const [x, y] = SC().ancre(heros, "coeur"); VG.son.jouer("soin"); FX().soin(x, SC().B.sol); aff.h = Math.min(pm, aff.h + b.soin); jauges(c); const [tx, ty] = tete(heros); FX().texte(tx, ty, "+" + b.soin, P.ok, .9); await pause(650); break; }
      case "dot": { const [x, y] = coeur(enn); VG.son.jouer("poison"); FX().miasme(x, y); aff.e = Math.max(0, aff.e - b.dmg); jauges(c); const [tx, ty] = tete(enn); FX().texte(tx, ty, String(b.dmg), "#a6e3b8", .7); enn.flash = .5; enn.flashCol = "#3f8a66"; await pause(480); break; }
      case "coupe": { const [tx, ty] = tete(enn); FX().texte(tx, ty - 4 * U, "Feinte coupée", P.ok, .55); await pause(140); break; }
      case "bon": { const [x, y] = coeur(heros); FX().onde(x, y, P.ok, .5); VG.son.jouer("regard"); await pause(560); break; }
      case "aAtt": { const al = allies.filter(a => a.allieIdx === b.qui)[0] || allies[0], [ex, ey] = coeur(enn); if (al) { const D = (enn.bx - al.bx) / U * .55; anim(al.st, "att", 1, 380, x => x).then(() => { al.st.att = 0; }); anim(al, "dx", D, 170, easeIn, 30).then(() => anim(al, "dx", 0, 280, smooth, 110)); await pause(190); }
        VG.son.jouer("coup"); FX().taille(ex, ey, 1, "#cfe6f5", .75); aff.e = Math.max(0, aff.e - b.dmg); jauges(c); frappeSur(enn, b.dmg, c.pvMax, { txt: "#bfe1f5" }); await pause(al ? 330 : 240); break; }
      case "annonce": { const [x, y] = tete(enn); VG.son.jouer("annonce"); if (/lourd|ramasse ses appuis/.test(b.txt)) anim(enn.st, "charge", 1, 260); else if (/garde/.test(b.txt)) anim(enn.st, "garde", 1, 260); FX().onde(x, y, P.mid, .55); if (/recule|s'affaisse|fend/.test(b.txt)) { posture(c); SC().secouer(.6); } await pause(620); break; }
      default: await pause(Math.min(900, 380 + b.txt.length * 5));
    } }

  // a : action « c-… ». Fait jouer le moteur, puis raconte le tour.
  async function jouer(a) { if (joue) { accel = true; return; } const c = S.scene.c; if (!c) return; const avant = { h: S.pv, e: c.pv, arme: S.arme };
    MOTEUR_action(a); const fini = S.scene.t !== "combat" || S.scene.c !== c, lignes = c.lignes.slice();
    aff.h = avant.h; aff.e = avant.e; journal = lignes; joue = true; accel = false;
    VG.ui.el("combat-ui").classList.add("joue"); VG.ui.el("c-cmd").querySelectorAll("button").forEach(b => b.disabled = true);
    const G = lire(lignes, c); G.forEach((b, i) => { if (b.type === "hAtt" && i && G[i - 1].type === "hAtt") b.suite = true; });
    try { for (let i = 0; i < G.length; i++) await geste(G[i], c, i); } catch (e) { console.error(e); }
    // fin du tour : on relâche les postures
    anim(heros.st, "garde", 0, 160); heros.st.esq = 0; enn.st.att = 0; if (!fini) { aff.h = S.pv; aff.e = c.pv; }
    if (fini) await denouement(c, a, avant);
    joue = false; accel = false; VG.main.rendre({}); }

  async function denouement(c, a, avant) { const t = S.scene.t, sc = S.scene;
    if (c.soumis && t === "soumis") { VG.son.jouer("tomber"); await anim(enn.st, "chute", 1, 700); await pause(200); return; }
    if (c.pv <= 0) { aff.e = 0; jauges(c); VG.son.jouer("tomber"); SC().secouer(.8); anim(enn.st, "chute", 1, 800); figurants.forEach((f, i) => anim(f.st, "chute", 1, 700, smooth, 120 + i * 140)); await pause(650); VG.son.jouer("victoire"); anim(heros.st, "joie", 1, 400); const [x, y] = coeur(heros); FX().onde(x, y, P.or, 1); await pause(700); return; }
    if (aff.h <= 0 || (t === "issue" && sc.cls === "bad" && avant.h > 0 && S.pv < avant.h && a !== "c-fuir")) { aff.h = 0; jauges(c); VG.son.jouer("defaite"); SC().eclair("#5a0f0a", .35); await anim(heros.st, "chute", 1, 800); await pause(500); return; }
    if (a === "c-fuir" && t !== "combat") { VG.son.jouer("esquive"); anim(heros, "alpha", 0, 500); heros.alphaCible = 0; await anim(heros, "dx", -40, 600, easeIn); return; }
    if (t === "issue" && /fui|recule|s'envol|rompt|évad/i.test((sc.titre || "") + (sc.texte || ""))) { enn.alphaCible = 0; await anim(enn, "dx", 40, 700, easeIn); return; }
    await pause(350); }

  // après le combat : on garde les personnages en scène pour l'écran d'issue
  function quitter() { courant = null; joue = false; }
  const actif = () => joue;

  return { rendre, jouer, entrer, quitter, actif, decorPour, cadrer, get courant() { return courant; }, spriteHeros };
})();
