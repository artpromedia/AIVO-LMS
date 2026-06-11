# Store submission runbook (Sprint A5)

Single source: `apps/mobile/store-assets/listing.json` (+
`ios.privacyManifests` in `app.json`). This runbook maps those fields to
the App Store Connect and Play Console forms so the answers can never
drift between the manifest, the privacy policy, and the store
questionnaires. Compliance basis: `docs/compliance/state-privacy-matrix.md`
and `docs/legal/privacy-program.md`.

## 0. Release-host preflight (cannot run in CI containers)

| Step | Command | Expectation |
| --- | --- | --- |
| Verify EAS identity | `eas whoami` | The release account; if it isn't `iamofemeofem` (app.json `owner`), STOP and fix `owner`/`extra.eas.projectId` first |
| Verify project link | `eas project:info` | id matches `extra.eas.projectId` |
| Gates | `pnpm release:gate && pnpm mobile:audit -- --store` | all green — `--store` additionally requires populated screenshot sets |
| Device a11y pass | `docs/accessibility/mobile-screenreader-checklist.md` | every row checked for this release |

## 1. iOS privacy manifest → App Privacy questionnaire

`app.json > expo.ios.privacyManifests` is emitted into
`PrivacyInfo.xcprivacy` at prebuild (verify locally with
`npx expo prebuild -p ios --no-install` and inspect
`ios/<app>/PrivacyInfo.xcprivacy`).

App Store Connect → App Privacy answers (must equal the manifest):

| Connect question | Answer | Source |
| --- | --- | --- |
| Do you collect data? | Yes | manifest collected types |
| Email Address | Collected, linked, app functionality | `NSPrivacyCollectedDataTypeEmailAddress` |
| Name | Collected, linked, app functionality | `…TypeName` |
| User ID | Collected, linked, app functionality | `…TypeUserID` |
| Other User Content | Collected, linked, app functionality (learning responses) | `…TypeOtherUserContentTypes` |
| Audio Data | Collected, linked, app functionality (speech answers) | `…TypeAudioData` |
| Crash Data / Performance Data | Collected, NOT linked (Sentry events are scrubbed + ids hashed — packages/observability/src/sentry-scrub.ts) | `…TypeCrashData`, `…TypePerformanceData` |
| Tracking | **No** for every type | `NSPrivacyTracking=false`, empty tracking domains |
| Kids Category | Not enrolled | listing.json `coppa.appStore_kidsCategory` + note |

Required-reason APIs declared (Expo SDK 54 / RN core set): UserDefaults
`CA92.1`; FileTimestamp `C617.1`, `3B52.1`; SystemBootTime `35F9.1`;
DiskSpace `E174.1`. When the Expo SDK is upgraded, re-check against the
SDK release notes and update `app.json` in the same PR.

## 2. Play Console

- **Privacy policy URL**: listing.json `privacyPolicyUrl`
  (`https://aivolearning.com/privacy-policy` — live route in apps/marketing).
- **Data safety**: enter exactly the rows in listing.json `dataSafety.collected`;
  encrypted in transit = yes; deletion path as listed (in-app + DSAR page).
- **Target audience & content**: listing.json `coppa.play_targetAudience`;
  NOT enrolled in Designed for Families (mixed-audience, see
  `coppa.play_familiesPolicyNote`); content-rating questionnaire answers in
  listing.json `contentRating.play_questionnaire` (expected rating: Everyone).
- **App category**: Education. **Contact**: listing.json `supportUrl`.

## 3. Screenshots

`store-assets/screenshots/README.md` defines the 7-shot carousel per
resolution. Generate on a workstation with simulators + a staging build:

```bash
# macOS host, staging app installed on the named simulators
MAESTRO_DEMO_EMAIL=… MAESTRO_DEMO_PASSWORD=… \
node apps/mobile/scripts/capture-store-screenshots.mjs all
```

The driver runs `.maestro/store-screens.yaml` per device, verifies all 7
captures exist, and files them into the per-resolution folders. Review,
then commit. `pnpm mobile:audit -- --store` fails while any required set
is empty, so a release build cannot ship without them.

## 4. Build + submit

```bash
eas build --profile production --platform all
eas submit -p ios && eas submit -p android
```

Record build IDs here per release:

| Date | iOS build | Android build | Submitted by |
| --- | --- | --- | --- |
| _(first production submission pending — blocked on §0 preflight + §3 screenshots from a workstation host)_ | | | |
