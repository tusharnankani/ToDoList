
# To-Do-List

## A To-Do website with a REST API and SQLite storage

![ToDoList](https://socialify.git.ci/tusharnankani/ToDoList/image?description=1&forks=1&issues=1&language=1&owner=1&pattern=Brick%20Wall&pulls=1&stargazers=1&theme=Dark)

The front end (vanilla JS) talks to a Node.js 20 + Express REST API. Tasks are stored in a SQLite database; only the chosen colour theme stays in the browser's `localStorage`.

- View the original local installation notes in [CONTRIBUTING.md](https://github.com/tusharnankani/ToDoList/blob/master/CONTRIBUTING.md).

### *Features*:

* Add, edit, complete and delete tasks (completed state is saved on the server and survives reloads)
* Priority (low / medium / high) and optional due date, with an overdue marker
* Filters: All / Active / Completed, text search and "Clear completed"
* Inline validation messages (blank or over-long tasks are rejected, no `alert()`)
* Live clock that updates every second
* Responsive, on all devices
* Themes: Users can choose among 3 themes (remembered in `localStorage`)
* Accessible controls: labelled icon buttons, real `<button>` theme selectors, `data-testid` hooks for UI tests

## Project layout

```
backend/        Express API (routes -> services -> repositories)
  server.js       process entry point
  src/            app factory, config, validation, errors, db helpers
db/             schema.sql, seed.sql, init.js (SQLite, better-sqlite3)
index.html      front end (served by the API server)
JS/ CSS/ assets/
tests/api/      Jest + Supertest API tests
tests/unit/     Jest unit tests (validation, service, repository, front end in jsdom)
scripts/        build.ps1 / build.sh
Dockerfile, docker-compose.yml
```

## Getting started

Requires Node.js 20 or newer.

```bash
npm install
npm run db:init   # creates db/todos.sqlite from schema.sql and loads seed.sql into an empty table
npm start         # http://localhost:3000
```

`npm start` also creates the schema if the database file does not exist yet, so `db:init` is only needed to load the sample data (`node db/init.js --no-seed` applies the schema only).

| Variable       | Default               | Purpose                          |
|----------------|-----------------------|----------------------------------|
| `PORT`         | `3000`                | HTTP port                        |
| `HOST`         | `0.0.0.0`             | Bind address                     |
| `DB_PATH`      | `db/todos.sqlite`     | SQLite database file             |
| `FRONTEND_DIR` | repository root       | Folder containing `index.html`, `JS/`, `CSS/`, `assets/` |

## REST API

Base path: `/api`. All bodies are JSON.

| Method | Path | Description | Success |
|--------|------|-------------|---------|
| GET | `/api/health` | Liveness check, returns `{"status":"ok"}` | 200 |
| GET | `/api/todos` | List todos. Query: `status=all\|active\|completed`, `priority=low\|medium\|high`, `q=<text>` (case-insensitive title search) | 200 |
| GET | `/api/todos/:id` | Get one todo | 200 |
| POST | `/api/todos` | Create a todo | 201 |
| PUT | `/api/todos/:id` | Update a todo; send any of `title`, `completed`, `priority`, `due_date` (at least one) | 200 |
| DELETE | `/api/todos/:id` | Delete one todo | 204 |
| DELETE | `/api/todos?completed=true` | Delete all completed todos, returns `{"deleted": <count>}` | 200 |

A todo looks like:

```json
{
  "id": 1,
  "title": "Buy milk",
  "completed": false,
  "priority": "medium",
  "due_date": "2030-01-31",
  "created_at": "2030-01-01T09:00:00.000Z",
  "updated_at": "2030-01-01T09:00:00.000Z"
}
```

Rules: `title` is trimmed and must be 1-200 characters; `priority` defaults to `medium`; `due_date` is `null` or a real calendar date as `YYYY-MM-DD`; `completed` must be a boolean. Unknown body fields are ignored.

Errors are JSON: `400` `{"error":"Validation failed","details":[...]}` (also malformed JSON, bad ids or filters, and `DELETE /api/todos` without `completed=true`), `404` `{"error":"Todo not found"}`, `413` for bodies over 10 KB, and `500` `{"error":"Internal server error"}` (details are only logged on the server).

All SQL uses prepared statements, and the front end builds the page with DOM APIs and `textContent`, never `innerHTML` with user text.

## Database

`db/schema.sql` defines the `todos` table (`id`, `title`, `completed`, `priority`, `due_date`, `created_at`, `updated_at`) with `CHECK` constraints mirroring the API rules. `db/seed.sql` holds a few sample rows. `npm run db:init` applies both and is safe to re-run (seed data is inserted only into an empty table).

## Tests

```bash
npm test
```

Jest runs the Supertest API tests in `tests/api/` (each test gets a fresh in-memory SQLite database) and the unit tests in `tests/unit/`, including the front end loaded into jsdom with a fake API.

## Build and deploy

Create `dist/todolist-<version>.zip` (runs the tests first; pass `-SkipTests` / `--skip-tests` to only package):

```powershell
powershell -File scripts/build.ps1          # Windows
```

```bash
sh scripts/build.sh                         # Linux / macOS / Git Bash
```

The archive contains the front end, backend, `db/` scripts, `package.json` and Docker files, without `node_modules`. On the target machine unzip it, run `npm ci --omit=dev` (or `npm install --omit=dev`), then `npm start`.

Docker:

```bash
docker compose up --build     # http://localhost:3000
```

The image is based on `node:20-bookworm-slim`, runs as the unprivileged `node` user and keeps the database in the `todolist-data` volume (`/app/data/todos.sqlite`). It has a health check against `/api/health`.

### *Features to be added*:

Check [Issues](https://github.com/madhaweshrai/ToDoList/issues) for contributing to this repository.

* SubTasks: Adding subtasks to the enlisted tasks, could be an option.
* Neumorphic Interface: For the to-do's so, it looks more appealing, Can use SASS (.scss file)
* ScratchPad: Adding an option of a Scratch pad and it can be locally saved.
* Login Features: users can log in, and the To-Dos can be viewed per user on any device.
* Reminder/Alerts: Sending automated mails once logged in, and due date/time set.

# *References*

* For Fonts: [Google Fonts](https://fonts.googleapis.com/css2?family=Work+Sans:wght@300&display=swap)
* For Basic Icons (like Trash and Check buttons): [font-awesome](https://fontawesome.com)
* For Favicon: [icons8](https://icons8.com/icons/)
* For Color Coordination: [w3schools](https://www.w3schools.com/colors/colors_mixer.asp?colorbottom=000000&colortop=FFFFFF)
* For JavaScript (Tutorial): [The Net Ninja](https://www.youtube.com/playlist?list=PL4cUxeGkcC9i9Ae2D9Ee1RvylH38dKuET)
* For help with CSS: [CSS Tricks](https://css-tricks.com/)
* For more CSS effects: [text-effects](https://speckyboy.com/underline-text-effects-css/)
* For Type Writing effects: [Type-effects](https://usefulangle.com/post/85/css-typewriter-animation)
* For Local Storage: [Web Dev Simplified Blog](https://blog.webdevsimplified.com/2020-08/cookies-localStorage-sessionStorage/)

# *Contributions*

- All contributors are most welcome! This is definitely open source!
- View the [`CONTRIBUTING.md`](https://github.com/tusharnankani/ToDoList/blob/master/CONTRIBUTING.md) for further instructions, requirements/dependencies & local project setup instructions!
- All the contributors to this repository can be found in the [`CONTRIBUTORS.md`](https://github.com/tusharnankani/ToDoList/blob/master/CONTRIBUTORS.md) file!

## *WEBSITE DEMO*

![Screenshot (771)](https://user-images.githubusercontent.com/61280281/99399713-0844b900-290c-11eb-8d7c-1199319b4a9e.png)

![Screenshot (772)](https://user-images.githubusercontent.com/61280281/99399731-0da20380-290c-11eb-8a59-e0a2e5f9b19f.png)

![Screenshot (773)](https://user-images.githubusercontent.com/61280281/99399728-0d096d00-290c-11eb-9ee5-59cc8358676c.png)

![Screenshot (774)](https://user-images.githubusercontent.com/61280281/99399723-0b3fa980-290c-11eb-8728-03d974be548d.png)

# *Author*

* Tushar Nankani (tusharnankani, tusharnankani3@gmail.com)
  - [LinkedIn](https://www.linkedin.com/in/tusharnankani)
