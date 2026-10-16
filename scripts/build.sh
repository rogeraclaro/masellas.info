#!/bin/sh
# Bundles the page sources into the .min files the HTML loads. CI runs this same script.
# Usage: sh scripts/build.sh   (or: npm run build)
set -eu
cd "$(dirname "$0")/.."

ESBUILD="npx --yes esbuild@0.24.0"
JS="--bundle --minify --format=iife --log-level=warning"
# Fonts live at /tipos/ on the site; leave those URLs alone.
CSS="--bundle --minify --external:/tipos/* --log-level=warning"

$ESBUILD js/page-transition.js $JS --outfile=js/page-transition.min.js
$ESBUILD js/home.js $JS --outfile=js/home.min.js
$ESBUILD css/home.css $CSS --outfile=css/home.min.css
$ESBUILD projects/js/projects.js $JS --outfile=projects/js/projects.min.js
$ESBUILD projects/css/projects.css $CSS --outfile=projects/css/projects.min.css

echo "built: js/page-transition.min.js js/home.min.js css/home.min.css projects/js/projects.min.js projects/css/projects.min.css"
