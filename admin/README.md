# projects admin

Small back-office for masellas.info: log in with one password, then edit the projects list (add, edit, hide, reorder, delete) or the text of the home's "some words" section (switch at the top).

## Languages

The site is in ca (principal), en and es. Translated fields: a project's `category`, `description` and `ai`, and the "some words" text. They are stored as `{ "ca": …, "en": …, "es": … }`; everything else (id, title, year, url, visible, thumbs, tools) is shared. In the form each translated field has a `ca / en / es` tab strip that shows which languages are empty. Only ca is required where the field is required (category, some words); an empty en / es shows the ca text on the site.

Older files with plain strings are read as the same text in all three languages (`lib/languages.js`, `migrateProjects` / `migrateSomeWords`) and stored in the new shape on the next save; nothing has to be migrated by hand.

It keeps two files:

- `DATA_FILE` — the private, full list (hidden projects included, with `visible`). Lives outside the web root. The API reads, writes and versions only this file.
- `PUBLIC_FILE` — `projects/data/projects.json` in the web root. Rebuilt from `DATA_FILE` after every change and at boot, together with one file per language next to it: `projects.ca.json`, `projects.en.json`, `projects.es.json` (what `/projects/`, `/en/projects/`, `/es/projects/` fetch). Visible projects only, in order, without the `visible` field, translated fields flattened to plain text for that language (empty -> ca). `projects.json` itself is the ca version. Never edit them by hand; the next change overwrites them.

"Some words" uses the same two-file setup, with no extra configuration: `some-words.json` sits next to each file above (private: `dirname(DATA_FILE)/some-words.json`; public: `dirname(PUBLIC_FILE)/some-words.json` plus `some-words.ca.json`, `.en.json`, `.es.json`, served at `/projects/data/some-words.<lang>.json`). Optional overrides: `SOME_WORDS_FILE`, `SOME_WORDS_PUBLIC_FILE` (absolute paths). At boot the private file is seeded once if missing: from the public copy, else from the repo default `projects/data/some-words.json`; the admin refuses to start if none exists.

Text format for "some words" and a project's "how I used AI" (validated on save; rendered on the home, the project detail, the static fallback and the admin previews with the same parser, `lib/rich-text.js`, and styles, `lib/rich-text.css`). The admin shows the same as a "formatting help" table under both fields.

- a blank line starts a new block (paragraph); a single newline is a line break
- `## text` on a block of its own: subheading
- every line of a block starting with `- `: list (a block mixing `- ` lines with other lines is rejected: add a blank line before the list, or write `\-`)
- every line of a block starting with `> `: quote
- `**bold**`, `~~strikethrough~~`, `` `code` `` (taken literally), on one line; bold and strikethrough may contain each other, links and code
- links only as `[text](https://…)`, `[text](http://…)` or `[text](mailto:…)`; the text may contain bold, strikethrough and code; any other scheme, relative URL or stray bracket is rejected with a message that quotes the link
- a backslash makes the next character literal when it is one of `*` `~` `\` `` ` `` `[` `]` `(` `)` `>` `-` `#` (e.g. `\*not bold\*`, `\- not a list`)
- unclosed `**`, `~~` or `` ` `` is rejected with a message that quotes where; a lone `*` or `~` is plain text
- `{{term}}`: a term explained by the glossary; `{{term|explanation}}`: with its own explanation (plain text, 1–300 characters; everything after the first `|`). The term is plain text, 1–60 characters, allowed inside bold / strikethrough, not inside a link label (and literal inside code); `\{` `\}` are literal braces. A `{{term}}` the glossary does not have blocks saving. On the site a term is a button with a dotted underline; hover, focus or tap shows the explanation (`lib/term-tooltip.js`).

## Glossary

The "glossary" view lists the terms (`glossary.json` next to `DATA_FILE`, created empty at boot; same atomic write, `.bak` and If-Match versions as the other files). A term is shared by every language and unique ignoring case; its explanation is per language (ca required, en / es fall back to ca), plain text, up to 300 characters. Deleting or renaming a term that a text still uses as `{{term}}` is refused with the list of places.

The site never reads the glossary: when publishing, every `{{term}}` in "how I used AI" and "some words" becomes `{{term|<explanation in that language>}}` in the public files (`lib/rich-text.js` `resolveTerms`). Saving the glossary republishes all public files. The static fallback in the pages (`scripts/build-pages.mjs`, from `i18n/*.json`) has no glossary: `{{term|…}}` works there, a bare `{{term}}` shows just the word.

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

Uses `node:test`. Covers languages (migration, fallback), validation per language, slugs, reorder checks, the file store (atomic write, backup, serialized writes, version conflicts), the public projection (regeneration, boot sync, migration, write failures), password hashing, session tokens, the rate limiter, and HTTP integration on an ephemeral port.

## How it works

- `server.js` — HTTP server, routes, static files (`public/` at `/`, the repo's `tipos/` at `/tipos/`).
- `lib/store.js` — reads (migrating older shapes) and writes `DATA_FILE`: temp file + rename, previous version kept as `projects.json.bak`, one write at a time, version = sha256 of the file.
- `lib/auth.js` — scrypt password check, HMAC-signed 12 h session cookie, in-memory login rate limit (5 failures per IP per 15 min).
- `lib/publish.js` — public projection (`toPublic`), atomic public write (no backup), boot sync and migration.
- `lib/slug.js` — url slug rules and `slugify` (served to the UI too).
- `lib/validation.js` — field rules (per language where translated), slug ids, reorder permutation check, "some words" text.
- `lib/languages.js` — the languages (ca, en, es), the `{ ca, en, es }` shape, fallback to ca, migration of older plain-string data, `<name>.<lang>.json` paths.
- `lib/rich-text.js` — pure parser for "some words" and "how I used AI" (blocks, styles, links, escapes). Also served to the admin UI and bundled into the home and projects pages by `scripts/build.sh`.
- `lib/rich-text-dom.js` — browser renderer for parsed text (admin previews and help, home, project detail).
- `lib/rich-text.css` — styles for rendered rich text; bundled into the site, served to the admin at `/rich-text.css`.
- `lib/glossary.js` — glossary lookups, unknown terms, where a term is used, the private file at boot.
- `lib/term-tooltip.js` — the term tooltip (served to the admin previews, bundled into the site).
- `public/rich-text-help.js` — the "formatting help" table (open / closed remembered in localStorage).
- `lib/envfile.js` — the `.env` update behind `hash-password --env`.
- `ecosystem.config.cjs` — pm2 process file (`masellas-admin`, one instance).

API (JSON, all under `/api`, session required except login, logout and session):

| method | path | body | notes |
| --- | --- | --- | --- |
| POST | `/api/login` | `{ password }` | sets the session cookie |
| POST | `/api/logout` | | clears it |
| GET | `/api/session` | | `{ loggedIn }`, always 200 |
| GET | `/api/config` | | `{ publicUrl }` |
| GET | `/api/projects` | | `{ projects, version }`; translated fields as `{ ca, en, es }` |
| POST | `/api/projects` | project fields, optional `position: "top"`, optional `id` | 201; without `id` one is made from the title |
| PUT | `/api/projects/:id` | any project fields, including a new `id` | a new `id` keeps the position; the old address is not redirected |
| DELETE | `/api/projects/:id` | | |
| PUT | `/api/order` | `{ ids }` | exact permutation of current ids |
| GET | `/api/some-words` | | `{ text: { ca, en, es }, version }` |
| PUT | `/api/some-words` | `{ text: { ca, en, es } }` | ca 1–4000 chars, en / es 0–4000; republishes the public copies |
| GET | `/api/glossary` | | `{ terms: [{ term, explanation: { ca, en, es } }], version }`, sorted |
| PUT | `/api/glossary` | `{ terms }` (the whole list) | errors keyed `terms.<i>.term`, `terms.<i>.explanation.<lang>`, `_usage`; republishes every public file |

`id` is the url slug (`/projects/?p=<id>`): lowercase a-z, 0-9 and single hyphens, 1-60 characters, no hyphen at either end (`lib/slug.js`, also used by the form to pre-fill it from the title). An id another project uses is rejected with a 400 field error, `already used by <title>`.

Translated fields must be sent as an object with exactly `ca`, `en` and `es` text (a plain string is rejected); their errors come back keyed `<field>.<lang>`, e.g. `category.en`.

Mutations need `Content-Type: application/json` and `If-Match: <version>`. A stale version gets 409, a missing one 428. A foreign `Origin` gets 403. If the private save works but the public file cannot be written, the response is 500 with the new `version`; the change is kept and the public file is rebuilt on the next change or restart.

## Notes

- Later cleanup: the legacy public `projects.json` and `some-words.json` (= ca) are still written so a browser that loaded a page before the languages release keeps working. Once no old page can be open (any later release), stop writing them in `lib/publish.js` (`writeLanguages`), drop them from the deploy smoke check, and delete them from the server.
- Hidden projects never reach the web root: they exist only in `DATA_FILE` (and its `.bak`), which must stay outside it.
- The public file is written as a temp dotfile (`.projects.json.tmp-<random>`) in the same directory, then renamed; mode 0644 so nginx can read it. Make sure nginx denies dotfiles (CloudPanel's vhost usually already has `location ~ /\. { deny all; }`; add it if not).
- The rate limiter and sessions live in memory: a restart clears the limiter, sessions survive (they are signed, not stored).
