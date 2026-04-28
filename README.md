This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Checklist (Local)

Use `apps/web/.env.local` for local development.

Required public/runtime keys:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
NEXT_PUBLIC_SOLANA_RPC_URL=http://127.0.0.1:8899
NEXT_PUBLIC_AR_SUBLEDGER_PROGRAM_ID=YOUR_PROGRAM_ID
NEXT_PUBLIC_ACCOUNTING_ENGINE_PROGRAM_ID=YOUR_ACCOUNTING_ENGINE_PROGRAM_ID
```

Required server-only keys (wallet phases A-F):

```env
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
WALLET_ENCRYPTION_KEY=YOUR_LONG_RANDOM_SECRET
WALLET_ENCRYPTION_KEY_VERSION=v1
```

`SUPABASE_SERVICE_ROLE_KEY` source:

1. Open Supabase Dashboard.
2. Go to Project Settings -> API Keys.
3. Copy the `service_role` key value.
4. Set it only in server environment files/secrets (never `NEXT_PUBLIC_*`).

Why this key is used in this project:

1. Wallet management server routes (bootstrap/create/set-main/import/export) perform privileged operations.
2. These flows require server-side access that can pass RLS checks after explicit auth + workspace authorization.
3. Therefore `SUPABASE_SERVICE_ROLE_KEY` is required in server environment only.

Supabase security warning context:

1. This key can bypass Row Level Security.
2. Never expose it in browser/client bundles, logs, screenshots, or shared docs.
3. If leaked, rotate immediately in Supabase.

Practical recommendation:

1. Prefer Supabase Secret API keys (`sb_secret_...`) when available.
2. Keep key usage restricted to server routes/services with strict bearer-token and workspace-role checks.
3. Store in local `.env.local` for development and in deployment secret manager for non-local environments.
4. Consider moving sensitive operations to narrowly scoped RPC/functions in later hardening phases.

`WALLET_ENCRYPTION_KEY` source:

1. Do not use Supabase API keys for this value.
2. Generate your own app secret in local/deployment secret manager.
3. Example (local shell):

```bash
openssl rand -base64 32
```

4. Set this generated value to `WALLET_ENCRYPTION_KEY`.

Safe handling checklist:

1. Never commit real secret values to git.
2. Keep only placeholders in examples and docs.
3. Restart `npm run dev` after changing env values.
4. Use a strong random value for `WALLET_ENCRYPTION_KEY`.
5. Treat `SUPABASE_SERVICE_ROLE_KEY` as server-only and never expose it in client code.
6. Use different secrets per environment (local/dev/stage/prod).
7. Rotate `WALLET_ENCRYPTION_KEY_VERSION` when rotating encryption material.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


solana airdrop 1 4MfoLXLHUT2WWt6X25tgqRcc61qEY9GuvZ4HSgrdL5Pc --url http://127.0.0.1:8899
