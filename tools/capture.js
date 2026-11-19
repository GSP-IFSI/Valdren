// Capture d'écran d'une page locale (outil de développement).
//   node tools/capture.js <fichier.html?params> <sortie.png> [largeur] [hauteur] [dpr] [attente ms]
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const [, , cible, sortie, w = "1280", h = "720", dpr = "1", attente = "500"] = process.argv;
  const [fichier, params = ""] = cible.split("?");
  const url = "file://" + path.resolve(fichier) + (params ? "?" + params : "");
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
  const erreurs = [];
  page.on("pageerror", e => erreurs.push("ERREUR " + e.message));
  page.on("console", m => { if (m.type() === "error") erreurs.push("console " + m.text()); });
  await page.goto(url);
  await page.waitForTimeout(+attente);
  await page.screenshot({ path: sortie });
  await nav.close();
  if (erreurs.length) { console.log(erreurs.slice(0, 8).join("\n")); process.exitCode = 1; } else console.log("ok " + sortie);
})();
