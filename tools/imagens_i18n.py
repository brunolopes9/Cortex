"""Versões EN/FR/ES das imagens com números (tabela mensal e comparação de capital), no mesmo estilo
das originais em PT. Mesmos dados (jan/2024–ago/2026, 1% de risco por operação).
Uso: py -3 tools/imagens_i18n.py   -> assets/tabela-mensal-{en,fr,es}.jpg e assets/comparativo-{en,fr,es}.jpg"""
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

SITE = Path(__file__).resolve().parent.parent
CHROME = next((c for c in (r"C:\Program Files\Google\Chrome\Application\chrome.exe", shutil.which("chromium"),
                            shutil.which("chromium-browser"), shutil.which("google-chrome")) if c and Path(c).exists()), "chromium")
_R = json.loads((SITE / "tools/dados/resultados.json").read_text(encoding="utf-8"))   # FONTE ÚNICA
D = {int(a): v for a, v in _R["meses"].items()}
DD = {int(a): v for a, v in _R["maior_drawdown_ano"].items()}
ANO_F = max(D)                      # último ano com dados
MES_F = len(D[ANO_F]) - 1           # índice do último mês fechado
N_MESES = sum(len(v) for v in D.values())
NOMES = {"pt": "JANEIRO FEVEREIRO MARÇO ABRIL MAIO JUNHO JULHO AGOSTO SETEMBRO OUTUBRO NOVEMBRO DEZEMBRO",
         "en": "JANUARY FEBRUARY MARCH APRIL MAY JUNE JULY AUGUST SEPTEMBER OCTOBER NOVEMBER DECEMBER",
         "fr": "JANVIER FÉVRIER MARS AVRIL MAI JUIN JUILLET AOÛT SEPTEMBRE OCTOBRE NOVEMBRE DÉCEMBRE",
         "es": "ENERO FEBRERO MARZO ABRIL MAYO JUNIO JULIO AGOSTO SEPTIEMBRE OCTUBRE NOVIEMBRE DICIEMBRE"}
T = {
 "pt": {"meses": "JAN FEV MAR ABR MAI JUN JUL AGO SET OUT NOV DEZ".split(), "dec": ",", "pct": "%",
        "topo": "RESULTADOS REAIS. DISCIPLINA CONSTANTE.", "comp_ano": "LUCRO<br>COMPOSTO", "no_ano": "(NO ANO)",
        "simples": "LUCRO SIMPLES", "composto": "LUCRO COMPOSTO", "ano": "(NO ANO)", "ate": "(ATÉ {m})", "dd": "MAIOR DRAWDOWN<br>DO ANO",
        "total": "TOTAL {n} MESES:", "simp": "SIMPLES", "comj": "COM JURO COMPOSTO", "risco": "1% DE RISCO POR OPERAÇÃO",
        "t1": "O mesmo capital.", "t2a": "Resultados totalmente ", "t2b": "diferentes.", "sub": "Veja o poder da automação inteligente.",
        "sem": "SEM CORTEX AUTOMATION", "sem2": "Apenas o seu capital inicial", "com": "COM CORTEX AUTOMATION", "com2": "Capital + resultados do sistema",
        "de": "DE", "jan": "JANEIRO 2024", "ate2": "ATÉ", "ago": "{M} {A}", "jc": "JURO COMPOSTO", "ini": "Capital inicial",
        "res": "Resultado com Cortex Automation", "eur": lambda v: "€ " + f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")},
 "en": {"meses": "JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC".split(), "dec": ".", "pct": "%",
        "topo": "REAL RESULTS. CONSTANT DISCIPLINE.", "comp_ano": "COMPOUNDED<br>PROFIT", "no_ano": "(YEAR)",
        "simples": "SIMPLE PROFIT", "composto": "COMPOUNDED PROFIT", "ano": "(YEAR)", "ate": "(TO {m})", "dd": "LARGEST DRAWDOWN<br>OF THE YEAR",
        "total": "TOTAL {n} MONTHS:", "simp": "SIMPLE", "comj": "COMPOUNDED", "risco": "1% RISK PER TRADE",
        "t1": "Same capital.", "t2a": "Completely ", "t2b": "different results.", "sub": "See the power of smart automation.",
        "sem": "WITHOUT CORTEX AUTOMATION", "sem2": "Just your starting capital", "com": "WITH CORTEX AUTOMATION", "com2": "Capital + system results",
        "de": "FROM", "jan": "JANUARY 2024", "ate2": "TO", "ago": "{M} {A}", "jc": "COMPOUNDED", "ini": "Starting capital",
        "res": "Result with Cortex Automation", "eur": lambda v: "€" + f"{v:,.2f}"},
 "fr": {"meses": "JANV FÉVR MARS AVR MAI JUIN JUIL AOÛT SEPT OCT NOV DÉC".split(), "dec": ",", "pct": " %",
        "topo": "RÉSULTATS RÉELS. DISCIPLINE CONSTANTE.", "comp_ano": "GAIN<br>COMPOSÉ", "no_ano": "(SUR L’ANNÉE)",
        "simples": "GAIN SIMPLE", "composto": "GAIN COMPOSÉ", "ano": "(SUR L’ANNÉE)", "ate": "(JUSQU’À {m})", "dd": "PLUS GRAND DRAWDOWN<br>DE L’ANNÉE",
        "total": "TOTAL {n} MOIS :", "simp": "SIMPLE", "comj": "AVEC INTÉRÊTS COMPOSÉS", "risco": "1 % DE RISQUE PAR OPÉRATION",
        "t1": "Le même capital.", "t2a": "Des résultats ", "t2b": "totalement différents.", "sub": "Découvrez la puissance de l’automatisation intelligente.",
        "sem": "SANS CORTEX AUTOMATION", "sem2": "Seulement votre capital initial", "com": "AVEC CORTEX AUTOMATION", "com2": "Capital + résultats du système",
        "de": "DE", "jan": "JANVIER 2024", "ate2": "À", "ago": "{M} {A}", "jc": "INTÉRÊTS COMPOSÉS", "ini": "Capital initial",
        "res": "Résultat avec Cortex Automation", "eur": lambda v: f"{v:,.2f}".replace(",", " ").replace(".", ",") + " €"},
 "es": {"meses": "ENE FEB MAR ABR MAY JUN JUL AGO SEP OCT NOV DIC".split(), "dec": ",", "pct": "%",
        "topo": "RESULTADOS REALES. DISCIPLINA CONSTANTE.", "comp_ano": "BENEFICIO<br>COMPUESTO", "no_ano": "(EN EL AÑO)",
        "simples": "BENEFICIO SIMPLE", "composto": "BENEFICIO COMPUESTO", "ano": "(EN EL AÑO)", "ate": "(HASTA {m})", "dd": "MAYOR DRAWDOWN<br>DEL AÑO",
        "total": "TOTAL {n} MESES:", "simp": "SIMPLE", "comj": "CON INTERÉS COMPUESTO", "risco": "1% DE RIESGO POR OPERACIÓN",
        "t1": "El mismo capital.", "t2a": "Resultados totalmente ", "t2b": "diferentes.", "sub": "Vea el poder de la automatización inteligente.",
        "sem": "SIN CORTEX AUTOMATION", "sem2": "Solo su capital inicial", "com": "CON CORTEX AUTOMATION", "com2": "Capital + resultados del sistema",
        "de": "DE", "jan": "ENERO 2024", "ate2": "A", "ago": "{M} {A}", "jc": "INTERÉS COMPUESTO", "ini": "Capital inicial",
        "res": "Resultado con Cortex Automation", "eur": lambda v: f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".") + " €"},
}
VERDE, VERM = "#2ee88a", "#ff4d4d"
ICONE_MOEDAS = '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.4"><ellipse cx="9" cy="6" rx="6" ry="2.5"/><path d="M3 6v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6"/><path d="M3 10v4c0 1.4 2.7 2.5 6 2.5"/><ellipse cx="15" cy="14" rx="6" ry="2.5"/><path d="M9 14v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4"/></svg>'
ICONE_GRAF = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2ee88a" stroke-width="1.6"><path d="M4 20V14M9 20V10M14 20v-6M19 20V7"/><path d="M4 11l5-4 4 3 7-6"/><path d="M16 4h4v4"/></svg>'
FONTES = '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">'


def pct(v, t, sinal=True):
    s = (f"{v:+.2f}" if sinal else f"{v:.2f}").replace(".", t["dec"])
    return s + t["pct"]


def comp(xs):
    p = 1
    for x in xs:
        p *= 1 + x / 100
    return (p - 1) * 100


def render(html, w, h, saida):
    with tempfile.TemporaryDirectory() as tmp:
        f = Path(tmp) / "p.html"
        f.write_text(html, encoding="utf-8")
        png = Path(tmp) / "p.png"
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--window-size={w},{h}",
                        "--virtual-time-budget=4000", f"--screenshot={png}", f.as_uri()], check=True, capture_output=True)
        Image.open(png).convert("RGB").crop((0, 0, w, h)).save(saida, quality=90)


def base(w, h, corpo):
    logo = (SITE / "assets" / "logo.png").as_uri()
    return f"""<!doctype html><meta charset=utf-8>{FONTES}<style>*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:{w}px;height:{h}px;overflow:hidden;font-family:Inter,sans-serif;color:#fff;
background:radial-gradient(ellipse at 50% -10%,#0f3d2a 0%,#04120c 45%,#020806 100%)}}
.cx{{border:1.5px solid #1f5a3d;border-radius:18px;background:#06150fcc}}</style>
<body data-logo="{logo}">{corpo}</body>"""


def _t(lang):
    t = dict(T[lang])
    m = t["meses"][MES_F]
    t["ate"] = t["ate"].replace("{m}", m)
    t["total"] = t["total"].replace("{n}", str(N_MESES))
    t["ago"] = t["ago"].replace("{M}", NOMES[lang].split()[MES_F]).replace("{A}", str(ANO_F))
    return t


def tabela(lang):
    t = _t(lang)
    logo = (SITE / "assets" / "logo.png").as_uri()
    cab = "".join(f'<th>{m}</th>' for m in t["meses"])
    linhas = ""
    for a, xs in D.items():
        cel = "".join(f'<td style="color:{VERDE if x >= 0 else VERM}">{pct(x, t, False) if x >= 0 else pct(x, t, False)}</td>' for x in xs)
        cel += "<td>-</td>" * (12 - len(xs))
        linhas += f'<tr><td class="ano">{a}</td>{cel}<td class="tot">{pct(comp(xs), t)}</td></tr>'
    caixas = ""
    for a in D:
        caixas += f"""<div class="cx" style="flex:1;display:flex;align-items:center;padding:14px 18px;gap:16px">
  <div style="font:700 26px Inter;width:76px">{a}</div>
  <div class="k"><div>{t['simples']}<br>{t['ate'] if a == ANO_F else t['ano']}</div><b style="color:{VERDE}">{pct(sum(D[a]), t)}</b></div>
  <div class="k"><div>{t['composto']}<br>{t['ate'] if a == ANO_F else t['ano']}</div><b style="color:{VERDE}">{pct(comp(D[a]), t)}</b></div>
  <div class="k"><div>{t['dd']}</div><b>{pct(DD[a], t, False)}</b></div></div>"""
    tot_s = sum(sum(x) for x in D.values())
    tot_c = comp([x for xs in D.values() for x in xs])
    corpo = f"""<style>
table{{width:100%;border-collapse:collapse}} th,td{{border:1px solid #1f5a3d;text-align:center;height:56px;font:600 17px Inter}}
th{{font:600 15px Inter;color:#e8f5ee;height:78px}} td.ano{{font:700 24px Inter;width:110px}} td.tot{{font:800 24px Inter;color:{VERDE};width:150px}}
.k{{flex:1;text-align:center;font:600 10.5px/1.25 Inter;color:#b9d3c5;border-left:1px solid #1f5a3d;padding-left:8px}} .k b{{display:block;font:800 21px Inter;color:#fff;margin-top:6px}}
</style>
<div style="position:absolute;right:56px;top:16px;font:500 13px Inter;letter-spacing:.3em;color:#cfe3d8">{t['topo']} ——</div>
<div class="cx" style="position:absolute;left:36px;right:36px;top:48px;overflow:hidden">
  <table><tr><th style="height:80px;text-align:left;padding-left:30px" colspan="1"><img src="{logo}" style="height:58px;vertical-align:middle"></th>
  {''.join('<th></th>' for _ in range(13))}</tr>
  <tr><th></th>{cab}<th>{t['comp_ano']}<br><span style="font-size:11px;color:#b9d3c5">{t['no_ano']}</span></th></tr>{linhas}</table></div>
<div style="position:absolute;left:36px;right:36px;top:392px;display:flex;gap:14px">{caixas}</div>
<div style="position:absolute;left:0;right:0;top:512px;text-align:center;font:600 14px Inter;letter-spacing:.25em;color:#cfe3d8">{t['total']}</div>
<div style="position:absolute;left:0;right:0;top:534px;text-align:center;font:600 16px Inter;letter-spacing:.12em;color:#cfe3d8">{t['simp']}: <b style="color:{VERDE};font-size:20px">{pct(tot_s, t)}</b> &nbsp;•&nbsp; {t['comj']}: <b style="color:{VERDE};font-size:20px">{pct(tot_c, t)}</b></div>
<div style="position:absolute;left:0;right:0;top:588px;text-align:center;font:500 13px Inter;letter-spacing:.3em;color:#cfe3d8">{t['risco']}</div>"""
    render(base(1500, 624, corpo), 1500, 624, SITE / "assets" / ("tabela-mensal.jpg" if lang == "pt" else f"tabela-mensal-{lang}.jpg"))


def comparativo(lang):
    t = _t(lang)
    logo = (SITE / "assets" / "logo.png").as_uri()
    serie, v = [2000.0], 2000.0
    for a in D:
        for x in D[a]:
            v *= 1 + x / 100
            serie.append(v)
    final = serie[-1]
    total = (final / 2000 - 1) * 100
    W, H, x0, x1, y0, y1, top = 760, 230, 70, 830, 740, 520, 10000
    X = lambda i: x0 + (x1 - x0) * i / (len(serie) - 1)
    pts = " ".join(f"{X(i):.1f},{y0 - val / top * 230:.1f}" for i, val in enumerate(serie))
    area = f"{x0},{y0} " + pts + f" {x1},{y0}"
    marcas = ""
    fins, k = [], 0
    for a in D:
        k += len(D[a]); fins.append((k - 1, t["meses"][len(D[a]) - 1] + f"/{str(a)[2:]}", comp(D[a])))
    ult = fins[-1][0]
    for i, rot, var in fins:
        xx, yy = X(i + 1), y0 - serie[i + 1] / top * 230
        marcas += f"""<line x1="{xx}" y1="{yy}" x2="{xx}" y2="{y0}" stroke="#ffffff55" stroke-dasharray="3 4"/>
<circle cx="{xx}" cy="{yy}" r="7" fill="{VERDE}" stroke="#fff" stroke-width="2"/>
<text x="{xx}" y="{y0 + 18}" fill="#cfe3d8" font-size="11" text-anchor="middle" font-weight="600">{rot}</text>
<text x="{xx}" y="{y0 + 34}" fill="{VERDE}" font-size="13" text-anchor="middle" font-weight="800">{pct(var, t)}</text>
<rect x="{xx - 62}" y="{yy - 44}" width="124" height="28" rx="6" fill="#06150f" stroke="#ffffff66"/>
<text x="{xx}" y="{yy - 25}" fill="#fff" font-size="14" text-anchor="middle" font-weight="700">{t['eur'](final if i == ult else serie[i + 1])}</text>"""
    grelha = "".join(f'<line x1="{x0}" x2="{x1}" y1="{y0 - k * 46}" y2="{y0 - k * 46}" stroke="#ffffff14"/><text x="{x0 - 10}" y="{y0 - k * 46 + 4}" fill="#cfe3d8" font-size="11" text-anchor="end">€{k * 2}K</text>' for k in range(6))
    eixo = "".join(f'<text x="{X(i)}" y="{y0 + 18}" fill="#8fb3a1" font-size="9.5" text-anchor="middle">{t["meses"][(i) % 12]}/{24 + i // 12}</text>' for i in range(0, N_MESES, 2) if all(abs(i - (f[0] + 1)) > 1 for f in fins))
    caixa = lambda titulo, sub, val, destaque: f"""<div class="cx" style="flex:1;height:140px;display:flex;align-items:center;gap:18px;padding:0 22px;{'border-color:' + VERDE + ';box-shadow:0 0 30px #2ee88a33' if destaque else ''}">
  <div style="width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:{'#0f3d2a' if destaque else 'transparent'}">{ICONE_GRAF if destaque else ICONE_MOEDAS}</div>
  <div style="min-width:0"><div style="font:800 14px Inter;color:{VERDE if destaque else '#fff'}">{titulo}</div><div style="font:500 13px Inter;color:#cfe3d8;margin:4px 0 8px;white-space:nowrap">{sub}</div>
  <div style="font:800 32px Inter">{val}</div></div></div>"""
    corpo = f"""<div style="text-align:center;padding-top:34px"><img src="{logo}" style="height:96px"></div>
<div style="text-align:center;font:800 44px/1.15 Inter;margin-top:16px">{t['t1']}<br>{t['t2a']}<span style="color:{VERDE}">{t['t2b']}</span></div>
<div style="text-align:center;font:400 20px Inter;color:#cfe3d8;margin-top:10px">{t['sub']}</div>
<div style="position:absolute;left:66px;right:50px;top:288px;display:flex;align-items:center;gap:18px">
  {caixa(t['sem'], t['sem2'], t['eur'](2000), False)}
  <div style="width:58px;height:58px;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font:800 18px Inter">VS</div>
  {caixa(t['com'], t['com2'], t['eur'](final), True)}</div>
<div class="cx" style="position:absolute;left:50px;right:50px;top:446px;height:340px"></div>
<div style="position:absolute;left:76px;top:468px;font:700 15px Inter">{t['de']} <span style="color:{VERDE}">{t['jan']}</span> {t['ate2']} <span style="color:{VERDE}">{t['ago']}</span></div>
<div style="position:absolute;right:70px;top:458px;border:1.5px solid {VERDE};border-radius:8px;padding:4px 14px;text-align:center">
  <div style="font:800 26px Inter;color:{VERDE}">{pct(total, t)}</div><div style="font:600 11px Inter;letter-spacing:.1em">{t['jc']}</div></div>
<svg width="900" height="956" style="position:absolute;left:0;top:0">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{VERDE}" stop-opacity=".45"/><stop offset="1" stop-color="{VERDE}" stop-opacity="0"/></linearGradient></defs>
  {grelha}<polygon points="{area}" fill="url(#g)"/><polyline points="{pts}" fill="none" stroke="{VERDE}" stroke-width="3"/>{eixo}{marcas}
</svg>
<div style="position:absolute;left:50px;right:50px;top:800px;display:flex;align-items:center;gap:18px">
  <div class="cx" style="flex:1;padding:20px 26px"><div style="font:500 17px Inter;color:#cfe3d8">{t['ini']}</div><div style="font:800 30px Inter">{t['eur'](2000)}</div></div>
  <div style="font:800 26px Inter">→</div>
  <div class="cx" style="flex:1.2;padding:20px 26px;border-color:{VERDE}"><div style="font:600 17px Inter;color:{VERDE}">{t['res']}</div>
    <div style="font:800 30px Inter">{t['eur'](final)} <span style="font:800 15px Inter;background:#0f3d2a;padding:4px 8px;border-radius:6px">{pct(total, t)}</span></div></div></div>
<div style="position:absolute;left:0;right:0;top:912px;text-align:center;font:500 13px Inter;letter-spacing:.3em;color:#cfe3d8">—— {t['risco']} ——</div>"""
    render(base(900, 956, corpo), 900, 956, SITE / "assets" / ("comparativo.jpg" if lang == "pt" else f"comparativo-{lang}.jpg"))


if __name__ == "__main__":
    import sys
    langs = sys.argv[1:] or list(T)
    for l in langs:
        tabela(l)
        comparativo(l)
        print(l, "ok")
