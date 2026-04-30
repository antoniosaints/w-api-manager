# Backend Checklist

## Existing Sources Of Truth

- Use `server/index.js` for route style, auth guards, error handling, Socket.IO emissions, and W-API endpoint wiring.
- Use `server/db.js` for SQLite access, settings, users, messages, sessions, metrics, and persistence patterns.
- Use `server/normalize.js`, `server/media.js`, `server/wapi.js`, and `server/conversation-status.js` for domain-specific helpers before creating new logic.
- Use existing tests in `test/*.test.js` as contract examples.

## API And Route Standards

- Keep routes under `/api` authenticated by default unless they are auth, health, static upload, or webhook endpoints.
- Use `requireAdmin` for settings, webhook registration, user management, or other admin-only operations.
- Return JSON responses consistent with nearby endpoints: `{ user }`, `{ message }`, `{ conversation }`, `{ ok: true }`, arrays, or metrics objects as already established.
- Return clear Portuguese error messages for predictable client errors.
- Use appropriate HTTP status codes: 400 for invalid input, 401 for auth, 404 for missing resources, 201 for created users.
- Keep route handlers thin enough to read; reuse helpers for parsing, validation, persistence, and external W-API calls.

## Data And Real-Time Behavior

- Preserve SQLite as the local source of truth.
- Do not change stored shapes or public response fields without updating frontend consumers and tests.
- When conversation state, assignment, messages, or deletion changes, emit the same Socket.IO state updates used by nearby flows.
- Keep W-API calls isolated in `server/wapi.js` unless the existing route already owns orchestration.
- Keep media download/decryption behavior in `server/media.js` and frontend preview lookup in `src/media.js`.

## Safety

- Never expose password hashes, tokens, or raw secrets through public settings or user responses.
- Preserve cookie-based session behavior and `credentials: 'include'` frontend calls.
- Avoid logging secrets or entire raw payloads unless the existing debug pattern explicitly requires it.
- Keep group/reaction filtering aligned with `normalize.js` and settings such as `ignoreGroups`.

## Backend Review

- Check whether a frontend caller expects the exact response shape.
- Check whether tests need new fixture coverage for auth, sessions, metrics, media, normalization, or W-API send behavior.
- Check whether a Socket.IO update is needed after mutations.
