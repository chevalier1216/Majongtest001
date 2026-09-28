## Mandatory cross-project PR gate (2026-09-29)

本 repo **必須遵守** [跨專案 Git 交付政策](https://github.com/chevalier1216/KarpathyWiki_personal/blob/main/CROSS_PROJECT_GIT_POLICY.md)。此規範優先於本檔及其他舊文件中任何直接提交預設分支的做法；保留原有產品規格、必要測試、授權與成本限制。Work / Codex / 其他 Agent 不需使用者每次重複提醒：

- 從最新受保護整合分支建立 **每項獨立需求一個短期 branch**；禁止 direct commit/push 至整合分支，包括 Wiki、文件與 hotfix；多 Agent 使用獨立 branch/工作樹。
- 在工作分支驗證、commit、push，建立 PR；審核 diff、範圍、敏感資訊、必要 CI、衝突與 migration/部署影響。未過不得 merge；新費用、破壞性及授權操作仍需明確批准。
- 預設 Squash Merge 並留存 PR、head SHA、merge SHA、CI/部署讀回；需要回檔則從 revert branch 建 PR，不 force push/reset 整合分支。只開 PR 或只 push 不可說已完成整合。
- 並行功能用獨立 PR，合併前確認相依及更新最新整合分支；如不能建立 PR/執行驗證，記錄 blocker，**不可改走直接 push**。
- 此文件為工作方式，不代表 GitHub Ruleset 已啟用；須另行設定與讀回預設分支的 Require PR、必須 CI、禁止 force push/刪除。


# Majongtest001 delivery rules

- Keep the existing game rules and UI constraints. The canonical repository is chevalier1216/Majongtest001; hosting is GitHub Pages.
- Work on a fix/*, feature/* or work/* branch. Do not use main as a remote trial-and-error loop.
- Before the first push of a candidate, run `node scripts/preflight.mjs` on the exact candidate: rules, production build, rendered layout, save/restore, browser restart and offline checks must all pass. Fix failures locally before pushing.
- Set up a checkout with `node scripts/setup-dev.mjs`. This installs the pinned browser tooling and enables the tracked pre-push hook. Hooks are checkout configuration, not a GitHub server rule.
- API writes do not run Git hooks: apply the same preflight requirement before creating/updating remote branches through APIs. Never bypass a failing check or use continue-on-error to hide failures.
- If browser execution is unavailable, try an available execution environment. If none is usable, report the validation blocker; do not send repeated speculative candidates to GitHub CI.
- After local checks pass, push the candidate branch once and wait for its `verify` job to succeed. Open a PR from that exact verified branch into main; review diff and require successful CI before Squash Merge. Never directly fast-forward/push main. If another change arrives, integrate it and verify again.
- Only main may deploy. Branch verification must not enter the github-pages environment or run deployment steps.
- Check the final deployment and published-file verification before reporting release success. Preserve real CI failure statuses and the user's GitHub notification settings.
