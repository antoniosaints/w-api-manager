# Theme, Agents, Sectors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-user accent colors, sectors, attendance tags, admin-only AI agents, and Gemini-powered automatic attendance for waiting chats.

**Architecture:** SQLite stores user preferences, sectors, tags, agent configs, and automation settings. Express exposes admin-guarded management APIs plus safe user preference/session tag APIs. React keeps the current operational shell and chat layout while applying accent tokens and adding focused panels.

**Tech Stack:** React 19, Vite, Tailwind/shadcn wrappers, Express, better-sqlite3, Socket.IO, node:test, `@google/genai`.

---

### Task 1: Database and Permission Contracts

**Files:**
- Modify: `server/db.js`
- Modify: `server/index.js`
- Test: `test/auth-transfer-dashboard.test.js`
- Test: `test/contacts-users-db.test.js`

- [ ] Add failing tests for attendant visibility, user theme updates, admin guards, sectors, tags, and agents.
- [ ] Add SQLite migrations for `users.theme_color`, `sectors`, `user_sectors`, `support_tags`, `support_session_tags`, `ai_agents`, `support_sessions.sector_id`, and `support_sessions.agent_id`.
- [ ] Add db helpers for theme preference, sectors, tags, agent CRUD, session tag updates, sector transfer, and admin-safe settings.
- [ ] Add Express routes with `requireAdmin` for users/settings/connection/webhooks/agents/sectors/tag definitions and authenticated routes for own theme plus session tags.
- [ ] Run targeted tests until green.

### Task 2: Accent Theme and Admin UI

**Files:**
- Modify: `src/styles.css`
- Modify: `src/theme.js`
- Modify: `src/components/AppShell.jsx`
- Modify: `src/app/navigation.jsx`
- Modify: `src/main.jsx`
- Modify: `src/pages/UsersPanel.jsx`
- Create: `src/pages/AgentsPanel.jsx`
- Test: `test/theme.test.js`
- Test: `test/ui-refactor.test.js`

- [ ] Add failing UI tests for accent tokens, menu visibility, and shadcn-backed controls.
- [ ] Apply `data-accent` from the current user and persist changes through `/api/auth/me/preferences`.
- [ ] Add a compact color picker in the user menu.
- [ ] Add admin-only Agents page with Gemini key status, automatic attendance switch, sectors, tags, and agent CRUD.
- [ ] Add sector assignment controls in user editing.
- [ ] Run targeted UI tests until green.

### Task 3: Chat Tags, Sectors, and Automation Runtime

**Files:**
- Modify: `src/main.jsx`
- Modify: `src/styles.css`
- Create: `server/ai-agents.js`
- Modify: `server/index.js`
- Test: `test/ai-agents.test.js`
- Test: `test/conversation-workflow-ui.test.js`

- [ ] Add failing tests for session tag rendering, tag updates, automatic attendance gating, and transfer actions.
- [ ] Install and use `@google/genai` in a server-only service.
- [ ] Run agents only for inbound webhook messages when automatic attendance is enabled, the session is waiting, and no human has taken responsibility.
- [ ] Persist agent replies and transfer sessions to user or sector according to structured Gemini JSON.
- [ ] Render sector and attendance tags in lists/header without changing the chat composer/bubble layout.
- [ ] Run targeted tests until green.

### Task 4: Full Verification

**Files:**
- Build output only.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Start the app and verify desktop/mobile plus light/dark/accent color behavior.
