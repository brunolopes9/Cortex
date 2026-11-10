"""Avisa o Bing (e outros motores com IndexNow) de todas as páginas do sitemap.  py -3 tools/indexnow.py"""
import json, re, urllib.request
from pathlib import Path
SITE = Path(__file__).resolve().parent.parent
key = (SITE / "tools" / "indexnow.key").read_text().strip()
urls = re.findall(r"<loc>([^<]+)</loc>", (SITE / "sitemap.xml").read_text(encoding="utf-8"))
corpo = json.dumps({"host": "www.cortexautomationai.com", "key": key,
                    "keyLocation": f"https://www.cortexautomationai.com/{key}.txt", "urlList": urls}).encode()
r = urllib.request.urlopen(urllib.request.Request("https://api.indexnow.org/indexnow", data=corpo,
                           headers={"Content-Type": "application/json; charset=utf-8"}), timeout=30)
print(r.status, len(urls), "URLs enviados")
