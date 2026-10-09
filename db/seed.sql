INSERT INTO todos (title, completed, priority, due_date) VALUES
    ('Read the project plan',            1, 'low',    NULL),
    ('Try adding, editing and filtering tasks', 0, 'medium', NULL),
    ('Review the REST API in the README', 0, 'high',   date('now', '+7 days')),
    ('Deploy with docker compose up',    0, 'medium', date('now', '+14 days'));
