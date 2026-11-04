# Customer login and AR integration

Adapted selected features from https://github.com/MarzanoMiles/LPG-Mobile.git
at commit `614ba521099d71f7f5d12dbdf1dd67bf49c2e2ad`.
LPG-App retains its React/Capacitor frontend, Express/MySQL API, and restocking ML.
The unrelated employee screens, shopping cart, checkout, and mobile backend were
not imported.

## Open the customer portal

Use **Customer login** on the existing login page, or visit `/#/customer`.
Customers can sign in, create an account, and open **AR visual guide**.
Customer tokens use a separate storage key and cannot authorize staff APIs.
Staff tokens cannot authorize the customer profile endpoint.

Run this once against your configured database before using customer accounts:

```powershell
npm.cmd --prefix Backend run migrate:customer-auth
```

The migration creates `CustomerAuth` with email and hashed passwords linked to
the existing `Customer` table's string IDs. It does not overwrite staff or
customer data. Customer deletion also removes the associated login credentials.
Customer accounts from a different database are not automatically imported.
Registration creates a new residential customer record. Existing customers
without `CustomerAuth` credentials cannot use their staff password to sign in.
Restart the API after updating the source.

Rebuild and synchronize the Android frontend:

```powershell
npm.cmd run android:sync
```

The camera requires user permission. Browser access requires HTTPS or localhost;
the installed Android app uses Capacitor's local secure origin. Camera permission
is declared in the Android manifest and requested by the WebView on first use.
No microphone permission is requested. Camera frames stay on the device.

## Source mapping

| LPG-Mobile source | LPG-App integration |
| --- | --- |
| `LogInCustomer.kt`, `CreateAccountCustomer.kt`, customer portions of `AuthViewModel.kt` | `src/customer/CustomerPortal.jsx` |
| Customer portions of `AuthRepository.kt`, `AuthDtos.kt`, `auth.routes.js` | `src/customer/customerApi.js`, `Backend/routes/customerAuthRoutes.js` |
| `ARChoose.kt`, `ARScan.kt`, `ARLoadingScreen.kt` | `src/customer/ARViewer.jsx` |
| `tank_11kg.xml`, `tank_2_7kg.xml`, `tank_50kg.xml` | `public/customer-ar/*.svg`, converted from the original vector paths |

The upstream AR flow has a camera preview with randomized success/error states.
This adaptation provides the actual camera preview, selected cylinder overlay,
supported-device flashlight, startup state, permission error/retry, and camera
cleanup on exit or backgrounding. It does not claim gas-level measurement,
leak detection, safety assessment, or world-tracked 3D AR. Randomized analysis
results and fake safety results were not imported.

No `explosive.tflite` file or reference was present in the source checkout or
current app. The file is excluded by `.gitignore` and is not packaged; no TFLite
runtime was added. The existing Python restocking ML service remains separate.

## Checks

Verified for this integration: production frontend build, lint (inherited
warnings), Android asset synchronization, 15 browser tests across 320px/390px
phones and desktop, and 121 backend tests. One database test was skipped.

Customer API tests cover credentials, inactive accounts, token separation,
validation, successful registration, and rollback on duplicate email.
Browser tests cover customer sign-in, tank selection, denied camera permission,
reference visibility, and camera track cleanup, with mocked API/camera inputs.
Live database migration and real-device camera behavior require the configured
database and an Android device; they are not exercised by the browser mocks.
