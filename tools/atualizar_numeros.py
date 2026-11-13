"""Fecho de mês no site (corre todos os dias a seguir a tools/diario/mes_atual.py; só faz alguma coisa quando um mês fecha).

1. Os meses marcados como fechados em tools/diario/meses.json entram na FONTE ÚNICA tools/dados/resultados.json.
2. Todos os números derivados são recalculados (total composto e simples, média mensal, nº de meses e meses positivos,
   resultado do ano em curso, 2000 € → X) e trocados nas páginas (início + termos, 4 línguas): o valor antigo pelo novo.
3. O último mês do histórico ("até outubro", "outubro de 2026") passa para o novo.
4. As imagens com números são geradas outra vez a partir da fonte única (tabela, comparativo, imagem de partilha).

Uso: python tools/atualizar_numeros.py <site>        (DRY=1 só mostra o que mudava)
"""
import json
import os
import subprocess
import sys
from pathlib import Path

SITE = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent)
FONTE = SITE / "tools/dados/resultados.json"
MESES = SITE / "tools/diario/meses.json"
PAGINAS = ["index.html", "en/index.html", "fr/index.html", "es/index.html",
           "termos.html", "en/termos.html", "fr/termos.html", "es/termos.html", "assets/og-source.html"]
NOMES = {"pt": "Janeiro Fevereiro Março Abril Maio Junho Julho Agosto Setembro Outubro Novembro Dezembro",
         "en": "January February March April May June July August September October November December",
         "fr": "janvier février mars avril mai juin juillet août septembre octobre novembre décembre",
         "es": "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre"}


def lang_de(p):
    return p.split("/")[0] if p.split("/")[0] in ("en", "fr", "es") else "pt"


def stats(R):
    anos = sorted(R["meses"], key=int)
    todos = [x for a in anos for x in R["meses"][a]]
    comp = lambda xs: (eval("*".join(str(1 + x / 100) for x in xs) or "1") - 1) * 100
    ult = anos[-1]
    return {"composto": comp(todos), "simples": sum(todos), "media": sum(todos) / len(todos), "n": len(todos),
            "pos": sum(1 for x in todos if x > 0), "final": 2000 * (1 + comp(todos) / 100),
            "ano": int(ult), "ano_simples": sum(R["meses"][ult]), "ano_comp": comp(R["meses"][ult]),
            "ano_pos": sum(1 for x in R["meses"][ult] if x > 0), "ano_n": len(R["meses"][ult]), "mes": len(R["meses"][ult]) - 1}


def f_pct(v, lang, sinal=True, esp=False):
    s = (f"{v:+.2f}" if sinal else f"{v:.2f}")
    s = s if lang == "en" else s.replace(".", ",")
    return s + (" %" if esp else "%")


def f_eur(v, lang):
    if lang == "en":
        return f"€{v:,.2f}"
    s = f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", " " if lang == "fr" else ".")
    return s + " €"


def trocas(a, b, lang):
    """Pares (texto antigo, texto novo) para uma língua."""
    t = []
    for k in ("composto", "simples", "media", "ano_simples", "ano_comp"):
        for esp in (False, True):
            t.append((f_pct(a[k], lang, esp=esp), f_pct(b[k], lang, esp=esp)))
    t.append((f_eur(a["final"], lang), f_eur(b["final"], lang)))
    t.append((f'data-count="{a["media"]:.2f}"', f'data-count="{b["media"]:.2f}"'))
    # nº de meses e meses positivos (sempre junto da palavra, para não apanhar outros números)
    pal = {"pt": "meses", "en": "months", "fr": "mois", "es": "meses"}[lang]
    t.append((f"{a['n']} {pal}", f"{b['n']} {pal}"))
    t.append((f"{a['ano_pos']} / {a['ano_n']}", f"{b['ano_pos']} / {b['ano_n']}"))
    t.append((f"<b>{a['pos']} ", f"<b>{b['pos']} "))
    t.append((f"{a['n']} {pal}, {a['pos']} ", f"{b['n']} {pal}, {b['pos']} "))
    # último mês do histórico
    ma, mb = NOMES[lang].split()[a["mes"]], NOMES[lang].split()[b["mes"]]
    ya, yb = a["ano"], b["ano"]
    for x, y in [(ma, mb), (ma.capitalize(), mb.capitalize()), (ma.lower(), mb.lower())]:
        t += [(f"{x} de {ya}", f"{y} de {yb}"), (f"{x} {ya}", f"{y} {yb}"), (f"t&eacute; {x}", f"t&eacute; {y}"), (f"té {x}", f"té {y}"),
              (f"to {x}", f"to {y}"), (f"en {x}", f"en {y}"), (f"’en {x}", f"’en {y}"), (f"&rsquo;en {x}", f"&rsquo;en {y}"), (f"asta {x}", f"asta {y}")]
    return [(x, y) for x, y in t if x != y]


def main():
    R = json.loads(FONTE.read_text(encoding="utf-8"))
    est = json.loads(MESES.read_text(encoding="utf-8")) if MESES.exists() else {}
    novos = []
    for mes, r in sorted(est.items()):
        if not r.get("fechado"):
            continue
        ano, m = mes[:4], int(mes[5:])
        lst = R["meses"].setdefault(ano, [])
        if len(lst) >= m:
            continue                     # já está na fonte
        if len(lst) != m - 1:
            print(f"AVISO: {mes} não segue o último mês da fonte ({ano}: {len(lst)} meses) — não mexo"); return
        novos.append((mes, r["pct"]))
        lst.append(r["pct"])
    if not novos:
        print("sem meses novos fechados"); return
    antes = stats(json.loads(FONTE.read_text(encoding="utf-8")))
    depois = stats(R)
    print("novos:", novos, "| composto", round(antes["composto"], 2), "->", round(depois["composto"], 2))
    if os.environ.get("DRY"):
        for p in PAGINAS:
            print(p, trocas(antes, depois, lang_de(p))[:6])
        return
    FONTE.write_text(json.dumps(R, ensure_ascii=False, indent=1), encoding="utf-8")
    for p in PAGINAS:
        f = SITE / p
        if not f.exists():
            continue
        s = f.read_text(encoding="utf-8")
        for x, y in trocas(antes, depois, "pt" if p.startswith("assets") else lang_de(p)):
            s = s.replace(x, y)
        f.write_text(s, encoding="utf-8")
    for script in ("tools/imagens_i18n.py", "tools/og_i18n.py"):
        subprocess.run([sys.executable, str(SITE / script)], check=True, cwd=SITE)
    print("site atualizado")


if __name__ == "__main__":
    main()
