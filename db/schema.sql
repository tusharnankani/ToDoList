CREATE TABLE IF NOT EXISTS todos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL
               CHECK (length(trim(title)) BETWEEN 1 AND 200 AND title = trim(title)),
    completed  INTEGER NOT NULL DEFAULT 0
               CHECK (completed IN (0, 1)),
    priority   TEXT    NOT NULL DEFAULT 'medium'
               CHECK (priority IN ('low', 'medium', 'high')),
    due_date   TEXT
               CHECK (due_date IS NULL
                      OR due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos (completed);
CREATE INDEX IF NOT EXISTS idx_todos_priority  ON todos (priority);
