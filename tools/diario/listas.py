"""Escreve existentes.txt e historico.txt para o Claude do artigo diário. Uso: python tools/diario/listas.py"""
import json
from pathlib import Path

SITE = Path(__file__).resolve().parents[2]
AQUI = Path(__file__).resolve().parent
todos = [json.loads(g.read_text(encoding="utf-8")) for g in sorted((SITE / "tools" / "blog-dados").glob("*.json"))]
linhas = []
for a in todos:
    pt = a["lang"].get("pt", {})
    linhas.append(f"{a['id']} | {pt.get('palavra_chave', '')} | {pt.get('titulo', '')}")
(AQUI / "existentes.txt").write_text("\n".join(linhas) + "\n", encoding="utf-8")
auto = sorted([a for a in todos if a.get("auto")], key=lambda a: a["data"])[-7:]
hist = [f"{a['data']} | {a.get('tipo', '?')} | {a['lang']['pt']['titulo']}" for a in auto]
(AQUI / "historico.txt").write_text(("\n".join(hist) if hist else "(ainda não há artigos automáticos)") + "\n", encoding="utf-8")
print(len(linhas), "existentes;", len(hist), "no histórico")
