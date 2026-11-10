"""
VSL da Cortex Automation em en / fr / es a partir do vídeo em PT (assets/vsl.mp4).

- voz: Gemini TTS, voz "Orus", frase a frase, encaixada no tempo da frase original;
- música de fundo baixa (o original tem uma cama musical a ~-35 dB);
- legendas novas no fundo (a faixa das legendas antigas é desfocada);
- títulos animados em PT desfocados e substituídos pelo texto traduzido.

    python vsl.py <pasta> en fr es        (precisa de ANTHROPIC_API_KEY e GEMINI_API_KEY)
"""

import base64
import json
import os
import re
import subprocess
import sys
import wave
from pathlib import Path

import anthropic
import requests

DUR = 77.83
# frases da voz (início, fim da janela, texto PT)
FRASES = [
    (0.0, 10.5, "Na Cortex Automation, focamo-nos numa coisa: um sistema de trading com IA que trabalha por si, enquanto o seu dinheiro fica 100% na sua própria conta de trading."),
    (10.64, 17.45, "O sistema analisa a tendência real do mercado, espera por rompimentos fortes e só depois abre uma operação,"),
    (17.56, 25.0, "com risco predefinido. Ao contrário de muitos robôs, não dispara 20 a 50 operações, nem usa grid ou martingale."),
    (25.1, 28.3, "É um sistema de operação única, totalmente automatizado."),
    (28.36, 33.1, "Começar é totalmente grátis: sem mensalidades, sem custos de adesão."),
    (33.22, 38.45, "O seu capital fica 100% na sua conta pessoal de trading, e pode parar quando quiser."),
    (38.56, 42.7, "Só ganhamos quando você ganha, com um modelo justo de partilha de lucros."),
    (42.8, 44.1, "Começar é simples."),
    (44.2, 48.3, "Primeiro, abre uma conta de trading; depois, deposita o valor que escolher."),
    (48.38, 54.9, "A seguir, entra no portal de investidor e liga a sua conta da corretora à Cortex Automation, em poucos cliques."),
    (54.98, 62.3, "A partir daí, a IA opera sozinha em segundo plano, e pode acompanhar tudo em tempo real, com total transparência."),
    (62.4, 71.0, "A estratégia foi testada com três anos de histórico, com um lucro médio mensal de cerca de 4,38% e drawdown controlado."),
    (71.08, 77.6, "Se quer trading automatizado enquanto aproveita a sua vida, deslize para baixo e comece com a Cortex Automation."),
]
# títulos no ecrã: (início, fim, x, y, tamanho, alinhamento ASS, caixa a desfocar x,y,w,h, texto PT)
TITULOS = [
    (10.3, 17.6, 640, 105, 30, 8, (380, 70, 520, 70), "Tendências reais de mercado"),
    (19.6, 22.0, 640, 455, 38, 8, (230, 410, 820, 110), "Não dispara 20-50 operações"),
    (21.9, 23.6, 640, 18, 30, 8, (330, 0, 620, 70), "Não dispara 20-50 operações"),
    (23.9, 27.0, 640, 228, 36, 8, (230, 190, 820, 110), "Sistema de operação única"),
    (27.9, 32.4, 640, 178, 26, 8, (380, 150, 520, 70), "Começar é totalmente grátis"),
    (34.0, 36.4, 640, 100, 24, 8, (430, 75, 420, 60), "Pare quando quiser"),
    (37.0, 39.4, 640, 345, 30, 8, (330, 300, 620, 100), "Só ganhamos quando ganha"),
    (39.4, 42.4, 640, 110, 28, 8, (330, 80, 620, 70), "Só ganhamos quando ganha"),
    (42.0, 44.2, 640, 345, 36, 8, (330, 300, 620, 110), "Começar é simples"),
    (52.6, 55.6, 640, 70, 28, 8, (230, 40, 820, 70), "A IA opera sozinha em segundo plano"),
    (55.7, 59.6, 480, 213, 28, 8, (130, 180, 700, 80), "Acompanhe tudo em tempo real"),
    (60.8, 70.6, 640, 160, 28, 8, (280, 125, 720, 75), "Estratégia testada com 3 anos de histórico"),
    (65.4, 70.6, 745, 545, 26, 8, (580, 520, 340, 60), "Lucro médio mensal"),
    (69.3, 72.6, 400, 190, 30, 8, (120, 160, 640, 90), "Se quer trading automatizado"),
]
FAIXA_LEGENDAS = (0, 640, 1280, 80)   # zona das legendas originais (desfocada)
LINGUAS = {"en": "English (neutral international, natural voice-over)", "fr": "French (France)", "es": "Spanish (Spain/neutral)"}
NOMES_TTS = {"en": "English", "fr": "French", "es": "Spanish"}


def traduzir(lang):
    cl = anthropic.Anthropic()
    pedido = {"frases": [f[2] for f in FRASES], "titulos": [t[-1] for t in TITULOS]}
    msg = cl.messages.create(
        model="claude-opus-5-5", max_tokens=8000,
        system=(f"Translate this Portuguese voice-over script and on-screen titles of a 78-second video for Cortex Automation "
                f"(automated trading; client funds stay in the client's own account) into {LINGUAS[lang]}. "
                "Each sentence must be speakable in roughly the same time as the Portuguese (similar or shorter length). "
                "Keep numbers exactly (100%, 20-50, 4.38% written the target-language way, 3 years). Keep 'grid', 'martingale', "
                "'drawdown', 'Cortex Automation'. Titles: short, same meaning. Return JSON only: "
                '{"frases": [...13 strings...], "titulos": [...same count as input...]}'),
        messages=[{"role": "user", "content": json.dumps(pedido, ensure_ascii=False)}])
    txt = "".join(b.text for b in msg.content if b.type == "text")
    d = json.loads(re.search(r"\{.*\}", txt, re.S).group(0))
    assert len(d["frases"]) == len(FRASES) and len(d["titulos"]) == len(TITULOS)
    return d


def tts(texto, lang, destino):
    k = os.environ["GEMINI_API_KEY"]
    import time
    modelo = "gemini-3.8-flash-tts"  # sempre o mesmo modelo, para a voz soar igual em todas as frases
    for tentativa in range(8):
        if tentativa:
            time.sleep(15 * tentativa)
        r = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent",
            params={"key": k}, timeout=180,
            json={"contents": [{"parts": [{"text": texto}]}],
                  "generationConfig": {"responseModalities": ["AUDIO"],
                                       "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": "Orus"}}}}})
        if r.status_code == 200:
            parte = r.json()["candidates"][0]["content"]["parts"][0]["inlineData"]
            pcm = base64.b64decode(parte["data"])
            mime = parte.get("mimeType", "")
            if pcm[:4] == b"RIFF" or "wav" in mime:
                Path(destino).write_bytes(pcm)
                return modelo + " " + mime
            if pcm[:3] == b"ID3" or "mpeg" in mime or "ogg" in mime:
                tmp = Path(str(destino) + ".src")
                tmp.write_bytes(pcm)
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), str(destino)], check=True)
                return modelo + " " + mime
            m = re.search(r"rate=(\d+)", mime)
            taxa = int(m.group(1)) if m else 24000
            with wave.open(str(destino), "wb") as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(taxa); w.writeframes(pcm)
            return modelo
        ultimo = f"{modelo}: {r.status_code} {r.text[:200]}"
    raise RuntimeError(ultimo)


def duracao(f):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)],
                                capture_output=True, text=True, check=True).stdout)


def ass_tempo(s):
    h, s = divmod(s, 3600); m, s = divmod(s, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def quebrar(txt, maxc=46):
    palavras, linhas, atual = txt.split(), [], ""
    for p in palavras:
        if len(atual) + len(p) + 1 > maxc and atual:
            linhas.append(atual); atual = p
        else:
            atual = (atual + " " + p).strip()
    linhas.append(atual)
    return linhas


def fazer(pasta, lang):
    trab = pasta / lang
    trab.mkdir(exist_ok=True)
    tf = trab / "texto.json"
    d = json.loads(tf.read_text(encoding="utf-8")) if tf.exists() else traduzir(lang)
    tf.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    # 1) vozes frase a frase, encaixadas na janela da frase original
    entradas, eventos = [], []
    for i, ((ini, fim, _), frase) in enumerate(zip(FRASES, d["frases"])):
        bruto = trab / f"v{i:02d}.wav"
        if not bruto.exists():
            print(lang, "tts", i, tts(frase, lang, bruto), flush=True)
        limpo = trab / f"l{i:02d}.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(bruto), "-af",
                        "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
                        str(limpo)], check=True)
        dur = duracao(limpo)
        janela = fim - ini - 0.05
        fator = min(max(dur / janela, 1.0), 1.35)
        pronto = trab / f"a{i:02d}.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(bruto), "-af",
                        f"silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,atempo={fator:.3f}", "-ar", "48000", str(pronto)], check=True)
        dfinal = duracao(pronto)
        entradas.append((ini, pronto))
        # legendas: a frase dividida em blocos de 2 linhas, ao ritmo da voz
        linhas = quebrar(frase)
        blocos = ["\\N".join(linhas[j:j + 2]) for j in range(0, len(linhas), 2)]
        pesos = [len(b) for b in blocos]
        t = ini
        for b, p in zip(blocos, pesos):
            dt = dfinal * p / sum(pesos)
            eventos.append((t, t + dt, b))
            t += dt
    # 2) faixa de voz + música
    cmd = ["ffmpeg", "-v", "error", "-y"]
    for _, f in entradas:
        cmd += ["-i", str(f)]
    musica = pasta / "musica.mp3"
    cmd += ["-stream_loop", "-1", "-i", str(musica)]
    filtros = [f"[{k}:a]adelay={int(ini * 1000)}|{int(ini * 1000)}[d{k}]" for k, (ini, _) in enumerate(entradas)]
    mix = "".join(f"[d{k}]" for k in range(len(entradas)))
    nm = len(entradas)
    filtros.append(f"{mix}amix=inputs={nm}:normalize=0,volume=1.0[voz]")
    filtros.append(f"[{nm}:a]atrim=0:{DUR},volume=0.035,afade=t=in:d=1.5,afade=t=out:st={DUR - 2.5}:d=2.5[mus]")
    filtros.append(f"[voz][mus]amix=inputs=2:normalize=0,atrim=0:{DUR},loudnorm=I=-16:TP=-1.5[out]")
    audio = trab / "audio.m4a"
    subprocess.run(cmd + ["-filter_complex", ";".join(filtros), "-map", "[out]", "-c:a", "aac", "-b:a", "160k", str(audio)], check=True)
    # 3) legendas e títulos (ASS)
    ass = ["[Script Info]", "ScriptType: v4.00+", "PlayResX: 1280", "PlayResY: 720", "",
           "[V4+ Styles]",
           "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
           "Style: Leg,Manrope,21,&H00FFFFFF,&H00FFFFFF,&H00140A12,&H64000000,1,0,0,0,100,100,0,0,1,1.2,0.6,2,80,80,22,1",
           "Style: Tit,Manrope,30,&H00F4F0FF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,8,40,40,0,1",
           "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
    for a, b, txt in eventos:
        ass.append(f"Dialogue: 1,{ass_tempo(a)},{ass_tempo(b)},Leg,,0,0,0,,{txt}")
    for (a, b, x, y, tam, al, _, _), txt in zip(TITULOS, d["titulos"]):
        ass.append(f"Dialogue: 2,{ass_tempo(a)},{ass_tempo(b)},Tit,,0,0,0,,{{\\an{al}\\pos({x},{y})\\fs{tam}\\fad(250,200)}}{txt}")
    (trab / "legendas.ass").write_text("\n".join(ass), encoding="utf-8")
    # 4) vídeo: desfoca a faixa das legendas PT e as zonas dos títulos PT, e queima o ASS
    fx, fy, fw, fh = FAIXA_LEGENDAS
    partes = [f"[0:v]split=2[base][c0]", f"[c0]crop={fw}:{fh}:{fx}:{fy},boxblur=luma_radius=18:luma_power=3:chroma_radius=9:chroma_power=3[b0]", f"[base][b0]overlay={fx}:{fy}[v0]"]
    ultimo = "v0"
    for k, (a, b, _, _, _, _, (bx, by, bw, bh), _) in enumerate(TITULOS, start=1):
        partes.append(f"[{ultimo}]split=2[s{k}][c{k}]")
        partes.append(f"[c{k}]crop={bw}:{bh}:{bx}:{by},boxblur=luma_radius={min(20, bh // 2 - 1)}:luma_power=3:chroma_radius={min(10, bh // 4 - 1)}:chroma_power=3[b{k}]")
        partes.append(f"[s{k}][b{k}]overlay={bx}:{by}:enable='between(t,{a - 0.4},{b + 0.3})'[v{k}]")
        ultimo = f"v{k}"
    partes.append(f"[{ultimo}]ass={trab / 'legendas.ass'}:fontsdir={pasta / 'fontes'}[vout]")
    saida = pasta / f"vsl-{lang}.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(pasta / "vsl.mp4"), "-i", str(audio),
                    "-filter_complex", ";".join(partes), "-map", "[vout]", "-map", "1:a",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-pix_fmt", "yuv420p", "-c:a", "copy",
                    "-movflags", "+faststart", "-t", str(DUR), str(saida)], check=True)
    print("feito", saida, round(duracao(saida), 2), flush=True)


if __name__ == "__main__":
    pasta = Path(sys.argv[1])
    for lang in sys.argv[2:]:
        fazer(pasta, lang)
