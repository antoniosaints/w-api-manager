# Shadcn UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make shadcn components the default UI layer for all non-chat controls and surfaces in W-API Atendimento.

**Architecture:** Keep app pages importing from `src/components/ui/index.js`. Strengthen those wrappers around `src/components/shadcn/*`, add a Card wrapper, convert remaining native controls in `src/main.jsx` and `src/components/AppShell.jsx`, and keep chat stream/composer styles intact.

**Tech Stack:** React 19, Vite, Tailwind, shadcn/Radix primitives, lucide-react, node:test static UI checks.

---

### Task 1: Static Guard Test

**Files:**
- Modify: `test/ui-refactor.test.js`

- [ ] Add tests that assert a Card wrapper exists, the shadcn Card primitive exists, AppShell uses shadcn Button for shell controls, and dashboard/history filters import the reusable UI wrappers.
- [ ] Run `npm test` and confirm the new test fails before implementation because the Card primitive/wrapper and AppShell conversion are missing.

### Task 2: Shadcn Card Primitive And Wrapper

**Files:**
- Create: `src/components/shadcn/card.jsx`
- Create: `src/components/ui/Card.jsx`
- Modify: `src/components/ui/index.js`

- [ ] Add shadcn `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `CardFooter`.
- [ ] Add app-facing `Card` wrapper with `variant="panel" | "metric" | "row" | "auth"` and forward refs.
- [ ] Export `Card` from `src/components/ui/index.js`.

### Task 3: Wrapper Polish

**Files:**
- Modify: `src/components/ui/Button.jsx`
- Modify: `src/components/ui/FormField.jsx`
- Modify: `src/components/ui/Input.jsx`
- Modify: `src/components/ui/SearchField.jsx`
- Modify: `src/components/ui/Select.jsx`
- Modify: `src/components/ui/Textarea.jsx`

- [ ] Remove dependence on legacy `primary-action` and `secondary-action` for baseline button styling while preserving compatibility classes when explicitly passed.
- [ ] Use shadcn Label in `FormField`.
- [ ] Give inputs, textareas, selects, and search fields shadcn-native sizing and app wrapper classes.

### Task 4: Convert Remaining Non-Chat Controls

**Files:**
- Modify: `src/components/AppShell.jsx`
- Modify: `src/main.jsx`

- [ ] Replace shell native buttons with the app Button/shadcn variants.
- [ ] Replace dashboard and history native selects/search inputs with `Select` and `SearchField`.
- [ ] Replace dashboard summary cards and non-chat panels/rows with `Card`.
- [ ] Keep conversation list buttons, message image/reply buttons, media modal close, composer attach/send, hidden file input, composer textarea, bubble classes, and send button unchanged.

### Task 5: CSS Cleanup

**Files:**
- Modify: `src/styles.css`

- [ ] Remove manual styling for generic form controls that duplicates shadcn defaults.
- [ ] Keep layout, dense operational shell, chat, composer, bubbles, media modal, responsive, and theme variables.
- [ ] Add minimal wrapper classes for shadcn card variants and shell button layout.

### Task 6: Verification

**Commands:**
- `npm test`
- `npm run build`

- [ ] Run both commands and read the output.
- [ ] Start or reuse the local dev server and inspect desktop/mobile, light/dark, with special attention that chat bubbles and composer did not visually regress.
