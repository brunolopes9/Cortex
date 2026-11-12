"""Valida o artigo automático do dia antes de publicar. Uso: python tools/diario/validar.py <ficheiro.json> <DATA>
Sai com código 1 (e explica porquê) se alguma regra falhar."""
import json
import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parents[2]
f, data = Path(sys.argv[1]), sys.argv[2]
erros = []
try:
    d = json.loads(f.read_text(encoding="utf-8"))
except Exception as e:
    print("JSON inválido:", e)
    sys.exit(1)

if d.get("data") != data:
    erros.append(f"data {d.get('data')} != {data}")
if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)+", d.get("id", "")) or f.stem != d.get("id"):
    erros.append("id inválido ou diferente do nome do ficheiro")
if set(d.get("lang", {})) != {"pt", "en", "fr", "es"}:
    erros.append(f"línguas: {sorted(d.get('lang', {}))}")

# slugs e ids já usados
usados = set()
for g in (SITE / "tools" / "blog-dados").glob("*.json"):
    if g.resolve() == f.resolve():
        continue
    o = json.loads(g.read_text(encoding="utf-8"))
    usados.add(o["id"])
    usados.update(x.get("slug", "") for x in o.get("lang", {}).values())
if d.get("id") in usados:
    erros.append("id já existe")

TAGS = {"h2", "h3", "p", "ul", "ol", "li", "strong", "em", "table", "thead", "tbody", "tr", "th", "td"}
for l, a in d.get("lang", {}).items():
    for campo in ("slug", "titulo", "descricao", "h1", "lead", "palavra_chave", "corpo", "faq", "tempo_leitura"):
        if not a.get(campo):
            erros.append(f"{l}: falta {campo}")
    if a.get("slug") in usados:
        erros.append(f"{l}: slug já existe ({a.get('slug')})")
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)+", a.get("slug", "")):
        erros.append(f"{l}: slug inválido")
    if not 35 <= len(a.get("titulo", "")) <= 65:
        erros.append(f"{l}: título com {len(a.get('titulo', ''))} caracteres")
    if not 115 <= len(a.get("descricao", "")) <= 170:
        erros.append(f"{l}: descrição com {len(a.get('descricao', ''))} caracteres")
    corpo = a.get("corpo", "")
    tags = {t.lower() for t in re.findall(r"</?([a-zA-Z0-9]+)", corpo)}
    if tags - TAGS:
        erros.append(f"{l}: tags não permitidas {sorted(tags - TAGS)}")
    if re.search(r"https?://|<a\b|<img\b|<script", corpo, re.I):
        erros.append(f"{l}: links/imagens/scripts no corpo")
    n = len(re.sub(r"<[^>]+>", " ", corpo).split())
    if not 650 <= n <= 2400:
        erros.append(f"{l}: corpo com {n} palavras")
    if not 3 <= len(a.get("faq", [])) <= 7:
        erros.append(f"{l}: {len(a.get('faq', []))} perguntas no FAQ")
    txt = re.sub(r"<[^>]+>", " ", corpo + " " + a.get("lead", "") + " " + " ".join(q.get("q", "") + " " + q.get("a", "") for q in a.get("faq", [])))
    if txt.count("Cortex") > 2:
        erros.append(f"{l}: Cortex mencionada {txt.count('Cortex')} vezes")
    if re.search(r"(?i)\b(\d+[.,]?\d*\s?%\s+(ao|por) m[eê]s)", txt) and "Cortex" in txt:
        erros.append(f"{l}: possível número de rentabilidade junto da Cortex")
    if l == "pt":
        if re.search(r"\b(?:o|do|ao|no|pelo) [Bb]itcoin\b", txt):
            erros.append("pt: 'o bitcoin' (é 'a bitcoin')")
        if re.search(r"\bFed\b", txt):
            erros.append("pt: 'Fed' (é 'Reserva Federal')")
        if re.search(r"(?i)\b(você|vocês|ônibus|registrar|time de)\b", txt):
            erros.append("pt: possível português do Brasil")

if erros:
    print("REJEITADO:\n- " + "\n- ".join(erros))
    sys.exit(1)
print("OK", d["id"], "|", d["lang"]["pt"]["titulo"])
