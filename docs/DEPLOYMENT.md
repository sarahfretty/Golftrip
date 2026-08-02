# Deployment

Flow: **Local → GitHub → Cloudflare Pages preview → Production → golftrips.app.**
Nothing touches the live domain until a Cloudflare preview has been fully tested.

## 1. Push to GitHub

Requires the GitHub CLI (`brew install gh`) or the web UI.

```bash
# From the project root, once the repo is initialised and committed:
gh auth login                       # if not already authenticated
gh repo create golftrips --private --source=. --remote=origin --push
```

Without `gh`: create an empty repo at github.com, then:

```bash
git remote add origin git@github.com:<you>/golftrips.git
git push -u origin main
```

## 2. Create the Cloudflare Pages project

**Dashboard route (recommended for first setup):**

1. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
2. Pick the `golftrips` repo.
3. Build settings:
   - **Framework preset:** None (or Vite)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `/`
4. **Environment variables** (add under both *Production* and *Preview* — see [ENVIRONMENT.md](ENVIRONMENT.md)):
   - `NODE_VERSION` = `20.19.0` (or `22.12.0`)
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (once Supabase exists)
   - `VITE_ORGANISER_PIN` (only if still using the local PIN; omit once Supabase Auth is wired)
5. **Save and Deploy.**

**CLI route (wrangler):**

```bash
npx wrangler pages project create golftrips --production-branch main
npm run build
npx wrangler pages deploy dist --project-name golftrips
```

The repo already contains `public/_headers` (security headers + caching) and
`public/_redirects` (SPA fallback + www→apex redirect); Cloudflare picks these up
automatically from the build output.

## 3. Preview deployments

Once the repo is connected, Cloudflare Pages builds **every branch and pull request** to a
unique `*.pages.dev` preview URL automatically. Use these to test changes — including the
first custom-domain rehearsal — before promoting to production.

- Production branch: `main` → the production deployment.
- Any other branch/PR → a preview deployment.

## 4. Production

Merging to `main` publishes to the project's `*.pages.dev` production URL. Attach the custom
domain only after you've verified a preview: see [DOMAIN.md](DOMAIN.md).

## Build facts

- Node 20.19+ or 22.12+ (set `NODE_VERSION`; `.nvmrc` pins `20.19.0`).
- Output: static assets in `dist/` (~85 KB gzipped JS + a Workbox service worker).
- No server, no functions required for v1.

## Rollback

Cloudflare Pages keeps every deployment. In the dashboard → the project → **Deployments**,
pick a previous good build and **Rollback**. The custom domain follows the active production
deployment.
