# Custom domain — golftrips.app

The domain is registered and managed in Cloudflare. **Do not attach it to the live project
until a Cloudflare preview deployment has been fully tested.**

## Order of operations

1. **Test on preview first.** Confirm the app works on the `*.pages.dev` preview URL —
   installability, score entry, leaderboards, the organiser console.
2. **Attach the apex domain.** Pages project → **Custom domains → Set up a custom domain** →
   `golftrips.app`. Because the zone is already in Cloudflare, Pages creates the required
   `CNAME`/`A` record automatically and provisions the TLS certificate.
3. **Attach `www`.** Add `www.golftrips.app` as a second custom domain (this creates its DNS
   record and certificate). The app's `public/_redirects` then 301-redirects
   `https://www.golftrips.app/*` → `https://golftrips.app/*`, so the apex is canonical.

   > Alternatively, do the www→apex redirect with a Cloudflare **Redirect Rule**
   > (Rules → Redirect Rules: hostname equals `www.golftrips.app` → `https://golftrips.app/${path}`,
   > 301). Either works; the `_redirects` file needs no dashboard config.

## HTTPS

- TLS certificates are issued automatically by Cloudflare for both hostnames.
- `Strict-Transport-Security` is sent on every response (see `public/_headers`).
- In the zone's **SSL/TLS** settings, use **Full (strict)** and enable **Always Use HTTPS**.

## Verifying the cutover

- `https://golftrips.app` serves the app over HTTPS.
- `https://www.golftrips.app` 301-redirects to the apex.
- `http://…` upgrades to `https://`.
- The PWA installs ("Add to Home Screen") and the crest icon appears.

## Rollback

Detaching the custom domain in the Pages project returns it to an unrouted state without
deleting DNS. Because deployments are immutable, you can also roll the production deployment
back (see [DEPLOYMENT.md](DEPLOYMENT.md)) and the domain follows it.
