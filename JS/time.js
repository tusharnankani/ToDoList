function updateClock() {
    const clock = document.getElementById("datetime");
    if (clock) {
        clock.textContent = new Date().toLocaleString();
    }
}

updateClock();
setInterval(updateClock, 1000);
