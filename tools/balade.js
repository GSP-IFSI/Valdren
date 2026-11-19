// Balade au hasard : clique des actions disponibles pendant N pas pour débusquer les erreurs (outil de développement).
//   node tools/balade.js [pas] [graine] [origine acad|aven] [largeur] [hauteur]
const { chromium } = require("playwright"); const path = require("path");
(async () => { const [, , pas = "300", graine = "1", orig = "aven", w = "1100", h = "700"] = process.argv;
  const nav = await chromium.launch(), page = await nav.newPage({ viewport: { width: +w, height: +h } });
  const err = []; page.on("pageerror", e => err.push("ERREUR " + e.message + "\n" + (e.stack || "").split("\n").slice(1, 3).join("\n")));
  await page.goto("file://" + path.resolve(__dirname, "../index.html")); await page.waitForTimeout(500);
  await page.evaluate(() => { VG.reglages.set("vitesse", 30); VG.reglages.set("son", false); });
  await page.click('[data-ui="nouvelle"]'); await page.waitForTimeout(300); await page.click(`[data-a="orig-${orig}"]`); await page.waitForTimeout(300);
  const res = await page.evaluate(async ({ pas, graine }) => { let a = graine * 7919 + 13; const rnd = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
    const vus = {}, scenes = {}, decors = {}, sprites = {}, attendre = ms => new Promise(r => setTimeout(r, ms)); let dernier = "";
    for (let i = 0; i < pas; i++) { const t = S.scene.t; scenes[t] = (scenes[t] || 0) + 1; if (VG.scene.B) decors[VG.scene.B.cle] = 1; VG.scene.acteurs.forEach(x => sprites[x.nom] = 1);
      if (S.fin && t === "fin") break;
      let L;
      if (t === "carte") { const pins = [...document.querySelectorAll("[data-lieu]")]; if (!VG.carte.sel || rnd() < .25) { const p = pins[Math.floor(rnd() * pins.length)]; if (p) { p.click(); await attendre(20); } } L = [...document.querySelectorAll("#panneau-in [data-a]:not([disabled])")]; }
      else if (t === "combat") { let n = 0; while (VG.combat.actif() && n++ < 400) await attendre(10); L = [...document.querySelectorAll("#c-cmd [data-a]:not([disabled])")]; if (rnd() < .6) L = L.filter(b => /c-(att|def|esq|obs)$/.test(b.dataset.a)).concat(L.filter(b => b.dataset.a === "c-att")); }
      else L = [...document.querySelectorAll("#panneau-in [data-a]:not([disabled])")];
      L = L.filter(b => !/^(rejouer|banc)/.test(b.dataset.a)); if (!L.length) { dernier = "aucune action : " + t; if (t === "carte") { VG.carte.oublier(); VG.main.rendre({}); continue; } break; }
      const b = L[Math.floor(rnd() * L.length)]; vus[b.dataset.a.replace(/-.*/, "")] = 1; dernier = t + " → " + b.dataset.a; b.click(); await attendre(t === "combat" ? 30 : 12); let n = 0; while (VG.combat.actif() && n++ < 400) await attendre(10); }
    return { jour: S.jour, niv: S.niv, fin: S.fin && S.fin.type, scenes, decors: Object.keys(decors), sprites: Object.keys(sprites), actions: Object.keys(vus).length, dernier }; }, { pas: +pas, graine: +graine });
  console.log(JSON.stringify(res)); if (err.length) { console.log([...new Set(err)].slice(0, 10).join("\n")); process.exitCode = 1; } else console.log("aucune erreur");
  await nav.close(); })();
