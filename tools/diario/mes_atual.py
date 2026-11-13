"""Barra do mês em curso no gráfico de 2026 da página inicial (4 línguas), atualizada todos os dias (Bruno, 13/11).

Resultado do mês até hoje = soma dos lucros das operações FECHADAS no mês ÷ saldo antes da 1.ª operação do mês
(feed da PAMM do bot do Telegram). Não usa o campo "profitIntervalTotal" da PAMM: em 13/11 dava −229 $ quando o saldo e as
operações davam +28,59 $.
Guarda os meses em tools/diario/meses.json; quando o mês muda, o anterior fica congelado com o valor final.

Uso: python tools/diario/mes_atual.py <site> <feed.json>
"""
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

SITE, FEED = Path(sys.argv[1]), Path(sys.argv[2])
L = ZoneInfo("Europe/Lisbon")
ESTADO = SITE / "tools/diario/meses.json"
BASE_ULTIMO = "2026-10"          # último mês já escrito à mão no gráfico (Out/2026)
K = 52.7 / 9.60                  # escala das barras: +9,60% = 52,7% de altura

ROT = {"pt": "Jan Fev Mar Abr Mai Jun Jul Ago Set Out Nov Dez", "en": "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec",
       "fr": "Janv Févr Mars Avr Mai Juin Juil Août Sept Oct Nov Déc", "es": "Ene Feb Mar Abr May Jun Jul Ago Sep Oct Nov Dic"}
NOME = {"pt": "janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro",
        "en": "January February March April May June July August September October November December",
        "fr": "janvier février mars avril mai juin juillet août septembre octobre novembre décembre",
        "es": "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre"}
NOTA = {"pt": "*{m} ainda não fechou: resultado até {d}, com base nas operações já fechadas. Atualizado todos os dias.",
        "en": "*{m} isn't over yet: result up to {d}, based on closed trades only. Updated every day.",
        "fr": "*{m} n'est pas encore terminé : résultat au {d}, sur la base des opérations déjà clôturées. Mis à jour chaque jour.",
        "es": "*{m} aún no ha terminado: resultado hasta el {d}, según las operaciones ya cerradas. Se actualiza cada día."}
PROV = {"pt": "provisório", "en": "provisional", "fr": "provisoire", "es": "provisional"}


def fmt(v, lang):
    s = f"{abs(v):.2f}"
    s = s if lang == "en" else s.replace(".", ",")
    return ("+" if v >= 0 else "−") + s + ("&nbsp;%" if lang == "fr" else "%")


def calcular(trades, mes):
    t = sorted([x for x in trades if datetime.fromtimestamp(x["close_utc"], L).strftime("%Y-%m") == mes], key=lambda x: x["close_utc"])
    if not t:
        return None
    return {"pct": round(sum(x["profit"] for x in t) / t[0]["balance_before"] * 100, 2),
            "ate": datetime.fromtimestamp(t[-1]["close_utc"], L).strftime("%Y-%m-%d"), "n": len(t)}


def main():
    feed = json.loads(FEED.read_text(encoding="utf-8"))
    hoje = datetime.now(L).strftime("%Y-%m")
    est = json.loads(ESTADO.read_text(encoding="utf-8")) if ESTADO.exists() else {}
    for mes in sorted(set(list(est) + [hoje])):
        if mes <= BASE_ULTIMO or est.get(mes, {}).get("fechado"):
            continue
        r = calcular(feed["trades"], mes)
        if r:
            est[mes] = dict(r, fechado=mes < hoje)
        elif mes < hoje and mes in est:
            est[mes]["fechado"] = True
    ESTADO.write_text(json.dumps(est, ensure_ascii=False, indent=1), encoding="utf-8")

    for lang in ["pt", "en", "fr", "es"]:
        f = SITE / ("index.html" if lang == "pt" else f"{lang}/index.html")
        s = f.read_text(encoding="utf-8")
        barras, aria, nota = [], [], ""
        for i, (mes, r) in enumerate(sorted(est.items())):
            mi = int(mes[5:]) - 1
            rot = ROT[lang].split()[mi]
            v = r["pct"]
            h = min(52.7 if v >= 0 else 47.3, abs(v) * K)
            estrela = "" if r["fechado"] else "*"
            cls = "bar" + ("" if v >= 0 else " bar--neg")
            estilo = "" if r["fechado"] else ";opacity:.78;outline:2px dashed currentColor;outline-offset:3px"
            barras.append(f'          <div class="{cls}" style="--h:{h:.1f}%;--d:{.54 + i * .05:.2f}s{estilo}"><i></i>'
                          f'<span class="bar__val">{fmt(v, lang)}{estrela}</span><span class="bar__lbl">{rot}{estrela}</span></div>')
            aria.append(f"{rot} {fmt(v, lang).replace('&nbsp;', ' ')}" + ("" if r["fechado"] else f" ({PROV[lang]})"))
            if not r["fechado"]:
                d = datetime.strptime(r["ate"], "%Y-%m-%d")
                m = NOME[lang].split()[mi]
                nota = NOTA[lang].format(m=m[0].upper() + m[1:], d=f"{d.day:02d}/{d.month:02d}")
        bloco = "<!--mes:ini-->\n" + "\n".join(barras) + "\n          <!--mes:fim-->"
        if "<!--mes:ini-->" in s:
            s = re.sub(r"<!--mes:ini-->.*?<!--mes:fim-->", lambda _: bloco, s, flags=re.S)
        else:
            # insere a seguir à barra de outubro (a última escrita à mão)
            m = re.search(r'(<div class="bar[^"]*"[^>]*><i></i><span class="bar__val">[^<]*</span><span class="bar__lbl">'
                          + re.escape(ROT[lang].split()[9]) + r'</span></div>)', s)
            s = s[:m.end()] + "\n          " + bloco + s[m.end():]
        bloco_nota = f'<!--nota:ini--><p class="small" style="margin-top:14px;opacity:.85">{nota}</p><!--nota:fim-->' if nota else "<!--nota:ini--><!--nota:fim-->"
        if "<!--nota:ini-->" in s:
            s = re.sub(r"<!--nota:ini-->.*?<!--nota:fim-->", lambda _: bloco_nota, s, flags=re.S)
        else:
            i = s.index("<!--mes:fim-->")
            j = s.index("</div>", i) + len("</div>")       # fecho da caixa das barras
            s = s[:j] + "\n        " + bloco_nota + s[j:]
        # aria-label do gráfico: o texto original fica guardado em data-aria-base; junta-se-lhe os meses novos
        def _aria(m):
            tag = m.group(0)
            b = re.search(r'data-aria-base="([^"]*)"', tag)
            base = b.group(1) if b else re.search(r'aria-label="([^"]*)"', tag).group(1)
            novo = base + (", " + ", ".join(aria) if aria else "")
            tag = re.sub(r'aria-label="[^"]*"', lambda _: f'aria-label="{novo}"', tag)
            if not b:
                tag = tag.replace(' aria-label=', f' data-aria-base="{base}" aria-label=', 1)
            return tag
        s = re.sub(r'<div class="bars[^>]*>', _aria, s, count=1)
        f.write_text(s, encoding="utf-8")
    print(json.dumps(est, ensure_ascii=False))


if __name__ == "__main__":
    main()
