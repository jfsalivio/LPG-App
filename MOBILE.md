# GasTrack mobile app

Imported frontend (`src`, `public`), Express/MySQL API (`Backend`), and Python
restocking service (`ML`) from https://github.com/jfsalivio/LPG-Capstone.git
at commit `4710e7fd46386455b2621d4c81b747d918143ab1`.
All tracked system source is preserved. The Android app uses the same React
screens and API through Capacitor; backend and ML run on a separate server.

## Install and run

Use Node 22.12+ (Node 24 used here), Python supported by `ML/requirements.txt`,
MySQL, and Android Studio with Android SDK 36 and JDK 21.
Set Android Studio's Gradle JDK to 21. The generated Gradle 8.14.3 wrapper
cannot run on JDK 25.
Run from the repository root in PowerShell:

```powershell
npm.cmd ci
npm.cmd --prefix Backend ci
Copy-Item .env.example .env
Copy-Item Backend/.env.example Backend/.env
Copy-Item ML/.env.example ML/.env
```

Only copy environment files when they do not already exist. Fill in your real
database, JWT, email, and routing credentials. The private database snapshot,
uploaded files, and trained ML model are not in the source repository.
Restore `Backend/db/snapshots/current.sql` from your existing installation and
copy its `Backend/uploads` assets. Backend startup refuses to initialize an
empty database without the snapshot. See README.md for the upstream database
restoration procedure. Do not run migrations against production without reviewing them.

In separate terminals:

```powershell
npm.cmd --prefix Backend run dev
```

```powershell
cd ML
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe train_model.py
.\venv\Scripts\python.exe serve.py
```

```powershell
npm.cmd run dev
```

Open http://localhost:5173 for the responsive browser version.

## Android Studio

For the Android emulator, set root `.env` to:

```dotenv
VITE_API_BASE_URL=http://10.0.2.2:4000
```

For a physical phone, use the server's reachable LAN IP instead of localhost
and connect both devices to the same network. Allow API port 4000 through the
server firewall if needed. Use a public HTTPS API for release builds.
`VITE_API_BASE_URL` is embedded at build time; rebuild after changing it.
The backend's allowed origins must include `https://localhost` for Capacitor.
The example configuration already includes this origin.

```powershell
npm.cmd run android:sync
npm.cmd run android:open
```

Alternatively open the `android` folder directly in Android Studio, let Gradle
sync, select an emulator/device, then press Run. After frontend edits, repeat
`android:sync` before rebuilding. The packaged app contains the built frontend;
it does not require the Vite development server. HTTP API access and mixed
content are allowed only in debug APKs. Release APKs require HTTPS.

## Mobile changes

- Compact fixed header and accessible off-canvas navigation with focus trapping,
  Escape/backdrop dismissal, and all role-permitted modules.
- Phone layouts for dashboard cards, registration forms, POS products, and dialogs.
- Touch controls, safe-area spacing, and horizontal scrolling for wide data tables.
- Desktop modules and existing backend/ML behavior are preserved.

## Validation

Checks performed in this clone: production frontend build passes; lint exits
successfully with inherited warnings; frontend utility tests pass (3 tests);
backend tests excluding `*.database.test.js` pass (116 passed, 1 skipped)
using isolated placeholder database environment values for mocked tests;
Python source compilation passes; Capacitor Android asset sync passes.
On November 4, 2026, the Android debug APK was built with JDK 21 and SDK 36,
installed on the Medium Phone emulator, and opened successfully. The three
home options and an HTTP 200 API health request were verified from the actual
Android WebView. The configured database connection and both login endpoints
were checked; the missing CustomerAuth table was created with its migration.
ML prediction and successful sign-in with a real account were not tested.

For emulator builds, set `VITE_API_BASE_URL=http://10.0.2.2:4000` before
building/syncing; `localhost` inside Android refers to the emulator itself.
The API must be running from this repository's `Backend` folder. An older API
instance can pass `/health` while missing the customer-login routes.

```powershell
npm.cmd run build
npm.cmd run lint
node --test src/utils/unitValue.test.js
python -m compileall -q ML
```

Backend integration tests need a separate configured test database. Do not run
`financialRules.database.test.js` against a production database: it runs a migration.
The inherited dependencies have npm audit findings; review them before deployment.
Live login, database operations, and trained ML predictions require the private
configuration/assets described above.
