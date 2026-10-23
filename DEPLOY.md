# Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`:

1. `test` — `npm test` in `admin/` and `npm test` at the repo root (site logic), on Node 22.
2. `deploy` (GitHub environment `production`):
   - builds the pages and bundles with `scripts/build.sh` and versions their URLs with `scripts/cache-bust.sh`.
   - copies each `projects/data/*.json` only if the server does not have it yet. After that the admin owns them.
   - rsyncs `admin/` to `/home/rogermasellas/masellas-admin/app/` with `--delete`. `.env` and `data/` are protected.
   - rsyncs the site to `/home/rogermasellas/htdocs/masellas.info/` (including `en/` and `es/`, `robots.txt` and `sitemap.xml`, never `src/`, `i18n/`, `llms.txt` or `sitemap-projects.xml`; the admin's project pages are not in the repo, so the sync never touches them). It does not delete anything and does not change ownership or permissions. This runs before the admin reload: the admin then rewrites the six projects pages with the live list (see "Crawlers" below), which a later sync would undo.
   - reloads the app with pm2 under `rogermasellas` (and waits until it has published `projects.ca.json` and `projects-ac.ca.json` and rewritten the six projects pages and `sitemap-projects.xml`, i.e. they are newer than a stamp taken before the reload), then smoke-checks `/en/`, `/es/projects/`, `/projects-ac/`, `/en/projects-ac/`, every `/projects/data/*.json`, `/robots.txt`, `/sitemap.xml`, `/sitemap-projects.xml`, `/llms.txt` and `/admin/`, and, when the live `projects.ca.json` has projects, that `/projects/` links to its first project's page and that page (`/projects/<id>/`) has its own canonical.

Server layout:

```
/home/rogermasellas/htdocs/masellas.info/             site (web root)
  index.html, projects/, projects-ac/                  ca pages (en/ and es/ hold the others)
  projects/data/projects.<lang>.json                   public list per language (ca, en, es), rebuilt by the admin
  projects/data/projects-ac.<lang>.json                projects (B.C.) public list per language, rebuilt by the admin (no legacy copy)
  projects/data/some-words.<lang>.json                 home "some words" text per language, rebuilt by the admin
  projects/data/menu.<lang>.json                       menu tab tooltips per language (from the glossary), rebuilt by the admin (no legacy copy)
  projects/data/projects.json, some-words.json         legacy copies (= ca), see admin/README.md
  robots.txt, sitemap.xml                              from the repo (scripts/build-pages.mjs)
  llms.txt                                             projects in en for AI crawlers, rebuilt by the admin
  sitemap-projects.xml                                 every project page with its alternates, rebuilt by the admin
  projects/<id>/, projects-ac/<id>/ (+ en/, es/)       one index.html per public project, rebuilt by the admin
/home/rogermasellas/masellas-admin/app/                admin code (deployed)
  .env                                                 config + secrets (never deployed)
/home/rogermasellas/masellas-admin/data/projects.json  private list, hidden projects included
/home/rogermasellas/masellas-admin/data/projects-ac.json private projects (B.C.) list (created empty on first boot)
/home/rogermasellas/masellas-admin/data/some-words.json  private copy of the "some words" text
/home/rogermasellas/masellas-admin/data/glossary.json    glossary for {{term}} and menu tooltips (created at first boot with the "projects (B.C.)" menu term, pending)
```

## Languages

The site is in Catalan (principal, at the root: `/`, `/projects/`, `/projects-ac/`), English (`/en/`, `/en/projects/`, `/en/projects-ac/`) and Spanish (`/es/`, `/es/projects/`, `/es/projects-ac/`). `/projects/` is "projects (IA)" (made with AI); `/projects-ac/` is "projects (B.C.)" (ca / es "a.C."), older projects made without AI, with the same list, filters, `<page>/<slug>/` detail and transitions. There is no redirect by browser language. Each page has `<html lang>`, `hreflang` alternates (x-default = ca), `og:locale` and a `ca / en / es` switcher (top right; on phones, up to 720px, it shares a burger menu with the section tabs) that keeps the current section (`#secondPage`) or open project (`<page>/<slug>/`; a legacy `?p=<slug>` opens the project and becomes that path).

- Page HTML lives in `src/pages/home.html` and `src/pages/projects.html`. Both projects pages use `projects.html` (`PAGES` in `scripts/build-pages.mjs` sets each page's path, `data-page-x`, the data it loads via `data-collection`, and its key overrides); dictionary keys `projects_ac.<key>` replace `<key>` on the projects (B.C.) page only (title, heading, description, the "how it was made" detail heading, the detail page title), and an override of a key that does not exist fails the build. `{{key}}` is escaped text from the dictionary; `{{{key}}}` is HTML/JSON the build generates (alternates, switcher, the "some words" fallback, the JS strings).
- Text lives in `i18n/ca.json`, `i18n/en.json`, `i18n/es.json` (flat keys). `home.words` uses the admin's rich-text format. Keys starting with `js.` are injected into the projects page as `<script type="application/json" id="i18n">` and read by `js/shared/i18n.js`.
- `node scripts/build-pages.mjs` (run by `scripts/build.sh`) writes the nine `index.html` files, each starting with a "generated" comment. It fails if any language misses a key another has, a value is empty, a template uses an unknown key, or `home.words` has a bad link. Edit the templates and dictionaries, never the generated pages, and commit the generated pages.
- Projects and "some words" content are translated in the admin; the pages fetch `/projects/data/projects.<lang>.json`, `/projects/data/projects-ac.<lang>.json` and `/projects/data/some-words.<lang>.json`. The repo holds empty `projects-ac.<lang>.json` seeds (`{ "projects": [] }`) so the page works when served from the repo; on the server the admin creates and owns them.
- The "projects (B.C.)" menu tab has a tooltip on mouse hover and keyboard focus (a tap just follows the link). Its text is the glossary term `projects (B.C.)`, which the admin publishes as `/projects/data/menu.<lang>.json` (`{ "tooltips": { "projects-ac": "…" } }`); `js/shared/menu-tips.js` (in the home and projects bundles) fetches it. Empty (term pending) or not loaded: no tooltip. The repo holds empty seeds so the pages work from the repo.
- Switching language between pages at the same `data-page-x` is a short crossfade (transition type `fade`), not a slide.

## Crawlers

The projects pages load their list with JS, so crawlers that do not run it would see an empty page. The admin (`admin/lib/seo-pages.js`) fills two marker pairs in each of the six projects pages in the web root (`<!-- projects:start/end -->` in the list: one `<li><a class="work-item" href="/projects/<id>/" data-static>` row per project; `<!-- projects-ld:start/end -->` in `<head>`: a JSON-LD `ItemList` of `CreativeWork`) writes one page per public project and language (`<collection dir>/<id>/index.html`: that list page with the project's title, description, canonical, hreflang, `og:*`, a JSON-LD `CreativeWork`, the switcher and the detail filled in; the detail stays hidden until the script opens it, as for any deep link), `/sitemap-projects.xml` and `/llms.txt`, at boot and after every projects, projects (B.C.) or glossary save. The page script replaces those rows with its own once the data has loaded (and removes them if it cannot load); CSS keeps them hidden meanwhile, so JS users see no change. The repo's pages keep the markers empty. `scripts/build-pages.mjs` also writes `robots.txt` (everything but `/admin/`, plus both sitemaps) and `sitemap.xml` (the nine pages with their hreflang alternates), and the home has a JSON-LD `Person`.

## Front-end build

Every page loads bundled, minified files built from ES module sources by esbuild 0.24.0 (no other dependencies):

| source | output |
| --- | --- |
| `js/home.js`, `css/home.css` | `js/home.min.js`, `css/home.min.css` |
| `projects/js/projects.js`, `projects/css/projects.css` | `projects/js/projects.min.js`, `projects/css/projects.min.css` (both projects pages) |
| `js/page-transition.js` | `js/page-transition.min.js` (render-blocking, both pages) |

Shared code lives in `js/shared/` and `css/shared/` and is pulled in with `import` / `@import`.

The home and projects bundles also import `admin/lib/rich-text.js`, `admin/lib/rich-text-dom.js` and `admin/lib/rich-text.css`: one parser and one set of styles for the admin's validation and previews, the home's "some words" and the projects' "how I used AI" (format: `admin/README.md`). The admin is deployed as-is, so it uses the same files directly. The home loads `/projects/data/some-words.<lang>.json` at runtime and keeps the paragraphs from `i18n/<lang>.json` as the fallback. No new environment variables are needed: the admin derives the some-words paths from `DATA_FILE` and `PUBLIC_FILE`.

```sh
npm run build   # = sh scripts/build.sh: pages, then bundles; CI runs the same script
npm test        # section wrap, gesture gate, page-transition direction, page build, language links
```

Commit the generated pages and rebuilt `.min` files too, so the site works when served straight from the repo. CI rebuilds them anyway, then `scripts/cache-bust.sh` appends `?v=<hash>` to their (root-absolute) URLs in all nine pages. It rewrites the HTML in place, so only run it in CI.

Page transitions: each page sets its place on a horizontal axis with `<html data-page-x="…">` (home `0`, projects (IA) `-1`, projects (B.C.) `1`). A page with a lower value slides in from the left, a higher one from the right; the same value (another language) crossfades. So projects (B.C.) enters from the right (from home or projects (IA)) and leaving it slides the other page in from the left. A new page only needs its own value plus `css/shared/view-transitions.css` and `js/page-transition.min.js`.

## One-time setup

Replace `HOST` with the server's hostname or IP. Use exactly the same value everywhere below.

### a. Deploy key (on your machine)

```sh
ssh-keygen -t ed25519 -N '' -C 'github-actions masellas.info' -f ~/.ssh/masellas_deploy
printf 'no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty %s\n' "$(cat ~/.ssh/masellas_deploy.pub)" \
  | ssh rogermasellas@HOST 'umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys'
ssh -i ~/.ssh/masellas_deploy rogermasellas@HOST 'node -v && pm2 -v'   # must print both versions
```

`no-pty` is fine here: the workflow only runs rsync and a non-interactive script.

### b. GitHub secrets (environment `production`)

Pin the host key. Scan it once, then check it against the fingerprint the server itself reports (CloudPanel terminal or an existing session: `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`).

```sh
ssh-keyscan -t ed25519 HOST > /tmp/masellas_known_hosts
ssh-keygen -lf /tmp/masellas_known_hosts                       # must match the server's fingerprint

gh api -X PUT "repos/{owner}/{repo}/environments/production" > /dev/null
gh secret set DEPLOY_HOST        --env production --body 'HOST'
gh secret set DEPLOY_USER        --env production --body 'rogermasellas'
gh secret set DEPLOY_SSH_KEY     --env production < ~/.ssh/masellas_deploy
gh secret set DEPLOY_KNOWN_HOSTS --env production < /tmp/masellas_known_hosts
rm /tmp/masellas_known_hosts
```

The workflow uses `StrictHostKeyChecking yes` and never scans keys itself. If the server's host key changes, deploys fail until you update `DEPLOY_KNOWN_HOSTS`.

### c. pm2 at boot (as root on the server)

```sh
pm2 startup systemd -u rogermasellas --hp /home/rogermasellas
```

This makes `rogermasellas`'s own pm2 start at boot and restore the processes saved by `pm2 save`.

### d. Admin config (on the server, as rogermasellas)

1. Push to `main` once (or run the workflow manually). The first run syncs the code and then stops on purpose with `.env is missing. Run the one-time setup in DEPLOY.md`.
2. Write the non-secret settings, then add the password and session secret interactively:

```sh
ssh -t rogermasellas@HOST
cd ~/masellas-admin/app
umask 077
cat > .env <<'EOF'
PORT=8787
HOST=127.0.0.1
DATA_FILE=/home/rogermasellas/masellas-admin/data/projects.json
PUBLIC_FILE=/home/rogermasellas/htdocs/masellas.info/projects/data/projects.json
COOKIE_SECURE=true
COOKIE_PATH=/admin/
TRUST_PROXY=true
PUBLIC_URL=https://masellas.info/projects/
EOF
node hash-password.js --env .env   # asks for the password twice; adds ADMIN_PASSWORD_HASH and SESSION_SECRET; prints neither
exit
```

3. Re-run the workflow. On first boot the admin creates `DATA_FILE` from the live public `projects.json`, with every project visible.

To change the password later: `ssh -t` in, run `node hash-password.js --env .env` again, then `pm2 reload masellas-admin`.

### e. nginx (CloudPanel → Sites → masellas.info → Vhost)

Paste this inside the HTTPS `server { … }` block, before the static-assets `location ~* \.(css|js|…)` block:

```nginx
location = /admin { return 301 /admin/; }
location ^~ /admin/ {
  proxy_pass http://127.0.0.1:8787/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  client_max_body_size 64k;
}
```

`^~` stops the static-assets regex from catching `/admin/*.js` and `/admin/*.css`. Also make sure dotfiles are denied, because the admin writes `.projects.json.tmp-*` for a moment while it updates the file. CloudPanel usually already has `location ~ /\. { deny all; }`; add it if it does not.

## Release

```sh
git switch main && git merge --ff-only develop && git push && git switch develop
```

## Rollback

Redeploy an earlier commit. The workflow deploys whatever ref it checks out:

```sh
gh workflow run deploy.yml --ref main -f ref=<commit-sha>
```

This rolls back code only. The private and public project lists are data and stay as they are. Site files that the bad release added are not removed, because the site sync never deletes.
