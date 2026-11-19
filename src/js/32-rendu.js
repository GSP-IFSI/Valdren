// Composition d'une image : couches du décor (avec parallaxe), personnages, premier plan.
VG.rendu = (() => {
  const G = VG.gfx, { clamp, rgba } = VG.u;

  // par : décalage de parallaxe de -1 à 1 ; acteurs : fonction appelée au plan des personnages
  function decor(ctx, B, t, dt, par, acteurs) {
    for (const it of B.items) {
      if (it.acteurs) { if (acteurs) acteurs(ctx); continue; }
      const dx = -par * B.M * (it.p || 0);
      if (it.c) ctx.drawImage(it.c, dx - B.M, 0);
      else { ctx.save(); ctx.translate(dx, 0); if (it.draw) it.draw(ctx, t, dt); else if (it.sys) it.sys.draw(ctx, t, dt); ctx.restore(); }
    }
  }

  // Un personnage est dessiné dans son propre tampon, puis éclairé : lumière rasante du décor,
  // pieds fondus dans la brume, éclair blanc quand il est touché, liseré clair du côté de la lumière.
  const tampons = [];
  function tampon(i, w, h) { let b = tampons[i]; if (!b) b = tampons[i] = { c: G.mk(w, h), c2: G.mk(w, h) }; if (b.c.width < w || b.c.height < h) { b.c.width = b.c2.width = Math.ceil(w); b.c.height = b.c2.height = Math.ceil(h); } return b; }

  // a : {draw(ctx,t,st), st, x, y, ech, sens (1 regarde à droite, -1 à gauche), flash, alpha, larg, haut (en unités du sprite), ombre}
  function acteur(ctx, a, i, t, lum, U) {
    const ech = a.ech * U, w = Math.ceil((a.larg || 160) * ech) + 8, h = Math.ceil((a.haut || 140) * ech) + 8, pied = h - Math.ceil((a.sous || 14) * ech);
    const b = tampon(i, w, h), x = b.c.getContext("2d");
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "source-over"; x.globalAlpha = 1; x.clearRect(0, 0, b.c.width, b.c.height);
    x.translate(w / 2, pied); x.scale(ech * a.sens, ech); a.draw(x, t, a.st || {}, lum);
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "source-atop";
    // lumière : le haut du corps prend la teinte du ciel, du côté d'où vient la lumière
    const lx = lum.dir > 0 ? w : 0;
    x.fillStyle = G.lin(x, lx, 0, w - lx, h * .9, [[0, rgba(lum.col, .34)], [.45, rgba(lum.col, .08)], [1, rgba(lum.amb, .2)]]); x.fillRect(0, 0, w, h);
    x.fillStyle = G.lin(x, 0, pied - h * .16, 0, pied + 4, [[0, rgba(lum.brume, 0)], [1, rgba(lum.brume, a.brume == null ? .17 : a.brume)]]); x.fillRect(0, 0, w, h);
    if (a.teinte) { x.fillStyle = a.teinte; x.fillRect(0, 0, w, h); }
    if (a.flash > 0) { x.fillStyle = rgba(a.flashCol || "#ffffff", clamp(a.flash, 0, 1) * .85); x.fillRect(0, 0, w, h); }
    x.globalCompositeOperation = "source-over";
    // liseré
    const y2 = b.c2.getContext("2d"); y2.setTransform(1, 0, 0, 1, 0, 0); y2.globalCompositeOperation = "source-over"; y2.clearRect(0, 0, b.c2.width, b.c2.height); y2.drawImage(b.c, 0, 0);
    y2.globalCompositeOperation = "source-in"; y2.fillStyle = rgba(lum.col, .62); y2.fillRect(0, 0, w, h);
    const px = Math.round(a.x - w / 2), py = Math.round(a.y - pied), d = Math.max(1, ech * .62);
    ctx.save(); ctx.globalAlpha = clamp(a.alpha == null ? 1 : a.alpha, 0, 1);
    if (a.ombre !== false) { ctx.fillStyle = G.rad(ctx, 0, 0, 0, 1, [[0, "rgba(0,0,0,.5)"], [1, "rgba(0,0,0,0)"]]); ctx.save(); ctx.translate(a.x0 == null ? a.x : a.x0, a.y0 == null ? a.y : a.y0); ctx.scale((a.larg || 160) * ech * (a.ombreK || .3), ech * 7); ctx.fillRect(-1, -1, 2, 2); ctx.restore(); }
    ctx.drawImage(b.c2, 0, 0, w, h, px + lum.dir * d, py - d * .6, w, h);
    ctx.drawImage(b.c, 0, 0, w, h, px, py, w, h);
    ctx.restore();
  }

  return { decor, acteur };
})();
