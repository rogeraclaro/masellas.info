# Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`:

1. `test` — `npm test` in `admin/` and `npm test` at the repo root (site logic), on Node 22.
2. `deploy` (GitHub environment `production`):
   - builds the bundles with `scripts/build.sh` and versions their URLs with `scripts/cache-bust.sh`.
   - rsyncs the site to `/home/rogermasellas/htdocs/masellas.info/`. It does not delete anything and does not change ownership or permissions.
   - copies `projects/data/projects.json` and `projects/data/some-words.json` only if the server has none yet. After that the admin owns them.
   - rsyncs `admin/` to `/home/rogermasellas/masellas-admin/app/` with `--delete`. `.env` and `data/` are protected.
   - reloads the app with pm2 under `rogermasellas`, then smoke-checks `/projects/data/projects.json` and `/admin/`.

Server layout:

```
/home/rogermasellas/htdocs/masellas.info/             site (web root)
  projects/data/projects.json                          public list, rebuilt by the admin
  projects/data/some-words.json                        home "some words" text, rebuilt by the admin
/home/rogermasellas/masellas-admin/app/                admin code (deployed)
  .env                                                 config + secrets (never deployed)
/home/rogermasellas/masellas-admin/data/projects.json  private list, hidden projects included
/home/rogermasellas/masellas-admin/data/some-words.json  private copy of the "some words" text
```

## Front-end build

Both pages load bundled, minified files built from ES module sources by esbuild 0.24.0 (no other dependencies):

| source | output |
| --- | --- |
| `js/home.js`, `css/home.css` | `js/home.min.js`, `css/home.min.css` |
| `projects/js/projects.js`, `projects/css/projects.css` | `projects/js/projects.min.js`, `projects/css/projects.min.css` |
| `js/page-transition.js` | `js/page-transition.min.js` (render-blocking, both pages) |

Shared code lives in `js/shared/` and `css/shared/` and is pulled in with `import` / `@import`.

The home bundle also imports `admin/lib/rich-text.js` and `admin/lib/rich-text-dom.js`: one parser for both the admin's validation and the home's rendering. The admin is deployed as-is, so it uses the same files directly. The home loads `/projects/data/some-words.json` at runtime and keeps the paragraphs in `index.html` as the fallback. No new environment variables are needed: the admin derives the some-words paths from `DATA_FILE` and `PUBLIC_FILE`.

```sh
npm run build   # = sh scripts/build.sh; CI runs the same script
npm test        # pure logic: section wrap, gesture gate, page-transition direction
```

Commit the rebuilt `.min` files too, so the site works when served straight from the repo. CI rebuilds them anyway, then `scripts/cache-bust.sh` appends `?v=<hash>` to their URLs in `index.html` and `projects/index.html`. It rewrites the HTML in place, so only run it in CI.

Page transitions: each page sets its place on a horizontal axis with `<html data-page-x="…">` (home `0`, projects `-1`). A page with a lower value slides in from the left, a higher one from the right. A new page only needs its own value plus `css/shared/view-transitions.css` and `js/page-transition.min.js`.

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
