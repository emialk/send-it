# Send — Climbing Competition Scoring

Live scoring for bouldering, lead and top-rope competitions.

- **Organisers** sign in, set up categories, routes and climbers, and control the competition.
- **Climbers** open a personal QR link on their phone and record their own climbs — no account.
- **Everyone** can follow a full-screen scoreboard that updates in real time.

The app is a static site (React + TypeScript + Vite + Tailwind) that talks directly to
Supabase (PostgreSQL, Auth, Row Level Security, Realtime). There is no server of our own.

## 1. Set up the database

In your Supabase project, open **SQL Editor** and run the contents of:

```
supabase/migrations/20260913090000_init_climbing_comp.sql
```

This creates all tables, access rules, the secure competitor link functions and enables
realtime. Nothing else needs configuring — but make sure **Email** sign-in is enabled under
Authentication → Providers so organisers can create accounts.

## 2. Configure the keys

Copy `.env.example` to `.env` and fill in your project values:

```
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Only the publishable key is ever used in the browser. Never put a secret or service-role
key in this project.

## 3. Run locally

```sh
bun install
bun run dev
```

## 4. Publish to GitHub Pages

1. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Go to **Settings → Secrets and variables → Actions** and add these as
   **Variables** or **Secrets** (the workflow supports either):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Push to `main`. The workflow in `.github/workflows/deploy-pages.yml` builds the static
   site and publishes it to `https://<owner>.github.io/<repo>/`.

To build the static site yourself:

```sh
VITE_PAGES_BASE=/Send/ bun run build:pages   # output in dist-pages/
```

`404.html` is generated alongside `index.html` so deep links (climber links, scoreboards)
work on GitHub Pages.

## Pages

| Path                        | Who        | What                                       |
| --------------------------- | ---------- | ------------------------------------------ |
| `/`                         | Everyone   | Landing page and public scoreboard list    |
| `/auth`                     | Organisers | Sign in / create account                   |
| `/admin`                    | Organisers | Competitions dashboard                     |
| `/admin/:id`                | Organisers | Full competition setup, scoring and export |
| `/climb/:token`             | Climbers   | Personal phone scoring card (QR link)      |
| `/scoreboard/:id`           | Everyone   | Full-screen live scoreboard                |

## Security

- Organisers can only read and change their own competitions.
- Climber links use a 48-character random token, validated inside the database; a climber
  can only ever see and score their own card in their own competition.
- Climber tokens are never exposed to the public scoreboard or exports.
