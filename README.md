# Viewtra

Brands run pay-per-view TikTok campaigns; creators post, see their views and get paid.

- **Creators** see only their own videos, views and money.
- **Brands** see and review videos for their own campaigns.
- **Admins** see everything. Only the **owner** can give or take away Brand/Admin access.
- A video earns once it reaches the campaign minimum (default 1,000 views) **on its own**. Views are never added up across videos.
  At $2 per 1K: 999 views = $0, 1,000 = $2.00, 1,500 = $3.00.
- **Invites**: every creator has a code. Inviters earn a share of invited creators' approved earnings (default 5% for 6 months, max $100 each), paid on top.

## Stack
- App: Expo (React Native) + Expo Router, in `src/app`
- Backend: Supabase (Postgres + Auth). Schema, security rules and money maths in `supabase/migrations/0001_init.sql`

## Commands
```bash
npm install
npx expo start            # run the app (scan the QR code with Expo Go)
npm run typecheck
npx expo lint
npm run test:db           # 48 checks on the money rules and who-can-see-what (needs a local Postgres on :5439)
```

Setup, TestFlight and App Store steps: see [SETUP.md](SETUP.md).
