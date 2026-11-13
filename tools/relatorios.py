"""PDFs do site com a marca Cortex, gerados da FONTE ÚNICA (tools/dados/resultados.json + mês em curso de
tools/diario/meses.json). Substituem os antigos (que ainda tinham o logótipo e as cores da Altrix).

  assets/relatorio-performance.pdf  — apresentação do sistema + histórico completo (A4 vertical)
  assets/relatorio-trimestral.pdf   — resultados trimestre a trimestre (A4 horizontal)

Uso: python tools/relatorios.py [site]      (precisa do Chrome/Chromium)
"""
import json
import shutil
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

SITE = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent)
CHROME = next((c for c in (r"C:\Program Files\Google\Chrome\Application\chrome.exe", shutil.which("chromium"),
                            shutil.which("google-chrome")) if c and Path(c).exists()), "chromium")
R = json.loads((SITE / "tools/dados/resultados.json").read_text(encoding="utf-8"))
EST = json.loads((SITE / "tools/diario/meses.json").read_text(encoding="utf-8")) if (SITE / "tools/diario/meses.json").exists() else {}
ANOS = sorted(R["meses"], key=int)
MES = "janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro".split()
MC = "Jan Fev Mar Abr Mai Jun Jul Ago Set Out Nov Dez".split()
VERDE, VERM, FUNDO, TXT, SUAVE = "#2EE08A", "#FF5C6C", "#05090A", "#EEF4F1", "#93A69D"
HOJE = date.today()
LOGO = (SITE / "assets/logo.png").as_uri()
TELEGRAM = "https://t.me/+Q_ac3NsORpE3YzRk"


def pct(v, sinal=True, d=2):
    return ((f"{v:+.{d}f}" if sinal else f"{v:.{d}f}").replace(".", ",").replace("-", "−")) + "%"


def comp(xs):
    p = 1.0
    for x in xs:
        p *= 1 + x / 100
    return (p - 1) * 100


TODOS = [(int(a), i, x) for a in ANOS for i, x in enumerate(R["meses"][a])]
VALS = [x for _, _, x in TODOS]
ULT_A, ULT_M = TODOS[-1][0], TODOS[-1][1]
CURSO = next(((k, v) for k, v in sorted(EST.items()) if not v.get("fechado")), None)   # mês em curso
REAL = [x for a, i, x in TODOS if (a, i) >= (2026, 1)]       # conta real desde fev/2026
ATE = f"{MES[ULT_M]} de {ULT_A}"
HOJE_TXT = f"{HOJE.day} de {MES[HOJE.month - 1]} de {HOJE.year}"


def nota_curso():
    if not CURSO:
        return ""
    k, v = CURSO
    d = date.fromisoformat(v["ate"])
    return (f'<div class="curso"><b>{MES[int(k[5:]) - 1].capitalize()} {k[:4]} (em curso, até {d.day:02d}/{d.month:02d}):</b> '
            f'<span style="color:{VERDE if v["pct"] >= 0 else VERM}">{pct(v["pct"])}</span> — resultado provisório da conta real, '
            'com base nas operações já fechadas. O mês só entra no histórico depois de fechar.</div>')


FONTS = (SITE / "tools/dados/fonts").as_uri()
CSS = f"""
@font-face{{font-family:Sora;src:url('{FONTS}/Sora.ttf');font-weight:100 900}}
@font-face{{font-family:Manrope;src:url('{FONTS}/Manrope.ttf');font-weight:200 800}}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{background:{FUNDO};color:{TXT};font-family:Manrope,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.pg{{position:relative;overflow:hidden;page-break-after:always;padding:56px 58px;
  background:radial-gradient(ellipse at 85% -10%,#0f3d2a 0%,{FUNDO} 55%)}}
.pg:last-child{{page-break-after:auto}}
.hd{{display:flex;justify-content:space-between;align-items:center;font:600 10px Sora;letter-spacing:.22em;color:{SUAVE};text-transform:uppercase;
  border-bottom:1px solid #ffffff14;padding-bottom:14px;margin-bottom:34px}}
.hd img{{height:40px}}
.ft{{position:absolute;left:58px;right:58px;bottom:30px;display:flex;justify-content:space-between;font:500 9px Sora;letter-spacing:.18em;color:#5e7068;text-transform:uppercase}}
h1{{font:800 40px/1.1 Sora;margin-bottom:16px}} h2{{font:700 22px Sora;margin:30px 0 12px}} h1 em,h2 em{{font-style:normal;color:{VERDE}}}
p{{font:500 14.5px/1.65 Manrope;color:#cbd8d2;margin-bottom:10px}} li{{font:500 14.5px/1.65 Manrope;color:#cbd8d2;margin:0 0 6px 18px}}
.kpis{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}}
.k{{border:1px solid #1f5a3d;border-radius:14px;padding:18px 18px;background:#08140fcc}}
.k span{{display:block;font:600 9.5px Sora;letter-spacing:.14em;color:{SUAVE};text-transform:uppercase;margin-bottom:8px}}
.k b{{font:800 28px Sora}} .k.hi{{border-color:{VERDE};box-shadow:0 0 24px #2ee08a33}}
.v{{color:{VERDE}}} .r{{color:{VERM}}}
.tag{{display:inline-block;font:700 9px Sora;letter-spacing:.16em;text-transform:uppercase;padding:5px 10px;border-radius:99px;border:1px solid #1f5a3d;color:{VERDE};margin-right:6px}}
.tag.t{{color:#f6c453;border-color:#5a4a1f}}
.curso{{margin-top:16px;border:1px dashed {VERDE};border-radius:12px;padding:12px 16px;font:500 12.5px/1.5 Manrope;color:#cbd8d2}}
table{{width:100%;border-collapse:collapse;margin-top:10px}} td,th{{font:600 11px Sora;padding:7px 4px;text-align:center;border-bottom:1px solid #ffffff10}}
th{{color:{SUAVE};font-size:9.5px;letter-spacing:.1em}}
.aviso{{border:1px solid #5a4a1f;background:#1a1408;border-radius:12px;padding:14px 16px;margin-top:14px}}
"""


def barras(xs, labels, w=680, h=330):
    m = max(10, max(abs(x) for x in xs))
    zero = h * m / (2 * m) if min(xs) < 0 else h - 30
    escala = (zero - 24) / m if min(xs) < 0 else (h - 54) / m
    bw = w / len(xs)
    out = [f'<svg width="{w}" height="{h + 20}" style="display:block;margin-top:8px"><line x1="0" x2="{w}" y1="{zero}" y2="{zero}" stroke="#ffffff22"/>']
    for i, (x, l) in enumerate(zip(xs, labels)):
        hh = abs(x) * escala
        y = zero - hh if x >= 0 else zero
        cor = VERDE if x >= 0 else VERM
        cx = i * bw + bw / 2
        out.append(f'<rect x="{cx - bw * .32:.1f}" y="{y:.1f}" width="{bw * .64:.1f}" height="{max(hh, 1.5):.1f}" rx="4" fill="{cor}"/>')
        ty = y - 6 if x >= 0 else y + hh + 13
        out.append(f'<text x="{cx:.1f}" y="{ty:.1f}" fill="{cor}" font-size="10" font-family="Sora" font-weight="700" text-anchor="middle">{pct(x, d=2)}</text>')
        out.append(f'<text x="{cx:.1f}" y="{h + 14}" fill="{SUAVE}" font-size="10" font-family="Sora" text-anchor="middle">{l}</text>')
    return "".join(out) + "</svg>"


def curva(w=680, h=300):
    v = [100.0]
    for x in VALS:
        v.append(v[-1] * (1 + x / 100))
    lo, hi = min(v) * .95, max(v) * 1.05
    X = lambda i: 40 + (w - 60) * i / (len(v) - 1)
    Y = lambda y: h - 30 - (h - 50) * (y - lo) / (hi - lo)
    pts = " ".join(f"{X(i):.1f},{Y(y):.1f}" for i, y in enumerate(v))
    out = [f'<svg width="{w}" height="{h}" style="display:block"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
           f'<stop offset="0" stop-color="{VERDE}" stop-opacity=".35"/><stop offset="1" stop-color="{VERDE}" stop-opacity="0"/></linearGradient></defs>',
           f'<polygon points="{X(0)},{h - 30} {pts} {X(len(v) - 1)},{h - 30}" fill="url(#g)"/>',
           f'<polyline points="{pts}" fill="none" stroke="{VERDE}" stroke-width="3"/>']
    k = 0
    for a in ANOS:
        out.append(f'<line x1="{X(k)}" x2="{X(k)}" y1="20" y2="{h - 30}" stroke="#ffffff18" stroke-dasharray="3 4"/>'
                   f'<text x="{X(k) + 6}" y="{h - 12}" fill="{SUAVE}" font-size="10" font-family="Sora">{a}</text>')
        k += len(R["meses"][a])
    rx = X(25)   # fev/2026: início da conta real
    out.append(f'<line x1="{rx}" x2="{rx}" y1="20" y2="{h - 30}" stroke="{VERDE}" stroke-dasharray="4 4"/>'
               f'<text x="{rx + 6}" y="32" fill="{VERDE}" font-size="10" font-family="Sora" font-weight="700">conta real</text>')
    out.append(f'<circle cx="{X(len(v) - 1)}" cy="{Y(v[-1])}" r="6" fill="{VERDE}"/>'
               f'<text x="{X(len(v) - 1) - 8}" y="{Y(v[-1]) - 12}" fill="{TXT}" font-size="12" font-family="Sora" font-weight="800" text-anchor="end">{pct(comp(VALS))}</text>')
    return "".join(out) + "</svg>"


def pagina(titulo_hd, corpo, n, doc):
    return (f'<section class="pg" style="height:{doc["h"]}px"><div class="hd"><span>{titulo_hd}</span><img src="{LOGO}"></div>{corpo}'
            f'<div class="ft"><span>Cortex Automation · {doc["nome"]}</span><span>{n:02d}</span></div></section>')


def capa(doc, titulo, sub):
    return (f'<section class="pg" style="height:{doc["h"]}px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;'
            f'background:radial-gradient(ellipse at 50% 30%,#0f4a32 0%,{FUNDO} 62%)">'
            f'<img src="{LOGO}" style="height:{doc["logo"]}px;margin-bottom:46px">'
            f'<div style="font:800 {doc["tc"]}px/1.05 Sora">{titulo}</div>'
            f'<div style="font:600 13px Sora;letter-spacing:.3em;color:{VERDE};margin-top:22px;text-transform:uppercase">{sub}</div>'
            f'<div style="position:absolute;bottom:48px;font:500 11px Sora;letter-spacing:.2em;color:{SUAVE};text-transform:uppercase">'
            f'Atualizado a {HOJE_TXT} · dados até {ATE}</div></section>')


def ano_info(a):
    xs = R["meses"][a]
    teste = "Teste sobre dados históricos" if int(a) < 2026 else "Jan: teste · desde fev: conta real"
    return xs, teste


def performance():
    doc = {"h": 1123, "nome": "Apresentação e histórico", "logo": 120, "tc": 48}
    pgs = [capa(doc, 'Apresentação<br><span style="color:' + VERDE + '">& histórico</span>', "Trading automático · Bitcoin e ouro")]
    n = 2
    anos = "".join(f'<div class="k"><span>{a} · {"teste" if int(a) < 2026 else "até " + MC[len(R["meses"][a]) - 1].lower()}</span>'
                   f'<b class="v">{pct(comp(R["meses"][a]))}</b><div style="font:500 10px Manrope;color:{SUAVE};margin-top:4px">composto · simples {pct(sum(R["meses"][a]))}</div></div>'
                   for a in ANOS)
    pos = sum(1 for x in VALS if x > 0)
    corpo = (f'<h1>{len(VALS)} meses de histórico, <em>um sistema.</em></h1>'
             f'<p>A Cortex Automation é um sistema de trading automático que opera dentro da conta de corretora de cada cliente, em nome do cliente. '
             f'Aqui estão todos os meses publicados, de janeiro de 2024 a {ATE}, os bons e os maus, à escala de 1% de risco por operação.</p>'
             f'<div class="kpis"><div class="k hi"><span>Total composto</span><b class="v">{pct(comp(VALS))}</b></div>'
             f'<div class="k"><span>Média mensal</span><b class="v">{pct(sum(VALS) / len(VALS))}</b></div>'
             f'<div class="k"><span>Meses positivos</span><b>{pos} / {len(VALS)}</b></div>'
             f'<div class="k"><span>Maior queda seguida</span><b class="r">{pct(-R["maior_queda_seguida"])}</b></div></div>'
             f'<div class="kpis" style="grid-template-columns:repeat({len(ANOS)},1fr)">{anos}</div>{nota_curso()}'
             '<h2>Neste documento</h2><ol style="margin-top:6px">'
             '<li>Como funciona o sistema</li><li>Resultados ano a ano</li><li>A curva completa e a conta real</li>'
             '<li>O modelo: sem mensalidade, só partilha de lucro</li><li>Metodologia e aviso de risco</li></ol>')
    pgs.append(pagina("Resumo", corpo, n, doc)); n += 1
    corpo = ('<h1>Como funciona <em>o sistema</em></h1>'
             '<h2>1 · Análise de mercado</h2><p>O algoritmo lê o mercado em tempo real e identifica a estrutura de preço: máximos, mínimos e zonas de rutura com maior probabilidade estatística. Não usa indicadores atrasados.</p>'
             '<h2>2 · Execução com regras</h2><p>Quando aparece um sinal válido, entra, define o risco antes de entrar (1% por operação na escala apresentada) e coloca o stop. Sem hesitar, sem medo e sem trades de vingança: as emoções ficam de fora.</p>'
             '<h2>3 · Gestão dinâmica da saída</h2><p>Os níveis de saída ajustam-se ao comportamento do mercado: deixa correr quando há força e protege o lucro quando as condições enfraquecem.</p>'
             '<h2>4 · Ativos: Bitcoin e, agora, ouro</h2><p>Todo o histórico apresentado (janeiro de 2024 a ' + ATE + ') foi feito em <b>Bitcoin (BTC/USD)</b>. '
             '<b>Desde o fim de outubro de 2026, o sistema também opera ouro (XAU/USD)</b>: um ativo diferente, com outros horários e outra volatilidade, '
             'que permite diversificar e aproveitar mais condições de mercado sem aumentar o risco por operação.</p>'
             '<h2>5 · O seu dinheiro fica consigo</h2><p>Os fundos ficam na sua conta de corretora, aberta em seu nome. A ligação só permite executar operações: não permite levantamentos nem transferências. Começa e para quando quiser.</p>')
    pgs.append(pagina("01 · O sistema", corpo, n, doc)); n += 1
    for a in ANOS:
        xs, tipo = ano_info(a)
        melhor, pior = max(xs), min(xs)
        corpo = (f'<h1>Resultados <em>{a}</em></h1><span class="tag{" t" if int(a) < 2026 else ""}">{tipo}</span><span class="tag">1% de risco</span>'
                 f'<div class="kpis"><div class="k hi"><span>Composto no ano</span><b class="{"v" if comp(xs) >= 0 else "r"}">{pct(comp(xs))}</b></div>'
                 f'<div class="k"><span>Soma simples</span><b>{pct(sum(xs))}</b></div>'
                 f'<div class="k"><span>Meses positivos</span><b>{sum(1 for x in xs if x > 0)} / {len(xs)}</b></div>'
                 f'<div class="k"><span>Melhor · pior mês</span><b style="font-size:20px;line-height:1.35"><span class="v">{pct(melhor)}</span><br><span class="r">{pct(pior)}</span></b></div></div>'
                 f'<h2>Mês a mês</h2>{barras(xs, MC[:len(xs)])}'
                 + (nota_curso() if a == ANOS[-1] else "")
                 + (f'<p style="margin-top:18px">Os meses de {a} resultam de testes sobre dados históricos de BTC/USD, com risco fixo de 1% por operação.</p>' if int(a) < 2026 else
                    '<p style="margin-top:18px">Janeiro de 2026 resulta de teste sobre dados históricos. Desde 10 de fevereiro de 2026, os resultados são de conta real, ajustados à escala de 1% de risco.</p>'))
        pgs.append(pagina(f"02 · Resultados {a}", corpo, n, doc)); n += 1
    linhas = "".join(f'<tr><td style="text-align:left;color:{TXT}">{a}</td>' + "".join(
        f'<td class="{"v" if x >= 0 else "r"}">{pct(x, d=2)}</td>' for x in R["meses"][a]) + "<td></td>" * (12 - len(R["meses"][a]))
        + f'<td class="v">{pct(comp(R["meses"][a]))}</td></tr>' for a in ANOS)
    corpo = (f'<h1>A curva <em>completa</em></h1><p>Evolução de 100 com juro composto, janeiro de 2024 a {ATE}. A linha tracejada marca o início da conta real (fevereiro de 2026).</p>'
             f'{curva()}<table><tr><th></th>' + "".join(f"<th>{m}</th>" for m in MC) + f'<th>ANO</th></tr>{linhas}</table>'
             f'<div class="kpis"><div class="k hi"><span>Total composto</span><b class="v">{pct(comp(VALS))}</b></div>'
             f'<div class="k"><span>Conta real (fev/26 →)</span><b class="{"v" if comp(REAL) >= 0 else "r"}">{pct(comp(REAL))}</b></div>'
             f'<div class="k"><span>Média mensal real</span><b>{pct(sum(REAL) / len(REAL))}</b></div>'
             f'<div class="k"><span>Maior queda seguida</span><b class="r">{pct(-R["maior_queda_seguida"])}</b></div></div>{nota_curso()}')
    pgs.append(pagina("03 · Curva completa", corpo, n, doc)); n += 1
    corpo = ('<h1>O nosso <em>modelo</em></h1>'
             '<h2>Sem mensalidades e sem taxa de adesão</h2><p>Não paga para entrar nem para usar o sistema.</p>'
             '<h2>Só partilha de lucro</h2><p>A Cortex só é remunerada com uma parte do lucro de cada mês. Se o mês fechar sem lucro, não paga nada.</p>'
             '<table style="margin:6px 0 12px"><tr><th>Escalão</th><th>Capital</th><th>Fica para si</th><th>Cortex</th></tr>'
             '<tr><td>Standard</td><td>500 a 999 €</td><td class="v">60%</td><td>40%</td></tr>'
             '<tr><td>Pro</td><td>1 000 a 9 999 €</td><td class="v">75%</td><td>25%</td></tr>'
             '<tr><td>VIP</td><td>10 000 € ou mais</td><td class="v">80%</td><td>20%</td></tr></table>'
             '<h2>O controlo é seu</h2><ul><li>A conta de corretora é sua, em seu nome.</li><li>Deposita e levanta diretamente na corretora, sem bloqueios nem penalizações.</li>'
             '<li>Liga e desliga o sistema quando quiser.</li><li>Acompanha todas as operações em tempo real.</li></ul>'
             '<h2>Como começar</h2><p>Cerca de 10 minutos: fale connosco, abra a conta na corretora recomendada, deposite o valor com que quer começar (mínimo 500 €) e ligue o sistema.</p>'
             f'<div class="k hi" style="margin-top:18px"><span>Fale connosco</span><b style="font-size:18px">cortexautomationai.com</b>'
             f'<div style="font:500 12px Manrope;color:{SUAVE};margin-top:6px">Resultados todos os dias no grupo do Telegram: {TELEGRAM}</div></div>')
    pgs.append(pagina("04 · Modelo", corpo, n, doc)); n += 1
    pgs.append(pagina("05 · Metodologia e risco", metodologia(), n, doc))
    return doc, pgs


def metodologia():
    return ('<h1>Metodologia e <em>aviso de risco</em></h1>'
            '<p><b>Escala.</b> Todos os resultados mensais estão apresentados à escala de 1% de risco por operação, para serem comparáveis entre si.</p>'
            '<p><b>Teste e conta real.</b> De janeiro de 2024 a janeiro de 2026, os resultados vêm de testes do sistema sobre dados históricos de BTC/USD. '
            'Desde 10 de fevereiro de 2026, vêm de uma conta real, ajustados à mesma escala. Os resultados de teste não são resultados de negociação real.</p>'
            '<p><b>Mês em curso.</b> O resultado do mês em curso é provisório (operações já fechadas) e só entra no histórico depois de o mês fechar.</p>'
            '<p><b>Ativos.</b> O histórico é de Bitcoin (BTC/USD). Desde o fim de outubro de 2026, o sistema também opera ouro (XAU/USD).</p>'
            '<div class="aviso"><p style="color:#f6c453;font-weight:700;margin-bottom:6px">Aviso de risco</p>'
            '<p>O trading envolve risco significativo de perda de capital, incluindo a possibilidade de perder parte ou a totalidade do capital investido. '
            'Rentabilidade passada não garante rentabilidade futura. O sistema pode passar por períodos de perda e as condições de mercado podem mudar de forma imprevisível. '
            'A Cortex Automation fornece software de execução automática; não presta aconselhamento financeiro nem gere fundos de clientes. '
            'Este documento tem fins exclusivamente informativos.</p></div>')


def trimestral():
    doc = {"h": 794, "nome": "Resultados trimestrais", "logo": 96, "tc": 44}
    pgs = [capa(doc, 'Resultados<br><span style="color:' + VERDE + '">trimestrais</span>', f"2024 — {ULT_A}")]
    n = 2
    for a in ANOS:
        xs = R["meses"][a]
        for q in range(4):
            ms = xs[q * 3:q * 3 + 3]
            if not ms:
                continue
            completo = len(ms) == 3
            cards = "".join(f'<div class="k" style="padding:20px"><span>{MES[q * 3 + i]} {a}</span><b style="font-size:34px" class="{"v" if x >= 0 else "r"}">{pct(x)}</b>'
                            f'<div style="font:500 10.5px Manrope;color:{SUAVE};margin-top:8px">{"teste sobre dados históricos" if (int(a), q * 3 + i) < (2026, 1) else "conta real · escala de 1%"}</div></div>'
                            for i, x in enumerate(ms))
            corpo = (f'<h1>{q + 1}.º trimestre <em>{a}</em>{"" if completo else " <span style=\'font-size:16px;color:" + SUAVE + "\'>(até " + MES[q * 3 + len(ms) - 1] + ")</span>"}</h1>'
                     f'<div class="kpis" style="grid-template-columns:repeat(3,1fr)"><div class="k hi"><span>Resultado do trimestre (composto)</span><b class="{"v" if comp(ms) >= 0 else "r"}">{pct(comp(ms))}</b></div>'
                     f'<div class="k"><span>Meses positivos</span><b>{sum(1 for x in ms if x > 0)} / {len(ms)}</b></div>'
                     f'<div class="k"><span>Acumulado desde jan/2024</span><b class="v">{pct(comp([x for aa in ANOS for x in R["meses"][aa]][:sum(len(R["meses"][b]) for b in ANOS if int(b) < int(a)) + q * 3 + len(ms)]))}</b></div></div>'
                     f'<div class="kpis" style="grid-template-columns:repeat(3,1fr);margin-top:22px">{cards}</div>'
                     + (nota_curso() if (a, q) == (ANOS[-1], (len(xs) - 1) // 3) else ""))
            pgs.append(pagina(f"Trimestre {q + 1} · {a}", corpo, n, doc)); n += 1
    corpo = (f'<h1>A curva <em>completa</em></h1><p>Evolução de 100 com juro composto, janeiro de 2024 a {ATE}. A linha tracejada marca o início da conta real.</p>'
             f'{curva(w=1000, h=330)}<div class="kpis"><div class="k hi"><span>Total composto</span><b class="v">{pct(comp(VALS))}</b></div>'
             f'<div class="k"><span>Meses positivos</span><b>{sum(1 for x in VALS if x > 0)} / {len(VALS)}</b></div>'
             f'<div class="k"><span>Média mensal</span><b>{pct(sum(VALS) / len(VALS))}</b></div>'
             f'<div class="k"><span>Maior queda seguida</span><b class="r">{pct(-R["maior_queda_seguida"])}</b></div></div>')
    pgs.append(pagina("Curva completa", corpo, n, doc)); n += 1
    pgs.append(pagina("Metodologia e risco", metodologia(), n, doc))
    return doc, pgs


def imprimir(doc, pgs, saida, paisagem=False):
    tam = "A4 landscape" if paisagem else "A4"
    w = 1123 if paisagem else 794
    html = (f'<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>Cortex Automation — {doc["nome"]}</title>'
            f'<style>@page{{size:{tam};margin:0}}{CSS} .pg{{width:{w}px}}</style></head><body>{"".join(pgs)}</body></html>')
    with tempfile.TemporaryDirectory() as tmp:
        f = Path(tmp) / "r.html"
        f.write_text(html, encoding="utf-8")
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--no-pdf-header-footer", "--virtual-time-budget=10000", "--allow-file-access-from-files",
                        f"--print-to-pdf={saida}", f.as_uri()], check=True, capture_output=True)
    print(saida, len(pgs), "páginas")


if __name__ == "__main__":
    imprimir(*performance(), SITE / "assets/relatorio-performance.pdf")
    imprimir(*trimestral(), SITE / "assets/relatorio-trimestral.pdf", paisagem=True)
