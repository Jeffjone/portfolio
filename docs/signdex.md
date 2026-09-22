# SignDex guestbook

SignDex has a static frontend and a Cloudflare Worker backed by D1. A static host such as GitHub Pages cannot persist visitor submissions by itself. Until the API URL is configured, the site explicitly stays in **preview mode**: it does not pretend to publish or save signatures.

## What visitors can do

- Required: display name/nickname, favorite Pokémon, favorite game, favorite animated series, and agreement to public display after review.
- Optional: work/education, city, and a 200-character message.
- Visitors who have not played or watched can say so. No email, account, full address, or location permission is requested.
- Live cards combine the Pokémon’s primary-type colors and symbol, the game’s region, the animated series’ trainer title, a deterministic pixel seal, and a unique edition ID.
- The public book shows approved signatures, 12 per page, newest first. Pending and rejected signatures are never returned by the public API.

## Run the complete feature locally

Requires Node 22.13 or newer (the preview server uses built-in SQLite).

```sh
npm ci
npm run signdex:dev
```

Open `http://127.0.0.1:8788/#signdex`. This server connects the frontend to a real local SQLite database, stored in the git-ignored `.signdex-data/` directory. It binds only to the loopback interface. The original static preview commands still work, but use SignDex’s disconnected preview mode.

Use a second browser/private window to verify shared signatures. New entries do not appear there until approved.

### Review local submissions

In a second terminal:

```sh
export SIGNDEX_API=http://127.0.0.1:8788/signdex-api
export SIGNDEX_ADMIN_TOKEN=local-review-only
npm run signdex:review -- list
npm run signdex:review -- approve SIGNATURE_ID
```

`local-review-only` is a development default, not a production secret. Setting `SIGNDEX_ADMIN_TOKEN` before starting the local server overrides it.

## Connect Cloudflare Workers + D1

The Worker bundle has been validated with `wrangler deploy --dry-run`. The database ID, real API URL, and private secrets still need your Cloudflare account. Nothing is provisioned by the repository itself.

1. Authenticate the CLI:

   ```sh
   npx wrangler login
   ```

2. Create the database:

   ```sh
   npx wrangler d1 create jeffrey-signdex
   ```

   Copy the returned `database_id` into `server/signdex/wrangler.jsonc`, replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`. Keep the binding name `DB`.

3. Check `ALLOWED_ORIGINS` in the same file. The default is `https://jeffjone.github.io`. If using a custom domain, replace or extend this comma-separated list with the exact origin, including `https://` but **without a path or trailing slash**. For example, a page at `https://jeffjone.github.io/portfolio/` uses the origin `https://jeffjone.github.io`.

4. Apply the database migration:

   ```sh
   npx wrangler d1 migrations apply jeffrey-signdex --remote --config server/signdex/wrangler.jsonc
   ```

5. Generate two different random values with `openssl rand -hex 32`, and save them securely. Use one for `ADMIN_TOKEN` and one for `RATE_LIMIT_SALT`. Enter them at the private CLI prompts:

   ```sh
   npx wrangler secret put ADMIN_TOKEN --config server/signdex/wrangler.jsonc
   npx wrangler secret put RATE_LIMIT_SALT --config server/signdex/wrangler.jsonc
   ```

   Wrangler may offer to create the Worker before setting its first secret. Neither secret belongs in frontend JavaScript, `wrangler.jsonc`, Git, or a public issue. The administrator token must be at least 16 characters; use the generated 64-character value.

6. Deploy the API:

   ```sh
   npx wrangler deploy --config server/signdex/wrangler.jsonc
   ```

7. Set the returned HTTPS Worker URL in `assets/js/signdex-config.js`:

   ```js
   globalThis.SignDexConfig = {
     apiBase: 'https://jeffrey-signdex.YOUR-SUBDOMAIN.workers.dev'
   };
   ```

   This is a public URL, not a credential. Do not include `/signatures` or a trailing slash. Publish this frontend configuration change to the static site.

8. Verify the live workflow: submit a signature, confirm it is absent from the public book, approve it, then refresh the book in another browser. Check all owner-created test entries and delete them when finished.

## Moderate the book

Set `SIGNDEX_API` to the Worker URL and `SIGNDEX_ADMIN_TOKEN` to your private administrator token in your terminal. The helper reads them from the environment and never stores them in the website.

```sh
npm run signdex:review -- list
npm run signdex:review -- list approved
npm run signdex:review -- list rejected
npm run signdex:review -- approve SIGNATURE_ID
npm run signdex:review -- reject SIGNATURE_ID
npm run signdex:review -- delete SIGNATURE_ID
```

The list command returns up to 100 entries in the chosen state, oldest first. Process the pending queue and list again for the next batch. Check names, affiliations, locations, and messages for harassment, impersonation, sensitive information, or disguised abuse before approval. Rejection also hides a previously approved entry. Deletion permanently removes it and can fulfill a visitor’s removal request; visitors can quote their edition ID when contacting Jeffrey.

## Validation and moderation behavior

The shared model is used in both browser and Worker. It enforces bounded plain-text fields, canonical Pokémon/game/series choices, and explicit consent. The API does not trust any client-supplied moderation status or timestamps.

The automated English-language checks catch a targeted set of profanity, slurs, insults, and common obfuscations (case changes, accents, leetspeak, inserted punctuation, spacing, and zero-width characters). They are not a comprehensive multilingual or contextual moderation service. All accepted entries therefore require review before public display; passing the word filter does not automatically publish a card.

Rendering uses DOM text nodes rather than user-supplied HTML. Database queries use prepared bindings. Submissions have a 4 KiB request limit and a five-new-submissions-per-hour IP-based limit. Only an HMAC digest of the IP is stored in the rate table, not the raw IP or a link to the signature. Old rate-limit records are pruned when the next submission arrives. Cloudflare may separately retain request metadata according to the account’s platform settings.

A random UUID is the edition ID and retry key. If a response is lost after saving, retrying the unchanged form does not create a second entry. On request failure, form values remain in the page. Personal form details are not persisted in browser local storage.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/signatures` | Approved entries, count, next-page cursor |
| GET | `/signatures?before=CURSOR` | Next 12 approved entries |
| POST | `/signatures` | Validate and queue a signature; returns HTTP 202 |
| GET | `/admin/signatures?status=pending` | Private review queue; bearer token required |
| PATCH | `/admin/signatures/UUID` | Set `status` to `approved` or `rejected`; bearer token required |
| DELETE | `/admin/signatures/UUID` | Permanently remove an entry; bearer token required |

The public API cannot update, approve, or delete entries. CORS only admits configured site origins. The moderation endpoints additionally require the administrator bearer token. CORS is not bot protection; rate limiting and review are separate controls. No moderation credentials are shipped in the static frontend.

## Tests and data

```sh
node --test tests/signdex-api.test.mjs
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm test
npx wrangler deploy --dry-run --config server/signdex/wrangler.jsonc
```

The API tests execute the actual Worker handler and SQL migration against an in-memory SQLite adapter implementing D1’s prepared-statement interface. Browser tests exercise real submissions, private pending entries, authenticated approval, a second visitor seeing the published card, error recovery, and disconnected mode. The Worker dry run checks Cloudflare bundling; it does not substitute for the final live-account smoke test.

The bundled Pokémon catalogue contains 1,025 species and their default primary types, taken from the official [PokéAPI dataset](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv). It needs no runtime Pokémon API connection. Refresh it with `python3 scripts/update-signdex-catalog.py` (requires curl and internet access). Games and series are curated in `assets/js/signdex-model.js`; “another” and “haven’t yet” choices allow visitors outside the list to participate.

Cloudflare references: [D1 setup](https://developers.cloudflare.com/d1/get-started/), [prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/), [migrations](https://developers.cloudflare.com/d1/reference/migrations/), [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).
