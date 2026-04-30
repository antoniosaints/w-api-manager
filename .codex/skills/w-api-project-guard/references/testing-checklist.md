# Testing Checklist

## Commands

- Run `npm test` after changes to backend logic, data helpers, message normalization, auth, dashboard metrics, media handling, or UI wiring covered by static tests.
- Run `npm run build` after frontend changes, CSS changes, imports, Vite config changes, or any cross-cutting project update.
- Run both commands before claiming a project-wide change is complete.

## Test Expectations

- Use `node:test` and `node:assert/strict`, matching the existing tests.
- Prefer behavior tests over implementation snapshots.
- For UI wiring tests, follow the existing static-source pattern only when a browser test is unnecessary or unavailable.
- Add focused tests for public API contracts, parsing, state transitions, permissions, metrics, and message/media edge cases.

## Manual UI Verification

Use browser verification when a change affects layout, navigation, theme, chat, composer, modals, responsive behavior, or visual hierarchy.

Check:
- desktop width
- mobile width
- light theme
- dark theme
- empty/loading/error states when reachable
- text overflow and button sizing
- keyboard focus on interactive controls

## Completion Rule

Do not claim tests or build pass unless the exact command was run in the current turn and exited successfully.
