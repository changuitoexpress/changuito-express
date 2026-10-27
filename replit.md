# Changuito Express

## Overview

Flat Vite + React + TypeScript project. No monorepo — single package at the root.

## Stack

- **Framework**: React 18
- **Build tool**: Vite 5
- **Language**: TypeScript
- **Auth / DB**: Supabase (auth via `@supabase/supabase-js`)
- **Icons**: lucide-react
- **Package manager**: npm

## Structure

```text
/
├── index.html          # HTML entry point → /src/main.tsx
├── package.json        # Single package, all deps here
├── vite.config.ts      # Vite config (port 5000, host 0.0.0.0)
├── tsconfig.json       # TypeScript config
└── src/
    ├── main.tsx        # React root mount
    └── App.tsx         # Full app — auth screen + dashboard
```

## Environment Variables

Set these in Replit Secrets before running:

- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — your Supabase anon/public key

## Dev Server

```
npm run dev   # starts Vite on port 5000
```

Use the **Start application** workflow (or the Run button) to open the app in
Replit Preview. The workflow installs locked dependencies before starting Vite,
which accepts Replit's proxied preview hosts. The `clean-build` validation
workflow is separate and does not run from the Run button.

Install dependencies with `npm ci` after cloning. Run `npm run build` to build
the production bundle in `dist/`; `npm run preview` serves that bundle locally.

The Supabase values above must come from the existing Supabase project. Do not
use a service-role key in a `VITE_` variable: these values are public in the
browser bundle. Restart the workflow after changing secrets.

After task merges, `scripts/post-merge.sh` installs locked dependencies and builds
the app before Replit reconciles the running workflows.
