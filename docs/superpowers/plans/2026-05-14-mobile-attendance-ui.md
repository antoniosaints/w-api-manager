# Mobile Attendance UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Atendimento screen usable on phones by showing either the conversation list or the selected chat full-screen, with a clear back action and touch-friendly chrome.

**Architecture:** Keep desktop unchanged. Add local Inbox state to switch mobile panes after selecting a conversation, pass a mobile-only back handler into `ChatWindow`, and use CSS media queries to control layout and visibility. Do not alter backend, socket events, message loading, filters, or conversation permissions.

**Tech Stack:** React 19, Vite, lucide-react, CSS in `src/styles.css`, node:test static UI checks.

---

### Task 1: Static UI Contract Tests

**Files:**
- Modify: `test/conversation-workflow-ui.test.js`

- [ ] **Step 1: Write the failing test**

Add assertions that `Inbox` tracks a mobile chat/list pane, selects the chat pane when a conversation is tapped, passes a back callback to `ChatWindowPanel`, and that CSS has mobile pane classes.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test\conversation-workflow-ui.test.js`
Expected: FAIL because `mobileInboxPane`, `mobile-chat-back`, and mobile pane CSS do not exist yet.

### Task 2: Mobile Pane State

**Files:**
- Modify: `src/main.jsx`
- Modify: `src/components/chat/ChatWindow.jsx`

- [ ] **Step 1: Implement minimal React behavior**

In `Inbox`, add local state for `mobileInboxPane`, move to `chat` after `setSelectedConversationId(item.id)`, and pass `onBackToList={() => setMobileInboxPane('list')}` to `ChatWindowPanel`.

- [ ] **Step 2: Add a mobile-only back button**

In `ChatWindow`, accept `onBackToList`, render a `mobile-chat-back` icon button before the avatar, and keep it visually hidden on desktop by CSS.

### Task 3: Mobile Layout CSS

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Keep desktop unchanged**

Only add or override styles inside existing mobile media queries unless defining a class that is hidden by default.

- [ ] **Step 2: Make Atendimento app-like on small screens**

At phone width, set `.inbox-layout` to a single full-height pane, show `.conversation-list` only for list pane, show `.chat-panel` only for chat pane, keep `.message-stream` scrollable, keep composer at the bottom, and reserve space for `.mobile-nav`.

- [ ] **Step 3: Tighten mobile navigation**

Keep `.mobile-nav` horizontally scrollable without a visible scrollbar, stable touch target sizes, and safe-area bottom padding.

### Task 4: Verification

**Files:**
- No production files unless verification reveals a defect.

- [ ] **Step 1: Run focused UI tests**

Run: `node --test test\conversation-workflow-ui.test.js`
Expected: PASS.

- [ ] **Step 2: Build frontend**

Run: `npm run build`
Expected: exit 0. Existing CSS/chunk warnings may remain, but no errors.

- [ ] **Step 3: Browser check**

Open `http://localhost:5173`, check mobile width and desktop width, verify list -> chat -> back works, composer is reachable, and bottom nav does not cover chat controls.
