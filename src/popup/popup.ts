import { MessageType, sendMessage } from '../shared/messages';
import { getTimerState, getDrafts } from '../shared/storage';
import { getRemainingMs } from '../shared/timer';
import type { TimerState } from '../shared/types';

// DOM elements
const timerTime = document.getElementById('timerTime')!;
const timerStatus = document.getElementById('timerStatus')!;
const durationSection = document.getElementById('durationSection')!;
const optionsRow = document.getElementById('optionsRow')!;
const startBtn = document.getElementById('startBtn')!;
const pauseBtn = document.getElementById('pauseBtn')!;
const resumeBtn = document.getElementById('resumeBtn')!;
const stopBtn = document.getElementById('stopBtn')!;
const customMinutes = document.getElementById('customMinutes') as HTMLInputElement;
const recurringToggle = document.getElementById('recurringToggle') as HTMLInputElement;
const autoRestartToggle = document.getElementById('autoRestartToggle') as HTMLInputElement;
const settingsLink = document.getElementById('settingsLink')!;
const draftBadge = document.getElementById('draftBadge')!;
const draftCount = document.getElementById('draftCount')!;

let selectedMinutes = 30;
let countdownInterval: ReturnType<typeof setInterval> | null = null;

// Format ms to MM:SS
function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Update UI based on timer state
function updateUI(state: TimerState, remainingMs: number) {
  timerTime.textContent = state.status === 'idle'
    ? formatTime(selectedMinutes * 60 * 1000)
    : formatTime(remainingMs);

  // Status text
  timerStatus.textContent = state.status === 'idle' ? 'Ready'
    : state.status === 'running' ? 'Running'
    : 'Paused';
  timerStatus.className = `timer-status ${state.status}`;

  // Show/hide controls
  const isIdle = state.status === 'idle';
  durationSection.classList.toggle('hidden', !isIdle);
  optionsRow.classList.toggle('hidden', !isIdle);

  startBtn.classList.toggle('hidden', !isIdle);
  pauseBtn.classList.toggle('hidden', state.status !== 'running');
  resumeBtn.classList.toggle('hidden', state.status !== 'paused');
  stopBtn.classList.toggle('hidden', isIdle);
}

// Start live countdown
function startCountdown() {
  stopCountdown();
  countdownInterval = setInterval(async () => {
    const remaining = await getRemainingMs();
    const state = await getTimerState();
    if (state.status === 'idle') {
      stopCountdown();
    }
    updateUI(state, remaining);
  }, 500);
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

// Preset buttons
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMinutes = Number((btn as HTMLElement).dataset.minutes);
    customMinutes.value = '';
    timerTime.textContent = formatTime(selectedMinutes * 60 * 1000);
  });
});

// Custom minutes input
customMinutes.addEventListener('input', () => {
  const val = Number(customMinutes.value);
  if (val > 0) {
    selectedMinutes = val;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    timerTime.textContent = formatTime(selectedMinutes * 60 * 1000);
  }
});

// Start button
startBtn.addEventListener('click', async () => {
  const durationMs = selectedMinutes * 60 * 1000;
  await sendMessage({
    type: MessageType.START_TIMER,
    durationMs,
    isRecurring: recurringToggle.checked,
    autoRestart: autoRestartToggle.checked,
  });
  const state = await getTimerState();
  const remaining = await getRemainingMs();
  updateUI(state, remaining);
  startCountdown();
});

// Pause button
pauseBtn.addEventListener('click', async () => {
  await sendMessage({ type: MessageType.PAUSE_TIMER });
  const state = await getTimerState();
  const remaining = await getRemainingMs();
  updateUI(state, remaining);
  stopCountdown();
});

// Resume button
resumeBtn.addEventListener('click', async () => {
  await sendMessage({ type: MessageType.RESUME_TIMER });
  const state = await getTimerState();
  const remaining = await getRemainingMs();
  updateUI(state, remaining);
  startCountdown();
});

// Stop button
stopBtn.addEventListener('click', async () => {
  await sendMessage({ type: MessageType.STOP_TIMER });
  const state = await getTimerState();
  updateUI(state, 0);
  stopCountdown();
});

// Settings link
settingsLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// Initialize popup state
async function init() {
  const state = await getTimerState();
  const remaining = await getRemainingMs();

  if (state.status !== 'idle') {
    selectedMinutes = state.durationMs / 60000;
    recurringToggle.checked = state.isRecurring;
    autoRestartToggle.checked = state.autoRestart;
  }

  updateUI(state, remaining);

  if (state.status === 'running') {
    startCountdown();
  }

  // Show draft count
  const drafts = await getDrafts();
  if (drafts.length > 0) {
    draftCount.textContent = String(drafts.length);
    draftBadge.classList.remove('hidden');
  }
}

init();
