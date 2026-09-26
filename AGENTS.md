<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

SixVox web branding uses `src/assets/sixvox-logo-signal.png` and derived public/favicon, install, and mobile icons; keep them derived from the same source so the brand remains consistent.
The mobile-first page system is defined by semantic colors in `src/styles.css`, shared page primitives in `src/components/screen.tsx`, and the signed-in navigation in `src/components/AppShell.tsx`; reuse these so pages retain consistent sizing and accessibility.
