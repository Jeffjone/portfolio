# SignDex email alerts and review desk

New submissions can email **joshj.jeffrey@gmail.com** with a **Review signature** button. The link opens a private review desk: sign in with an emailed Cloudflare code, read the entry, then press **Approve** or **Reject**. Opening an email link never changes a signature. The desk also has Pending, Approved, and Rejected tabs, pagination, refresh, and a confirmed Delete action.

The code is implemented. **Production login and alerts are not enabled until the account setup below is complete.** The existing public guestbook and terminal moderation continue to work.

## 1. Enable your private login in Cloudflare

In the Cloudflare account that owns `jeffrey-signdex`:

1. Open **Zero Trust / Cloudflare One**. Complete initial team setup if prompted. Record your team domain, such as `https://your-team.cloudflareaccess.com`.
2. Under **Integrations → Identity providers**, enable **One-time PIN** if it is not already available.
3. Under **Access → Applications**, add a **Self-hosted** application called **SignDex Review**. Set a session duration such as **1 hour**.
4. Add the public hostname `jeffrey-signdex.joshj-jeffrey.workers.dev` with path **`review`**. This covers `/review` and its descendants through Access path inheritance, including `/review/api/…`. Do not use only `review/*`, because that excludes the bare `/review` URL. Do not protect the entire Worker: `/signatures` must remain public.
5. Add an **Allow** policy whose **Include → Emails** rule is exactly **`joshj.jeffrey@gmail.com`**. Select One-time PIN as a login method. Do not add an Everyone or Bypass policy.
6. Save the application. Copy its **Application Audience (AUD) Tag** from the application details.

Add these two non-secret settings under `vars` in `server/signdex/wrangler.jsonc`:

```json
"ACCESS_TEAM_DOMAIN": "https://YOUR-TEAM.cloudflareaccess.com",
"ACCESS_AUD": "YOUR-APPLICATION-AUD"
```

Replace the placeholders with the real values. `ADMIN_EMAIL` is already set to your confirmed address. Team URLs and audience identifiers are configuration, not passwords. The Worker separately verifies the audience and owner email on every review request; unsigned email headers and the terminal admin token cannot unlock the browser route.

Cloudflare references: [self-hosted applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/), [path inheritance](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/), [Worker Access identity](https://developers.cloudflare.com/workers/configuration/cloudflare-access/).

## 2. Set up outgoing notifications

1. In [Resend](https://resend.com/domains), add and verify a sending domain you control, for example `mail.jeffjone.dev`. Follow its DNS verification instructions.
2. Choose a sender on that verified domain, such as `SignDex <notifications@mail.jeffjone.dev>`. This is an example, not an already verified sender.
3. Create a **sending-only** Resend API key restricted to that domain.
4. Save it as a Worker secret using the private terminal prompt:

   ```sh
   npx wrangler secret put RESEND_API_KEY --config server/signdex/wrangler.jsonc
   ```

   If working with Codex, you can instead put `RESEND_API_KEY=...` in the Git-ignored `.env` file and ask for it to be uploaded. Never paste the key into chat, frontend JavaScript, or `wrangler.jsonc`. The `.env` file is not automatically loaded or uploaded by a production deployment.

5. Add `NOTIFICATION_FROM` under the config's `vars`, using your verified sender, and change `NOTIFICATIONS_ENABLED` from `"false"` to `"true"`.

`REVIEW_URL` and the recipient `ADMIN_EMAIL` are already configured. Cloudflare sends the sign-in code; Resend sends the new-signature alert. A failed notification does not lose a submission.

Provider references: [domain verification](https://resend.com/docs/dashboard/domains/introduction), [API keys](https://resend.com/docs/dashboard/api-keys/introduction), [idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys).

## 3. Apply the migration and deploy

From the project directory:

```sh
npx wrangler d1 migrations apply jeffrey-signdex --remote --config server/signdex/wrangler.jsonc
npx wrangler deploy --config server/signdex/wrangler.jsonc
```

Migration `0002_moderation_notifications.sql` adds the notification outbox and moderation audit table. Apply it **before deploying** the new Worker. It does not change existing signature content. No notification is created retroactively for entries submitted before this migration and Worker update.

## 4. Verify the real workflow

1. Open `https://jeffrey-signdex.joshj-jeffrey.workers.dev/review` in a private window. Cloudflare should request your email and send a code to the approved address.
2. Sign in. The desk should identify `joshj.jeffrey@gmail.com` and report that email alerts are enabled.
3. Submit one clearly named test signature on your portfolio. Confirm that it is still absent from the public book.
4. Check your inbox for **New SignDex signature awaiting review**, then open **Review signature**. Confirm the test entry is shown and still pending. Check Spam if needed.
5. Press **Approve** and verify the public portfolio in another private window. Use **Reject** to hide the test again, then **Delete** to clean up only that test entry.
6. Sign out. Verify the review page and `/review/api/signatures` require login, while `/signatures` remains accessible without a login.

These steps verify actual Access login, delivery, and D1 persistence. Local automated tests do not verify your external account configuration or guarantee inbox delivery.

## Local preview

```sh
SIGNDEX_REVIEW_PREVIEW=true npm run signdex:dev
```

Open `http://127.0.0.1:8788/signdex-api/review`. Submit local signatures at `http://127.0.0.1:8788/#signdex` to fill the inbox.

This loopback-only preview simulates a trusted Access identity in the local server. It sends no email, does not use production D1, and has no real Access sign-out session. The production Worker has no preview-authentication switch.

## Delivery and troubleshooting

Each accepted submission and its outbox record are saved in one transaction. Delivery starts in the background; a five-minute cron retries failed attempts. Overlapping runs claim jobs with a lease and use a stable provider idempotency key and payload. Delivery stops after six attempts or a twelve-hour retry window, inside the provider's 24-hour idempotency window. Entries already approved or rejected are skipped. Deleting a signature also removes its outbox record. The email contains the visitor's display name and private review link; work, city, and message stay in the review desk.

- **503 “awaiting its Cloudflare Access configuration”:** set `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`, then redeploy.
- **401 after login:** check the application's AUD, team URL, exact owner email, and that Access covers `/review` and descendants.
- **Public signatures suddenly require login:** the Access application covers too much. Restrict it to the `review` path.
- **Alerts not configured:** check all five settings: `NOTIFICATIONS_ENABLED`, `NOTIFICATION_FROM`, `ADMIN_EMAIL`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`; also check `REVIEW_URL` and the `RESEND_API_KEY` Worker secret.
- **Alerts enabled but no email:** inspect Resend's delivery dashboard and the outbox below. “Enabled” indicates configuration is present, not proof of delivery. Provider rejection or bounce can still prevent arrival.

Read delivery states without displaying visitor content or credentials:

```sh
npx wrangler d1 execute jeffrey-signdex --remote --config server/signdex/wrangler.jsonc --command "SELECT state, COUNT(*) AS count FROM notification_outbox GROUP BY state"
npx wrangler d1 execute jeffrey-signdex --remote --config server/signdex/wrangler.jsonc --command "SELECT signature_id, attempts, last_error FROM notification_outbox WHERE state = 'failed'"
```

Failed jobs stay failed to avoid duplicate delivery after the retry window. Review those signatures directly in the desk. The terminal helper remains available as an independent fallback; its `ADMIN_TOKEN` is never exposed to the browser. Moderation audit rows retain signature ID, action, owner identity, and timestamp, without retaining deleted signature content.

## Automated validation

```sh
node --test tests/signdex-*.test.mjs
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm test
npx wrangler deploy --dry-run --config server/signdex/wrangler.jsonc
```

Tests cover signed JWT verification, unauthorized access, CSRF, stale/concurrent decisions, public visibility, pagination, transactional outbox creation, retries and duplicate prevention, safe rendering, mobile layouts, deletion confirmation, failed requests, and expired sessions. Provider calls are mocked; tests do not send real emails.
