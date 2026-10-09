/**
 * @jest-environment jsdom
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const INDEX_HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const BODY_HTML = INDEX_HTML.match(/<body>([\s\S]*)<\/body>/)[1];

function respond(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (data === undefined) throw new Error('no body');
      return data;
    },
  };
}

// In-memory stand-in for the REST API; records every call.
function createFakeApi(initial = []) {
  const todos = initial.map((t, i) => ({
    id: i + 1, completed: false, priority: 'medium', due_date: null, ...t,
  }));
  let nextId = todos.length + 1;
  const calls = [];

  const fetchMock = jest.fn(async (url, options = {}) => {
    const method = options.method || 'GET';
    const parsed = new URL(url, 'http://localhost');
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ method, path: parsed.pathname, search: parsed.search, body });
    const idMatch = parsed.pathname.match(/^\/api\/todos\/(\d+)$/);

    if (parsed.pathname === '/api/todos' && method === 'GET') {
      const status = parsed.searchParams.get('status');
      const q = (parsed.searchParams.get('q') || '').toLowerCase();
      return respond(200, todos
        .filter((t) => (status === 'active' ? !t.completed : status === 'completed' ? t.completed : true))
        .filter((t) => t.title.toLowerCase().includes(q))
        .map((t) => ({ ...t })));
    }
    if (parsed.pathname === '/api/todos' && method === 'POST') {
      if (typeof body.title !== 'string' || body.title.trim() === '') {
        return respond(400, { error: 'Validation failed', details: ['title must not be blank'] });
      }
      const todo = {
        id: nextId++, completed: false, priority: 'medium', due_date: null, ...body,
      };
      todos.push(todo);
      return respond(201, { ...todo });
    }
    if (parsed.pathname === '/api/todos' && method === 'DELETE') {
      const before = todos.length;
      for (let i = todos.length - 1; i >= 0; i -= 1) {
        if (todos[i].completed) todos.splice(i, 1);
      }
      return respond(200, { deleted: before - todos.length });
    }
    if (idMatch) {
      const index = todos.findIndex((t) => t.id === Number(idMatch[1]));
      if (index === -1) return respond(404, { error: 'Todo not found' });
      if (method === 'PUT') {
        Object.assign(todos[index], body);
        return respond(200, { ...todos[index] });
      }
      if (method === 'DELETE') {
        todos.splice(index, 1);
        return respond(204);
      }
    }
    return respond(500, { error: 'unexpected request' });
  });

  return { todos, calls, fetchMock };
}

async function waitFor(assertion, timeout = 2000) {
  const start = Date.now();
  for (;;) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() - start > timeout) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}

const byTestId = (id, root = document) => Array.from(root.querySelectorAll(`[data-testid="${id}"]`));
const one = (id, root = document) => root.querySelector(`[data-testid="${id}"]`);
const titles = () => byTestId('todo-item').map((li) => li.querySelector('.todo-text').textContent);

function loadApp(api) {
  document.body.className = '';
  document.body.innerHTML = BODY_HTML;
  global.fetch = api.fetchMock;
  window.alert = jest.fn();
  jest.resetModules();
  require('../../JS/main.js');
}

function submitTask(text) {
  const input = one('todo-input');
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  one('add-btn').click();
}

describe('index.html', () => {
  test('closes div.version so the clock and list are not nested inside it', () => {
    document.body.innerHTML = BODY_HTML;
    const version = document.querySelector('.version');
    expect(version.contains(document.querySelector('.github-corner'))).toBe(true);
    expect(version.contains(document.getElementById('datetime'))).toBe(false);
    expect(version.contains(document.getElementById('todo-list'))).toBe(false);
  });

  test('points the GitHub corner at madhaweshrai/ToDoList', () => {
    document.body.innerHTML = BODY_HTML;
    expect(document.querySelector('.github-corner').getAttribute('href'))
      .toBe('https://github.com/madhaweshrai/ToDoList');
  });

  test('has the required data-testid hooks and real theme buttons', () => {
    document.body.innerHTML = BODY_HTML;
    ['todo-input', 'add-btn', 'filter-all', 'filter-active', 'filter-completed'].forEach((id) => {
      expect(one(id)).not.toBeNull();
    });
    const themes = Array.from(document.querySelectorAll('.theme-selector'));
    expect(themes).toHaveLength(3);
    themes.forEach((el) => {
      expect(el.tagName).toBe('BUTTON');
      expect(el.getAttribute('aria-label')).toBeTruthy();
    });
  });

  test('main.js never uses innerHTML', () => {
    expect(fs.readFileSync(path.join(ROOT, 'JS', 'main.js'), 'utf8')).not.toMatch(/innerHTML/);
  });
});

describe('todo list UI', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('renders todos from the API with data-id, test ids and aria-labels', async () => {
    const api = createFakeApi([{ title: 'First', priority: 'high', due_date: '2999-01-01' }, { title: 'Second' }]);
    loadApp(api);
    await waitFor(() => expect(byTestId('todo-item')).toHaveLength(2));

    const [first] = byTestId('todo-item');
    expect(first.dataset.id).toBe('1');
    expect(first.textContent).toContain('high priority');
    expect(first.textContent).toContain('Due 2999-01-01');
    expect(one('check-btn', first).getAttribute('aria-label')).toBeTruthy();
    expect(one('edit-btn', first).getAttribute('aria-label')).toBeTruthy();
    expect(one('delete-btn', first).getAttribute('aria-label')).toBeTruthy();
  });

  test('renders user text as text, never as markup', async () => {
    const api = createFakeApi([{ title: '<img src=x onerror=alert(1)><b>bold</b>' }]);
    loadApp(api);
    await waitFor(() => expect(byTestId('todo-item')).toHaveLength(1));
    const item = one('todo-item');
    expect(item.querySelector('img, b')).toBeNull();
    expect(item.querySelector('.todo-text').textContent).toBe('<img src=x onerror=alert(1)><b>bold</b>');
  });

  test('rejects blank input with an inline message instead of alert()', async () => {
    const api = createFakeApi();
    loadApp(api);
    await waitFor(() => expect(api.calls).toHaveLength(1));

    submitTask('    ');
    const error = document.getElementById('form-error');
    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe('Please enter a task.');
    expect(window.alert).not.toHaveBeenCalled();
    expect(api.calls.filter((c) => c.method === 'POST')).toHaveLength(0);

    one('todo-input').value = 'x';
    one('todo-input').dispatchEvent(new Event('input', { bubbles: true }));
    expect(error.hidden).toBe(true);
  });

  test('adds a trimmed task with priority and due date, then clears the form', async () => {
    const api = createFakeApi();
    loadApp(api);
    await waitFor(() => expect(api.calls).toHaveLength(1));

    document.getElementById('priority-input').value = 'high';
    document.getElementById('due-input').value = '2030-12-31';
    submitTask('  Buy milk  ');

    await waitFor(() => expect(titles()).toEqual(['Buy milk']));
    const post = api.calls.find((c) => c.method === 'POST');
    expect(post.body).toEqual({ title: 'Buy milk', priority: 'high', due_date: '2030-12-31' });
    expect(one('todo-input').value).toBe('');
    expect(document.getElementById('priority-input').value).toBe('medium');
    expect(document.getElementById('due-input').value).toBe('');
  });

  test('shows a server validation error inline', async () => {
    const api = createFakeApi();
    loadApp(api);
    await waitFor(() => expect(document.getElementById('status-message').hidden).toBe(false));
    api.fetchMock.mockImplementationOnce(async () =>
      respond(400, { error: 'Validation failed', details: ['title must not be blank'] }));

    submitTask('valid on client');
    await waitFor(() => {
      expect(document.getElementById('form-error').textContent).toBe('title must not be blank');
    });
  });

  test('toggling completed is saved through the API and survives a reload', async () => {
    const api = createFakeApi([{ title: 'Persist' }]);
    loadApp(api);
    await waitFor(() => expect(byTestId('todo-item')).toHaveLength(1));

    one('check-btn').click();
    await waitFor(() => expect(one('todo-item').classList.contains('completed')).toBe(true));
    const put = api.calls.find((c) => c.method === 'PUT');
    expect(put.path).toBe('/api/todos/1');
    expect(put.body).toEqual({ completed: true });

    loadApp(api); // simulate a page reload against the same backend
    await waitFor(() => expect(one('todo-item')).not.toBeNull());
    expect(one('todo-item').classList.contains('completed')).toBe(true);
  });

  test('deletes by id, not by text, when titles are duplicated', async () => {
    const api = createFakeApi([{ title: 'Same' }, { title: 'Same' }]);
    loadApp(api);
    await waitFor(() => expect(byTestId('todo-item')).toHaveLength(2));

    one('delete-btn', byTestId('todo-item')[1]).click();
    await waitFor(() => expect(byTestId('todo-item')).toHaveLength(1));

    expect(api.calls.find((c) => c.method === 'DELETE').path).toBe('/api/todos/2');
    expect(one('todo-item').dataset.id).toBe('1');
  });

  test('edits a task inline and saves it with the edit button', async () => {
    const api = createFakeApi([{ title: 'Old title', priority: 'low' }]);
    loadApp(api);
    await waitFor(() => expect(byTestId('todo-item')).toHaveLength(1));

    one('edit-btn').click();
    const input = one('edit-input');
    expect(input.value).toBe('Old title');
    expect(one('edit-btn').getAttribute('aria-label')).toBe('Save task');

    input.value = '  New title ';
    document.querySelector('.edit-priority').value = 'high';
    document.querySelector('.edit-due').value = '2031-05-06';
    one('edit-btn').click();

    await waitFor(() => expect(titles()).toEqual(['New title']));
    expect(api.calls.find((c) => c.method === 'PUT').body).toEqual({
      title: 'New title', priority: 'high', due_date: '2031-05-06',
    });
    expect(one('edit-input')).toBeNull();
  });

  test('saves an edit with Enter and cancels with Escape', async () => {
    const api = createFakeApi([{ title: 'Keep me' }]);
    loadApp(api);
    await waitFor(() => expect(byTestId('todo-item')).toHaveLength(1));

    one('edit-btn').click();
    one('edit-input').value = 'Discarded';
    one('edit-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(one('edit-input')).toBeNull();
    expect(titles()).toEqual(['Keep me']);
    expect(api.calls.filter((c) => c.method === 'PUT')).toHaveLength(0);

    one('edit-btn').click();
    one('edit-input').value = 'Via enter';
    one('edit-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await waitFor(() => expect(titles()).toEqual(['Via enter']));
  });

  test('rejects a blank edit inline and stays in edit mode', async () => {
    const api = createFakeApi([{ title: 'Needs title' }]);
    loadApp(api);
    await waitFor(() => expect(byTestId('todo-item')).toHaveLength(1));

    one('edit-btn').click();
    one('edit-input').value = '   ';
    one('edit-btn').click();

    const error = one('todo-item').querySelector('.edit-error');
    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe('Please enter a task.');
    expect(one('edit-input')).not.toBeNull();
    expect(api.calls.filter((c) => c.method === 'PUT')).toHaveLength(0);
  });

  test('filters All / Active / Completed through the API', async () => {
    const api = createFakeApi([{ title: 'Open' }, { title: 'Done', completed: true }]);
    loadApp(api);
    await waitFor(() => expect(titles()).toEqual(['Open', 'Done']));

    one('filter-active').click();
    await waitFor(() => expect(titles()).toEqual(['Open']));
    expect(one('filter-active').getAttribute('aria-pressed')).toBe('true');
    expect(one('filter-all').getAttribute('aria-pressed')).toBe('false');
    expect(api.calls[api.calls.length - 1].search).toBe('?status=active');

    one('filter-completed').click();
    await waitFor(() => expect(titles()).toEqual(['Done']));

    one('filter-all').click();
    await waitFor(() => expect(titles()).toEqual(['Open', 'Done']));
  });

  test('searches with a debounce and sends q to the API', async () => {
    const api = createFakeApi([{ title: 'Apples' }, { title: 'Bananas' }]);
    loadApp(api);
    await waitFor(() => expect(titles()).toHaveLength(2));
    const callsBefore = api.calls.length;

    const search = one('search-input');
    ['b', 'ba', 'ban'].forEach((value) => {
      search.value = value;
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await waitFor(() => expect(titles()).toEqual(['Bananas']));
    expect(api.calls.length - callsBefore).toBe(1);
    expect(api.calls[api.calls.length - 1].search).toBe('?q=ban');
  });

  test('clears completed tasks', async () => {
    const api = createFakeApi([{ title: 'Open' }, { title: 'Done', completed: true }]);
    loadApp(api);
    await waitFor(() => expect(titles()).toHaveLength(2));

    one('clear-completed').click();
    await waitFor(() => expect(titles()).toEqual(['Open']));
    const del = api.calls.find((c) => c.method === 'DELETE');
    expect(del.path).toBe('/api/todos');
    expect(del.search).toBe('?completed=true');
  });

  test('shows a message when the server cannot be reached', async () => {
    const api = createFakeApi();
    api.fetchMock.mockImplementation(async () => { throw new TypeError('network down'); });
    loadApp(api);
    const status = document.getElementById('status-message');
    await waitFor(() => expect(status.hidden).toBe(false));
    expect(status.textContent).toContain('Could not reach the server.');
    expect(status.classList.contains('error')).toBe(true);
  });
});

describe('themes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('defaults to the standard theme and applies theme classes', async () => {
    loadApp(createFakeApi([{ title: 'Themed' }]));
    await waitFor(() => expect(byTestId('todo-item')).toHaveLength(1));
    expect(document.body.className).toBe('standard');
    expect(one('todo-item').classList.contains('standard-todo')).toBe(true);
    expect(one('add-btn').classList.contains('standard-button')).toBe(true);
  });

  test('switching theme updates the page and is saved in localStorage', async () => {
    loadApp(createFakeApi([{ title: 'Themed' }]));
    await waitFor(() => expect(byTestId('todo-item')).toHaveLength(1));

    document.querySelector('.darker-theme').click();
    expect(document.body.className).toBe('darker');
    expect(localStorage.getItem('savedTheme')).toBe('darker');
    expect(one('todo-item').classList.contains('darker-todo')).toBe(true);
    expect(one('todo-item').classList.contains('standard-todo')).toBe(false);
    expect(document.getElementById('title').classList.contains('darker-title')).toBe(true);
    expect(document.querySelector('.darker-theme').getAttribute('aria-pressed')).toBe('true');
  });

  test('restores a saved theme and ignores unknown values', async () => {
    localStorage.setItem('savedTheme', 'light');
    loadApp(createFakeApi());
    expect(document.body.className).toBe('light');

    localStorage.setItem('savedTheme', '<script>');
    loadApp(createFakeApi());
    expect(document.body.className).toBe('standard');
  });

  test('does not store todos in localStorage', async () => {
    loadApp(createFakeApi());
    await waitFor(() => expect(document.getElementById('status-message').hidden).toBe(false));
    submitTask('Not local');
    await waitFor(() => expect(titles()).toEqual(['Not local']));
    expect(localStorage.getItem('todos')).toBeNull();
  });
});

describe('live clock (JS/time.js)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('updates the displayed time every second', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2030-01-01T10:00:00'));
    document.body.innerHTML = '<span id="datetime"></span>';
    jest.resetModules();
    require('../../JS/time.js');

    const clock = document.getElementById('datetime');
    const first = clock.textContent;
    expect(first).toBe(new Date().toLocaleString());

    jest.advanceTimersByTime(1000);
    expect(clock.textContent).not.toBe(first);
    expect(clock.textContent).toBe(new Date().toLocaleString());

    jest.advanceTimersByTime(3000);
    expect(clock.textContent).toBe(new Date().toLocaleString());
  });
});
