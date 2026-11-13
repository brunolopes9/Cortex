"""Imagem de partilha (Open Graph) em EN/FR/ES a partir de assets/og-source.html (mesmos números do PT).
Uso: py -3 tools/og_i18n.py  -> assets/og-image-{en,fr,es}.png e atualiza og:image/twitter:image nas páginas da língua."""
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

SITE = Path(__file__).resolve().parent.parent
CHROME = next((c for c in (r"C:\Program Files\Google\Chrome\Application\chrome.exe", shutil.which("chromium"),
                            shutil.which("google-chrome")) if c and Path(c).exists()), "chromium")
DOM = "https://www.cortexautomationai.com"
TROCAS = {
    "en": [("Conta real verificada", "Verified real account"), ("O seu dinheiro a trabalhar 24/7 —", "Your money working 24/7 —"),
           ("sem sair da sua conta.", "without leaving your account."),
           ("Trading algorítmico em Bitcoin. Sem taxa de adesão, sem mensalidades. Só ganhamos quando você ganha.",
            "Algorithmic Bitcoin trading. No sign-up fee, no monthly fees. We only earn when you earn."),
           ("Desde Janeiro de 2024", "Since January 2024"), 
           ("Maior queda", "Largest drop"), (">0 €<", ">€0<"), ("Custo de adesão", "Sign-up cost"), ('lang="pt-PT"', 'lang="en"')],
    "fr": [("Conta real verificada", "Compte réel vérifié"), ("O seu dinheiro a trabalhar 24/7 —", "Votre argent travaille 24h/24 —"),
           ("sem sair da sua conta.", "sans quitter votre compte."),
           ("Trading algorítmico em Bitcoin. Sem taxa de adesão, sem mensalidades. Só ganhamos quando você ganha.",
            "Trading algorithmique en Bitcoin. Sans frais d’adhésion, sans abonnement. Nous ne gagnons que si vous gagnez."),
           ("Desde Janeiro de 2024", "Depuis janvier 2024"), 
           ("Maior queda", "Plus forte baisse"), ("Custo de adesão", "Frais d’adhésion"), ('lang="pt-PT"', 'lang="fr"')],
    "es": [("Conta real verificada", "Cuenta real verificada"), ("O seu dinheiro a trabalhar 24/7 —", "Su dinero trabajando 24/7 —"),
           ("sem sair da sua conta.", "sin salir de su cuenta."),
           ("Trading algorítmico em Bitcoin. Sem taxa de adesão, sem mensalidades. Só ganhamos quando você ganha.",
            "Trading algorítmico en Bitcoin. Sin cuota de alta, sin mensualidades. Solo ganamos cuando usted gana."),
           ("Desde Janeiro de 2024", "Desde enero de 2024"), ("Maior queda", "Mayor caída"),
           ("Custo de adesão", "Coste de alta"), ('lang="pt-PT"', 'lang="es"')],
}


def main():
    src = (SITE / "assets" / "og-source.html").read_text(encoding="utf-8")
    TROCAS["pt"] = []
    for lang, trocas in TROCAS.items():
        h = src
        for a, b in trocas:
            assert a in h, f"{lang}: não encontrei {a!r}"
            h = h.replace(a, b)
        if lang == "en":
            h = re.sub(r"([+−-]\d+),(\d+)%", r"\1.\2%", h)
        elif lang == "fr":
            h = re.sub(r"([+−-]\d+,\d+)%", r"\1 %", h)
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / "og.html"
            # caminhos relativos do original (assets/...) continuam a resolver
            h = h.replace("<head>", f'<head><base href="{(SITE / "assets").as_uri()}/">', 1)
            f.write_text(h, encoding="utf-8")
            png = Path(tmp) / "og.png"
            subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1200,630",
                            "--no-sandbox", "--virtual-time-budget=4000", f"--screenshot={png}", f.as_uri()], check=True, capture_output=True)
            Image.open(png).convert("RGB").crop((0, 0, 1200, 630)).save(SITE / "assets" / ("og-image.png" if lang == "pt" else f"og-image-{lang}.png"), optimize=True)
        if lang == "pt":
            print(lang, "ok"); continue
        for pag in (SITE / lang).rglob("*.html"):
            s = pag.read_text(encoding="utf-8")
            n = re.sub(r'(<meta (?:property="og:image"|name="twitter:image") content=")[^"]*og-image\.png(")',
                       rf'\g<1>{DOM}/assets/og-image-{lang}.png\2', s)
            if n != s:
                pag.write_text(n, encoding="utf-8")
        print(lang, "ok")


if __name__ == "__main__":
    main()
