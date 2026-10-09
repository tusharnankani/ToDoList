(function () {
    'use strict';

    const API_URL = '/api/todos';
    const THEMES = ['standard', 'light', 'darker'];
    const THEME_KEY = 'savedTheme';
    const TITLE_MAX = 200;
    const SEARCH_DEBOUNCE_MS = 250;
    const REMOVE_ANIMATION_MS = 600;

    // Selectors
    const form = document.getElementById('todo-form');
    const toDoInput = document.getElementById('todo-input');
    const priorityInput = document.getElementById('priority-input');
    const dueInput = document.getElementById('due-input');
    const addBtn = form.querySelector('.todo-btn');
    const formError = document.getElementById('form-error');
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-completed');
    const filterButtons = Array.from(document.querySelectorAll('.filter-btn'));
    const themeButtons = Array.from(document.querySelectorAll('.theme-selector'));
    const toDoList = document.getElementById('todo-list');
    const statusMessage = document.getElementById('status-message');
    const title = document.getElementById('title');

    const state = {
        todos: [],
        filter: 'all',
        query: '',
        editingId: null,
        theme: 'standard',
        requestSeq: 0,
        adding: false,
    };

    // ---------- Helpers ----------

    function createElement(tag, className) {
        const element = document.createElement(tag);
        if (className) {
            element.className = className;
        }
        return element;
    }

    function applyTheme(element) {
        const kind = element.dataset.themed;
        THEMES.forEach((theme) => element.classList.remove(`${theme}-${kind}`));
        element.classList.add(`${state.theme}-${kind}`);
    }

    function showStatus(message, isError) {
        statusMessage.textContent = message;
        statusMessage.classList.toggle('error', Boolean(isError));
        statusMessage.hidden = false;
    }

    function hideStatus() {
        statusMessage.textContent = '';
        statusMessage.classList.remove('error');
        statusMessage.hidden = true;
    }

    function setFieldError(element, message) {
        element.textContent = message;
        element.hidden = !message;
    }

    function validateTitle(value) {
        if (value.length === 0) {
            return 'Please enter a task.';
        }
        if (value.length > TITLE_MAX) {
            return `A task can have at most ${TITLE_MAX} characters.`;
        }
        return '';
    }

    function todayLocal() {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${now.getFullYear()}-${month}-${day}`;
    }

    function prefersReducedMotion() {
        return typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    // ---------- API ----------

    class ApiError extends Error {
        constructor(message, status) {
            super(message);
            this.status = status;
        }
    }

    function describeError(data, status) {
        if (data && Array.isArray(data.details) && data.details.length > 0) {
            return data.details.join('; ');
        }
        if (data && data.error) {
            return data.error;
        }
        return `Request failed (${status}).`;
    }

    async function request(method, url, body) {
        const options = { method, headers: { Accept: 'application/json' } };
        if (body !== undefined) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }

        let response;
        try {
            response = await fetch(url, options);
        } catch (error) {
            throw new ApiError('Could not reach the server.', 0);
        }
        if (response.status === 204) {
            return null;
        }

        let data = null;
        try {
            data = await response.json();
        } catch (error) {
            data = null;
        }
        if (!response.ok) {
            throw new ApiError(describeError(data, response.status), response.status);
        }
        return data;
    }

    async function loadTodos() {
        const seq = ++state.requestSeq;
        const params = new URLSearchParams();
        if (state.filter !== 'all') {
            params.set('status', state.filter);
        }
        if (state.query) {
            params.set('q', state.query);
        }
        const query = params.toString();

        try {
            const todos = await request('GET', query ? `${API_URL}?${query}` : API_URL);
            if (seq !== state.requestSeq) {
                return;
            }
            state.todos = todos;
            render();
        } catch (error) {
            if (seq === state.requestSeq) {
                showStatus(`Could not load tasks. ${error.message}`, true);
            }
        }
    }

    // Runs a write, refreshes the list, then reports a failure (if any) so the refresh does not hide it.
    async function mutate(action) {
        let failure = null;
        try {
            await action();
        } catch (error) {
            failure = error;
        }
        await loadTodos();
        if (failure) {
            showStatus(failure.message, true);
        }
    }

    // ---------- Rendering (DOM APIs + textContent only; user text is never parsed as HTML) ----------

    function iconButton(kind, icon, label) {
        const button = createElement('button', `${kind}-btn`);
        button.type = 'button';
        button.dataset.themed = 'button';
        button.dataset.testid = `${kind}-btn`;
        button.setAttribute('aria-label', label);
        const glyph = createElement('i', `fas ${icon}`);
        glyph.setAttribute('aria-hidden', 'true');
        button.append(glyph);
        applyTheme(button);
        return button;
    }

    function priorityOptions(select, selected) {
        ['low', 'medium', 'high'].forEach((value) => {
            const option = createElement('option');
            option.value = value;
            option.textContent = value.charAt(0).toUpperCase() + value.slice(1);
            option.selected = value === selected;
            select.append(option);
        });
    }

    function buildDisplay(todo) {
        const fragment = document.createDocumentFragment();

        const text = createElement('span', 'todo-text');
        text.textContent = todo.title;

        const meta = createElement('div', 'todo-meta');
        const priority = createElement('span', `priority priority-${todo.priority}`);
        priority.textContent = `${todo.priority} priority`;
        meta.append(priority);
        if (todo.due_date) {
            const due = createElement('span', 'due-date');
            due.textContent = `Due ${todo.due_date}`;
            if (!todo.completed && todo.due_date < todayLocal()) {
                due.classList.add('overdue');
                due.textContent += ' (overdue)';
            }
            meta.append(due);
        }

        fragment.append(text, meta);
        return fragment;
    }

    function buildEditor(todo) {
        const fragment = document.createDocumentFragment();

        const titleInput = createElement('input', 'control edit-input');
        titleInput.type = 'text';
        titleInput.value = todo.title;
        titleInput.maxLength = TITLE_MAX;
        titleInput.dataset.themed = 'input';
        titleInput.dataset.testid = 'edit-input';
        titleInput.setAttribute('aria-label', 'Edit task title');
        applyTheme(titleInput);

        const row = createElement('div', 'edit-row');
        const prioritySelect = createElement('select', 'control edit-priority');
        prioritySelect.dataset.themed = 'input';
        prioritySelect.setAttribute('aria-label', 'Edit priority');
        priorityOptions(prioritySelect, todo.priority);
        applyTheme(prioritySelect);

        const dueDate = createElement('input', 'control edit-due');
        dueDate.type = 'date';
        dueDate.value = todo.due_date || '';
        dueDate.dataset.themed = 'input';
        dueDate.setAttribute('aria-label', 'Edit due date');
        applyTheme(dueDate);
        row.append(prioritySelect, dueDate);

        const error = createElement('p', 'field-error edit-error');
        error.setAttribute('role', 'alert');
        error.hidden = true;

        fragment.append(titleInput, row, error);
        return fragment;
    }

    function buildItem(todo) {
        const item = createElement('li', 'todo');
        item.dataset.id = String(todo.id);
        item.dataset.testid = 'todo-item';
        item.dataset.themed = 'todo';
        if (todo.completed) {
            item.classList.add('completed');
        }
        applyTheme(item);

        const editing = state.editingId === todo.id;
        const main = createElement('div', 'todo-main');
        main.append(editing ? buildEditor(todo) : buildDisplay(todo));

        const checkLabel = todo.completed ? 'Mark task as not completed' : 'Mark task as completed';
        const check = iconButton('check', 'fa-check', checkLabel);
        check.setAttribute('aria-pressed', String(todo.completed));
        const edit = editing
            ? iconButton('edit', 'fa-save', 'Save task')
            : iconButton('edit', 'fa-pen', 'Edit task');
        const remove = iconButton('delete', 'fa-trash', 'Delete task');

        const actions = createElement('div', 'todo-actions');
        actions.append(check, edit, remove);

        item.append(main, actions);
        return item;
    }

    function render(options) {
        if (state.editingId !== null && !state.todos.some((todo) => todo.id === state.editingId)) {
            state.editingId = null;
        }

        toDoList.replaceChildren(...state.todos.map(buildItem));

        if (state.todos.length === 0) {
            showStatus(state.filter === 'all' && !state.query ? 'No tasks yet.' : 'No matching tasks.', false);
        } else {
            hideStatus();
        }

        if (options && options.focusEditor) {
            const editor = toDoList.querySelector('[data-testid="edit-input"]');
            if (editor) {
                editor.focus();
            }
        }
    }

    // ---------- Actions ----------

    async function addToDo(event) {
        event.preventDefault();
        if (state.adding) {
            return;
        }

        const value = toDoInput.value.trim();
        const problem = validateTitle(value);
        if (problem) {
            setFieldError(formError, problem);
            toDoInput.setAttribute('aria-invalid', 'true');
            toDoInput.focus();
            return;
        }
        setFieldError(formError, '');
        toDoInput.removeAttribute('aria-invalid');

        state.adding = true;
        addBtn.disabled = true;
        try {
            await request('POST', API_URL, {
                title: value,
                priority: priorityInput.value,
                due_date: dueInput.value || null,
            });
            toDoInput.value = '';
            priorityInput.value = 'medium';
            dueInput.value = '';
            await loadTodos();
            toDoInput.focus();
        } catch (error) {
            setFieldError(formError, error.message);
        } finally {
            state.adding = false;
            addBtn.disabled = false;
        }
    }

    function animateRemoval(node) {
        return new Promise((resolve) => {
            if (prefersReducedMotion()) {
                resolve();
                return;
            }
            node.addEventListener('transitionend', resolve, { once: true });
            setTimeout(resolve, REMOVE_ANIMATION_MS);
            node.classList.add('fall');
        });
    }

    async function deleteTodo(id, item) {
        try {
            await request('DELETE', `${API_URL}/${id}`);
        } catch (error) {
            await loadTodos();
            showStatus(error.message, true);
            return;
        }
        await animateRemoval(item);
        await loadTodos();
    }

    function toggleTodo(id) {
        const todo = state.todos.find((entry) => entry.id === id);
        if (!todo) {
            return Promise.resolve();
        }
        return mutate(() => request('PUT', `${API_URL}/${id}`, { completed: !todo.completed }));
    }

    async function saveEdit(id, item) {
        const titleInput = item.querySelector('[data-testid="edit-input"]');
        const prioritySelect = item.querySelector('.edit-priority');
        const dueDate = item.querySelector('.edit-due');
        const error = item.querySelector('.edit-error');

        const value = titleInput.value.trim();
        const problem = validateTitle(value);
        if (problem) {
            setFieldError(error, problem);
            titleInput.setAttribute('aria-invalid', 'true');
            titleInput.focus();
            return;
        }

        try {
            await request('PUT', `${API_URL}/${id}`, {
                title: value,
                priority: prioritySelect.value,
                due_date: dueDate.value || null,
            });
        } catch (failure) {
            setFieldError(error, failure.message);
            return;
        }
        state.editingId = null;
        await loadTodos();
    }

    function startEdit(id) {
        state.editingId = id;
        render({ focusEditor: true });
    }

    function cancelEdit() {
        state.editingId = null;
        render();
    }

    function onListClick(event) {
        const button = event.target.closest('button');
        const item = event.target.closest('[data-id]');
        if (!button || !item || !toDoList.contains(item)) {
            return;
        }
        const id = Number(item.dataset.id);

        if (button.classList.contains('delete-btn')) {
            deleteTodo(id, item);
        } else if (button.classList.contains('check-btn')) {
            toggleTodo(id);
        } else if (button.classList.contains('edit-btn')) {
            if (state.editingId === id) {
                saveEdit(id, item);
            } else {
                startEdit(id);
            }
        }
    }

    function onListKeydown(event) {
        if (!event.target.closest('[data-testid="edit-input"], .edit-priority, .edit-due')) {
            return;
        }
        const item = event.target.closest('[data-id]');
        if (event.key === 'Enter') {
            event.preventDefault();
            saveEdit(Number(item.dataset.id), item);
        } else if (event.key === 'Escape') {
            cancelEdit();
        }
    }

    function setFilter(filter) {
        state.filter = filter;
        state.editingId = null;
        filterButtons.forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
        });
        loadTodos();
    }

    let searchTimer = null;
    function onSearchInput() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            state.query = searchInput.value.trim();
            state.editingId = null;
            loadTodos();
        }, SEARCH_DEBOUNCE_MS);
    }

    function clearCompleted() {
        return mutate(() => request('DELETE', `${API_URL}?completed=true`));
    }

    // ---------- Theme (kept in localStorage) ----------

    function readSavedTheme() {
        try {
            const saved = localStorage.getItem(THEME_KEY);
            return THEMES.includes(saved) ? saved : 'standard';
        } catch (error) {
            return 'standard';
        }
    }

    function changeTheme(theme) {
        state.theme = theme;
        try {
            localStorage.setItem(THEME_KEY, theme);
        } catch (error) {
            // Storage unavailable: the theme just won't persist.
        }

        document.body.className = theme;
        title.classList.toggle('darker-title', theme === 'darker');
        themeButtons.forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.theme === theme));
        });
        document.querySelectorAll('[data-themed]').forEach(applyTheme);
    }

    // ---------- Init ----------

    function init() {
        themeButtons.forEach((button) => {
            button.addEventListener('click', () => changeTheme(button.dataset.theme));
        });
        filterButtons.forEach((button) => {
            button.addEventListener('click', () => setFilter(button.dataset.filter));
        });
        form.addEventListener('submit', addToDo);
        toDoInput.addEventListener('input', () => {
            setFieldError(formError, '');
            toDoInput.removeAttribute('aria-invalid');
        });
        toDoList.addEventListener('click', onListClick);
        toDoList.addEventListener('keydown', onListKeydown);
        searchInput.addEventListener('input', onSearchInput);
        clearBtn.addEventListener('click', clearCompleted);

        changeTheme(readSavedTheme());
        loadTodos();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
