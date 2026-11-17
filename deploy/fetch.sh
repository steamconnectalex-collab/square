#!/bin/sh
# Baixa os arquivos de site/ do GitHub (no commit indicado) para a pasta out/.
# Serve para publicar na Vercel sem precisar colar os arquivos um a um.
# Uso (comando de build da Vercel): sh fetch.sh <commit>
set -eu
REF="${1:?informe o commit}"
BASE="https://raw.githubusercontent.com/steamconnectalex-collab/square/$REF/site"
mkdir -p out
for f in index.html app.js home.js config.js qr.js style.css favicon.svg; do
  curl -fsSL --retry 3 --max-time 60 "$BASE/$f" -o "out/$f"
done
ls -l out
