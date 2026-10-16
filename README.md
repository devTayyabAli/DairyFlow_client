# DairyFlow mobile app

Expo SDK 57 / React Native 0.86 / React 19, TypeScript, expo-router, expo-sqlite. Offline-first; see the [root README](../README.md) for the product overview and the backend.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Start the Expo dev server (`npx expo start`) |
| `npm run android` / `ios` / `web` | Start and open on a platform |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `expo lint` (ESLint, eslint-config-expo) |
| `npm run check` | typecheck + lint (run before every commit) |
| `node scripts/run-unit-tests.mjs` | Pure-logic unit tests (Node built-in runner) |
| `npm test` | Legacy audit/workflow scripts (`scripts/test-audit.js`, `scripts/test-workflows.js`) |

Configuration: copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` (Android emulator `http://10.0.2.2:3000`, iOS simulator `http://localhost:3000`, phone `http://<LAN IP>:3000`, production `https://...`). Restart Metro after editing it.

Add native/Expo packages with `npx expo install <pkg>`, never plain `npm install`. Native modules outside Expo Go need a development build (`npx expo run:android` or `eas build --profile development`).

## Structure of `src/`

```
src/
  app/            expo-router screens (routes only)
    index.tsx       Home (day summary, entries)
    explore.tsx     Milk (filterable entries)
    buyers/         Buyers list, [id] ledger, bill (weekly bill)
    livestock.tsx   Herd
    more/           index, accounts (weekly report), expenses, backup, cloud-sync
    login.tsx, register.tsx
  components/
    auth/           AuthGate, CloudAuthScreen (email login/register/OTP/reset), LoginScreen (PIN)
    dairy/          Domain components and modals (AddMilkEntryModal, BuyerCard, ...)
    ui/             Reusable primitives (button, card, chip, badge, text-input, ...)
  constants/theme.ts   Color tokens (light/dark), spacing, fonts
  context/         admin-context (auth + PIN), language-context (en/ur strings)
  db/database.ts   Schema, migrations, triggers, all queries
  sync/            sync-engine, sync-context, sync-config, sync-storage, sync-types
  hooks/           use-theme, use-color-scheme
  utils/           pdf-report (templates), pdf-export (print + share), week-cycle, backup-restore, file-storage, pin-security, pin-crypto, csv-export (no longer used by the UI)
```

Keep non-route code outside `src/app/`.

## Navigation

Bottom tabs (`components/app-tabs.tsx`, native tabs): **Home**, **Milk**, **Buyers**, **Herd**, **More**. More leads to Accounts (weekly report), Expenses, Backup and Cloud sync. Auth screens are shown by `AuthGate` until the user is signed in.

## Data model (SQLite, `dairy_farm.db`)

| Table | Contents |
| --- | --- |
| `buyers` | name, phone, address, `is_default` |
| `milk_entries` | date, shift (Morning/Evening), liters, fat %, rate per liter, total, buyer |
| `expenses` | date, category, title, amount, optional quantity/unit/unit price, payee, payment method |
| `buyer_payments` | payments received per buyer (ledger) |
| `livestock` | tag, species (Cow/Buffalo/Calf), gender, status, breed, birth date |
| `livestock_activities` | dated events per animal |
| `app_settings` | key/value (language, farm profile, PIN, sync farm id) |
| `sync_queue` | pending changes written by triggers |

The six data tables carry `uuid` and `updated_at`. `migrateAndSetupSync` adds them idempotently and installs `AFTER INSERT/UPDATE/DELETE` triggers that write to `sync_queue`.

## Sync

`sync-engine.ts` pushes queued changes to `POST /sync/push`, then pulls `GET /sync/pull?since=<cursor>`. Last write wins by `updated_at`; deletes are tombstones; foreign keys travel as UUIDs (`resolveBuyerUuid` / `resolveBuyerId`). The token and cursor live in `expo-secure-store` (`sync-storage.ts`). The base URL comes from `sync-config.ts` (runtime override, then `EXPO_PUBLIC_API_URL`, then a platform default).

## i18n

No i18n library: `context/language-context.tsx` holds two flat dictionaries (`en`, `ur`) and exposes `useLanguage()` returning `t(key)`, `language`, `isUrdu`. Every user-visible string needs a key in **both** languages.

## Theming

`constants/theme.ts` defines `Colors.light` / `Colors.dark` tokens (emerald brand, mint surfaces, amber for Morning and blue for Evening). Components read them through `useTheme()` (`hooks/use-theme.ts`) and the `ui/` primitives; do not hardcode hex colors or spacing in screens.

## Tests

Unit tests use Node's built-in runner and only cover modules that run in plain Node (no React Native, Expo or `@/` imports):

```bash
node scripts/run-unit-tests.mjs              # all *.test.ts under src/ and test/
node scripts/run-unit-tests.mjs week-cycle   # filter by path
# equivalent raw command (Node 22.6+ needs the flag; Node 24+ accepts it too):
node --experimental-strip-types --test src/utils/__tests__/*.test.ts src/utils/*.test.ts
```

Current suites: `week-cycle`, `csv-export`, `backup-restore`, `pin-security`, `pdf-report`. Test files import siblings with an explicit `.ts` extension. Database logic is bound to `expo-sqlite`/`react-native`, so it is exercised by `npm test` (SQLite adapter on `node:sqlite`) rather than the unit runner.
