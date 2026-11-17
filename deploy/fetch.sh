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
# Fotos de teste dos perfis (provisório; ver USE_TEST_PHOTOS em site/app.js)
mkdir -p out/img
for f in eu capa tux terno anime estatua craque morcego mono1 mono2 cao craque2 boneco dentes v1 v2 v3 v4 v5 v6 v7 v8 dream foroz sleepy unity sociaxs; do
  curl -fsSL --retry 3 --max-time 60 "$BASE/img/$f.jpg" -o "out/img/$f.jpg"
done
ls -l out out/img
