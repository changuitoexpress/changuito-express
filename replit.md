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

## Dev Server

```
npm run dev   # starts Vite on port 5173
```
