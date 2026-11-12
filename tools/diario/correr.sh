#!/bin/bash
# Artigo diário do blog da Cortex (cron do deploy, 10:15). Modelo do lopestech-diario:
# o Claude (contentor, sem Bash) só escreve UM json em tools/blog-dados; o anfitrião valida, gera, publica e confirma.
#   DRY=1 bash correr.sh   -> escreve e valida, mas não faz push
set -uo pipefail
D=/home/deploy/cortex-blog
SITE=/home/deploy/estudio/data/cortex-site
IMG=estudio-estudio
DATA=$(date +%F)
LOG=$D/registo.log
log() { echo "$(date '+%F %T') $*" >> "$LOG"; }
corre() { docker run --rm -i --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$SITE:/site" -w /site "$IMG" "$@"; }

exec 9>"$D/lock"; flock -n 9 || { log "já está a correr"; exit 0; }
cd "$SITE" || exit 1
git fetch -q origin && git reset -q --hard origin/main && git clean -fdq -e tools/diario/*.txt || { log "git fetch/reset falhou"; exit 1; }

# já há artigo automático de hoje? sai (idempotente)
if grep -l "\"auto\": true" tools/blog-dados/*.json 2>/dev/null | xargs -r grep -l "\"data\": \"$DATA\"" | grep -q .; then log "já existe artigo de $DATA"; exit 0; fi
# limite da subscrição já atingido hoje (estúdio, lopestech ou nós)? sai
for f in /home/deploy/estudio/data/alertas.json /opt/lopestech-diario/alertas.json "$D/alertas.json"; do
  [ -f "$f" ] && grep -q "limite-$DATA" "$f" && { log "limite Max já atingido hoje ($f)"; exit 0; }
done

corre python tools/diario/listas.py >> "$LOG" 2>&1
set -a; . /home/deploy/partilhado-claude.env; set +a
sed "s/{{DATA}}/$DATA/g" tools/diario/PROMPT.md > "$D/prompt.md"
OUT=$(docker run --rm -i --user "$(id -u):$(id -g)" -e HOME=/tmp -e CLAUDE_CODE_OAUTH_TOKEN -e ANTHROPIC_API_KEY= \
  -v "$SITE:/site" -w /site "$IMG" claude -p --output-format json --model opus --permission-mode acceptEdits \
  --allowedTools "WebSearch,WebFetch,Read,Glob,Grep,Write" --disallowedTools "Bash,Task,Edit" < "$D/prompt.md" 2>&1)
echo "$OUT" > "$D/ultimo-claude.json"
if echo "$OUT" | grep -qiE "usage limit|rate limit|limit reached|5-hour limit|weekly limit|resets at"; then
  python3 - "$D/alertas.json" "$DATA" <<'PY'
import json, sys, pathlib
p = pathlib.Path(sys.argv[1]); d = json.loads(p.read_text()) if p.exists() else {}
d[f"limite-{sys.argv[2]}"] = True; p.write_text(json.dumps(d))
PY
  log "limite da Max: artigo fica para amanhã"; exit 0
fi

# só pode haver UM ficheiro novo, em tools/blog-dados
NOVOS=$(git status --porcelain --untracked-files=all | grep -v "tools/diario/.*\.txt$")
if [ "$(echo "$NOVOS" | grep -c .)" != "1" ] || ! echo "$NOVOS" | grep -qE '^\?\? tools/blog-dados/[a-z0-9-]+\.json$'; then
  log "REJEITADO (ficheiros inesperados): $(echo "$NOVOS" | tr '\n' ' ')"; git reset -q --hard; git clean -fdq -e tools/diario/*.txt; exit 1
fi
F=$(echo "$NOVOS" | awk '{print $2}')
if ! V=$(corre python tools/diario/validar.py "$F" "$DATA" 2>&1); then
  log "$V"; mkdir -p "$D/rejeitados"; cp "$F" "$D/rejeitados/"; git clean -fdq -e tools/diario/*.txt; exit 1
fi
log "$V"

corre sh -c "python tools/blog.py /site --paginas && python tools/seo.py && python tools/seo_extra.py && python tools/diario/og_paginas.py" >> "$LOG" 2>&1 \
  || { log "gerar páginas falhou"; git reset -q --hard; git clean -fdq -e tools/diario/*.txt; exit 1; }
ID=$(basename "$F" .json)
SLUG=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['lang']['pt']['slug'])" "$F")
git add -A && git -c user.name="Cortex diário" -c user.email="blog@cortexautomationai.com" commit -qm "Blog diário $DATA: $ID" || { log "commit falhou"; exit 1; }

if [ -n "${DRY:-}" ]; then log "DRY: $ID gerado e validado (sem push)"; git reset -q --hard origin/main; exit 0; fi
GIT_SSH_COMMAND="ssh -i /home/deploy/.ssh/cortex_deploy -o IdentitiesOnly=yes" git push -q git@github.com:brunolopes9/Cortex.git HEAD:main \
  || { log "push falhou"; exit 1; }
URL="https://www.cortexautomationai.com/blog/$SLUG.html"
for i in $(seq 1 30); do [ "$(curl -s -o /dev/null -w '%{http_code}' "$URL")" = 200 ] && break; sleep 10; done
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$URL")
log "publicado $URL -> $CODE"
[ "$CODE" = 200 ] && corre python tools/indexnow.py >> "$LOG" 2>&1
echo "$DATA | site | artigo do blog: $ID ($URL)" >> /home/deploy/estudio/data/manual/publicado.md
