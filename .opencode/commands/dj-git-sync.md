---
description: Syncs the repository with remote (git add, commit, push) without asking.
subtask: true
---

# Git Sync

Syncs the repository with remote. Executes the git workflow autonomously and decisively. **Do NOT ask the user anything**. If something cannot be resolved automatically, report the error and stop.

## Mandatory flow

1. **Inspect** — determine:
   - Current branch: `git branch --show-current`
   - Change status: `git status --short` and `git diff`
   - Recent commits: `git log --oneline -5`

2. **Validate branch** — if the current branch is `main`:
   - Stop immediately.
   - Report: "Sync from main is not allowed. Switch to a working branch (e.g. dev) and try again."
   - Do not execute any changes.

3. **Pull** — run `git pull origin <current-branch>`.
   - If there are conflicts, stop and report the exact error.

4. **Commit ALL changes**:
   - If there are no pending changes (no modified or untracked files), skip to step 5.
   - Run `git add .` to stage all changes.
   - Decide between one or multiple commits:
     - **Default rule:** a single commit with a descriptive message summarizing the overall change.
     - **Exception:** only if the changes are clearly from separate domains/features (e.g. modifying auth AND inventory with no relation), then make separate commits using `git add -p` or specifying files.
   - Messages must be concise, in English, present tense, repo style (`chore:`, `feat:`, `fix:`, `refactor:`, etc.).
   - Examples: `chore: add husky with pre-commit hook`, `refactor: move feature flag initialization to seed`.
   - NEVER ask whether to commit. Always commit.

5. **Push** — run `git push origin <current-branch>`.
   - Never use `git push --force`.

6. **Report** — respond with:
   - Branch synced.
   - Commits created (hash + message).
   - Files affected.
   - Push result.
   - Any warnings (large files, conflicts, etc.).

## Hard constraints

- Do NOT switch branches.
- Do NOT run `git reset`, `git rebase`, `git push --force`, or merges unless explicitly requested.
- Do NOT ask questions. If there is ambiguity, take the most conservative approach (a single descriptive commit).
- Do NOT reveal secrets.
- Always work against the current branch, which must be different from `main`.
