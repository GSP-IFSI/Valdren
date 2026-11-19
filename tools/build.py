#!/usr/bin/env python3
"""Assemble le jeu : moteur de règles (prototype texte) + couche graphique -> index.html autonome.

    python3 tools/build.py            # écrit index.html (et galerie.html, planche de contrôle des dessins)

Le moteur est lu tel quel dans moteur/valdren-v*.html (la version la plus récente).
Pour passer à une nouvelle version des règles : déposer le nouveau fichier dans moteur/ et relancer.
Trois greffes seulement sont faites sur son script, chacune vérifiée par un repère :
  1. le bloc de démarrage (écouteurs de clics) devient la fonction MOTEUR_action(a) ;
  2. render() est scindé en MOTEUR_resoudre() (quelle scène ?) et MOTEUR_html() (son contenu) ;
  3. rien d'autre : règles, textes et équilibrage restent ceux du prototype.
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"


def version_key(p):
    return [int(x) for x in re.findall(r"\d+", p.stem)]


def lire_moteur():
    fichiers = sorted((ROOT / "moteur").glob("valdren-v*.html"), key=version_key)
    if not fichiers:
        sys.exit("Aucun moteur dans moteur/ (attendu : valdren-vX.Y.Z.html)")
    f = fichiers[-1]
    src = f.read_text(encoding="utf-8")
    m = re.search(r"<script>(.*)</script>", src, re.S)
    if not m:
        sys.exit("Script du moteur introuvable")
    js = m.group(1)
    version = (re.search(r"banc d'essai (v[\d.]+)", src) or [None, f.stem.split("-")[-1]])[1]

    def repere(texte, motif, quoi):
        i = texte.find(motif)
        if i < 0:
            sys.exit(f"Repère introuvable dans le moteur ({quoi}) : {motif!r}")
        return i

    # 1. bloc de démarrage -> MOTEUR_action
    i = repere(js, 'if(typeof document!=="undefined"){', "démarrage")
    boot, js = js[i:], js[:i]
    a = repere(boot, "const a=b.dataset.a;", "début de la chaîne d'actions") + len("const a=b.dataset.a;")
    b = repere(boot, "const garder=", "fin de la chaîne d'actions")
    chaine = boot[a:b].strip()
    if re.search(r"\b(?:ev|b)\.[A-Za-z]", chaine):
        sys.exit("La chaîne d'actions du moteur dépend de l'évènement DOM : greffe à revoir")

    # 2. render() -> MOTEUR_resoudre() + MOTEUR_html()
    repere(js, "function render(){", "render")
    js = js.replace("function render(){", "function MOTEUR_resoudre(){", 1)
    motif = re.compile(r"rClock\(\);\s*rFiche\(\);\s*rMonde\(\);\s*const t=S\.scene\.t;\s*\$\(\"#main\"\)\.innerHTML=")
    if not motif.search(js):
        sys.exit("Repère introuvable dans le moteur (corps de render)")
    js = motif.sub("}\nfunction MOTEUR_html(){ const t=S.scene.t;\n  return ", js, count=1)
    fin = re.compile(r":rFin\(\);\s*save\(\);\s*\}")
    if not fin.search(js):
        sys.exit("Repère introuvable dans le moteur (fin de render)")
    js = fin.sub(":rFin(); }", js, count=1)

    js += "\nfunction MOTEUR_action(a){\n" + chaine + "\n}\n"
    js += f'const MOTEUR_VERSION="{version}";\n'
    return js, version, f.name


def lire(dossier, ext):
    return [(p.name, p.read_text(encoding="utf-8")) for p in sorted((SRC / dossier).glob("*." + ext))]


def balise_js(nom, code):
    code = code.replace("</script", "<\\/script")
    return f"<script>\n// ===== {nom} =====\n{code}\n</script>"


def assembler(gabarit, css, scripts):
    html = (SRC / gabarit).read_text(encoding="utf-8")
    html = html.replace("/*__CSS__*/", "\n".join(c for _, c in css))
    html = html.replace("<!--__JS__-->", "\n".join(balise_js(n, c) for n, c in scripts))
    return html


def main():
    moteur, version, fichier = lire_moteur()
    css = lire("css", "css")
    js = lire("js", "js")
    jeu = assembler("index.tpl.html", css, [("moteur " + fichier, moteur)] + js)
    jeu = jeu.replace("__VERSION__", version)
    (ROOT / "index.html").write_text(jeu, encoding="utf-8")
    print(f"index.html : {len(jeu.encode('utf-8'))/1024:.0f} Ko · moteur {version} ({fichier}) · {len(js)} modules")

    # Variante « contenu seul » (sans <html>/<head>/<body>), pour les hébergeurs qui enveloppent la page eux-mêmes :
    #   python3 tools/build.py --contenu chemin/sortie.html
    if "--contenu" in sys.argv:
        sortie = pathlib.Path(sys.argv[sys.argv.index("--contenu") + 1])
        titre = re.search(r"<title>.*?</title>", jeu, re.S).group(0)
        police = re.search(r'<link rel="stylesheet" href="https://fonts[^>]+>', jeu).group(0)
        style = re.search(r"<style>.*?</style>", jeu, re.S).group(0)
        corps = re.search(r"<body>(.*)</body>", jeu, re.S).group(1)
        sortie.write_text("\n".join([titre, police, style, corps]), encoding="utf-8")
        print(f"{sortie} : contenu seul, {sortie.stat().st_size/1024:.0f} Ko")

    gal = SRC / "galerie.tpl.html"
    if gal.exists():
        dessin = [(n, c) for n, c in js if n[:2] < "40"]  # outils, décors, sprites, rendu
        page = assembler("galerie.tpl.html", css, dessin)
        (ROOT / "tools" / "galerie.html").write_text(page, encoding="utf-8")
        print("tools/galerie.html : planche de contrôle")


if __name__ == "__main__":
    main()
