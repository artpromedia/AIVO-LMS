# AAC Bridge — Vendor Integration Status

## Overview
`@aivo/aac-bridge` provides a platform-agnostic AAC (Augmentative and Alternative Communication)
integration layer for AIVO. This document tracks the integration status for each vendor.

---

## ✅ Built — Phase 1 (Software-only, no vendor dependencies)

| Component | Status | Notes |
|---|---|---|
| `SwitchScanController` | **Complete** | Pure TypeScript, no DOM dependency. Tested. |
| `useAACInput` React hook | **Complete** | Wraps SwitchScanController for web + RN. |
| OBF v1.0 importer (`parseOBF`, `parseOBZ`) | **Complete** | Parses boards and symbol grids. Tested. |
| OBF v1.0 exporter (`exportToOBF`) | **Complete** | Round-trip lossless. Tested. |

---

## ✅ Built — Phase 2 (Vendor adapters, interface-complete)

### PRC-Saltillo (LAMP Words for Life / Snap Core First)
- **Status:** Interface complete. Requires `window.__LAMP_SDK` or `window.__SnapCore` injected by the Snap Core First Web SDK.
- **Activation:** Requires a signed commercial integration agreement with PRC-Saltillo.
- **Contact:** developer-integrations@prentrom.com
- **Env var required:** `PRC_APP_ID`

### Tobii Dynavox (eye gaze)
- **Status:** Interface complete. Connects to the Tobii Interaction Library WebSocket bridge at `ws://localhost:1983`.
- **Activation:** Requires Tobii Eye Tracking Core software running on the user's device (PCEye, IS5, or Dynavox eye trackers).
- **Notes:** Dwell-based selection is fully implemented. GazePoint → targetId mapping must be done by the host UI (the UI knows element positions; the adapter knows dwell timing).

### AssistiveWare (Proloquo2Go)
- **Status:** Interface complete. iOS/iPadOS x-callback-url scheme registered.
- **Activation:** Requires:
  1. An iOS app native bridge that intercepts Proloquo2Go x-callback-url payloads and dispatches `proloquo2go-aac-event` CustomEvents on `window`.
  2. A signed commercial partnership agreement with AssistiveWare.
- **Contact:** developer@assistiveware.com
- **TODO:** Reverse highlighting via x-callback-url (not yet in AssistiveWare's developer docs as of April 2026).

### CoughDrop (cloud-based AAC)
- **Status:** Complete. REST API integration using CoughDrop v1 API.
- **Activation:** Parent must provide their CoughDrop API key in Family Settings. Key is encrypted at rest using `@aivo/security` AES-256-GCM.
- **Endpoints added to family-svc:**
  - `POST /api/family/language-profile/:learnerId/coughdrop-sync`
  - `GET  /api/family/language-profile/:learnerId/coughdrop-sync/status`

---

## ❌ Not yet built

| Component | Notes |
|---|---|
| Eye-gaze GazePoint → DOM element mapping | Requires host UI to compute element bounding boxes and map to `targetId`. |
| Switch access hardware key detection (mobile) | Implemented in `SwitchScanOverlay.tsx` via volume buttons (Expo). |
| Partner-assisted scanning UI | No implementation; interaction_type="partner_assisted" is reserved. |
| Head pointer support | No implementation; `head_pointer` method is reserved for future. |

---

## Vendor Partnership Status

| Vendor | Agreement Status | SDK Access |
|---|---|---|
| PRC-Saltillo | Pending | Pending |
| Tobii Dynavox | Pending | WebSocket bridge (public) |
| AssistiveWare | Pending | Public docs only |
| CoughDrop | Active (REST API) | API key per-user |

---

*Last updated: Sprint 20 Phase 2 implementation*
