"""Afinações de SEO por cima do seo.py (idempotente):
- títulos (<= 60) e descrições (<= 160) das páginas principais, para o Google não os cortar;
- JSON-LD SoftwareApplication + VideoObject (VSL) nas 4 páginas iniciais;
- twitter:card nas páginas legais.
Uso: py -3 tools/seo_extra.py
"""
import json
import re
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
DOM = "https://www.cortexautomationai.com"

TEXTOS = {
    "index.html": ("Trading Automático de Bitcoin | Cortex Automation",
                   "Trading automático em Bitcoin com histórico real verificado. O dinheiro fica na sua conta de corretora. Sem mensalidades: só partilha de lucro."),
    "en/index.html": ("Automated Bitcoin Trading | Cortex Automation",
                      "Automated Bitcoin trading with a verified real track record. Your money stays in your own brokerage account. No monthly fees, profit sharing only."),
    "fr/index.html": ("Trading automatique Bitcoin | Cortex Automation",
                      "Trading automatique en Bitcoin avec un historique réel vérifié. L’argent reste sur votre compte de courtage. Sans abonnement : partage des bénéfices."),
    "es/index.html": ("Trading automático de Bitcoin | Cortex Automation",
                      "Trading automático en Bitcoin con historial real verificado. El dinero permanece en su cuenta de bróker. Sin cuotas mensuales: solo reparto de beneficios."),
    "blog/index.html": ("Blog Cortex: investimento, trading e gestão de risco", None),
    "en/blog/index.html": ("Cortex Blog: investing, trading and risk management", None),
    "fr/blog/index.html": ("Blog Cortex : investissement, trading et gestion du risque", None),
    "es/blog/index.html": ("Blog Cortex: inversión, trading y gestión del riesgo", None),
}

VIDEO = {
    "pt": ("Cortex Automation: apresentação em 1 minuto", "Como funciona o algoritmo de trading automático da Cortex Automation, na sua própria conta de corretora."),
    "en": ("Cortex Automation: 1-minute overview", "How the Cortex Automation automated trading algorithm works, in your own brokerage account."),
    "fr": ("Cortex Automation : présentation en 1 minute", "Comment fonctionne l’algorithme de trading automatique de Cortex Automation, sur votre propre compte de courtage."),
    "es": ("Cortex Automation: presentación en 1 minuto", "Cómo funciona el algoritmo de trading automático de Cortex Automation, en su propia cuenta de bróker."),
}
APP_DESC = {
    "pt": "Software de trading automático em Bitcoin que opera na conta de corretora do próprio cliente. Sem mensalidades nem adesão: só partilha de lucro.",
    "en": "Automated Bitcoin trading software that runs in the client's own brokerage account. No monthly or setup fees: profit sharing only.",
    "fr": "Logiciel de trading automatique en Bitcoin qui opère sur le compte de courtage du client. Sans abonnement ni frais d’adhésion : partage des bénéfices.",
    "es": "Software de trading automático en Bitcoin que opera en la cuenta de bróker del propio cliente. Sin cuotas ni alta: solo reparto de beneficios.",
}


def esc(t):
    return t.replace("&", "&amp;").replace('"', "&quot;")


def meta(s, nome, valor, prop=False):
    at = "property" if prop else "name"
    return re.sub(rf'(<meta {at}="{re.escape(nome)}" content=")[^"]*(")', lambda m: m.group(1) + esc(valor) + m.group(2), s, count=1)


def main():
    for rel, (tit, desc) in TEXTOS.items():
        f = SITE / rel
        s = f.read_text(encoding="utf-8")
        s = re.sub(r"<title>.*?</title>", f"<title>{tit}</title>", s, count=1, flags=re.S)
        if desc:
            s = meta(s, "description", desc)
        f.write_text(s, encoding="utf-8")
        print(rel, len(tit), len(desc or ""))

    for lang in ["pt", "en", "fr", "es"]:
        f = SITE / ("index.html" if lang == "pt" else f"{lang}/index.html")
        s = f.read_text(encoding="utf-8")
        base = DOM + ("/" if lang == "pt" else f"/{lang}/")
        m = re.search(r'<video[^>]*>.*?<source src="([^"]+)"', s, re.S)
        video = m.group(1) if m else "/assets/vsl.mp4"
        video = video if video.startswith("http") else DOM + video
        try:  # enquanto o VSL da língua não existir, o Google recebe o vídeo PT (o que a página mostra)
            import urllib.request
            urllib.request.urlopen(urllib.request.Request(video, method="HEAD"), timeout=10)
        except Exception:
            video = DOM + "/assets/vsl.mp4"
        ld = [{
            "@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Cortex Automation",
            "applicationCategory": "FinanceApplication", "operatingSystem": "Web", "url": base,
            "description": APP_DESC[lang], "inLanguage": lang,
            "publisher": {"@type": "Organization", "name": "Cortex Automation", "url": DOM + "/"},
        }, {
            "@context": "https://schema.org", "@type": "VideoObject", "name": VIDEO[lang][0], "description": VIDEO[lang][1],
            "thumbnailUrl": DOM + "/assets/vsl-poster.jpg", "uploadDate": "2026-11-01", "duration": "PT1M",
            "contentUrl": video, "embedUrl": base + "#video", "inLanguage": lang,
        }]
        bloco = '<script type="application/ld+json" id="ld-extra">' + json.dumps(ld, ensure_ascii=False) + "</script>"
        s = re.sub(r'<script type="application/ld\+json" id="ld-extra">.*?</script>\n?', "", s, flags=re.S)
        s = s.replace("</head>", bloco + "\n</head>", 1)
        f.write_text(s, encoding="utf-8")

    for f in list(SITE.glob("*.html")) + list(SITE.glob("*/*.html")):
        if f.name not in ("privacidade.html", "termos.html"):
            continue
        s = f.read_text(encoding="utf-8")
        if 'name="twitter:card"' not in s and 'property="og:title"' in s:
            s = s.replace('<meta property="og:title"', '<meta name="twitter:card" content="summary_large_image">\n<meta property="og:title"', 1)
            f.write_text(s, encoding="utf-8")
            print("twitter:card", f.relative_to(SITE))


if __name__ == "__main__":
    main()
