# Umhlaba Wami 2.0

Commercial property management platform for shopping centres and commercial properties (Eswatini-focused).  
**Manage Better. Respond Faster. Know More.**

Operations system covering centres, units, tenants, maintenance tickets, SLAs, finance, vendors, and organisation administration. Backed by Supabase (Auth, Postgres, RLS, Edge Functions) with a Vite + React + TypeScript frontend.

---

## Stack

| Layer | Technology |
|--------|------------|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4 |
| Backend / data | Supabase (Postgres, Auth, Realtime, Edge Functions) |
| Icons / motion | Lucide React, Motion |
| Hosting | Vercel (Git-connected to this repository) |

---

## Prerequisites

- Node.js 20+ (recommended)
- npm (or compatible package manager)
- A Supabase project (for production / full features)
- Vercel account linked to this GitHub repository (already configured as project `umhlaba-wami`)

---

## Local development

```bash
git clone https://github.com/Brightwell-Dlamini/UmhlabaWami_2.0.git
cd UmhlabaWami_2.0
cp .env.example .env
# Edit .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

App runs at `http://localhost:3000`.

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes (production) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes (production) | Supabase anonymous (public) key |
| `VITE_ENABLE_PWA` | No | Set to `false` to skip service worker registration |

When the Supabase variables are missing or still contain placeholder values, the data layer falls back to an in-memory demonstration store. Production deployments **must** set real values in Vercel.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 3000, host 0.0.0.0) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Type-check with `tsc --noEmit` |
| `npm run clean` | Remove `dist` and `server.js` |

---

## Database & Supabase

Migrations live under `supabase/migrations/`:

1. `001_initial_schema.sql` — core tables (organisations, profiles, centres, shops, tickets, etc.)
2. `002_rls_policies.sql` — row-level security for organisation isolation
3. `004_commercial_engine.sql` — finance / commercial engine extensions

Apply them in the Supabase SQL editor or via the Supabase CLI (`supabase db push`).

Edge Functions:

- `supabase/functions/approve-organization` — approve pending organisations (JWT + super_admin check)
- `supabase/functions/invite-staff` — staff invitation flow

Deploy functions with the Supabase CLI after setting secrets as required by each function.

---

## Vercel deployment

The repository is already linked to the Vercel project **umhlaba-wami** under the team `brightwelldlaminis-projects`. Pushes to `main` trigger production deployments.

### Required Vercel configuration

1. **Environment variables** (Project → Settings → Environment Variables)  
   Add for **Production** and **Preview**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

2. **Framework preset**  
   Vite is auto-detected. Build command: `npm run build`. Output directory: `dist`.

3. After changing env vars, trigger a redeploy (Deployments → Redeploy) so Vite can embed the values at build time.

### Common build failures

- **Missing named exports from `src/lib/supabase.ts`**  
  Ensure `isSupabaseConfigured` and `tryGetSupabase` are exported (fixed in this branch).

- **Missing Supabase env at runtime**  
  Auth and data calls that use `getSupabase()` will throw if the variables are not set. Configure them in Vercel as above.

- **Lockfile / package manager mismatch**  
  Prefer `package-lock.json` (npm). Avoid incompatible `bun.lock` files on Vercel.

---

## Project structure (high level)

```
├── index.html
├── package.json
├── vite.config.ts
├── public/                 # static assets, PWA manifest, service worker
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/         # UI (auth, dashboard, finance, layout, tickets, …)
│   ├── hooks/
│   ├── lib/                # supabase client, repository, query client
│   ├── services/           # auth, in-memory db, storage, API helpers
│   └── types (via imports)
└── supabase/
    ├── migrations/
    └── functions/
```

---

## Security notes

- Never commit real `.env` files or service-role keys.
- Use only the **anon** key in the frontend; enforce access with Supabase RLS.
- Edge Functions that perform privileged actions must verify JWT and role (see `approve-organization`).

---

## Licence & contact

Private / proprietary unless otherwise stated by the repository owner.  
Repository: [Brightwell-Dlamini/UmhlabaWami_2.0](https://github.com/Brightwell-Dlamini/UmhlabaWami_2.0)
