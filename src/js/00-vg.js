// Valdren graphique : espace de noms et outils communs.
// Tout le code graphique vit sous VG pour ne jamais heurter les noms du moteur (S, K, F, E, $, esc…).
const VG = { v: "1.0" };

VG.u = (() => {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const easeIn = t => Math.pow(clamp(t, 0, 1), 3);
  const easeInOut = t => { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const backOut = t => { t = clamp(t, 0, 1); const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  // cloche 0→1→0, sommet en p
  const bell = (t, p = .5) => { t = clamp(t, 0, 1); return t < p ? smooth(t / p) : smooth((1 - t) / (1 - p)); };
  const TAU = Math.PI * 2;

  // hasard reproductible
  const hash = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => { let a = (typeof seed === "number" ? seed : hash(seed)) | 0;
    const f = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    f.r = (a, b) => a + f() * (b - a);
    f.i = (a, b) => Math.floor(a + f() * (b - a + 1));
    f.pick = arr => arr[Math.floor(f() * arr.length)];
    f.chance = p => f() < p;
    return f; };

  // bruit de valeur 1D / 2D, et sa version fractale
  const h1 = (i, s) => { let x = Math.imul(i ^ (s * 374761393), 668265263); x = (x ^ x >>> 13) * 1274126177; return ((x ^ x >>> 16) >>> 0) / 4294967296; };
  const noise1 = (x, s = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(h1(i, s), h1(i + 1, s), u); };
  const fbm1 = (x, s = 0, oct = 4, gain = .5) => { let a = 1, f = 1, v = 0, n = 0; for (let o = 0; o < oct; o++) { v += a * noise1(x * f, s + o * 17); n += a; a *= gain; f *= 2; } return v / n; };
  const h2 = (i, j, s) => h1(i * 73856093 ^ j * 19349663, s);
  const noise2 = (x, y, s = 0) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(h2(i, j, s), h2(i + 1, j, s), ux), lerp(h2(i, j + 1, s), h2(i + 1, j + 1, s), ux), uy); };

  // couleurs : "#rrggbb" -> [r,g,b]
  const hex = c => { if (Array.isArray(c)) return c; c = c.replace("#", ""); if (c.length === 3) c = c.split("").map(x => x + x).join(""); const n = parseInt(c, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgba = (c, a = 1) => { const [r, g, b] = hex(c); return `rgba(${r | 0},${g | 0},${b | 0},${a})`; };
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]; };
  const mixc = (a, b, t, al = 1) => rgba(mix(a, b, t), al);
  const shade = (c, k) => k >= 0 ? mix(c, "#ffffff", k) : mix(c, "#000000", -k);

  return { clamp, lerp, smooth, easeOut, easeIn, easeInOut, backOut, bell, TAU, hash, rng, noise1, fbm1, noise2, hex, rgba, mix, mixc, shade };
})();

// Réglages du joueur (son, vitesse des combats, qualité), gardés à part de la sauvegarde du moteur.
VG.reglages = (() => {
  const CLE = "valdren-graphique-reglages";
  const def = { son: true, musique: true, vitesse: 1, qualite: "auto", mouvement: true };
  let r = Object.assign({}, def);
  try { Object.assign(r, JSON.parse(localStorage.getItem(CLE)) || {}); } catch (e) {}
  if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) r.mouvement = false;
  return { get: k => r[k], set: (k, v) => { r[k] = v; try { localStorage.setItem(CLE, JSON.stringify(r)); } catch (e) {} }, tout: () => r };
})();
