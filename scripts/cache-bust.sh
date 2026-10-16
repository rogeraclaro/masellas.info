#!/bin/sh
# Versions the bundled asset URLs by content hash (nginx caches css/js for 10 years).
# Rewrites the HTML in place: run it in CI after scripts/build.sh, never on your working copy.
# Covers every generated page (ca at the root, en/, es/); fails if any expected URL was not found and replaced.
set -eu
cd "$(dirname "$0")/.."

# html file | URL as written in the HTML | built file
bust() {
  html=$1 url=$2 file=$3
  [ -f "$html" ] || { echo "::error::missing page $html"; exit 1; }
  hash=$(shasum -a 256 "$file" | cut -c1-10)
  URL="$url" HASH="$hash" perl -pi -e 's/"\Q$ENV{URL}\E"/"$ENV{URL}?v=$ENV{HASH}"/g' "$html"
  grep -qF "\"$url?v=$hash\"" "$html" || { echo "::error::failed to version $url in $html"; exit 1; }
  echo "$html: $url?v=$hash"
}

for prefix in '' en/ es/; do
  bust "${prefix}index.html" /css/home.min.css css/home.min.css
  bust "${prefix}index.html" /js/home.min.js js/home.min.js
  bust "${prefix}index.html" /js/page-transition.min.js js/page-transition.min.js
  bust "${prefix}projects/index.html" /projects/css/projects.min.css projects/css/projects.min.css
  bust "${prefix}projects/index.html" /projects/js/projects.min.js projects/js/projects.min.js
  bust "${prefix}projects/index.html" /js/page-transition.min.js js/page-transition.min.js
done
