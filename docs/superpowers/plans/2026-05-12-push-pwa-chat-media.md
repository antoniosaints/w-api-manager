# Push, PWA, Clipboard Attachment, and Image Pre-send Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add installable PWA support, mobile-capable Web Push notifications for inbound messages, clipboard file/image paste in the chat composer, and an image pre-send step with crop/resize while preserving the current operational chat UI.

**Architecture:** Express + SQLite remain the source of truth. Web Push uses VAPID keys stored locally in SQLite settings, device subscriptions stored per user/device, and a service worker in the Vite app for notification delivery + click routing. Chat media keeps the existing upload pipeline but inserts a client-side pre-send transform step for images.

**Tech Stack:** React 19, Vite, Express, better-sqlite3, Socket.IO, node:test, `web-push`, service worker, canvas-based image processing.

---

### Task 1: PWA + Push Foundation

**Files:**
- Modify: `package.json`
- Modify: `server/db.js`
- Modify: `server/index.js`
- Modify: `src/main.jsx`
- Modify: `src/components/AppShell.jsx`
- Modify: `src/styles.css`
- Modify: `index.html`
- Create: `server/push.js`
- Create: `src/pwa.js`
- Create: `public/manifest.webmanifest`
- Create: `public/sw.js`
- Test: `test/contacts-users-db.test.js`
- Test: `test/conversation-workflow-ui.test.js`

- [ ] Add failing tests for push preference persistence, push subscription persistence, service worker wiring, manifest wiring, and user notification control visibility.
- [ ] Add SQLite support for per-user push enablement and per-device push subscriptions.
- [ ] Generate/persist VAPID keys locally and expose only the public key through authenticated API.
- [ ] Add authenticated subscribe/unsubscribe endpoints and wire inbound message events to push delivery.
- [ ] Register the service worker, add manifest metadata, and add a compact user-menu notification toggle.
- [ ] Handle notification click deep-links into the inbox conversation.
- [ ] Run targeted tests until green.

### Task 2: Push Targeting + Permission UX Hardening

**Files:**
- Modify: `server/db.js`
- Modify: `server/index.js`
- Modify: `src/main.jsx`
- Modify: `src/components/AppShell.jsx`
- Modify: `src/styles.css`
- Test: `test/contacts-users-db.test.js`
- Test: `test/conversation-workflow-ui.test.js`

- [ ] Add per-user notification scope (`assigned`, `queue-and-assigned`) with safe defaults.
- [ ] Suppress unnecessary push delivery when the app is already visible on a client.
- [ ] Improve user feedback for unsupported browsers, denied permission, installed-PWA guidance, and subscription sync failures.
- [ ] Add targeted tests for routing and preference behavior.

### Task 3: Clipboard Attachment + Image Pre-send Modal

**Files:**
- Modify: `src/components/chat/ChatWindow.jsx`
- Modify: `src/media-config.js`
- Modify: `src/styles.css`
- Create: `src/components/chat/ImagePreSendModal.jsx`
- Create: `src/components/chat/image-editing.js`
- Test: `test/conversation-workflow-ui.test.js`

- [ ] Add failing UI tests for paste-to-attach and image pre-send flow wiring.
- [ ] Intercept clipboard file/image paste in the chat composer without breaking normal text paste.
- [ ] Add an image pre-send modal with crop ratio presets and resize presets.
- [ ] Keep the current lightweight upload reference flow after the user confirms the final image.
- [ ] Verify mobile, desktop, light, and dark layouts.

### Task 4: Full Verification

**Files:**
- Build/test output only.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Start the app and verify installability, notification permission flow, notification click routing, desktop/mobile layouts, and composer behavior in light/dark mode.
