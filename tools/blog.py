"""
Blog da Cortex Automation em 4 línguas (pt, en, fr, es), escrito pela Claude.

Cada tema é escrito de raiz em cada língua (não é tradução à letra): a palavra-chave e os exemplos
são os que as pessoas desse país pesquisam. Gera blog/<slug>.html, en/blog/<slug>.html, ...,
os índices do blog e blog/artigos.json (que o seo.py usa no sitemap).

    python blog.py <pasta_do_site>            escreve os temas que ainda não existem
    python blog.py <pasta_do_site> --paginas  só refaz as páginas a partir dos .json guardados
"""

import html
import json
import os
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

DOM = "https://www.cortexautomationai.com"
LINGUAS = ["pt", "en", "fr", "es"]
HTML_LANG = {"pt": "pt-PT", "en": "en", "fr": "fr", "es": "es"}
OG = {"pt": "pt_PT", "en": "en_GB", "fr": "fr_FR", "es": "es_ES"}
PUBLICO = {"pt": "Portuguese readers in Portugal (European Portuguese, pt-PT spelling)",
           "en": "English-speaking readers worldwide (UK spelling)",
           "fr": "French-speaking readers in France, Belgium and Switzerland",
           "es": "Spanish-speaking readers in Spain and Latin America (neutral Spanish)"}
MODELO = "claude-opus-5-5"

# Clusters: pilar + artigos de apoio. A palavra-chave é a da intenção de pesquisa em PT;
# em cada língua a Claude escolhe o equivalente que as pessoas realmente pesquisam.
TEMAS = [
    {"id": "diversificar-investimentos", "kw": "como diversificar investimentos",
     "angulo": "Pillar guide: what diversification is, why it matters, asset classes, correlation, how to build a diversified portfolio step by step, common mistakes, where alternative strategies (like algorithmic trading) can fit as a small slice."},
    {"id": "investimento-mensal", "kw": "investimento mensal",
     "angulo": "How to invest a fixed amount every month (dollar-cost averaging), pros/cons vs lump sum, how much to invest, automating it, realistic expectations."},
    {"id": "o-que-e-forex", "kw": "o que é forex",
     "angulo": "Forex explained for beginners: currency pairs, pips, spreads, leverage and margin, trading sessions, risks, how retail traders access it, regulation basics."},
    {"id": "trading-automatico", "kw": "trading automático",
     "angulo": "What automated/algorithmic trading is, how trading bots and copy/PAMM structures work, advantages, real risks (overfitting, drawdowns, scams), checklist to evaluate a service (verified track record, funds in own account)."},
    {"id": "investir-em-bitcoin", "kw": "como investir em bitcoin",
     "angulo": "Ways to get exposure to Bitcoin (buying spot, ETFs/ETPs, CFDs, automated trading), volatility, custody and security, taxes in general terms, position sizing."},
    {"id": "gestao-de-risco", "kw": "gestão de risco investimentos",
     "angulo": "Risk management: risk per trade, drawdown, maximum drawdown, stop loss, position sizing, risk/reward, diversification, emotional discipline, worked numeric example."},
    {"id": "juro-composto", "kw": "juro composto",
     "angulo": "Compound interest explained with formula and worked examples, monthly contributions, the effect of time, the effect of losses (why -50% needs +100%), realistic rates."},
    {"id": "investimentos-alternativos", "kw": "investimentos alternativos",
     "angulo": "Alternative investments beyond stocks and bonds: real estate, commodities/gold, crypto, private equity, P2P lending, managed/algorithmic strategies; liquidity, fees, risk, how much to allocate."},
    {"id": "rendimento-passivo", "kw": "rendimento passivo",
     "angulo": "Realistic guide to passive income from investments: dividends, interest, ETFs, real estate, automated strategies; why 'guaranteed' returns are a red flag; time and capital required."},
    {"id": "ouro-e-bitcoin-diversificar", "kw": "investir em ouro e bitcoin",
     "angulo": "Real change at Cortex Automation (confirmed in the account history): the algorithm traded only Bitcoin (BTC/USD) and, since the end of October 2026, it also trades gold (XAU/USD). Explain WHY a strategy adds a second, different asset: gold behaves differently from crypto (safe haven, reacts to dollar, rates and geopolitics), trades in other hours and market conditions, allows diversifying across conditions, protecting capital and not depending on one market's cycle; testing scalping/intraday/swing approaches. Teach readers how gold and bitcoin differ (volatility, drivers, trading hours, correlation that changes over time) and what diversification across assets really does and does not do. Mention Cortex Automation as the real example, soberly. NO results, win rates or profit numbers for gold (too early); no promises."},
    {"id": "robo-de-trading", "kw": "robô de trading",
     "angulo": "Trading robots/bots explained for beginners: what they are, how they work (rules, signals, execution), types (trend, breakout, scalping, grid, martingale, arbitrage), why most ads are scams and the red flags (guaranteed returns, sending money to a third party, only showing good months, unverifiable results), a checklist to evaluate one (verified track record with drawdowns, funds stay in the client's own broker account, clear fees, can switch off any time). Mention Cortex Automation once as an example of the 'funds stay in your own account, profit-share' model, soberly."},
    {"id": "martingale-e-grid", "kw": "martingale trading",
     "angulo": "Martingale and grid trading strategies explained with simple worked numeric examples (doubling after each loss; a grid of open orders), why they look great on a chart for months and then can wipe out an account in one strong trend, how to spot them in a bot's track record (very smooth equity curve, many open trades at once, huge floating drawdown), safer alternatives (fixed risk per trade, stop loss, one position at a time). Neutral, educational."},
    {"id": "conta-pamm", "kw": "conta PAMM",
     "angulo": "What PAMM/MAM/copy-trading accounts are, how they work (the manager trades, the investor's funds stay in the investor's own account at the broker, profit share / performance fee), differences between PAMM, copy trading and handing money to a fund, what to check (broker, regulation of the broker, track record with drawdowns, fees, withdrawal rules), risks. Mention Cortex Automation once as an example of an investor-portal / profit-share model, soberly."},
    {"id": "estrategia-breakout", "kw": "estratégia breakout",
     "angulo": "Breakout trading strategy explained: support/resistance and ranges, what a breakout is, false breakouts, confirmation (close, volume, retest), where to put the stop and the target, risk/reward, why breakout strategies have lower win rates but bigger winners, trend context, a simple worked example with round hypothetical numbers. Mention once that some automated systems (like Cortex Automation) are built around waiting for strong breakouts with predefined risk, soberly."},
    {"id": "o-que-e-drawdown", "kw": "o que é drawdown",
     "angulo": "Drawdown and maximum drawdown explained, how to read it on a track record, recovery math, how it differs from volatility, why it matters more than the headline return."},
]

ESQUEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["slug", "titulo", "descricao", "h1", "lead", "palavra_chave", "corpo", "faq", "tempo_leitura"],
    "properties": {
        "slug": {"type": "string", "description": "URL slug in the target language, lowercase, hyphens, no accents, 3-7 words, built around the main keyword"},
        "titulo": {"type": "string", "description": "SEO <title>, 50-60 characters, keyword first, ends with ' | Cortex Automation'"},
        "descricao": {"type": "string", "description": "meta description 140-158 characters, with the keyword and a reason to click"},
        "h1": {"type": "string"},
        "lead": {"type": "string", "description": "2-3 sentence intro that answers the search intent immediately"},
        "palavra_chave": {"type": "string", "description": "main keyword people actually search in this language"},
        "corpo": {"type": "string", "description": "article body in HTML: only <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <table>, <thead>, <tbody>, <tr>, <th>, <td>. 1600-2200 words. No <h1>, no links, no images."},
        "faq": {"type": "array", "items": {"type": "object", "additionalProperties": False, "required": ["q", "a"],
                                           "properties": {"q": {"type": "string"}, "a": {"type": "string"}}},
                "description": "4-6 real questions people search, short factual answers"},
        "tempo_leitura": {"type": "integer"},
    },
}

SYSTEM = """You are a senior financial-education writer for Cortex Automation (an automated trading service whose
clients keep their money in their own broker account; profit-share model). You write blog articles that rank on
Google and Bing because they genuinely answer what people search, with clear structure and depth.

Write for: {publico}. Write natively in that language (not a translation).

Rules:
- Educational and accurate. No hype, no promises of returns, no "get rich", no invented statistics, studies or quotes.
  Use only well-established facts and simple worked examples with round, clearly hypothetical numbers.
- Every article must make the risks clear. Include a short closing note that this is general information, not
  financial advice, and that past performance does not guarantee future results.
- Mention Cortex Automation at most once or twice, naturally and soberly, only where relevant (e.g. as an example
  of an automated strategy where funds stay in the client's own account). Never claim regulation or guarantees.
- SEO: main keyword in the H1, in the first 100 words and in at least one H2; use related terms naturally;
  short paragraphs; descriptive H2/H3 that match sub-questions people search; a comparison table when useful.
- Return only the JSON for the schema."""


def escrever(cl, tema, lang):
    pedido = (f"Topic id: {tema['id']}\nSearch intent (Portuguese keyword, adapt to what people search in this language): "
              f"{tema['kw']}\nAngle and coverage: {tema['angulo']}")
    if os.environ.get("CLAUDE_CODE_OAUTH_TOKEN"):
        # subscrição Claude (Max) via Claude Code, com Opus: não gasta créditos da API
        prompt = pedido + ("\n\nRespond ONLY with a valid JSON object (no text before/after, no code fences) matching this JSON Schema:\n"
                           + json.dumps(ESQUEMA))
        env = {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}
        r = subprocess.run(["claude", "-p", "--output-format", "json", "--model", "opus",
                            "--append-system-prompt", SYSTEM.format(publico=PUBLICO[lang]),
                            "--disallowedTools", "Bash,Edit,Write,Read,WebSearch,WebFetch,Glob,Grep,Task"],
                           input=prompt, capture_output=True, text=True, timeout=1800, env=env, cwd="/tmp")
        if r.returncode != 0:
            raise RuntimeError(f"claude -p: {(r.stderr or r.stdout)[-300:]}")
        txt = json.loads(r.stdout)["result"].strip()
        a = json.loads(txt[txt.find("{"): txt.rfind("}") + 1])
        a["slug"] = re.sub(r"[^a-z0-9-]+", "-", a["slug"].lower()).strip("-")
        return a
    with cl.beta.messages.stream(
            model=MODELO, max_tokens=24000, system=SYSTEM.format(publico=PUBLICO[lang]),
            messages=[{"role": "user", "content": pedido}],
            output_config={"effort": "medium", "format": {"type": "json_schema", "schema": ESQUEMA}},
            betas=["server-side-fallback-2026-07-01"], fallbacks="default") as s:
        msg = s.get_final_message()
    if msg.stop_reason not in ("end_turn", "stop_sequence"):
        raise RuntimeError(f"{tema['id']}/{lang}: {msg.stop_reason}")
    a = json.loads("".join(b.text for b in msg.content if b.type == "text"))
    a["slug"] = re.sub(r"[^a-z0-9-]+", "-", a["slug"].lower()).strip("-")
    return a


# ---------------------------------------------------------------- páginas

TXT = {
    "pt": {"blog": "Blog", "inicio": "Início", "voltar": "Voltar ao site", "relacionados": "Artigos relacionados",
           "faq": "Perguntas frequentes", "min": "min de leitura", "cta_t": "Quer ver como funciona um sistema automático, com o dinheiro na sua conta?",
           "cta_b": "Ver resultados e simulador", "blog_t": "Blog da Cortex Automation: investimentos, trading e gestão de risco",
           "blog_d": "Guias claros sobre diversificação, investimento mensal, forex, bitcoin, trading automático e gestão de risco.",
           "blog_h": "Investir com a cabeça fria", "blog_l": "Guias sem promessas: o que é cada mercado, como se gere o risco e o que esperar de verdade.",
           "aviso": "Informação geral, não é aconselhamento financeiro. Rentabilidade passada não garante rentabilidade futura. Todo o investimento envolve risco de perda de capital.",
           "direitos": "Todos os direitos reservados.", "termos": "Termos e Condições", "privacidade": "Privacidade", "data": "Atualizado a"},
    "en": {"blog": "Blog", "inicio": "Home", "voltar": "Back to the site", "relacionados": "Related articles",
           "faq": "Frequently asked questions", "min": "min read", "cta_t": "Want to see how an automated system works, with the money in your own account?",
           "cta_b": "See results and simulator", "blog_t": "Cortex Automation Blog: investing, trading and risk management",
           "blog_d": "Clear guides on diversification, monthly investing, forex, bitcoin, automated trading and risk management.",
           "blog_h": "Investing with a cool head", "blog_l": "Guides without promises: how each market works, how risk is managed and what to really expect.",
           "aviso": "General information, not financial advice. Past performance does not guarantee future results. All investing involves risk of capital loss.",
           "direitos": "All rights reserved.", "termos": "Terms and Conditions", "privacidade": "Privacy", "data": "Updated"},
    "fr": {"blog": "Blog", "inicio": "Accueil", "voltar": "Retour au site", "relacionados": "Articles liés",
           "faq": "Questions fréquentes", "min": "min de lecture", "cta_t": "Envie de voir comment fonctionne un système automatique, avec l’argent sur votre propre compte ?",
           "cta_b": "Voir les résultats et le simulateur", "blog_t": "Blog Cortex Automation : investissement, trading et gestion du risque",
           "blog_d": "Des guides clairs sur la diversification, l’investissement mensuel, le forex, le bitcoin, le trading automatique et la gestion du risque.",
           "blog_h": "Investir la tête froide", "blog_l": "Des guides sans promesses : comment fonctionne chaque marché, comment gérer le risque et à quoi s’attendre vraiment.",
           "aviso": "Information générale, pas un conseil financier. Les performances passées ne préjugent pas des performances futures. Tout investissement comporte un risque de perte en capital.",
           "direitos": "Tous droits réservés.", "termos": "Conditions générales", "privacidade": "Confidentialité", "data": "Mis à jour le"},
    "es": {"blog": "Blog", "inicio": "Inicio", "voltar": "Volver a la web", "relacionados": "Artículos relacionados",
           "faq": "Preguntas frecuentes", "min": "min de lectura", "cta_t": "¿Quiere ver cómo funciona un sistema automático, con el dinero en su propia cuenta?",
           "cta_b": "Ver resultados y simulador", "blog_t": "Blog de Cortex Automation: inversión, trading y gestión del riesgo",
           "blog_d": "Guías claras sobre diversificación, inversión mensual, forex, bitcoin, trading automático y gestión del riesgo.",
           "blog_h": "Invertir con la cabeza fría", "blog_l": "Guías sin promesas: cómo funciona cada mercado, cómo se gestiona el riesgo y qué esperar de verdad.",
           "aviso": "Información general, no es asesoramiento financiero. La rentabilidad pasada no garantiza resultados futuros. Toda inversión implica riesgo de pérdida de capital.",
           "direitos": "Todos los derechos reservados.", "termos": "Términos y condiciones", "privacidade": "Privacidad", "data": "Actualizado el"},
}


def base(lang):
    return "" if lang == "pt" else f"/{lang}"


def cabeca(lang, titulo, descricao, caminhos, tipo, jsonld):
    """caminhos: {lang: caminho} das versões desta página."""
    e = html.escape
    alt = "\n".join(f'<link rel="alternate" hreflang="{HTML_LANG[l]}" href="{DOM}{base(l)}{c}">' for l, c in caminhos.items())
    if "pt" in caminhos:
        alt += f'\n<link rel="alternate" hreflang="x-default" href="{DOM}{caminhos["pt"]}">'
    eu = f"{DOM}{base(lang)}{caminhos[lang]}"
    return f"""<!DOCTYPE html>
<html lang="{HTML_LANG[lang]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<script>document.documentElement.classList.add('js');</script>
<title>{e(titulo)}</title>
<meta name="description" content="{e(descricao)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#0A0B0C">
<link rel="canonical" href="{eu}">
{alt}
<meta property="og:type" content="{tipo}">
<meta property="og:locale" content="{OG[lang]}">
<meta property="og:site_name" content="Cortex Automation">
<meta property="og:url" content="{eu}">
<meta property="og:title" content="{e(titulo)}">
<meta property="og:description" content="{e(descricao)}">
<meta property="og:image" content="{DOM}/assets/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Manrope:wght@300;400;500;600;700;800&family=Sora:wght@400;600;700;800&display=swap">
<link rel="stylesheet" href="/css/style.css">
<script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False)}</script>
</head>
<body>
<header class="nav is-stuck" id="nav">
  <div class="wrap nav__in">
    <a href="{base(lang)}/" class="logo" aria-label="Cortex Automation">
      <img class="logo__mark" src="/assets/mark.png" width="38" height="38" alt="" aria-hidden="true">
      <span class="logo__txt"><b>Cortex</b><span>Automation</span></span>
    </a>
    <div class="nav__cta">
      {seletor(lang, caminhos)}
      <a href="{base(lang)}/" class="btn btn--ghost btn--sm">{TXT[lang]['voltar']}</a>
    </div>
  </div>
</header>
<main>
"""


def seletor(lang, caminhos):
    nomes = {"pt": "Português", "en": "English", "fr": "Français", "es": "Español"}
    itens = ""
    for l in LINGUAS:
        destino = f"{base(l)}{caminhos[l]}" if l in caminhos else f"{base(l)}/blog/"
        cur = ' aria-current="true"' if l == lang else ""
        itens += (f'<a href="{destino}" hreflang="{HTML_LANG[l]}" lang="{HTML_LANG[l]}" title="{nomes[l]}" '
                  f'data-lang="{l}"{cur}><img src="/assets/flags/{l}.svg" width="22" height="15" alt="{nomes[l]}"></a>')
    return f'<div class="langsel" role="navigation" aria-label="Language">{itens}</div>'


def rodape(lang):
    t = TXT[lang]
    b = base(lang)
    return f"""</main>
<footer class="foot">
  <div class="wrap">
    <p class="micro" style="max-width:80ch;margin-bottom:18px">{t['aviso']}</p>
    <div class="foot__bar" style="border-top:0">
      <span class="micro">© 2026 Cortex Automation. {t['direitos']}</span>
      <nav aria-label="Legal">
        <a href="{b}/">{t['inicio']}</a>
        <a href="{b}/blog/">{t['blog']}</a>
        <a href="{b}/termos.html">{t['termos']}</a>
        <a href="{b}/privacidade.html">{t['privacidade']}</a>
      </nav>
    </div>
  </div>
</footer>
<a href="#" class="wa" data-wa aria-label="WhatsApp"><svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Z"/></svg></a>
<script src="/js/main.js" defer></script>
<script>document.addEventListener('click',function(e){{var a=e.target.closest&&e.target.closest('.langsel a');if(a)try{{localStorage.setItem('lang',a.getAttribute('data-lang'))}}catch(x){{}}}});</script>
</body>
</html>
"""


def pagina_artigo(site, art, lang, todos, hoje):
    a = art["lang"][lang]
    t = TXT[lang]
    b = base(lang)
    caminhos = {l: f"/blog/{x['slug']}.html" for l, x in art["lang"].items()}
    url = f"{DOM}{b}{caminhos[lang]}"
    jsonld = {"@context": "https://schema.org", "@graph": [
        {"@type": "Article", "headline": a["h1"], "description": a["descricao"], "inLanguage": HTML_LANG[lang],
         "datePublished": art["data"], "dateModified": hoje, "mainEntityOfPage": url,
         "image": f"{DOM}/assets/og-image.png",
         "author": {"@type": "Organization", "name": "Cortex Automation", "url": DOM + "/"},
         "publisher": {"@type": "Organization", "name": "Cortex Automation", "logo": {"@type": "ImageObject", "url": f"{DOM}/assets/logo.png"}}},
        {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": f["a"]}} for f in a["faq"]]},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": t["inicio"], "item": f"{DOM}{b}/"},
            {"@type": "ListItem", "position": 2, "name": t["blog"], "item": f"{DOM}{b}/blog/"},
            {"@type": "ListItem", "position": 3, "name": a["h1"], "item": url}]}]}
    rel = [x for x in todos if x["id"] != art["id"] and lang in x["lang"]][:4]
    rel_html = "".join(f'<li><a href="{b}/blog/{x["lang"][lang]["slug"]}.html">{html.escape(x["lang"][lang]["h1"])}</a></li>' for x in rel)
    faq_html = "".join(f"<h3>{html.escape(f['q'])}</h3><p>{html.escape(f['a'])}</p>" for f in a["faq"])
    corpo = cabeca(lang, a["titulo"], a["descricao"], caminhos, "article", jsonld) + f"""
<article class="wrap doc">
  <div class="doc__hd">
    <p class="micro"><a href="{b}/">{t['inicio']}</a> › <a href="{b}/blog/">{t['blog']}</a></p>
    <h1 class="h2" style="margin-top:14px">{html.escape(a['h1'])}</h1>
    <p class="micro" style="margin-top:10px">{t['data']} {hoje} · {a['tempo_leitura']} {t['min']}</p>
  </div>
  <div class="doc__body">
    <p><strong>{html.escape(a['lead'])}</strong></p>
    {a['corpo']}
    <h2>{t['faq']}</h2>
    {faq_html}
    <div class="note" style="margin-top:40px"><p class="small">{t['cta_t']} <a href="{b}/#performance"><strong>{t['cta_b']} →</strong></a></p></div>
    <h2>{t['relacionados']}</h2>
    <ul>{rel_html}</ul>
  </div>
</article>
""" + rodape(lang)
    destino = site / (lang if lang != "pt" else "") / "blog" / f"{a['slug']}.html"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(corpo, encoding="utf-8")


def pagina_indice(site, lang, todos, hoje):
    t = TXT[lang]
    b = base(lang)
    caminhos = {l: "/blog/" for l in LINGUAS}
    lista = [x for x in todos if lang in x["lang"]]
    jsonld = {"@context": "https://schema.org", "@type": "Blog", "name": t["blog_t"], "inLanguage": HTML_LANG[lang],
              "url": f"{DOM}{b}/blog/", "blogPost": [{"@type": "BlogPosting", "headline": x["lang"][lang]["h1"],
                                                      "url": f"{DOM}{b}/blog/{x['lang'][lang]['slug']}.html"} for x in lista]}
    itens = "".join(f'<li><a href="{b}/blog/{x["lang"][lang]["slug"]}.html"><strong>{html.escape(x["lang"][lang]["h1"])}</strong></a>'
                    f'<br><span class="small">{html.escape(x["lang"][lang]["descricao"])}</span></li>' for x in lista)
    corpo = cabeca(lang, t["blog_t"], t["blog_d"], caminhos, "website", jsonld) + f"""
<section class="wrap doc">
  <div class="doc__hd">
    <p class="micro"><a href="{b}/">{t['inicio']}</a> › {t['blog']}</p>
    <h1 class="h2" style="margin-top:14px">{t['blog_h']}</h1>
    <p style="margin-top:12px;max-width:60ch">{t['blog_l']}</p>
  </div>
  <div class="doc__body"><ul>{itens}</ul></div>
</section>
""" + rodape(lang)
    destino = site / (lang if lang != "pt" else "") / "blog" / "index.html"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(corpo, encoding="utf-8")


def main():
    site = Path(sys.argv[1])
    dados = site / "tools" / "blog-dados"
    dados.mkdir(parents=True, exist_ok=True)
    hoje = date.today().isoformat()
    if "--paginas" not in sys.argv:
        cl = None
        if not os.environ.get("CLAUDE_CODE_OAUTH_TOKEN"):
            import anthropic
            cl = anthropic.Anthropic()
        so = [a for a in sys.argv[2:] if not a.startswith("--")]
        for tema in TEMAS:
            if so and tema["id"] not in so:
                continue
            f = dados / f"{tema['id']}.json"
            art = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {"id": tema["id"], "data": hoje, "lang": {}}
            for lang in LINGUAS:
                if lang in art["lang"]:
                    continue
                print(f"a escrever {tema['id']} [{lang}]", flush=True)
                art["lang"][lang] = escrever(cl, tema, lang)
                f.write_text(json.dumps(art, ensure_ascii=False, indent=1), encoding="utf-8")
    todos = [json.loads(f.read_text(encoding="utf-8")) for f in sorted(dados.glob("*.json"))]
    ordem = {t["id"]: i for i, t in enumerate(TEMAS)}
    todos.sort(key=lambda x: ordem.get(x["id"], 99))
    for art in todos:
        for lang in art["lang"]:
            pagina_artigo(site, art, lang, todos, hoje)
    for lang in LINGUAS:
        pagina_indice(site, lang, todos, hoje)
    (site / "blog" / "artigos.json").write_text(json.dumps(
        [{"id": a["id"], "data": a["data"], "slugs": {l: x["slug"] for l, x in a["lang"].items()}} for a in todos],
        ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(todos)} temas, páginas geradas")


if __name__ == "__main__":
    main()
