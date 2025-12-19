// --- State ---
let isWorking = false;
let isBreaking = false;
let startTime = null;
let timerInterval = null;
let records = [];

// --- Config ---
const STORAGE_KEY = 'flowtime_data';

// --- DOM Elements ---
const dom = {
    timerDisplay: document.getElementById('timerDisplay'),
    timerLabel: document.getElementById('timerLabel'),
    actionBtn: document.getElementById('actionBtn'),
    taskInput: document.getElementById('taskInput'),
    historyList: document.getElementById('historyList'),
    emptyState: document.getElementById('emptyState'),
    appStatus: document.getElementById('appStatus'),

    // Modals
    breakModal: document.getElementById('breakModal'),
    modalWorkTime: document.getElementById('modalWorkTime'),
    breakInput: document.getElementById('breakInput'),
    startBreakBtn: document.getElementById('startBreakBtn'),
    presetChips: document.querySelectorAll('.chip'),

    // Alarm
    alarmOverlay: document.getElementById('alarmOverlay'),
    stopAlarmBtn: document.getElementById('stopAlarmBtn'),
    audio: document.getElementById('notificationSound'),

    // Utility
    clearBtn: document.getElementById('clearBtn')
};

// --- Initialization ---
function init() {
    loadRecords();
    renderHistory();

    // Event Listeners
    dom.actionBtn.addEventListener('click', toggleWork);
    dom.startBreakBtn.addEventListener('click', startBreak);
    dom.stopAlarmBtn.addEventListener('click', stopAlarm);
    dom.clearBtn.addEventListener('click', clearHistory);

    // Preset chips
    dom.presetChips.forEach(chip => {
        chip.addEventListener('click', () => {
            dom.breakInput.value = chip.dataset.min;
        });
    });

    // Check for "Enter" on input
    dom.taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') toggleWork();
    });
}

// --- Core Logic ---

function stopAllTimers() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function toggleWork() {
    // If break is active, "Skip Break" button was clicked
    if (isBreaking) {
        stopAllTimers();
        isBreaking = false;

        // Reset UI to Ready state
        dom.actionBtn.textContent = "Start Focus";
        dom.actionBtn.classList.remove('btn-danger');
        dom.actionBtn.classList.remove('btn-secondary');
        dom.actionBtn.classList.add('btn-primary');
        dom.timerLabel.textContent = "Focus Time";
        dom.appStatus.textContent = "Ready to Focus";
        dom.timerDisplay.textContent = "00:00:00";
        document.body.classList.remove('break-mode');
        document.title = "Flowtime Focus";

        return; // Stop here, don't auto-start work
    }

    stopAllTimers();

    if (!isWorking) {
        // --- START WORK ---

        // Validation
        const taskName = dom.taskInput.value.trim();
        if (!taskName) {
            alert("Please enter a task name first!");
            dom.taskInput.focus();
            return;
        }

        // Updates Previous Break Time if applicable
        if (records.length > 0) {
            const lastRecord = records[records.length - 1];
            if (!lastRecord.breakTime && lastRecord.endTime) {
                // Calculate gap
                const lastEnd = new Date(lastRecord.endTime);
                const now = new Date();
                const gapSeconds = Math.floor((now - lastEnd) / 1000);
                // Only count positive gaps
                lastRecord.breakTime = formatTime(gapSeconds > 0 ? gapSeconds : 0);
                saveRecords();
            }
        }

        // State Update
        isWorking = true;
        startTime = new Date();

        // UI Updates
        dom.taskInput.disabled = true;
        dom.actionBtn.textContent = "Stop & Break";
        dom.actionBtn.classList.add('btn-danger');
        dom.actionBtn.classList.remove('btn-primary');
        dom.appStatus.textContent = "Focusing...";
        dom.timerLabel.textContent = "Focus Time";
        document.body.classList.remove('break-mode');
        document.body.classList.add('working-mode');

        // Loop
        updateTimer(); // run once immediately
        timerInterval = setInterval(updateTimer, 1000);

    } else {
        // --- STOP WORK ---
        isWorking = false;
        // timerInterval already stopped at top of function

        const endTime = new Date();
        // Prevent negative duration if system time changes or glitch
        let durationSeconds = Math.floor((endTime - startTime) / 1000);
        if (durationSeconds < 0) durationSeconds = 0;

        // Save Record
        const newRecord = {
            task: dom.taskInput.value.trim(),
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration: formatTime(durationSeconds),
            breakTime: null
        };

        records.push(newRecord);
        saveRecords();
        renderHistory();

        // UI Reset
        dom.taskInput.disabled = false;
        // dom.taskInput.value = ''; // REMOVED: Keep task name for next session
        dom.actionBtn.textContent = "Start Focus";
        dom.actionBtn.classList.remove('btn-danger');
        dom.actionBtn.classList.add('btn-primary');
        dom.appStatus.textContent = "Session Complete";
        dom.timerDisplay.textContent = "00:00:00";
        document.body.classList.remove('working-mode');

        // Show Break Modal
        dom.modalWorkTime.textContent = formatTime(durationSeconds);
        dom.breakModal.classList.remove('hidden');
    }
}

function updateTimer() {
    if (isWorking) {
        const now = new Date();
        let diff = Math.floor((now - startTime) / 1000);
        if (diff < 0) diff = 0; // Safety

        dom.timerDisplay.textContent = formatTime(diff);
        document.title = `(${formatTime(diff)}) Flowtime`;
    }
}

// --- Break Logic ---

function startBreak() {
    let mins = parseInt(dom.breakInput.value);
    if (!mins || mins <= 0) mins = 5; // Default safety

    // Hide Modal
    dom.breakModal.classList.add('hidden');

    stopAllTimers();

    isBreaking = true;
    isWorking = false; // Safety

    let secondsLeft = mins * 60;

    dom.timerLabel.textContent = "Break Time";
    dom.appStatus.textContent = "Recharging...";

    // Update Button to "Skip Break"
    dom.actionBtn.textContent = "Skip Break";
    dom.actionBtn.classList.remove('btn-primary');
    dom.actionBtn.classList.add('btn-secondary'); // Use secondary style for skip

    document.body.classList.remove('working-mode');
    document.body.classList.add('break-mode');

    // Initial display
    dom.timerDisplay.textContent = formatTime(secondsLeft);

    timerInterval = setInterval(() => {
        secondsLeft--;

        // Check for finish
        if (secondsLeft <= 0) {
            dom.timerDisplay.textContent = "00:00:00";
            triggerAlarm(); // This clears interval
            return;
        }

        dom.timerDisplay.textContent = formatTime(secondsLeft);
        document.title = `(${formatTime(secondsLeft)}) Break`;

    }, 1000);
}

function triggerAlarm() {
    stopAllTimers();
    isBreaking = false;

    dom.alarmOverlay.classList.remove('hidden');
    dom.audio.loop = true;

    // User interaction promise handling
    const playPromise = dom.audio.play();
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.log("Auto-play was prevented. Interaction needed.");
        });
    }
}

function stopAlarm() {
    dom.audio.pause();
    dom.audio.currentTime = 0;
    dom.alarmOverlay.classList.add('hidden');

    // Reset Main UI
    dom.timerDisplay.textContent = "00:00:00";
    dom.timerLabel.textContent = "Focus Time";
    dom.appStatus.textContent = "Ready to Focus";
    document.body.classList.remove('break-mode');
    document.title = "Flowtime Focus";
}

// --- Helpers ---

function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    const pad = (num) => num.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatTimeShort(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// --- Persistence ---

function saveRecords() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function loadRecords() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        records = JSON.parse(data);
    }
}

function renderHistory() {
    dom.historyList.innerHTML = '';

    if (records.length === 0) {
        dom.emptyState.style.display = 'block';
        return;
    }

    dom.emptyState.style.display = 'none';

    // Show newest first
    const reversed = [...records].reverse();

    reversed.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.task}</td>
            <td style="color:${dom.textSecondary}">${formatTimeShort(r.startTime)} - ${formatTimeShort(r.endTime)}</td>
            <td>${r.duration}</td>
            <td>${r.breakTime || '-'}</td>
        `;
        dom.historyList.appendChild(tr);
    });
}

function clearHistory() {
    if (confirm("Clear all history?")) {
        records = [];
        saveRecords();
        renderHistory();
    }
}

// Start
init();
