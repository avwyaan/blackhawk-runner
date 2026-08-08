# RunCart

A group run ordering app for iOS. One person runs to the store — everyone else adds their items in real time.

---

## How it works

1. A **runner** creates a run and picks a store
2. **Group members** receive a push notification and add items to the shared order
3. The runner sees items added live while they shop
4. Everyone gets notified when items are added

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| UI | shadcn/ui, Tailwind CSS |
| Native wrapper | Capacitor 8 (iOS) |
| Backend | Supabase (Postgres, Auth, Edge Functions) |
| Push notifications | APNs via Supabase Edge Functions |

---

## Prerequisites

- Node.js 18+
- Xcode 15+ (for iOS builds)
- Supabase CLI (`brew install supabase/tap/supabase`)
- An Apple Developer account

---

## Local development

```bash
# Install dependencies
npm install

# Start the web dev server
npm run dev
# App runs at http://localhost:5173
```

---

## Environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

---

## Supabase setup

### 1. Link the CLI to your project

```bash
export SUPABASE_ACCESS_TOKEN=your_token   # from supabase.com/dashboard/account/tokens
supabase link --project-ref your-project-id
```

### 2. Push all migrations

```bash
supabase db push
```

### 3. Deploy edge functions

```bash
supabase functions deploy notify-run-started
supabase functions deploy notify-item-added
supabase functions deploy notify-run-status-changed
supabase functions deploy notify-scheduled-run-reminder
supabase functions deploy send-notification-digests
supabase functions deploy guest-login
supabase functions deploy seed-test-users
```

`notify-scheduled-run-reminder` and `send-notification-digests` are invoked on a
schedule by `pg_cron` (set up automatically by the migrations, no manual step
needed) rather than by a per-row trigger like the others.

### 4. Set edge function secrets

```bash
supabase secrets set \
  APNS_KEY_ID=your_key_id \
  APNS_TEAM_ID=your_team_id \
  APNS_KEY_P8="$(cat /path/to/AuthKey_XXXXXXXXXX.p8)"
```

### 5. Supabase dashboard settings

- **Authentication → Providers → Email**: turn off **Confirm email** (invite system handles verification)

---

## iOS build & TestFlight

```bash
# 1. Build web assets and sync to iOS project
npm run build && npx cap sync ios

# 2. Open in Xcode
npx cap open ios
```

In Xcode:
- **Signing & Capabilities** — ensure **Push Notifications** capability is added
- **General** — bump the Build number before each upload
- **Product → Archive** → Distribute to TestFlight

> Before archiving, unlock your keychain:
> ```bash
> security set-key-partition-list -S apple-tool:,apple: -s ~/Library/Keychains/login.keychain-db
> ```

---

## Invite system

Access is invite-only. As admin:

1. Go to **Groups** → expand a group → **Invites**
2. Enter the invitee's email and tap **+**
3. Tap the **share icon** on the pending invite to send a WhatsApp message with the TestFlight link, sign-up steps, and their personal invite code

Invitees sign up with: name, email, invite code, and a password of their choice. They are automatically joined to the group on sign up.

---

## Push notifications

Push notifications are sent via APNs through Supabase Edge Functions:

| Trigger | Recipient | Function |
|---|---|---|
| Run created | All group members (except runner) | `notify-run-started` |
| Item added to order | Runner | `notify-item-added` |

Device tokens are stored in the `device_tokens` table and registered automatically when a user logs in on a native device.

---

## Project structure

```
src/
  pages/          # Auth, Home, Groups, CreateRun, RunTracker, etc.
  hooks/          # useAuth, usePushNotifications
  components/     # UI components (shadcn)
  integrations/   # Supabase client + generated types
supabase/
  migrations/     # All DB schema migrations (applied in order)
  functions/      # Edge functions (Deno/TypeScript)
ios/              # Capacitor iOS project (Xcode)
```

---

## APNs key setup

1. Go to [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles → Keys**
2. Create a key with **Apple Push Notifications service (APNs)** enabled
3. Download the `.p8` file — **you can only download it once**
4. The filename gives you the **Key ID** (`AuthKey_XXXXXXXXXX.p8`)
5. Your **Team ID** is on the Membership page
