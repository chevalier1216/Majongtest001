# Majongtest001 delivery rules

- Keep the existing game rules and UI constraints. The canonical repository is chevalier1216/Majongtest001; hosting is GitHub Pages.
- Work on a fix/*, feature/* or work/* branch. Do not use main as a remote trial-and-error loop.
- Before the first push of a candidate, run `node scripts/preflight.mjs` on the exact candidate: rules, production build, rendered layout, save/restore, browser restart and offline checks must all pass. Fix failures locally before pushing.
- Set up a checkout with `node scripts/setup-dev.mjs`. This installs the pinned browser tooling and enables the tracked pre-push hook. Hooks are checkout configuration, not a GitHub server rule.
- API writes do not run Git hooks: apply the same preflight requirement before creating/updating remote branches through APIs. Never bypass a failing check or use continue-on-error to hide failures.
- If browser execution is unavailable, try an available execution environment. If none is usable, report the validation blocker; do not send repeated speculative candidates to GitHub CI.
- After local checks pass, push the candidate branch once and wait for its `verify` job to succeed. Promote that exact verified commit to main with a non-forced fast-forward only while main is still its ancestor. If another change arrives, integrate it and verify again.
- Only main may deploy. Branch verification must not enter the github-pages environment or run deployment steps.
- Check the final deployment and published-file verification before reporting release success. Preserve real CI failure statuses and the user's GitHub notification settings.
