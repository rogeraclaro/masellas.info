# projects admin

Small back-office for `projects/data/projects.json`: log in with one password, add, edit, hide, reorder and delete projects. The public page at `/projects/` reads the same file.

Node 22, zero npm dependencies.

## Run

```sh
cd admin
cp .env.example .env
npm run hash-password          # paste the output into ADMIN_PASSWORD_HASH
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # SESSION_SECRET
# edit .env: DATA_FILE, and COOKIE_SECURE=false if you use plain http locally
npm start
```

Open `http://127.0.0.1:8787/`.

For local work, point `DATA_FILE` at a copy (for example `admin/data/projects.json`, which is gitignored) instead of the committed file.

## Configure

Environment variables only. `admin/.env` is read at boot if it exists; real environment variables override it. The server refuses to start if a required variable is missing or malformed.

| variable | required | default | notes |
| --- | --- | --- | --- |
| `DATA_FILE` | yes | | absolute path to `projects.json` |
| `ADMIN_PASSWORD_HASH` | yes | | from `npm run hash-password`; contains `$`, so single-quote it in a shell |
| `SESSION_SECRET` | yes | | 64+ hex chars (32+ random bytes); changing it logs everyone out |
| `PORT` | no | `8787` | |
| `HOST` | no | `127.0.0.1` | |
| `COOKIE_SECURE` | no | `true` | `false` only for local http |
| `PUBLIC_URL` | no | `https://masellas.info/projects/` | target of the "view site" link |

## Test

```sh
npm test
```

Uses `node:test`. Covers validation, slugs, reorder checks, the file store (atomic write, backup, serialized writes, version conflicts), password hashing, session tokens, the rate limiter, and HTTP integration on an ephemeral port.

## How it works

- `server.js` — HTTP server, routes, static files (`public/` at `/`, the repo's `tipos/` at `/tipos/`).
- `lib/store.js` — reads/writes `DATA_FILE`: temp file + rename, previous version kept as `projects.json.bak`, one write at a time, version = sha256 of the file.
- `lib/auth.js` — scrypt password check, HMAC-signed 12 h session cookie, in-memory login rate limit (5 failures per IP per 15 min).
- `lib/validation.js` — field rules, slug ids, reorder permutation check.

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

Mutations need `Content-Type: application/json` and `If-Match: <version>`. A stale version gets 409, a missing one 428. A foreign `Origin` gets 403.

## Notes

- `visible: false` only hides a project on the public page. The JSON file is public, so hidden projects are still readable there. Do not put anything secret in it.
- `projects.json.bak` sits next to the data file. If the data file is in the web root, the backup is publicly readable too; deny `*.bak` in the web server if that matters.
- The rate limiter and sessions live in memory: a restart clears the limiter, sessions survive (they are signed, not stored).
