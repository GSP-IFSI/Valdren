// Tableaux : met le jeu dans des situations précises et capture l'écran (outil de développement).
//   node tools/tableaux.js <dossier> <largeur> <hauteur> <dpr> <nom1,nom2,…>
const { chromium } = require("playwright"); const path = require("path");
const T = {
  antre: () => { arriverAntre(); }, forge: () => aller({ t: "atelier" }), herbo: () => aller({ t: "herbo" }), guilde: () => visiterOrsan(), boutique: () => aller({ t: "boutique" }),
  rival: () => { S.moment = 1; ouvrirRival(); }, fort: () => arriverFort(), dragon: () => { S.dragon.faible = true; engager("eveille"); }, dragonDort: () => { S.moment = 1; engager("endormi"); },
  varek: () => { S.jour = 20; defier(); }, loups: () => { S.loup.allie = true; S.betes.push({ nom: "Ours brun", f: .4, type: "Ours" }); secteur("lisiere"); if (S.scene.t !== "combat") secteur("lisiere"); },
  marais: () => secteur("marais"), gorge: () => secteur("gorge"), morghal: () => { S.moment = 1; aller({ t: "veilleForet" }); }, morghalC: () => { S.moment = 1; morghal(); },
  nuit: () => { S.moment = 1; aller({ t: "carte" }); }, fin: () => { finir("victoire"); aller({ t: "fin" }); }, cellule: () => aller({ t: "cellule" }), charge: () => { S.charge = true; aller({ t: "charge" }); },
  archives: () => ouvrirArchives(), loup: () => aller({ t: "loup" }), foret: () => { S.foret.merci = 5; S.foret.crainte = 6; aller({ t: "foret" }); }, sanglier: () => { const c = ennemi("secteur", "Sanglier géant", 12, "brut"); c.secteur = "lisiere"; c.allies = []; c.lignes = [["", "Un sanglier géant."]]; engagerC(c); },
  ours: () => { const c = ennemi("secteur", "Ours des Failles", 12, "brut"); c.secteur = "lisiere"; c.allies = []; c.lignes = [["", "Un ours."]]; engagerC(c); }, cerf: () => { const c = ennemi("secteur", "Cerf aux bois de fer", 12, "brut"); c.secteur = "lisiere"; c.allies = []; c.lignes = [["", "Un cerf."]]; engagerC(c); },
  chimere: () => { const c = ennemi("guilde", "Chimère de Faille", 19, "ruse"); c.rang = 3; c.allies = allies("escouade"); c.lignes = [["", "Une chimère."]]; engagerC(c); },
};
(async () => { const [, , out = "/tmp", w = "1280", h = "720", dpr = "1", noms = "antre"] = process.argv;
  const nav = await chromium.launch(), err = [];
  for (const nom of noms.split(",")) { const [n, orig = "aven"] = nom.split(":"); const page = await nav.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
    page.on("pageerror", e => err.push(n + " ERREUR " + e.message + "\n" + (e.stack || "").split("\n").slice(1, 3).join("\n")));
    await page.goto("file://" + path.resolve(__dirname, "../index.html")); await page.waitForTimeout(400);
    await page.evaluate(({ f, orig }) => { VG.reglages.set("son", false); S = nouvellePartie(orig); S.tuto = false; VG.main.entrer(); (0, eval)("(" + f + ")()"); VG.main.rendre({}); }, { f: T[n].toString(), orig });
    await page.waitForTimeout(3000); await page.screenshot({ path: path.join(out, n + "-" + w + ".png") }); console.log("capture", n); await page.close(); }
  if (err.length) { console.log(err.join("\n")); process.exitCode = 1; } else console.log("aucune erreur"); await nav.close(); })();
