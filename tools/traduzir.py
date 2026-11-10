"""
Traduz as páginas do site (PT) para en, fr e es com a Claude.

Uso (onde houver a chave ANTHROPIC_API_KEY):
    python traduzir.py <pasta_do_site> en fr es

Só o texto visível e os metadados são traduzidos: a marcação, as classes, os ids,
os URLs e os números ficam iguais. O resultado vai para <site>/<lingua>/<pagina>.html.
Depois corre-se `seo.py` para pôr hreflang, canonical e o seletor de língua.
"""

import re
import sys
from pathlib import Path

import anthropic

PAGINAS = ["index.html", "privacidade.html", "termos.html", "404.html"]
NOMES = {"en": "English (UK spelling, neutral international tone)", "fr": "French (France)", "es": "Spanish (Spain)"}
MODELO = "claude-opus-5-5"

SYSTEM = """You translate the HTML of a Portuguese (pt-PT) website for Cortex Automation, an automated trading
service, into {lingua}. Return ONLY the translated HTML chunk, nothing else, no code fences.

Rules:
- Translate every piece of human-readable text: text nodes, <title>, meta description/keywords, og:/twitter:
  titles and descriptions, alt, title, aria-label, placeholder, data-wa-msg and any other attribute that holds
  a sentence, and the text values inside JSON-LD (keep JSON keys, @type, @id and URLs unchanged; keep it valid JSON).
- Do NOT change tags, attributes names, classes, ids, inline styles, scripts' code, URLs, file paths, numbers,
  percentages, prices, dates' values or HTML entities' meaning. Keep the exact same structure and line breaks.
- Keep brand and product names: Cortex Automation, PAMM, MetaTrader, Bitcoin, WhatsApp, Telegram, Instagram.
- Financial/legal tone: precise, sober, no hype. Keep every risk warning with the same strength.
  Translate "Não é aconselhamento financeiro" faithfully. Do not add or remove claims.
- Internal links: change href="/termos.html" -> href="/{code}/termos.html", href="/privacidade.html" ->
  href="/{code}/privacidade.html", href="/" (home) -> href="/{code}/". Anchors like #faq stay.
- Write numbers and currency in the target language's usual format only inside visible text
  (e.g. "1.000 €" -> "€1,000" in English). Do not touch numbers inside attributes, scripts or JSON keys.
- If the chunk starts or ends in the middle of the document, keep it that way: translate only what you get.
"""


def pedacos(html, limite=18000):
    """Parte o HTML em blocos (pelas secções) para cada pedido caber bem na resposta."""
    partes = re.split(r"(?=\n<!-- ═+)|(?=\n<section )", html)
    out, atual = [], ""
    for p in partes:
        if len(atual) + len(p) > limite and atual:
            out.append(atual)
            atual = ""
        atual += p
    if atual:
        out.append(atual)
    return out


def traduzir(cl, html, code):
    out = []
    for i, bloco in enumerate(pedacos(html)):
        with cl.messages.stream(model=MODELO, max_tokens=64000,
                                system=SYSTEM.format(lingua=NOMES[code], code=code),
                                messages=[{"role": "user", "content": bloco}]) as s:
            msg = s.get_final_message()
        if msg.stop_reason != "end_turn":
            raise RuntimeError(f"bloco {i}: {msg.stop_reason}")
        txt = "".join(b.text for b in msg.content if b.type == "text")
        txt = re.sub(r"^```(?:html)?\n|\n```$", "", txt.strip("\n")) if txt.startswith("```") else txt
        # mantém as quebras de linha das pontas como no original
        if bloco.startswith("\n") and not txt.startswith("\n"):
            txt = "\n" + txt
        out.append(txt)
        print(f"  {code} bloco {i + 1}: {len(bloco)} -> {len(txt)}", flush=True)
    return "".join(out)


def main():
    site = Path(sys.argv[1])
    linguas = sys.argv[2:] or ["en", "fr", "es"]
    paginas = [p for p in PAGINAS if p in (sys.argv[3:] if False else PAGINAS)]
    cl = anthropic.Anthropic()
    for code in linguas:
        (site / code).mkdir(exist_ok=True)
        for pag in paginas:
            destino = site / code / pag
            if destino.exists():
                print(f"{code}/{pag}: já existe, salto")
                continue
            html = (site / pag).read_text(encoding="utf-8")
            print(f"{code}/{pag} ({len(html)} caracteres)", flush=True)
            destino.write_text(traduzir(cl, html, code), encoding="utf-8")


if __name__ == "__main__":
    main()
