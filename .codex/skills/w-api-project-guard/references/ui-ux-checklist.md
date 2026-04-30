# UI/UX Checklist

## Visual Direction

- Preserve the clean operational console style chosen for this app.
- Keep layouts dense and scan-friendly for repeated support work.
- Use restrained neutral surfaces, green operational accents, soft shadows, and `--radius: 8px`.
- Avoid marketing composition: no landing page, hero block, split hero, decorative gradients, or free-floating decoration.
- Avoid nested cards. Use cards only for repeated items, modals, or genuinely framed tools.

## Existing Sources Of Truth

- Use `src/styles.css` for tokens, component classes, responsive rules, and theme variables.
- Use `src/main.jsx` for the established screen structure: `Sidebar`, `Header`, `.workspace`, panels, lists, chat, composer, modals, and actions.
- Use `src/theme.js` for theme preference logic.

## Components And Controls

- Use `lucide-react` icons for nav items and action buttons.
- Prefer existing action classes: `primary-action`, `secondary-action`, `theme-button`, `status-pill`, `send-button`, and `icon-only` where applicable.
- Keep buttons and icon controls dimensionally stable so hover, loading, labels, or icons do not shift layout.
- Use familiar controls: selects for option sets, checkboxes/toggles for booleans, buttons only for commands.
- Keep visible UI copy operational and concise. Do not add text that explains how to use the app.

## Layout And Responsiveness

- Preserve sidebar console navigation on desktop and mobile bottom navigation on small screens.
- Keep desktop information density high, with predictable panels and lists.
- Ensure long names, phone numbers, URLs, emails, message bodies, and button labels do not overflow their containers.
- Use `minmax(0, 1fr)`, `min-width: 0`, ellipsis, wrapping, or stable dimensions where needed.
- Check mobile width for readable navigation, non-overlapping controls, and usable chat/composer layout.

## Theme And States

- Maintain both `:root` and `:root[data-theme="dark"]` variables when adding colors.
- Prefer existing variables over literal colors.
- Keep focus-visible outlines and keyboard-accessible controls.
- Include loading, empty, disabled, success, and error states when the workflow can enter them.
- For chat UI, preserve compact WhatsApp-like bubbles, tails, inbound/outbound color distinction, reply context, and media preview behavior.

## Final UI Review

- Desktop: layout remains dense and aligned.
- Mobile: no overlapping nav, toolbar, or composer elements.
- Light and dark themes: contrast and surfaces remain coherent.
- Empty/loading/error states: present and styled consistently.
- Text: no clipping or unreadable overflow in buttons, panels, lists, or chat bubbles.
