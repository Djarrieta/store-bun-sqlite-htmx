---
name: git-sync
description: Synchronizes the current repository branch with its remote by pulling, committing pending changes with a meaningful message, and pushing. Use when the user says "git sync", "sync git", "sincronizar git", or similar.
license: Complete terms in LICENSE.txt
---

# Git Sync

When the user asks to "sync git" in this repository, run the following safe workflow. This repository has two protected environments: `main` (production) and `dev` (development). The goal is to upload the user's current work to the remote on the branch they are currently on.

## 1. Inspect current state

Before any mutation, report:
- Current branch (`git branch --show-current`)
- Uncommitted changes (`git status --short`)
- Last few local commits (`git log --oneline -5`)

If the user is on `main`, warn them that production is usually deployed from `main` and that direct pushes should be avoided. Prefer creating a branch or switching to `dev` for development work.

## 2. Ask for confirmation

Always ask the user to confirm before running `git commit`, `git push`, `git pull`, or any destructive operation, even if they explicitly said "git sync". Present the planned actions clearly:

- Pull from `origin/<current-branch>`
- Stage the listed files
- Commit with a suggested message
- Push to `origin/<current-branch>`

Wait for the user to confirm (e.g., "yes", "sí", "ok", "procede").

## 3. Pull

Run `git pull origin <current-branch>`. If there are conflicts, stop and ask the user how to resolve them.

## 4. Stage and commit

If there are pending changes after the pull:
- Run `git diff` to understand the changes.
- Run `git add .` (or stage only the intended files if the user prefers).
- Write a concise, meaningful commit message.
  - Use English for this repository, matching the existing commit style.
  - Use a short subject line.
  - Add a bullet body if multiple distinct changes are present.
- Run `git commit -m "<message>"`.

If there are no pending changes and nothing was pulled, inform the user that the branch is already up to date.

## 5. Push

Run `git push origin <current-branch>` only for the current branch. Never push to `main` unless the user explicitly requests it after a warning.

## 6. Report the result

Summarize:
- Commit hash and message
- Files changed
- Push result
- Any warnings (e.g., being on `main`, large files)

## Important constraints

- Stay on the current branch; do not switch branches.
- Never run `git push --force`, `git reset`, or `git rebase` unless explicitly requested.
- Do not commit secrets or unrelated files.
- If a large binary file (e.g., images) is included, note it in the summary.
