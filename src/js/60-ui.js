// Interface : HUD, volets, panneau du récit, messages, passage du temps, menu, plein écran.
VG.ui = (() => {
  const { clamp } = VG.u, el = id => document.getElementById(id), ic = n => `<svg class="ic"><use href="#i-${n}"/></svg>`;
  let jeu, modeCourant = "titre", vuLog = 0, cartoucheT = 0;

  function init() { jeu = el("jeu"); format(); addEventListener("resize", () => { clearTimeout(init.t); init.t = setTimeout(() => { format(); const f = document.activeElement; if (f && f.matches && f.matches("input,textarea")) return; if (VG.main.enJeu) VG.main.rendre({ garder: true }); else VG.main.versTitre(); }, 120); }); }
  // Format d'écran : portrait (téléphone tenu droit), paysage ; « bas » = paysage de faible hauteur (téléphone couché).
  function format() { const w = innerWidth, h = innerHeight, portrait = w < h * .95 || w < 600; jeu.classList.toggle("f-portrait", portrait); jeu.classList.toggle("f-paysage", !portrait); jeu.classList.toggle("f-bas", !portrait && h < 540); return portrait; }
  const portrait = () => jeu.classList.contains("f-portrait");
  function mode(m) { if (m === modeCourant && jeu.classList.contains("m-" + m)) return; ["titre", "origine", "carte", "recit", "combat", "fin"].forEach(x => jeu.classList.toggle("m-" + x, x === m)); modeCourant = m; }

  // ---------- HUD ----------
  function hud() { if (!S.origine) return; const pm = pvMax(), r = clamp(S.pv / pm, 0, 1);
    el("h-niv").textContent = S.niv; el("h-pv").style.width = r * 100 + "%"; el("h-pv").parentNode.classList.toggle("bas", r < .35); el("h-xp").style.width = clamp(S.xp / xpNeed(S.niv), 0, 1) * 100 + "%"; el("h-pvt").textContent = S.pv + " / " + pm;
    const nuit = S.moment === 1, hj = el("h-jour"); hj.classList.toggle("nuit", nuit);
    hj.innerHTML = ic(nuit ? "lune" : "soleil") + (S.post ? `<span><em>Après · </em>j <b>${S.jour}</b></span>` : `<span><em>Jour </em><b>${Math.min(S.jour, JOURS)}</b>/${JOURS}</span><span class="fil"><i style="width:${clamp(S.jour / JOURS, 0, 1) * 100}%"></i></span>`);
    el("h-stats").innerHTML = `<span class="r" title="Renom : ${renomNom(S.renom)}">${ic("etoile")}${S.renom}<em>renom</em></span><span class="o" title="Or">${ic("piece")}${S.or || 0}</span><span class="v" title="Varek, à votre dernière visite">${ic("tour")}${S.varek.vu < 0 ? "?" : S.varek.vuNiv}<em>Varek</em></span>`;
    const neufs = Math.max(0, S.log.length - vuLog), p = el("h-new"); p.hidden = !neufs || vuLog === 0; p.textContent = neufs > 9 ? "9+" : neufs; }

  // ---------- volets ----------
  function volets(c) { jeu.classList.remove("volet-g-ouvert", "volet-d-ouvert"); if (c) { jeu.classList.add("volet-" + c + "-ouvert"); VG.son.jouer("ouvrir"); if (c === "d") { vuLog = S.log.length; el("h-new").hidden = true; } } }
  const voletOuvert = () => jeu.classList.contains("volet-g-ouvert") ? "g" : jeu.classList.contains("volet-d-ouvert") ? "d" : null;

  // ---------- panneau du récit ----------
  // Pose le contenu produit par le moteur, hisse le portrait peint dans la scène, donne le ton (couleur) du panneau.
  function panneau(html, o = {}) { const P = el("panneau"), In = el("panneau-in"), y = In.scrollTop; In.innerHTML = html;
    const carte = In.querySelector(".card"), ton = carte ? ["ok", "mid", "bad", "gold", "night"].find(c => carte.classList.contains(c)) : null; P.dataset.ton = o.ton || ton || "";
    hisser(In);
    if (o.garder) In.scrollTop = y; else { In.scrollTop = 0; P.classList.remove("entre"); void P.offsetWidth; P.classList.add("entre"); }
    return In; }
  function hisser(racine) { const p = racine && racine.querySelector(".withp .portrait"), img = p && p.querySelector("img"), box = el("portrait");
    if (!img) { box.classList.remove("vu"); return; }
    p.parentNode.classList.add("hisse"); const lib = (p.querySelector("span") || {}).textContent || "";
    if (box.dataset.src !== img.src) { box.innerHTML = `<div class="cadre"><img alt="${escA(img.alt || "")}" src="${img.src}">${lib ? `<span class="humeur">${esc(lib)}</span>` : ""}</div>`; box.dataset.src = img.src; }
    else { const h = box.querySelector(".humeur"); if (h) h.textContent = lib; }
    placerPortrait(); box.classList.add("vu"); }
  function placerPortrait() { const box = el("portrait"), st = box.style, hudH = el("hud").getBoundingClientRect().height;
    if (modeCourant === "combat") { st.display = "none"; return; } st.display = "";
    if (portrait()) { const t = Math.min(innerWidth * .3, innerHeight * .17, 150); st.width = t + "px"; st.right = "12px"; st.left = "auto"; st.top = hudH + 6 + "px"; }
    else { const pr = el("panneau").getBoundingClientRect(), t = clamp(innerWidth * .15, 110, 200); st.width = t + "px"; st.left = "auto"; st.right = innerWidth - pr.left + 16 + "px"; st.top = hudH + 14 + "px"; } }
  function cacherPortrait() { el("portrait").classList.remove("vu"); }

  // Nom du lieu, affiché quelques secondes quand le décor change.
  function cartouche(nom, sous) { const c = el("cartouche"); if (!nom) { c.classList.remove("vu"); return; } c.innerHTML = `<div class="lieu-s">${esc(sous || "")}</div><div class="lieu-n">${esc(nom)}</div>`; c.classList.add("vu"); clearTimeout(cartoucheT); cartoucheT = setTimeout(() => c.classList.remove("vu"), 3600); }

  // ---------- fenêtre utile de la scène (zone que l'interface ne recouvre pas), en pixels CSS ----------
  function zone(m, o = {}) { const W = innerWidth, H = innerHeight, hudH = modeCourant === "titre" || modeCourant === "origine" ? 0 : el("hud").getBoundingClientRect().height;
    if (m === "plein") return { x: 0, y: 0, w: W, h: H };
    if (m === "combat") { const d = el("c-duel").getBoundingClientRect(), b = el("c-bas").getBoundingClientRect();
      if (jeu.classList.contains("f-bas")) return { x: 0, y: d.bottom - 6, w: Math.max(200, b.left), h: H - d.bottom + 6 };
      return { x: 0, y: d.bottom - 4, w: W, h: Math.max(120, b.top - d.bottom + 10) }; }
    if (m === "carte" && !o.lieu) return { x: 0, y: hudH, w: W, h: H - hudH };
    if (portrait()) { const k = m === "carte" ? .43 : .4; return { x: 0, y: m === "carte" ? hudH : 0, w: W, h: H * k + 16 - (m === "carte" ? hudH : 0) }; }
    const pw = Math.min(W * .46, 560) + 14; return { x: 0, y: m === "carte" ? hudH : 0, w: Math.max(200, W - pw - 8), h: H - (m === "carte" ? hudH : 0) }; }

  // ---------- messages volants ----------
  function toast(texte, cls = "", duree = 4600) { const box = el("toasts"); while (box.children.length >= 3) box.firstChild.remove();
    const d = document.createElement("div"); d.className = "toast " + cls; d.textContent = texte; box.appendChild(d);
    const sortir = () => { d.classList.add("sort"); setTimeout(() => d.remove(), 380); }; d.addEventListener("click", sortir); setTimeout(sortir, duree); }

  // ---------- passage du temps ----------
  function passage(nuit, jour, sous) { const p = el("passage"); p.className = nuit ? "nuit" : ""; p.innerHTML = `<div class="pa"><svg viewBox="0 0 24 24"><use href="#i-${nuit ? "lune" : "soleil"}"/></svg><h2>${nuit ? "La nuit tombe" : "Jour " + jour}</h2><p>${esc(sous || (nuit ? "Jour " + jour + " · peu de témoins" : "L'aube se lève sur Valdren"))}</p></div>`;
    void p.offsetWidth; p.classList.add("joue"); VG.son.jouer(nuit ? "nuit" : "jour"); setTimeout(() => p.classList.remove("joue"), 1750); }

  // ---------- plein écran ----------
  const pleinActif = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const autonome = () => (window.matchMedia && matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches) || navigator.standalone === true;
  function pleinEcran(force) { const d = document.documentElement, on = force == null ? !pleinActif() : force;
    try { if (on) { const f = d.requestFullscreen || d.webkitRequestFullscreen; if (!f) { toast(/iPhone|iPad|iPod/.test(navigator.userAgent) ? "Sur iPhone : bouton Partager, puis « Sur l'écran d'accueil ». Le jeu s'ouvrira en plein écran." : "Le plein écran n'est pas disponible dans ce navigateur.", "info", 7000); return false; }
        const r = f.call(d, { navigationUI: "hide" }); if (r && r.catch) r.catch(() => {}); if (screen.orientation && screen.orientation.unlock) { try { screen.orientation.unlock(); } catch (e) {} } }
      else { const f = document.exitFullscreen || document.webkitExitFullscreen; if (f && pleinActif()) f.call(document); } } catch (e) {}
    return true; }

  // ---------- menu ----------
  function menu(ouvert) { const m = el("menu"); if (!ouvert) { m.hidden = true; return; } const R = VG.reglages, v = R.get("vitesse");
    const b = (a, t, d, icone) => `<button class="act" data-ui="${a}"><span class="t">${t}</span><span class="d">${d}</span>${ic(icone)}</button>`;
    m.innerHTML = `<div class="menu-b"><h2>Menu</h2>
      ${autonome() ? "" : b("plein", pleinActif() ? "Quitter le plein écran" : "Plein écran", "Le jeu occupe tout l'écran, sur téléphone comme sur ordinateur.", "plein")}
      ${b("son", "Sons : " + (R.get("son") ? "activés" : "coupés"), "Bruitages des combats et de l'interface.", R.get("son") ? "son" : "muet")}
      ${b("musique", "Ambiance : " + (R.get("musique") ? "activée" : "coupée"), "Le vent des lieux traversés.", R.get("musique") ? "son" : "muet")}
      ${b("vitesse", "Vitesse des combats : " + (v >= 2.4 ? "rapide" : v >= 1.4 ? "soutenue" : "posée"), "Durée des animations entre deux décisions. On peut aussi toucher l'écran pour accélérer.", "vite")}
      ${b("mouvement", "Mouvements de caméra : " + (R.get("mouvement") ? "oui" : "non"), "Secousses et parallaxe.", "oeil")}
      ${S.origine && !S.fin ? b("titre", "Écran-titre", "La partie est sauvegardée automatiquement.", "maison") : ""}
      ${b("rejouer", "Recommencer la partie", "Efface la partie en cours et revient au choix de l'origine.", "recommencer")}
      <button class="btn" data-ui="menu-fermer">Reprendre</button>
      <div class="pied">L'épreuve de Valdren · règles ${MOTEUR_VERSION} · version graphique ${VG.v}</div></div>`; m.hidden = false; VG.son.jouer("ouvrir"); }

  // ---------- écran-titre ----------
  function titre() { const enCours = !!(S && S.origine && !S.fin);
    el("t-btns").innerHTML = (enCours ? `<button class="btn" data-ui="continuer">Continuer · jour ${Math.min(S.jour, JOURS)}</button><button class="btn ghost" data-ui="nouvelle">Nouvelle partie</button>` : `<button class="btn" data-ui="nouvelle">Commencer</button>`)
      + (autonome() ? "" : `<button class="btn ghost" data-ui="plein">Plein écran</button>`); }

  function confirmer(texte, oui, non) { const m = el("menu"); m.innerHTML = `<div class="menu-b"><h2>${esc(texte)}</h2><div class="row"><button class="btn" data-ui="conf-oui">${esc(oui)}</button><button class="btn ghost" data-ui="conf-non">${esc(non || "Annuler")}</button></div></div>`; m.hidden = false;
    return new Promise(res => { confirmer.res = res; }); }

  return { init, format, portrait, mode, get modeCourant() { return modeCourant; }, hud, volets, voletOuvert, panneau, hisser, placerPortrait, cacherPortrait, cartouche, zone, toast, passage, pleinEcran, pleinActif, menu, titre, confirmer, ic, el,
    marquerLog() { vuLog = S.log.length; } };
})();
