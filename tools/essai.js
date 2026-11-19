// Essai de bout en bout : ouvre le jeu, joue quelques actions, capture des écrans (outil de développement).
//   node tools/essai.js <dossier de sortie> [largeur] [hauteur] [dpr] [scénario]
const { chromium } = require("playwright"); const path = require("path");
(async () => { const [, , out = "/tmp", w = "1280", h = "720", dpr = "1", scen = "debut"] = process.argv;
  const nav = await chromium.launch(), page = await nav.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr, hasTouch: +w < 600, isMobile: +w < 600 });
  const err = []; page.on("pageerror", e => err.push("ERREUR " + e.message + "\n" + (e.stack || "").split("\n").slice(1, 4).join("\n"))); page.on("console", m => { if (m.type() === "error") err.push("console " + m.text()); });
  await page.goto("file://" + path.resolve(__dirname, "../index.html")); await page.waitForTimeout(900);
  const shot = async n => { await page.screenshot({ path: path.join(out, n + "-" + w + ".png") }); console.log("capture", n); };
  const clic = async (sel, att = 500) => { const b = page.locator(sel).first(); if (await b.count() === 0) { console.log("absent :", sel); return false; } await b.click({ force: true }); await page.waitForTimeout(att); return true; };
  const acte = async (a, att = 600) => { await page.evaluate(a => VG.main.action(a), a); await page.waitForTimeout(att); };
  await shot("01-titre");
  await clic('[data-ui="nouvelle"]', 700); await shot("02-origine");
  await clic('[data-a="orig-aven"]', 2200); await shot("03-carte");
  if (scen === "debut") { await clic('[data-lieu="village"]', 900); await shot("04-village");
    await clic('[data-a="mission-0"]', 2800); await shot("05-combat");
    await clic('[data-a="c-obs"]', 2600); await shot("06-combat-obs");
    await clic('[data-a="c-att"]', 700); await shot("07-combat-att"); await page.waitForTimeout(2200);
    for (let i = 0; i < 14; i++) { const fini = await page.evaluate(() => S.scene.t !== "combat"); if (fini) break; await page.evaluate(() => VG.main.action(S.scene.c.riposte || !tellVisible(S.scene.c) || S.scene.c.intent === "feinte" || S.scene.c.intent === "garde" ? "c-att" : S.scene.c.intent === "brise" ? "c-esq" : "c-def")); await page.waitForTimeout(2600); }
    await shot("08-issue");
    await clic('[data-a="continuer"]', 1200); await shot("09-carte2");
    await clic('[data-ui="volet-g"]', 600); await shot("10-fiche"); await clic('[data-ui="fermer-volets"]', 400);
    await clic('[data-ui="volet-d"]', 600); await shot("11-monde"); await clic('[data-ui="fermer-volets"]', 400);
    await clic('[data-lieu="crete"]', 800); await clic('[data-a="antre"]', 1500); await shot("12-antre"); }
  if (err.length) { console.log(err.slice(0, 12).join("\n")); process.exitCode = 1; } else console.log("aucune erreur");
  await nav.close(); })();
