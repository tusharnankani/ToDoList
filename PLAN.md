# ToDoList Modernisation — PLAN (G01: Todo object model + stable IDs)

## Objective
Modernise the ToDoList app’s client-side persistence by replacing the legacy `localStorage` format (array of strings) with a structured **Todo domain model** using **stable unique IDs**. This enables safe operations with duplicate task texts, lays groundwork for metadata (completed/createdAt/etc.), and improves maintainability.

Primary Jira delivery: **EPMCDMETST-68130** and its subtasks.

---

## Scope

### In scope (this release)
- Introduce a Todo domain model (object instead of string) in the frontend code.
- Generate a stable unique `id` per todo (client-generated).
- Persist todos to `localStorage` as an array of objects.
- Render todos with a stable identifier in the DOM (e.g., `data-id` attribute).
- Implement one-time backward-compatible migration:
  - If legacy storage is detected as an array of strings, convert to objects and re-save.
- Update delete logic to delete by `id` (not by text) so duplicates are handled reliably.
- Add automated tests for the model and migration.
- Add concise documentation of the new storage shape + migration behaviour.

### Out of scope (explicitly not in this release)
- Backend/API implementation (Node/Express/SQLite).
- Server-side persistence and authentication/authorization.
- Advanced metadata fields beyond the minimum (e.g., due date, priority) except where stubbed for forward compatibility.
- UI redesign, filtering/search, editing workflow (unless required to support delete-by-id and rendering).
- CI/CD pipeline changes beyond what’s needed to run tests locally.

---

## Target architecture (post-release)

### Data model (frontend domain model)
Minimum shape aligned to Story notes/AC:
```js
Todo = {
  id: string,          // stable unique identifier
  text: string,        // trimmed user input
  completed: boolean,  // toggled in UI; persistence can be added now or later
  createdAt: string    // ISO timestamp
}
```

### Persistence
- `localStorage` key continues to be used (existing key preserved to avoid data loss).
- Stored value becomes `JSON.stringify(Todo[])`.
- On startup:
  1. Read stored value.
  2. Detect format:
     - `string[]` legacy → migrate to `Todo[]` and persist.
     - `Todo[]` new → use as-is.
     - anything else → default `[]` safely.
- IDs generated using `crypto.randomUUID()` when available; fallback UUID generator when not.

### UI rendering
- Each rendered todo root element must include `data-id="<todo.id>"`.
- Actions (delete/toggle complete) must use the `data-id` to locate and update the correct item in memory + persisted storage.

---

## Milestones (M1–M4)

> Estimates are in story points (SP). Owners are placeholders unless your team has named assignees; update before execution.

| Milestone | Goal | Jira issues | Estimate | Owner |
|---|---|---|---:|---|
| **M1** | Design + scaffolding for domain model and migration approach | **EPMCDMETST-68130** (Story refinement tasks: confirm storage key, edge cases, uuid fallback approach) | 1 | Delivery Lead / Dev |
| **M2** | Implement todo object model + localStorage migration + delete-by-id rendering | **EPMCDMETST-68131** | 3 | Frontend Dev |
| **M3** | Add automated tests for model/migration and duplicate-delete behaviour | **EPMCDMETST-68132** | 2 | Dev + QA |
| **M4** | Documentation + final hardening (lint, manual regression, release notes) | **EPMCDMETST-68133** | 1 | Dev |

Total planned: **7 SP** (Story is 5 SP in Jira; subtasks represent the work breakdown—keep Jira story points as-is, but track milestone effort here for delivery clarity).

---

## Detailed delivery approach

### M1 — Analysis & design decisions
- Confirm current storage keys used in `JS/main.js` (likely `todos`).
- Decide whether to:
  - Keep key name the same (recommended) and migrate contents in place.
  - Or use a versioned key (`todos.v2`) and keep legacy key as fallback (optional; adds complexity).
- Define the migration detection logic:
  - If parsed JSON is an array and first element is string => legacy.
  - If parsed JSON is an array and elements have `id` and `text` => v2.
  - Otherwise treat as empty and overwrite safely.
- Define minimal validation rules for `text`:
  - Trim whitespace.
  - Reject empty after trimming.

### M2 — Implementation (EPMCDMETST-68131)
Changes expected primarily in `JS/main.js`:
- Introduce helpers:
  - `generateId()`
  - `loadTodos()` (includes migration)
  - `saveTodos(todos)`
  - `normalizeTodoText(text)`
- Update add-todo flow:
  - Create object `{id, text, completed:false, createdAt:new Date().toISOString()}`
  - Push into array and save
  - Render with `data-id`
- Update delete flow:
  - Read `data-id` from DOM node
  - Remove using `filter(t => t.id !== id)` and save
- Update get/render flow:
  - Use loaded objects
  - Render text from `todo.text`
- Ensure duplicate text delete works by targeting ID, not `indexOf(text)`.

Notes:
- Maintain backward compatibility by auto-migrating on first load.
- Avoid breaking theme recoloring logic; ensure new DOM structure remains compatible.

### M3 — Tests (EPMCDMETST-68132)
Add a lightweight test harness (recommended: Jest + jsdom) to cover:
- Migration:
  - Given `["A","B"]` stored, load migrates to objects with ids and preserves text order.
- Duplicate delete:
  - Given two todos with same text but different ids, deleting one id removes only one.
- Stability:
  - Load/save roundtrip preserves ids and fields.

If the repo does not currently have Node tooling:
- Add minimal `package.json` devDependencies (`jest`, `jsdom`) and scripts:
  - `test`
  - optional `test:watch`

### M4 — Docs & hardening (EPMCDMETST-68133)
Add/update documentation (README or `/docs`) describing:
- Storage key name and schema (`Todo[]`)
- Migration rules and when it runs
- How IDs are generated and fallback behaviour
- Any known limitations

---

## Dependencies
- Browser support for `crypto.randomUUID()` varies; a fallback UUID generator is required for compatibility.
- Local environment capable of running Node-based tests (if Jest is added). If not permitted, tests must be runnable via browser-based test runner; confirm constraints early.

---

## Risks & mitigations
| Risk | Impact | Likelihood | Mitigation |
|---|---|---:|---|
| Migration corrupts/overwrites user data due to unexpected localStorage shape | Data loss, broken UI | Medium | Implement defensive parsing + backup-before-write (optional: store legacy blob to `todos.backup` once) and default safely |
| UUID generation not available in some browsers | Runtime error | Medium | Use `crypto.randomUUID()` with fallback generator; unit test fallback |
| Existing DOM-dependent logic (theme styling, completed class toggling) breaks after refactor | Visual or functional regression | Medium | Keep CSS class names and structure stable; manual regression checklist |
| Tests introduce tooling friction in static repo | Slows delivery | Low-Med | Keep Jest setup minimal; document how to run; avoid heavy build steps |

---

## Test strategy
### Automated tests
- Unit tests for:
  - `generateId()` (format/non-empty; fallback path)
  - `loadTodos()` migration logic for legacy and v2 format
  - delete-by-id behaviour
- Run locally via `npm test` (if Node tooling is introduced).

### Manual test checklist (smoke)
- Load with empty localStorage → app works, can add and delete.
- Seed legacy storage `["A","B"]` → reload → both appear; storage becomes objects with ids.
- Create duplicate todos with same text → delete one → only one disappears; remaining one persists after reload.
- Theme switching still works (no JS errors, list items remain styled).
- Refresh page → todos persist with same ids.

---

## Build & deployment (local)
This repo appears to be a static site; for this release:
- No production build required.
- For local development:
  - Serve via any static server (e.g., VS Code Live Server) for manual testing.
- If tests are added with Jest:
  - `npm install`
  - `npm test`

No containerization or CI changes required for this scoped release.

---

## Human-in-the-loop (HITL) checkpoints
1. **HITL-1 (pre-implementation):** Confirm storage key name, migration behaviour, and ID generation approach (UUID + fallback).
2. **HITL-2 (post-M2):** Demo: duplicate text delete works correctly; migration runs once and preserves existing todos.
3. **HITL-3 (pre-merge):** Review tests and docs; verify no regressions to theme switching and basic add/delete/complete UI flows.

---

## Definition of Done (DoD)
- Todos are persisted as objects with fields at least: `id`, `text`, `completed`, `createdAt`.
- Todo elements render with stable `data-id` (or equivalent) matching the stored `id`.
- Deleting a todo removes only the matching `id` even when duplicate texts exist.
- Backward-compatible migration converts legacy `string[]` todos to object todos automatically on load.
- Automated tests exist and pass for migration and duplicate-delete behaviour.
- Documentation updated to describe schema and migration.
- No console errors in normal usage; basic flows (add/delete/mark complete, theme switch) still operate.

---

## Branching & commits
- Branch naming: `feature/<JIRA-KEY>-<slug>`
  - Example: `feature/EPMCDMETST-68131-todo-object-model-migration`
- Commit message convention: `<JIRA-KEY>: <message>`
  - Example: `EPMCDMETST-68131: migrate localStorage todos to object model`
- Keep commits small and aligned to subtasks where practical.

---

## Jira mapping
- **EPMCDMETST-68130** — Story: Todo domain model & stable IDs (overall acceptance criteria)
- **EPMCDMETST-68131** — Sub-task: Implement todo object model + localStorage migration
- **EPMCDMETST-68132** — Sub-task: Test todo object model + migration
- **EPMCDMETST-68133** — Sub-task: Docs: todo storage format + migration notes
