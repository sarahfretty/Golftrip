# Environment variables

Copy `.env.example` → `.env.local` for local work. `.env*` is gitignored (only `.env.example`
is committed). In Cloudflare Pages, set these under **Settings → Environment variables** for
**both** Production and Preview.

| Variable | Where | Exposed to browser? | Purpose |
|---|---|---|---|
| `VITE_SUPABASE_URL` | client build | Yes | Supabase project URL. Blank ⇒ app uses the local/offline adapter. |
| `VITE_SUPABASE_ANON_KEY` | client build | Yes (safe) | Supabase anonymous key. Safe to expose — Row Level Security protects the data. |
| `VITE_ORGANISER_PIN` | client build | Yes | Organiser console PIN for the **local adapter only**. Remove once Supabase Auth is wired. |
| `NODE_VERSION` | Cloudflare build | n/a | Set to `20.19.0` or `22.12.0` so the Vite 8 build runs. |
| `SUPABASE_URL` | `npm run db:seed` only | **No** | Server-side seeding. Do **not** prefix with `VITE_`. |
| `SUPABASE_SERVICE_ROLE_KEY` | `npm run db:seed` only | **No — secret** | Full-access key for seeding. Never put in client env or commit it. |

## Rules

- Anything prefixed `VITE_` is **bundled into the client** and public. Never put a secret there.
- The `service_role` key bypasses RLS. It belongs only in your local `.env.local` for seeding,
  never in Pages client env and never in git.
- The Supabase **anon** key is designed to be public; security comes from RLS (see
  [DATABASE.md](DATABASE.md)).

## Local vs shared backend

- **No Supabase vars set** → the app runs on `localStorage` (per-device). Great for dev and demos.
- **Supabase vars set** → the app is expected to read/write the shared Postgres backend once the
  Supabase data adapter is wired into `src/store/store.tsx` (see [DATABASE.md](DATABASE.md) →
  "Adapter status").
