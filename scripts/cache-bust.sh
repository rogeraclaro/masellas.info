#!/bin/sh
# Versions the bundled asset URLs by content hash (nginx caches css/js for 10 years).
# Rewrites the HTML in place: run it in CI after scripts/build.sh, never on your working copy.
# Fails if any expected URL was not found and replaced.
set -eu
cd "$(dirname "$0")/.."

# html file | URL as written in the HTML | built file
bust() {
  html=$1 url=$2 file=$3
  hash=$(shasum -a 256 "$file" | cut -c1-10)
  URL="$url" HASH="$hash" perl -pi -e 's/"\Q$ENV{URL}\E"/"$ENV{URL}?v=$ENV{HASH}"/g' "$html"
  grep -qF "\"$url?v=$hash\"" "$html" || { echo "::error::failed to version $url in $html"; exit 1; }
  echo "$html: $url?v=$hash"
}

bust index.html css/home.min.css css/home.min.css
bust index.html js/home.min.js js/home.min.js
bust index.html /js/page-transition.min.js js/page-transition.min.js
bust projects/index.html css/projects.min.css projects/css/projects.min.css
bust projects/index.html js/projects.min.js projects/js/projects.min.js
bust projects/index.html /js/page-transition.min.js js/page-transition.min.js
