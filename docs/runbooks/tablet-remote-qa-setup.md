# Remote Tablet QA Setup (BrowserStack App Live)

Companion to [`tablet-hardware-qa.md`](./tablet-hardware-qa.md). That doc
is the **what to test**; this one is the **where to test it** without
owning every device in the matrix.

## Why BrowserStack App Live

The QA checklist is interactive — you have to sign in as five different
roles, rotate the device, watch the rail animate, and tap a deep
route. That's a poor fit for automation-only farms like AWS Device Farm
or Firebase Test Lab (those want a scripted test bundle). **BrowserStack
App Live** gives a manual, remote-desktop-style session on a real
device, runs both iOS (`.ipa`) and Android (`.apk`), and covers every
device in our matrix:

| Matrix entry                     | BrowserStack device label                            |
| -------------------------------- | ---------------------------------------------------- |
| iPad 10.9" (10th / 11th gen)     | `iPad 10th Gen` / `iPad 11th Gen` — iOS 17/18        |
| iPad Pro 12.9" / iPad Pro 13" M4 | `iPad Pro 12.9 2022` / `iPad Pro 13 M4` — iOS 18     |
| Android ~11" tablet              | `Google Pixel Tablet` / `Galaxy Tab S9` — Android 14 |

Plan needed: **App Live** (sufficient — App Automate is not required
for a manual walk-through).

## One-time setup

1. **Create / log in to the BrowserStack account** that owns the
   AIVO workspace. Note the **username** and **access key** under
   _Account → Settings_.
2. **Add the credentials as GitHub repo secrets** (Settings → Secrets
   and variables → Actions):
   - `BROWSERSTACK_USERNAME`
   - `BROWSERSTACK_ACCESS_KEY`
3. **Add them again as Expo / EAS secrets** only if you want EAS to
   auto-upload on every build (optional — the GitHub workflow handles
   the same job).
4. Confirm the BrowserStack plan includes parallel iOS + Android App
   Live sessions and that the device matrix above is enabled.

## Producing an installable build

BrowserStack App Live installs **real device builds**, not Expo Go
links. Two acceptable inputs:

- **iOS** — an internal-distribution `.ipa` from
  `eas build --profile preview-device --platform ios`. **Do not** use
  the older `preview` profile for iOS: it has `"ios": { "simulator": true }`
  in `apps/mobile/eas.json` and produces a `.app` for the simulator,
  not an installable `.ipa`. The `preview-device` profile (added with
  this runbook) drops `simulator: true` so EAS builds a signed `.ipa`
  for ad-hoc distribution.
- **Android** — the `.apk` from
  `eas build --profile preview-device --platform android`. (The older
  `preview` profile also emits an APK, but use `preview-device`
  consistently so the iOS and Android builds come from a matching
  profile.)

Trigger from a workstation with EAS access:

```bash
cd apps/mobile
eas build --profile preview-device --platform ios --non-interactive
eas build --profile preview-device --platform android --non-interactive
```

Download the resulting build artifacts from the EAS dashboard
(`https://expo.dev/accounts/<org>/projects/aivo-mobile/builds`) — you
need the public download URL or the local file.

## Uploading to BrowserStack

Two paths; pick whichever is faster for the moment.

### Path A — GitHub Actions (preferred for shareable links)

The repo ships `.github/workflows/mobile-browserstack-upload.yml`. Run
it from the Actions tab via **workflow_dispatch** with one of:

- `ios_build_url` — the EAS-hosted `.ipa` URL, **or**
- `android_build_url` — the EAS-hosted `.apk` URL

(you can run iOS and Android in one dispatch by filling in both). The
workflow POSTs to `https://api-cloud.browserstack.com/app-live/upload`
and prints the resulting `app_url` (e.g. `bs://abc123…`) plus a direct
App Live launch URL in the run summary. Paste either into the App Live
device picker to install.

If `BROWSERSTACK_USERNAME` / `BROWSERSTACK_ACCESS_KEY` are not set, the
workflow fails fast with a setup checklist instead of a cryptic 401.

### Path B — Manual upload (one-off)

```bash
curl -u "$BROWSERSTACK_USERNAME:$BROWSERSTACK_ACCESS_KEY" \
  -X POST "https://api-cloud.browserstack.com/app-live/upload" \
  -F "url=https://expo.dev/artifacts/.../build.ipa"
```

Response is JSON with `"app_url": "bs://…"`. Open
[app-live.browserstack.com](https://app-live.browserstack.com), pick a
device from the matrix, and paste the `app_url` in the _Uploaded apps_
picker.

## Running the checklist on a remote device

For each device + orientation cell in
[`tablet-hardware-qa.md`](./tablet-hardware-qa.md#test-matrix):

1. **Start a session**: in App Live, pick the device, then the uploaded
   build. Wait for the device to boot and the app to install (~30–60s).
2. **Set system text size to default** (Settings → Display → Text Size
   for iOS; Settings → Display → Font size for Android). Hardware QA
   assumes default font scaling — don't run with accessibility text
   amplification on for the first pass.
3. **Rotate via the toolbar**, not by tilting your laptop — App Live's
   _Rotate_ control fires the real OS rotation event so the layout's
   `useWindowDimensions` hook fires correctly.
4. **Sign in fresh as each role**. Test accounts live in 1Password
   under `mobile-qa-roles`:
   - `qa+parent@aivolearning.com`
   - `qa+learner@aivolearning.com`
   - `qa+teacher@aivolearning.com`
   - `qa+caregiver@aivolearning.com`
   - `qa+therapist@aivolearning.com`
5. **Walk the checklist** (rail visible, no double-nav, content capped,
   greeting amplified, no dead-ends, rotation behaves) and **log each
   finding** into the Drift log table at the bottom of
   `tablet-hardware-qa.md`. One row per (device, orientation, role,
   screen) — or one summary row per (device, orientation, role)
   marked _"no drift observed"_ if everything passed.
6. **Capture evidence for anything ≥ P1**: App Live's toolbar has a
   _Screenshot_ and _Record session_ button — attach the recording URL
   in the Drift log row so the fix PR has something to reference.
7. **End the session** when done. Sessions are billed by the minute on
   App Live; don't leave one idle.

## Re-running after a fix

When a P0 or P1 fix lands:

1. Trigger a fresh `eas build --profile preview-device` for the
   affected platform.
2. Re-upload via the GitHub workflow (it overwrites the in-app picker
   entry for the same build name).
3. Re-run only the rows in the Drift log marked with that severity
   for that device — full re-pass is only required if structural code
   (`RoleTabletShell`, `TabletScaffold`, `useResponsiveType`,
   `responsive.ts`) changed.

## Adding a new device to the matrix

1. Update the matrix table in `tablet-hardware-qa.md`.
2. Confirm the device exists in App Live's device list (Settings →
   _Device Cloud_ → search by model number).
3. No workflow change is needed — App Live exposes every enabled
   device through the same upload endpoint.

## What this does **not** cover

- **Push notifications**: App Live sessions are sandboxed; FCM/APNs
  delivery has to be tested on a physically owned device or via Firebase
  Test Lab Robo with a dedicated tester account.
- **Biometric auth**: simulated on the BrowserStack devices — TouchID /
  FaceID prompts work but actual fingerprint matching is mocked. Real
  biometric verification still needs hardware.
- **Camera / microphone**: BrowserStack injects a synthetic feed.
  Brain-clone voice capture must be re-verified on owned hardware before
  GA.

These three are the only reasons to ever keep hardware on the shelf —
everything else in `tablet-hardware-qa.md` is fully exercisable through
App Live.
