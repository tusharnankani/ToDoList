'use strict';

function escapeLike(text) {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function toTodo(row) {
  return { ...row, completed: row.completed === 1 };
}

function createTodoRepository(db) {
  const statements = {
    list: db.prepare(`
      SELECT * FROM todos
      WHERE (@completed IS NULL OR completed = @completed)
        AND (@priority  IS NULL OR priority  = @priority)
        AND (@pattern   IS NULL OR title LIKE @pattern ESCAPE '\\')
      ORDER BY id ASC
    `),
    byId: db.prepare('SELECT * FROM todos WHERE id = ?'),
    insert: db.prepare(`
      INSERT INTO todos (title, completed, priority, due_date)
      VALUES (@title, @completed, @priority, @due_date)
    `),
    update: db.prepare(`
      UPDATE todos SET
        title      = CASE WHEN @has_title     THEN @title     ELSE title     END,
        completed  = CASE WHEN @has_completed THEN @completed ELSE completed END,
        priority   = CASE WHEN @has_priority  THEN @priority  ELSE priority  END,
        due_date   = CASE WHEN @has_due_date  THEN @due_date  ELSE due_date  END,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = @id
    `),
    remove: db.prepare('DELETE FROM todos WHERE id = ?'),
    removeCompleted: db.prepare('DELETE FROM todos WHERE completed = 1'),
  };

  return {
    findAll({ status = 'all', priority = null, q = null } = {}) {
      const completed = status === 'completed' ? 1 : status === 'active' ? 0 : null;
      const pattern = q ? `%${escapeLike(q)}%` : null;
      return statements.list.all({ completed, priority, pattern }).map(toTodo);
    },

    findById(id) {
      const row = statements.byId.get(id);
      return row ? toTodo(row) : null;
    },

    create({ title, completed, priority, due_date }) {
      const { lastInsertRowid } = statements.insert.run({
        title,
        completed: completed ? 1 : 0,
        priority,
        due_date,
      });
      return this.findById(Number(lastInsertRowid));
    },

    update(id, fields) {
      const has = (key) => (Object.prototype.hasOwnProperty.call(fields, key) ? 1 : 0);
      const { changes } = statements.update.run({
        id,
        has_title: has('title'),
        title: fields.title ?? null,
        has_completed: has('completed'),
        completed: fields.completed ? 1 : 0,
        has_priority: has('priority'),
        priority: fields.priority ?? null,
        has_due_date: has('due_date'),
        due_date: fields.due_date ?? null,
      });
      return changes === 0 ? null : this.findById(id);
    },

    delete(id) {
      return statements.remove.run(id).changes > 0;
    },

    deleteCompleted() {
      return statements.removeCompleted.run().changes;
    },
  };
}

module.exports = { createTodoRepository, escapeLike };
