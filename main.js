// Selectors

const toDoInput = document.querySelector('.todo-input');
const toDoBtn = document.querySelector('.todo-btn');
const toDoList = document.querySelector('.todo-list');
const standardTheme = document.querySelector('.standard-theme');
const lightTheme = document.querySelector('.light-theme');
const darkerTheme = document.querySelector('.darker-theme');


// Event Listeners

toDoBtn.addEventListener('click', addToDo);
toDoList.addEventListener('click', deletecheck);
document.addEventListener("DOMContentLoaded", getTodos);
standardTheme.addEventListener('click', () => changeTheme('standard'));
lightTheme.addEventListener('click', () => changeTheme('light'));
darkerTheme.addEventListener('click', () => changeTheme('darker'));

// Check if one theme has been set previously and apply it (or std theme if not found):
let savedTheme = localStorage.getItem('savedTheme');
savedTheme === null ?
    changeTheme('standard')
    : changeTheme(localStorage.getItem('savedTheme'));

// Functions;
function addToDo(event) {
    // Prevents form from submitting / Prevents form from reloading;
    event.preventDefault();

    // Get deadline input
    const deadlineInput = document.querySelector('#deadline');
    const deadline = deadlineInput.value;

    // toDo DIV;
    const toDoDiv = document.createElement("div");
    toDoDiv.classList.add('todo', `${savedTheme}-todo`);

    // Create LI
    const newToDo = document.createElement('li');
    if (toDoInput.value === '') {
        alert("You must write something!");
    } else {
        newToDo.innerText = toDoInput.value;
        newToDo.classList.add('todo-item');
        toDoDiv.appendChild(newToDo);

        // Adding deadline to the task
        const deadlinePara = document.createElement('p');
        deadlinePara.innerText = `Deadline: ${deadline}`;
        toDoDiv.appendChild(deadlinePara);

        // Adding to local storage with checked status as false
        savelocal(toDoInput.value, deadline, false);

        // check btn;
        const checked = document.createElement('button');
        checked.innerHTML = '<i class="fas fa-check"></i>';
        checked.classList.add('check-btn', `${savedTheme}-button`);
        toDoDiv.appendChild(checked);
        // delete btn;
        const deleted = document.createElement('button');
        deleted.innerHTML = '<i class="fas fa-trash"></i>';
        deleted.classList.add('delete-btn', `${savedTheme}-button`);
        toDoDiv.appendChild(deleted);

        // Append to list;
        toDoList.appendChild(toDoDiv);

        // Clearing the input;
        toDoInput.value = '';
        deadlineInput.value = ''; // Clear deadline input after task is added
    }
}




function deletecheck(event) {
    const item = event.target;

    // delete
    if (item.classList.contains('delete-btn')) {
        // Animation
        item.parentElement.classList.add("fall");

        // Removing local todos;
        removeLocalTodos(item.parentElement);

        item.parentElement.addEventListener('transitionend', function() {
            item.parentElement.remove();
        })
    }

    // check
    if (item.classList.contains('check-btn')) {
        const todoDiv = item.parentElement;
        todoDiv.classList.toggle("completed");
        const todos = JSON.parse(localStorage.getItem('todos'));
        const todoIndex = todos.findIndex(todo => todo.todo === todoDiv.firstChild.innerText);
        todos[todoIndex].isChecked = !todos[todoIndex].isChecked;
        localStorage.setItem('todos', JSON.stringify(todos));
    }
}

function savelocal(todo, deadline, isChecked) {
    // Check if items are present in local storage
    let todos;
    if (localStorage.getItem('todos') === null) {
        todos = [];
    } else {
        todos = JSON.parse(localStorage.getItem('todos'));
    }

    // Store task, deadline, and checked status as an object
    todos.push({ todo: todo, deadline: deadline, isChecked: isChecked });
    localStorage.setItem('todos', JSON.stringify(todos));
}



function getTodos() {
    // Check if items are present in local storage
    let todos;
    if (localStorage.getItem('todos') === null) {
        todos = [];
    } else {
        todos = JSON.parse(localStorage.getItem('todos'));
    }

    todos.forEach(function (todoItem) {
        // Create todo div
        const toDoDiv = document.createElement("div");
        toDoDiv.classList.add("todo", `${savedTheme}-todo`);

        // Create li element for task text
        const newToDo = document.createElement('li');
        newToDo.innerText = todoItem.todo;
        newToDo.classList.add('todo-item');
        toDoDiv.appendChild(newToDo);

        // Create paragraph for displaying the deadline
        const deadlinePara = document.createElement('p');
        deadlinePara.innerText = `Deadline: ${todoItem.deadline}`;
        toDoDiv.appendChild(deadlinePara);

        // Create check button
        const checked = document.createElement('button');
        checked.innerHTML = '<i class="fas fa-check"></i>';
        checked.classList.add("check-btn", `${savedTheme}-button`);
        toDoDiv.appendChild(checked);

        // Create delete button
        const deleted = document.createElement('button');
        deleted.innerHTML = '<i class="fas fa-trash"></i>';
        deleted.classList.add("delete-btn", `${savedTheme}-button`);
        toDoDiv.appendChild(deleted);

        // Append todo div to todo list
        toDoList.appendChild(toDoDiv);

        // Set checked status based on stored data
        if (todoItem.isChecked) {
            toDoDiv.classList.add("completed");
        }
    });
}




function removeLocalTodos(todo) {
    let todos;
    if (localStorage.getItem('todos') === null) {
        todos = [];
    } else {
        todos = JSON.parse(localStorage.getItem('todos'));
    }

    const todoIndex = todos.findIndex(item => item.todo === todo.firstChild.innerText);
    todos.splice(todoIndex, 1);
    localStorage.setItem('todos', JSON.stringify(todos));
}

// Change theme function:
function changeTheme(color) {
    localStorage.setItem('savedTheme', color);
    savedTheme = localStorage.getItem('savedTheme');

    document.body.className = color;
    // Change blinking cursor for darker theme:
    color === 'darker' ? 
        document.getElementById('title').classList.add('darker-title')
        : document.getElementById('title').classList.remove('darker-title');

    document.querySelector('input').className = `${color}-input`;
    // Change todo color without changing their status (completed or not):
    document.querySelectorAll('.todo').forEach(todo => {
        Array.from(todo.classList).some(item => item === 'completed') ? 
            todo.className = `todo ${color}-todo completed`
            : todo.className = `todo ${color}-todo`;
    });
    // Change buttons color according to their type (todo, check or delete):
    document.querySelectorAll('button').forEach(button => {
        Array.from(button.classList).some(item => {
            if (item === 'check-btn') {
              button.className = `check-btn ${color}-button`;  
            } else if (item === 'delete-btn') {
                button.className = `delete-btn ${color}-button`; 
            } else if (item === 'todo-btn') {
                button.className = `todo-btn ${color}-button`;
            }
        });
    });
}
