---
name: w-api-project-guard
description: Use when creating, updating, fixing, refactoring, or reviewing the W-API Atendimento project, especially changes in React, Tailwind, UX, responsive UI, light/dark theme, Express, SQLite, Socket.IO, API contracts, tests, or any frontend/backend workflow in this repository.
---

# W-API Project Guard

## Overview

Use this skill to keep W-API Atendimento consistent during every project change. Preserve the current fullstack architecture and the clean operational UX: dense, calm, professional, responsive, and focused on daily support work.

## Required Workflow

1. Inspect the closest existing implementation before editing: use `src/main.jsx`, `src/styles.css`, `server/index.js`, `server/db.js`, or the nearest test as the source of truth.
2. Identify whether the change affects UI/UX, backend/API, tests, or a cross-cutting workflow.
3. Load the matching reference before implementation:
   - UI or visual behavior: `references/ui-ux-checklist.md`
   - Backend, data, API, auth, or real-time behavior: `references/backend-checklist.md`
   - Verification scope: `references/testing-checklist.md`
4. Keep the existing stack and shape: React/Vite/Tailwind in `src`, Express/SQLite/Socket.IO in `server`, and `node:test` in `test`.
5. Make the smallest coherent change that fits nearby patterns. Avoid unrelated refactors, new libraries, and new visual systems.
6. Verify with the commands and manual checks appropriate to the changed surface.

## Project Standards

- Keep the product identity as a local W-API support console, not a marketing site.
- Preserve the "operacional limpo" direction: sidebar console, dense information, restrained surfaces, clear hierarchy, and low decoration.
- Use `lucide-react` icons for actions and navigation when an icon exists.
- Maintain light/dark theme parity through CSS variables in `src/styles.css`.
- Keep API responses, error messages, auth/admin guards, and Socket.IO state updates consistent with existing endpoints.
- Add or update tests when behavior, contracts, parsing, metrics, or UI wiring changes.

## UI Review Gate

For any UI-affecting change, check desktop, mobile, light theme, dark theme, empty/loading/error states when applicable, text overflow, keyboard focus, and whether controls match the existing action classes.

Do not add landing pages, hero sections, decorative gradients, free-floating decoration, nested cards, one-off palettes, or visible instructional copy that explains the interface.

## Expected Result

The changed project should still look and feel like the same W-API Atendimento app: a practical WhatsApp support operations tool with predictable navigation, compact panels, resilient responsive layouts, and stable backend contracts.
