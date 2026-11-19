// Fabrique les icônes de l'application à partir de tools/icone.html (outil de développement).
const { chromium } = require("playwright"); const path = require("path");
(async () => { const nav = await chromium.launch(); const racine = path.resolve(__dirname, "..");
  for (const [nom, t, masque] of [["icon-192", 192], ["icon-512", 512], ["icon-maskable-512", 512, true]]) { const page = await nav.newPage({ viewport: { width: t, height: t } });
    await page.goto("file://" + path.join(racine, "tools/icone.html"));
    await page.evaluate(({ t, masque }) => { const s = document.getElementById("s"); s.setAttribute("width", t); s.setAttribute("height", t); if (masque) { document.getElementById("fond").setAttribute("rx", 0); document.getElementById("cadre").remove(); s.setAttribute("viewBox", "-64 -64 640 640"); document.body.style.background = "#0b100e"; const r = document.createElementNS("http://www.w3.org/2000/svg", "rect"); r.setAttribute("x", -64); r.setAttribute("y", -64); r.setAttribute("width", 640); r.setAttribute("height", 640); r.setAttribute("fill", "#0e1512"); s.insertBefore(r, s.firstChild.nextSibling); } }, { t, masque });
    await page.screenshot({ path: path.join(racine, "icons", nom + ".png"), omitBackground: !masque }); await page.close(); }
  await nav.close(); console.log("icônes écrites"); })();
