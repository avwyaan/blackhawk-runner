# Environments

## Current state

There is **one** Supabase project, and it is production. Local development, migrations,
and App Store builds all point at it. Two consequences have already bitten this project:

- On 2026-06-25 `.env` was switched between project refs by hand, and the mismatch
  wasn't noticed until the app stopped loading six weeks later.
- Every migration has been tested by applying it to production.

## Standing up staging

Migrations became portable in `20260806000002_parameterize_edge_urls.sql` — the project
URL is now read from vault rather than compiled into the trigger bodies. Before that,
applying this migration set to a second project would have made *staging* fire push
notifications at *production* edge functions.

1. **Create a second Supabase project**, e.g. `runcart-staging`.

2. **Seed its vault secrets.** The notify triggers no-op with a warning if `PROJECT_URL`
   is missing, so this must happen before any run is created:

   ```sql
   SELECT vault.create_secret('https://<staging-ref>.supabase.co', 'PROJECT_URL',  'Base URL for edge fns');
   SELECT vault.create_secret('<random-value>',                    'TRIGGER_SECRET','Shared secret for pg_net triggers');
   ```

3. **Apply migrations and deploy functions:**

   ```sh
   supabase link --project-ref <staging-ref>
   supabase db push
   supabase functions deploy guest-login notify-run-started notify-item-added \
                             delete-account privacy-policy support
   supabase secrets set GUEST_ACCESS_TOKEN=<value>   # required by guest-login
   ```

4. **Point the app at it** by copying `.env.example` to `.env` and filling in the staging
   values. `.env` is gitignored; switch environments by editing it, and confirm which
   project a build actually contains before shipping:

   ```sh
   grep -o 'https://[a-z]*\.supabase\.co' dist/assets/*.js | sort -u
   ```

   That grep is worth running before every archive. The App Store build reviewed on
   2026-07-30 had the right project baked in — but nothing would have caught it if not.

## Free-plan pausing

Both projects will be on the free plan, which **pauses after ~7 days without database
activity**. A paused project stops resolving in DNS, which is indistinguishable from a
deleted one and surfaces in the app as `Load failed`. This caused the Guideline 2.1(a)
App Store rejection on 2026-07-30.

`.github/workflows/keepalive.yml` keeps production awake. It only covers the one project
whose URL is hardcoded in it — **add a second step for staging**, or accept that staging
sleeps and resume it manually before use.

## Before submitting to App Review

- Confirm the backend is awake: a real query must return `200`, not `000`.
- Confirm the bundle points at production (the grep above).
- Do **not** apply migrations or deploy functions while a build is in review. The binary
  under review talks to live infrastructure; changing behaviour underneath a reviewer is
  how you turn one rejection into two.
