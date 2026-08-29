# Second Brain Design System — sync notes

## Source

This repo has no engineering-side design system (no `package.json` for a UI
package, no Storybook, no build). The synced source was
`~/Downloads/Second-Brain-UI-Design.zip` — a prior Claude Design export
(raw `.jsx` + `.d.ts` + `.prompt.md` + grouped `.card.html` previews,
produced via the separate `second-brain-design` Claude skill during UX
prototyping, 2026-08-26). That zip is not tracked in this repo.

This was therefore an **off-script sync**: no `package-build.mjs` /
`package-validate.mjs` pipeline ran. Instead:

- `_ds_bundle.js` was esbuild-bundled by hand from the zip's `components/**/*.jsx`
  (IIFE, `window.SecondBrainDS`, React/ReactDOM aliased to `window.React`/
  `window.ReactDOM` shims so the UMD-script-tag cards can consume it).
- `_ds_bundle.css` is an empty stub — every component styles via inline
  `style={{ ... }}` against `tokens/*.css` custom properties, no CSS-in-JS
  or generated classes exist.
- Preview cards are the zip's own **grouped** cards (one `.card.html` per
  group — `chat`, `core`, `navigation` — not one per component). Verified
  with a local headless Playwright render check (all 18 cards, including
  15 guideline cards, render with non-empty content and zero console/page
  errors).
- No `_ds_sync.json` anchor was written — an anchor built without the real
  converter's hash recipe would be dishonest. **The next sync has no
  anchor and will re-verify everything from scratch.** That's expected and
  correct, not a bug.
- The "Author the conventions header" step (base SKILL.md) was **not**
  done this run — no `.design-sync/conventions.md` exists yet.

## Bug fixed during verification

`CitationMarker` used `ref` as a prop name in its `.jsx`, `.d.ts`, and
`.prompt.md`, and `AnswerBody.jsx` passed it as a JSX attribute
(`<CitationMarker ref={r.ref} ... />`). `ref` is a reserved React prop —
passing it to a plain function component throws (minified error #290) in
production React. This crashed the `chat.card.html` preview outright and
would have crashed it in every consumer, including anything the Claude
Design agent builds with these components. Renamed to `refLabel`
everywhere (component, `.d.ts`, `.prompt.md`, the one call site in
`AnswerBody.jsx`). **Not yet fixed in the source zip** — if that zip (or
whatever repo eventually owns this UI) is edited again, port this rename
there too, or it'll reappear on the next off-script sync.

## Re-sync risks

- No anchor (see above) → any re-sync is a full re-verify, not incremental.
- If a real engineering repo for this UI is created later (package.json +
  build), re-run `/design-sync` from that repo instead of this zip — it'll
  detect `shape: "package"` already pinned in `.design-sync/config.json`
  and go through the real converter, which is more faithful than this
  hand-bundled path.
- `ui_kits/chat/` in the source zip (a separate "interactive recreation")
  was not synced — design-sync only consumes `components/`, `tokens/`,
  `guidelines/`, `styles.css`. It has the same `ref`-prop bug in its own
  copy of the `refs` shape; not fixed, since it's out of scope for this
  upload.
- `components/core/core.card.html`'s Avatar `brand` variant renders an
  empty box in the headless check — likely a missing brand-mark asset, not
  investigated further (cosmetic, non-blocking).
