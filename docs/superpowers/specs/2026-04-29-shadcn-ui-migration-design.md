# Shadcn UI Migration Design

## Goal

Migrate W-API Atendimento frontend controls and framed surfaces to shadcn-based components while preserving the current chat experience.

## Scope

Convert selects, buttons, inputs, labels, textareas, switches, dialogs, badges, tables, search fields, cards, toolbar controls, and shell action controls outside the message composer and chat bubbles.

Preserve the chat stream, message bubbles, media modal behavior, reply context, attach button, send button, hidden file input, and message textarea styling. Chat header actions may use shadcn buttons/selects only where this does not alter the composer or bubble language.

## Approach

Use the existing `src/components/ui` wrappers as the app-facing API and make those wrappers delegate cleanly to `src/components/shadcn` primitives. Add the missing shadcn Card primitive and a local Card wrapper for operational panels and metric cards.

Replace remaining native controls in `src/main.jsx` and `src/components/AppShell.jsx` with the existing wrappers or direct shadcn primitives where appropriate. Keep page modules already using wrappers on the same public API, but remove old manual classes that force non-shadcn control styling.

## UI Rules

The app remains a dense support console, not a marketing page. Surfaces use shadcn card, border, background, foreground, muted, input, primary, destructive, and ring tokens already mapped in `src/styles.css`.

Cards must not become nested decorative containers. Use cards for dashboard metrics, repeated insight rows, panels, auth form, tables, QR panel, webhook event rows, and modal content.

## Testing

Add static UI wiring tests that verify shadcn primitives are used for app controls outside the preserved chat classes. Run `npm test` and `npm run build`. Verify manually in browser at desktop and mobile widths, in light and dark themes.

## Constraints

Do not change backend contracts, Socket.IO behavior, message normalization, or W-API API calls. Do not change chat bubble, stream, media preview, or composer visual behavior beyond necessary import compatibility.
