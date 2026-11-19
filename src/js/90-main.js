// Chef d'orchestre : relie le moteur de règles (S, MOTEUR_action, MOTEUR_html…) à la mise en scène.
// Le moteur décide de tout ; ici on choisit seulement comment le montrer.
VG.main = (() => {
  const ui = VG.ui, el = id => document.getElementById(id);
  let decorCourant = null, enJeu = false;
  const nuit = () => S.moment === 1;

  // ---------- mise en scène des écrans de récit ----------
  const NOMS = { village: ["Valdren", "le village du Gué"], lisiere: ["Lisière des ronces", "bois profond"], marais: ["Marais de la Guivre", "bois profond"], gorge: ["Gorge des Traqueurs", "bois profond"], crete: ["Crête de cendre", "le sentier"],
    antre: ["L'antre du dragon", "Crête de cendre"], fort: ["Fort de Varek", "l'objectif"], cellule: ["Les cellules", "sous bonne garde"], forge: ["La forge d'Ivan", "Valdren"], herbo: ["Chez Hilda", "Valdren"], guilde: ["La Guilde", "antenne de l'Académie"],
    auberge: ["L'auberge du Gué", "Valdren"], bataille: ["Valdren en armes", "la barrière du Gué"], camp: ["Bois profond", "à la belle étoile"], route: ["Route du nord", "hors les murs"] };
  const AMB = { antre: "antre", forge: "dedans", herbo: "dedans", guilde: "dedans", auberge: "dedans", cellule: "dedans", bataille: "bataille", marais: "marais" };

  function miseEnScene(t, sc) { const hs = VG.combat.spriteHeros(), tendu = /^(rival|traque|sicaire|raid|charge|foret|veilleForet|varekNuit|fort|assaut|raidA|raidB)$/.test(t), calme = tendu ? 0 : 1;
    const h = (o = {}) => Object.assign({ nom: hs.nom, cle: "heros", opts: hs.opts, u: .22, sens: 1, plan: 2 }, o, { st: Object.assign({ calme }, o.st) });
    const pnj = (nom, o = {}) => Object.assign({ nom, cle: "pnj-" + nom + (o.i || ""), u: .72, sens: -1, plan: 1, opts: {} }, o, { st: Object.assign({ calme }, o.st) }), D = S.dragon;
    const dragon = st => pnj("dragon", { u: .7, st: st || {} });
    switch (t) {
      case "antre": { const e = sc.e || ""; return { decor: "antre", acteurs: [h({ u: .16 })].concat(e === "chasse" || e === "parti" ? [] : [dragon({ dort: e.startsWith("endormi") ? 1 : 0, blesse: e.includes("blesse") ? 1 : 0 })]) }; }
      case "ami": case "parole": case "tenir": return { decor: "antre", acteurs: [h({ u: .16 }), dragon()] };
      case "reveil": return { decor: "antre", acteurs: [h({ u: .18, st: { chute: .7 } }), dragon()] };
      case "veille": return { decor: "antre", acteurs: [h({ u: .2 }), dragon({ dort: .8, blesse: 1 })] };
      case "fort": case "assaut": case "raidA": case "raidB": return { decor: "fort", acteurs: [h()].concat(S.varek.vaincu ? [] : [pnj("garde", { u: .74 }), pnj("garde", { u: .86, i: 2, k: .9, plan: 0, opts: { seed: 2 } })]) };
      case "cellule": return { decor: "cellule", acteurs: [h({ u: .4, st: { chute: .45 } })] };
      case "cellules": return { decor: "cellule", nuit: true, acteurs: [h(), pnj("varek", { st: { chute: .35 } })] };
      case "dehors": return { decor: "lisiere", nuit: true, acteurs: [h({ u: .3 })] };
      case "loup": return { decor: "lisiere", acteurs: [h(), pnj("loup", { st: { chute: .8 }, u: .66 })] };
      case "rival": return { decor: acad() ? "lisiere" : "village", nuit: true, acteurs: [h(), pnj(acad() ? "kael" : "selena")] };
      case "foret": return { decor: "lisiere", acteurs: [h(), pnj("vieux-gris", { u: .68 })].concat(foretAmie() ? [pnj("loup", { u: .84, i: 2, plan: 0, k: .9, opts: { seed: 2 } }), pnj("loup", { u: .93, i: 3, plan: -1, k: .85, opts: { seed: 3 } })] : []) };
      case "veilleForet": return { decor: "camp", nuit: true, acteurs: [h({ u: .3 }), pnj("morghal", { u: .78, alpha: .92 })] };
      case "fumee": case "varekForet": return { decor: "lisiere", acteurs: [h({ u: .3 })] };
      case "traque": return { decor: "route", acteurs: [h({ u: .3 }), pnj("chasseur", { u: .8 })] };
      case "bramRetour": return { decor: "route", acteurs: [h({ u: .3 })] };
      case "raid": return { decor: "bataille", acteurs: [h(), pnj("capitaine", { u: .74 }), pnj("pillard", { u: .87, i: 2, plan: 0, k: .9 })] };
      case "charge": return { decor: "bataille", acteurs: [h(), pnj("varek", { u: .72 }), pnj("capitaine", { u: .87, i: 2, plan: 0, k: .9 })] };
      case "verdict": case "grace": return { decor: sc.lieu === "fort" || (sc.prev && sc.prev.lieu === "fort") ? "fort" : "bataille", acteurs: [h(), pnj("varek", { u: .64, st: { chute: .42 } })] };
      case "orsan": case "conseil": return { decor: "guilde", nuit: false, acteurs: [h()].concat(orsanAbsent() && !destitue() ? [pnj("guilde")] : [pnj("orsan")]) };
      case "convoc": case "confront": case "verite": case "fauxCircule": case "accuser": case "role": case "achat": case "verif": case "confier": case "piegeInfo": return { decor: "guilde", nuit: false, acteurs: [h(), pnj("guilde", { u: .76 })] };
      case "atelier": case "convoiScene": return { decor: "forge", nuit: false, acteurs: [h({ u: .26 }), pnj("ivan", { u: .68 })] };
      case "herbo": return { decor: "herbo", nuit: false, acteurs: [h({ u: .26 }), pnj("hilda", { u: .68 })] };
      case "boutique": return { decor: "auberge", acteurs: [h({ u: .26 }), pnj("odile", { u: .7 })] };
      case "sicaire": return { decor: "village", nuit: true, acteurs: [h(), pnj("sicaire", { u: .76 })] };
      case "varekNuit": return { decor: S.rdv && S.rdv.route === "infil" ? "fort" : "route", nuit: true, acteurs: [h(), pnj("varek")] };
      case "invitVarek": case "piege": return { decor: "village", acteurs: [h({ u: .3 })] };
      case "fin": return { decor: "titre", nuit: false, acteurs: [] };
      case "issue": case "soumis": case "archives": return null; // on reste où l'on est
    }
    const L = S.lieu || "village"; return { decor: { village: "village", dehors: "lisiere", fort: "fort", antre: "antre", cellule: "cellule" }[L] || "village", acteurs: [h({ u: .3 })] }; }

  // ---------- rendu ----------
  function rendre(o = {}) { if (!enJeu) return;
    MOTEUR_resoudre(); rFiche(); rMonde(); ui.hud();
    const t = S.scene.t, jeu = el("jeu");
    if (t !== "combat" && VG.combat.courant) VG.combat.quitter();
    if (t !== "carte") jeu.classList.remove("lieu-ouvert");
    if (!S.origine) { ui.mode("origine"); ui.panneau(MOTEUR_html(), o); VG.carte.oublier(); decorCourant = null; VG.scene.montrer("titre", { nuit: false, zone: ui.zone("plein"), acteurs: [] }); VG.son.ambiance("dehors"); }
    else if (t === "carte") { ui.mode("carte"); const r = VG.carte.rendre(MOTEUR_html(), o); decorCourant = "carte"; ui.cartouche(null);
      VG.scene.montrer("carte", { nuit: nuit(), zone: r.zone, donnees: r.donnees, var: JSON.stringify(r.donnees.etat), acteurs: [] }); VG.son.ambiance(nuit() ? "nuit" : "dehors"); }
    else if (t === "combat") { ui.mode("combat"); ui.cacherPortrait(); ui.cartouche(null); VG.combat.rendre(o); decorCourant = VG.combat.decorPour(S.scene.c); }
    else { ui.mode(t === "fin" ? "fin" : "recit"); ui.panneau(MOTEUR_html(), o); const m = miseEnScene(t, S.scene), z = ui.zone(t === "fin" ? "plein" : "recit");
      if (m) { const n = m.nuit == null ? nuit() : m.nuit; if (m.decor !== decorCourant && NOMS[m.decor]) ui.cartouche(NOMS[m.decor][0], NOMS[m.decor][1]); decorCourant = m.decor; VG.scene.montrer(m.decor, { nuit: n, zone: z, acteurs: m.acteurs }); VG.son.ambiance(AMB[m.decor] || (n ? "nuit" : "dehors")); }
      else if (decorCourant && decorCourant !== "carte" && VG.scene.B) VG.scene.montrer(VG.scene.B.cle, { nuit: VG.scene.B.nuit, zone: z });
      else { const f = miseEnScene("?", S.scene); decorCourant = f.decor; VG.scene.montrer(f.decor, { nuit: nuit(), zone: z, acteurs: f.acteurs }); }
      ui.placerPortrait(); }
    save(); }

  // ---------- actions ----------
  const avant = () => ({ jour: S.jour, moment: S.moment, log0: S.log[0], niv: S.niv, or: S.or || 0, origine: S.origine, fin: !!S.fin });
  function apres(av, a) {
    const i = S.log.indexOf(av.log0), neufs = (i < 0 ? S.log.slice(0, 3) : S.log.slice(0, i)).slice(0, 3);
    if (av.origine && S.origine) neufs.reverse().forEach((l, k) => setTimeout(() => ui.toast(l.t, l.c), 250 + k * 500));
    if (S.origine && !S.fin && av.origine && (S.jour !== av.jour || S.moment !== av.moment)) ui.passage(S.moment === 1, S.jour);
    else if (!av.origine && S.origine) ui.passage(false, 1, "Trente-cinq jours avant l'offensive");
    if (S.niv > av.niv) setTimeout(() => VG.son.jouer("niveau"), 500); else if ((S.or || 0) > av.or) VG.son.jouer("or");
    if (S.fin && !av.fin) VG.son.jouer(["defaite", "mortVarek", "mort", "orsanEnleve"].includes(S.fin.type) ? "defaite" : "victoire");
    rendre({ garder: /^(iret-|iavis-|arch-tab-|conf-citer|accp-|vsel-|vciter|bt-|equiper-|banc)/.test(a) }); }
  function action(a) { VG.son.eveiller();
    if (S.scene.t === "combat" && a.startsWith("c-")) return VG.combat.jouer(a);
    if (VG.combat.actif()) return;
    const av = avant(); MOTEUR_action(a); apres(av, a); }

  // ---------- commandes d'interface ----------
  async function commande(c, cible) { const R = VG.reglages;
    switch (c) {
      case "volet-g": case "volet-d": { const k = c.slice(-1); ui.volets(ui.voletOuvert() === k ? null : k); break; }
      case "fermer-volets": ui.volets(null); break;
      case "menu": ui.menu(true); break; case "menu-fermer": ui.menu(false); break;
      case "plein": ui.pleinEcran(); setTimeout(() => { if (!el("menu").hidden) ui.menu(true); ui.titre(); }, 350); break;
      case "son": R.set("son", !R.get("son")); VG.son.jouer("clic"); if (!R.get("son")) VG.son.stopAmb(); ui.menu(true); break;
      case "musique": R.set("musique", !R.get("musique")); if (R.get("musique")) VG.son.ambiance(nuit() ? "nuit" : "dehors"); else VG.son.stopAmb(); ui.menu(true); break;
      case "vitesse": { const v = R.get("vitesse"); R.set("vitesse", v >= 2.4 ? 1 : v >= 1.4 ? 2.5 : 1.6); ui.menu(true); break; }
      case "mouvement": R.set("mouvement", !R.get("mouvement")); ui.menu(true); break;
      case "titre": ui.menu(false); versTitre(); break;
      case "rejouer": if (await ui.confirmer("Recommencer la partie ?", "Recommencer")) { ui.menu(false); const av = avant(); MOTEUR_action("rejouer"); enJeu = true; apres(av, "rejouer"); } else ui.menu(false); break;
      case "continuer": entrer(); break;
      case "nouvelle": if (S.origine && !S.fin && !(await ui.confirmer("Une partie est en cours. La remplacer ?", "Nouvelle partie"))) { ui.menu(false); break; } ui.menu(false); S = nouvellePartie(); entrer(); break;
      case "conf-oui": case "conf-non": if (ui.confirmer.res) { const r = ui.confirmer.res; ui.confirmer.res = null; r(c === "conf-oui"); } break;
      case "fermer-lieu": VG.carte.fermer(); break;
      case "alerte": cible.classList.toggle("ouverte"); break;
    } }
  function entrer() { VG.son.eveiller(); VG.son.jouer("page"); if (matchMedia("(pointer: coarse)").matches && !ui.pleinActif()) { try { const d = document.documentElement, f = d.requestFullscreen || d.webkitRequestFullscreen; if (f) { const r = f.call(d, { navigationUI: "hide" }); if (r && r.catch) r.catch(() => {}); } } catch (e) {} }
    enJeu = true; ui.marquerLog(); rendre({}); }
  function versTitre() { enJeu = false; decorCourant = null; ui.volets(null); ui.cacherPortrait(); el("jeu").classList.remove("lieu-ouvert"); ui.mode("titre"); ui.titre(); VG.scene.montrer("titre", { nuit: false, zone: ui.zone("plein"), acteurs: [] }); }

  function demarrer() { S = load() || nouvellePartie(); ui.init(); VG.scene.init(); versTitre();
    document.addEventListener("click", ev => { const u = ev.target.closest("[data-ui]"); if (u) { VG.son.eveiller(); if (u.dataset.ui !== "alerte") VG.son.jouer("clic"); commande(u.dataset.ui, u); return; }
      const l = ev.target.closest("[data-lieu]"); if (l) { VG.son.eveiller(); VG.carte.ouvrir(l.dataset.lieu); return; }
      const b = ev.target.closest("[data-a]"); if (!b || b.disabled) return; const a = b.dataset.a; if (!a.startsWith("c-")) VG.son.jouer(a === "continuer" || a === "retour" ? "page" : "clic"); if (!a.startsWith("equiper-")) ui.volets(null); action(a); });
    document.addEventListener("change", ev => { const c = ev.target; if (c.dataset.note && S.infos) { const i = S.infos.find(x => x.id === c.dataset.note); if (i) { i.note = c.value.slice(0, 200); save(); } } if (c.dataset.banc) BANC[c.dataset.banc] = c.value.slice(0, 12); });
    el("jeu").addEventListener("pointerdown", ev => { if (VG.combat.actif() && !ev.target.closest("button")) VG.combat.jouer(""); });
    document.addEventListener("keydown", ev => { if (ev.target.matches && ev.target.matches("input,textarea")) return;
      if (ev.key === "Escape") { if (!el("menu").hidden) ui.menu(false); else if (ui.voletOuvert()) ui.volets(null); else if (!VG.carte.fermer() && enJeu) ui.menu(true); return; }
      if (!enJeu) return;
      if (ev.key === "Enter" || ev.key === " ") { const b = document.querySelector('#panneau-in .btn[data-a="continuer"]'); if (b && ui.modeCourant === "recit") { ev.preventDefault(); b.click(); } else if (VG.combat.actif()) VG.combat.jouer(""); return; }
      if (/^[1-9]$/.test(ev.key)) { const L = ui.modeCourant === "combat" ? [...document.querySelectorAll("#c-cmd button")] : [...document.querySelectorAll("#panneau-in .act")]; const b = L[+ev.key - 1]; if (b && !b.disabled && getComputedStyle(el("panneau")).display !== "none" || (b && ui.modeCourant === "combat" && !b.disabled)) b.click(); } });
    document.addEventListener("fullscreenchange", () => { ui.format(); if (enJeu) rendre({ garder: true }); else versTitre(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { VG.scene.oublier(); if (enJeu) rendre({ garder: true }); });
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(() => {});
    window.addEventListener("error", e => console.error("Valdren :", e.message)); }

  return { demarrer, rendre, action, avant, apres, entrer, versTitre, get enJeu() { return enJeu; } };
})();
VG.ui.rafraichirScene = () => VG.main.rendre({ garder: true });
VG.main.demarrer();
