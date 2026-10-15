# projects admin

Small back-office for the projects list on masellas.info: log in with one password, add, edit, hide, reorder and delete projects.

It keeps two files:

- `DATA_FILE` — the private, full list (hidden projects included, with `visible`). Lives outside the web root. The API reads, writes and versions only this file.
- `PUBLIC_FILE` — what `/projects/` fetches (`projects/data/projects.json` in the web root). Rebuilt from `DATA_FILE` after every change and at boot: visible projects only, in order, without the `visible` field. Never edit it by hand; the next change overwrites it.

Node 22, zero npm dependencies.

## Run

```sh
cd admin
cp .env.example .env
node hash-password.js --env .env   # asks twice; writes ADMIN_PASSWORD_HASH (+ SESSION_SECRET if missing), mode 0600
# edit .env: DATA_FILE, PUBLIC_FILE, and COOKIE_SECURE=false if you use plain http locally
npm start
```

Open `http://127.0.0.1:8787/`. In production it runs under pm2 behind nginx at `https://masellas.info/admin/`; see `../DEPLOY.md`.

The UI uses relative URLs only (`api/...`, `admin.css`), so it works at `/` and under a stripped prefix like `/admin/`. Fonts load from `/tipos/` (the main site in production, the admin's own `/tipos/` route locally).

`npm run hash-password` without `--env` just prints a hash.

For local work, put `DATA_FILE` in `admin/data/` (gitignored) and point `PUBLIC_FILE` at a scratch copy outside the repo, so the committed `projects/data/projects.json` never changes.

### First run in production (migration)

If `DATA_FILE` does not exist but `PUBLIC_FILE` does, the admin creates `DATA_FILE` from it once (every project `visible: true`, mode 0600, parent directories created). If neither exists, or the public file cannot be written, it refuses to start.

## Configure

Environment variables only. `admin/.env` is read at boot if it exists; real environment variables override it. The server refuses to start if a required variable is missing or malformed.

| variable | required | default | notes |
| --- | --- | --- | --- |
| `DATA_FILE` | yes | | absolute path to the private `projects.json`, outside the web root |
| `PUBLIC_FILE` | yes | | absolute path to the public `projects.json` in the web root; must differ from `DATA_FILE` |
| `ADMIN_PASSWORD_HASH` | yes | | from `npm run hash-password`; contains `$`, so single-quote it in a shell |
| `SESSION_SECRET` | yes | | 64+ hex chars (32+ random bytes); changing it logs everyone out |
| `PORT` | no | `8787` | |
| `HOST` | no | `127.0.0.1` | |
| `COOKIE_SECURE` | no | `true` | `false` only for local http |
| `PUBLIC_URL` | no | `https://masellas.info/projects/` | target of the "view site" link |
| `COOKIE_PATH` | no | `/` | session cookie path; `/admin/` in production |
| `TRUST_PROXY` | no | `false` | `true` only behind nginx: the login rate limit then keys on `X-Real-IP` (fallback: first `X-Forwarded-For` entry). When `false` those headers are ignored, because clients can forge them |

## Test

```sh
npm test
```

Uses `node:test`. Covers validation, slugs, reorder checks, the file store (atomic write, backup, serialized writes, version conflicts), the public projection (regeneration, boot sync, migration, write failures), password hashing, session tokens, the rate limiter, and HTTP integration on an ephemeral port.

## How it works

- `server.js` — HTTP server, routes, static files (`public/` at `/`, the repo's `tipos/` at `/tipos/`).
- `lib/store.js` — reads/writes `DATA_FILE`: temp file + rename, previous version kept as `projects.json.bak`, one write at a time, version = sha256 of the file.
- `lib/auth.js` — scrypt password check, HMAC-signed 12 h session cookie, in-memory login rate limit (5 failures per IP per 15 min).
- `lib/publish.js` — public projection (`toPublic`), atomic public write (no backup), boot sync and migration.
- `lib/validation.js` — field rules, slug ids, reorder permutation check.
- `lib/envfile.js` — the `.env` update behind `hash-password --env`.
- `ecosystem.config.cjs` — pm2 process file (`masellas-admin`, one instance).

API (JSON, all under `/api`, session required except login, logout and session):

| method | path | body | notes |
| --- | --- | --- | --- |
| POST | `/api/login` | `{ password }` | sets the session cookie |
| POST | `/api/logout` | | clears it |
| GET | `/api/session` | | `{ loggedIn }`, always 200 |
| GET | `/api/config` | | `{ publicUrl }` |
| GET | `/api/projects` | | `{ projects, version }` |
| POST | `/api/projects` | project fields, optional `position: "top"` | 201 |
| PUT | `/api/projects/:id` | any project fields | |
| DELETE | `/api/projects/:id` | | |
| PUT | `/api/order` | `{ ids }` | exact permutation of current ids |

Mutations need `Content-Type: application/json` and `If-Match: <version>`. A stale version gets 409, a missing one 428. A foreign `Origin` gets 403. If the private save works but the public file cannot be written, the response is 500 with the new `version`; the change is kept and the public file is rebuilt on the next change or restart.

## Notes

- Hidden projects never reach the web root: they exist only in `DATA_FILE` (and its `.bak`), which must stay outside it.
- The public file is written as a temp dotfile (`.projects.json.tmp-<random>`) in the same directory, then renamed; mode 0644 so nginx can read it. Make sure nginx denies dotfiles (CloudPanel's vhost usually already has `location ~ /\. { deny all; }`; add it if not).
- The rate limiter and sessions live in memory: a restart clears the limiter, sessions survive (they are signed, not stored).
