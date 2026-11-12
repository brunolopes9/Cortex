"""Depois de blog.py --paginas: as páginas EN/FR/ES voltam a apontar para a imagem de partilha da sua língua
(a mesma troca que og_i18n.py faz, sem precisar do Chrome). Uso: python tools/diario/og_paginas.py"""
import re
from pathlib import Path

SITE = Path(__file__).resolve().parents[2]
DOM = "https://www.cortexautomationai.com"
for lang in ("en", "fr", "es"):
    for pag in (SITE / lang).rglob("*.html"):
        s = pag.read_text(encoding="utf-8")
        n = re.sub(r'(<meta (?:property="og:image"|name="twitter:image") content=")[^"]*og-image\.png(")',
                   rf'\g<1>{DOM}/assets/og-image-{lang}.png\2', s)
        if n != s:
            pag.write_text(n, encoding="utf-8")
print("og ok")
