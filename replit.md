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
├── vite.config.ts      # Vite config (port 5173, host 0.0.0.0)
├── tsconfig.json       # TypeScript config
└── src/
    ├── main.tsx        # React root mount
    └── App.tsx         # Full app — auth screen + dashboard
```

## Environment Variables

Set these in Replit Secrets before running:

- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — your Supabase anon/public key
- `GEMINI_API_KEY` — server-only Gemini API key used by ChanguiBot

## Dev Server

```
npm run dev   # starts Vite on port 5173
```

Development uses port 5173 (external 80). `npm run preview` uses port 5174
(external 3001), so both can run without colliding. Both use `strictPort`
to fail explicitly rather than silently select another port.
`vite preview` checks the built frontend only; the development middleware
APIs are not mounted there. Vercel executes the handlers under `api/` as
serverless functions, not as a Vite server listening on these ports.

## Operational references

See [docs/operations.md](docs/operations.md) for the integration audit
procedure, reusable skill references and deployment verification limits.
Preserve the independent WhatsApp CRM model in
`.agents/memory/whatsapp-crm-scope.md`; never replace the existing order chat.
