"""
SEO das 4 línguas: põe em cada página o <html lang>, o canonical, os hreflang, o og:locale,
o seletor de língua no topo e a sugestão automática de língua; e gera o sitemap.xml.

Corre-se sempre que se muda ou acrescenta uma página (é idempotente):
    py -3 tools/seo.py
"""

import json
import re
from datetime import date
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
DOM = "https://www.cortexautomationai.com"
LINGUAS = ["pt", "en", "fr", "es"]
HTML_LANG = {"pt": "pt-PT", "en": "en", "fr": "fr", "es": "es"}
OG = {"pt": "pt_PT", "en": "en_GB", "fr": "fr_FR", "es": "es_ES"}
ROTULO = {"pt": "PT", "en": "EN", "fr": "FR", "es": "ES"}
NOME = {"pt": "Português", "en": "English", "fr": "Français", "es": "Español"}
PAGINAS = {"index.html": ("/", "weekly", "1.0"), "privacidade.html": ("/privacidade.html", "yearly", "0.3"),
           "termos.html": ("/termos.html", "yearly", "0.3")}


def url(lang, caminho):
    return DOM + ("" if lang == "pt" else f"/{lang}") + caminho


def ficheiro(lang, pag):
    return SITE / pag if lang == "pt" else SITE / lang / pag


def bloco_head(lang, caminho):
    linhas = [f'<link rel="canonical" href="{url(lang, caminho)}">']
    for l in LINGUAS:
        linhas.append(f'<link rel="alternate" hreflang="{HTML_LANG[l]}" href="{url(l, caminho)}">')
    linhas.append(f'<link rel="alternate" hreflang="x-default" href="{url("pt", caminho)}">')
    linhas.append(f'<meta property="og:locale" content="{OG[lang]}">')
    for l in LINGUAS:
        if l != lang:
            linhas.append(f'<meta property="og:locale:alternate" content="{OG[l]}">')
    linhas.append(f'<meta property="og:url" content="{url(lang, caminho)}">')
    if lang == "pt":
        # Quem abre a versão portuguesa com o browser noutra língua vai para a sua (uma vez; a escolha no seletor manda).
        # Os motores de pesquisa não são redirecionados: indexam cada língua no seu endereço.
        linhas.append("<script>(function(){try{var n=navigator,u=n.userAgent||'';if(/bot|crawl|spider|slurp|lighthouse|headless/i.test(u))return;"
                      "if(localStorage.getItem('lang'))return;var l=((n.languages&&n.languages[0])||n.language||'pt').slice(0,2).toLowerCase();"
                      "if(['en','fr','es'].indexOf(l)<0)return;localStorage.setItem('lang',l);"
                      f"location.replace('/'+l+location.pathname.replace(/^\\/index\\.html$/,'/')+location.search+location.hash)}}catch(e){{}}}})();</script>")
    return "<!-- seo:i18n -->\n" + "\n".join(linhas) + "\n<!-- /seo:i18n -->"


def seletor(lang, caminho):
    itens = []
    for l in LINGUAS:
        cur = ' aria-current="true"' if l == lang else ""
        itens.append(f'<a href="{url(l, caminho).replace(DOM, "") or "/"}" hreflang="{HTML_LANG[l]}" lang="{HTML_LANG[l]}"'
                     f' title="{NOME[l]}" data-lang="{l}"{cur}><img src="/assets/flags/{l}.svg" width="22" height="15" alt="{NOME[l]}"></a>')
    return ('<!-- seo:lang --><div class="langsel" role="navigation" aria-label="Language">'
            + "".join(itens) + "</div><!-- /seo:lang -->")


SCRIPT_ESCOLHA = ("<!-- seo:langjs --><script>document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('.langsel a');"
                  "if(a)try{localStorage.setItem('lang',a.getAttribute('data-lang'))}catch(x){}});</script><!-- /seo:langjs -->")


def tratar(lang, pag):
    f = ficheiro(lang, pag)
    if not f.exists():
        return False
    h = f.read_text(encoding="utf-8")
    caminho = PAGINAS.get(pag, (None,))[0]
    h = re.sub(r'<html lang="[^"]*"', f'<html lang="{HTML_LANG[lang]}"', h, count=1)
    # tira o que havia antes (versões antigas e geradas)
    h = re.sub(r"<!-- seo:i18n -->.*?<!-- /seo:i18n -->\n?", "", h, flags=re.S)
    h = re.sub(r"<!-- seo:lang -->.*?<!-- /seo:lang -->", "", h, flags=re.S)
    h = re.sub(r"<!-- seo:langjs -->.*?<!-- /seo:langjs -->", "", h, flags=re.S)
    if caminho:
        h = re.sub(r'<link rel="canonical"[^>]*>\n?', "", h)
        h = re.sub(r'<meta property="og:(locale|locale:alternate|url)"[^>]*>\n?', "", h)
        h = h.replace("</head>", bloco_head(lang, caminho) + "\n</head>", 1)
        h = re.sub(r'"inLanguage": "[^"]*"', f'"inLanguage": "{HTML_LANG[lang]}"', h)
    # ligação para o blog no menu (se o blog desta língua existir)
    h = re.sub(r"<!-- seo:blog -->.*?<!-- /seo:blog -->", "", h, flags=re.S)
    if ficheiro(lang, "blog/index.html").exists():
        b = "" if lang == "pt" else f"/{lang}"
        h = re.sub(r'(<nav class="nav__links"[^>]*>)', r'\1<!-- seo:blog --><a href="' + b + r'/blog/">Blog</a><!-- /seo:blog -->', h, count=1)
        h = re.sub(r'(<nav class="mnav"[^>]*>)', r'\1<!-- seo:blog --><a href="' + b + r'/blog/"><span>Blog</span><i>✎</i></a><!-- /seo:blog -->', h, count=1)
        h = re.sub(r'(<nav aria-label="Legal">)', r'\1<!-- seo:blog --><a href="' + b + r'/blog/">Blog</a><!-- /seo:blog -->', h, count=1)
    sel = seletor(lang, caminho or "/")
    h = h.replace('<div class="nav__cta">', '<div class="nav__cta">\n      ' + sel, 1)
    if 'class="mnav"' in h:
        h = re.sub(r'(<nav class="mnav"[^>]*>)', r"\1\n  " + sel.replace("langsel", "langsel langsel--m"), h, count=1)
    h = h.replace("</body>", SCRIPT_ESCOLHA + "\n</body>", 1)
    f.write_text(h, encoding="utf-8")
    return True


def artigos_blog():
    """Páginas do blog: blog/<slug>.html por língua (lidas do índice gerado pelo blog.py)."""
    idx = SITE / "blog" / "artigos.json"
    return json.loads(idx.read_text(encoding="utf-8")) if idx.exists() else []


def sitemap():
    hoje = date.today().isoformat()
    linhas = ['<?xml version="1.0" encoding="UTF-8"?>',
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']

    def entrada(caminhos, freq, prio, mod):
        # caminhos: {lang: caminho}
        for lang, cam in caminhos.items():
            linhas.append("  <url>")
            linhas.append(f"    <loc>{url(lang, cam)}</loc>")
            for l2, c2 in caminhos.items():
                linhas.append(f'    <xhtml:link rel="alternate" hreflang="{HTML_LANG[l2]}" href="{url(l2, c2)}"/>')
            if "pt" in caminhos:
                linhas.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{url("pt", caminhos["pt"])}"/>')
            linhas.append(f"    <lastmod>{mod}</lastmod>\n    <changefreq>{freq}</changefreq>\n    <priority>{prio}</priority>")
            linhas.append("  </url>")

    for pag, (cam, freq, prio) in PAGINAS.items():
        entrada({l: cam for l in LINGUAS if ficheiro(l, pag).exists()}, freq, prio, hoje)
    blog = {l: "/blog/" for l in LINGUAS if ficheiro(l, "blog/index.html").exists()}
    if blog:
        entrada(blog, "daily", "0.8", hoje)
    for a in artigos_blog():
        entrada({l: f"/blog/{s}.html" for l, s in a["slugs"].items()}, "monthly", "0.7", a.get("data", hoje))
    linhas.append("</urlset>")
    (SITE / "sitemap.xml").write_text("\n".join(linhas) + "\n", encoding="utf-8")


def main():
    for lang in LINGUAS:
        for pag in list(PAGINAS) + ["404.html"]:
            if tratar(lang, pag):
                print("ok", lang, pag)
    sitemap()
    print("sitemap.xml gerado")


if __name__ == "__main__":
    main()
