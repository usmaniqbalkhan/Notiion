"use strict";
(() => {
  // src/shared/messages.ts
  function sendMessage(message) {
    return chrome.runtime.sendMessage(message);
  }

  // src/shared/types.ts
  var DEFAULT_TIMER_STATE = {
    status: "idle",
    durationMs: 30 * 60 * 1e3,
    startedAt: 0,
    pausedAt: null,
    pausedElapsed: 0,
    isRecurring: false,
    autoRestart: false,
    snoozeDurationMs: 5 * 60 * 1e3
  };
  var DEFAULT_TIMER_PREFERENCES = {
    defaultDurationMs: 30 * 60 * 1e3,
    isRecurring: false,
    autoRestart: false,
    snoozeDurationMs: 5 * 60 * 1e3
  };
  var STORAGE_KEYS = {
    TIMER_STATE: "timerState",
    NOTION_SETTINGS: "notionSettings",
    TIMER_PREFERENCES: "timerPreferences",
    DRAFTS: "drafts",
    LAST_SUBMISSION: "lastSubmission"
  };

  // src/shared/storage.ts
  async function getItem(key, defaultValue) {
    const result = await chrome.storage.local.get(key);
    return result[key] !== void 0 ? result[key] : defaultValue;
  }
  async function getTimerState() {
    return getItem(STORAGE_KEYS.TIMER_STATE, { ...DEFAULT_TIMER_STATE });
  }
  async function getDrafts() {
    return getItem(STORAGE_KEYS.DRAFTS, []);
  }

  // src/shared/timer.ts
  async function getRemainingMs() {
    const state = await getTimerState();
    if (state.status === "idle") return 0;
    if (state.status === "paused" && state.pausedAt !== null) {
      const elapsed2 = state.pausedAt - state.startedAt - state.pausedElapsed;
      return Math.max(state.durationMs - elapsed2, 0);
    }
    const elapsed = Date.now() - state.startedAt - state.pausedElapsed;
    return Math.max(state.durationMs - elapsed, 0);
  }

  // src/popup/popup.ts
  var timerTime = document.getElementById("timerTime");
  var timerStatus = document.getElementById("timerStatus");
  var durationSection = document.getElementById("durationSection");
  var optionsRow = document.getElementById("optionsRow");
  var startBtn = document.getElementById("startBtn");
  var pauseBtn = document.getElementById("pauseBtn");
  var resumeBtn = document.getElementById("resumeBtn");
  var stopBtn = document.getElementById("stopBtn");
  var customMinutes = document.getElementById("customMinutes");
  var recurringToggle = document.getElementById("recurringToggle");
  var autoRestartToggle = document.getElementById("autoRestartToggle");
  var settingsLink = document.getElementById("settingsLink");
  var draftBadge = document.getElementById("draftBadge");
  var draftCount = document.getElementById("draftCount");
  var selectedMinutes = 30;
  var countdownInterval = null;
  function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1e3));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  function updateUI(state, remainingMs) {
    timerTime.textContent = state.status === "idle" ? formatTime(selectedMinutes * 60 * 1e3) : formatTime(remainingMs);
    timerStatus.textContent = state.status === "idle" ? "Ready" : state.status === "running" ? "Running" : "Paused";
    timerStatus.className = `timer-status ${state.status}`;
    const isIdle = state.status === "idle";
    durationSection.classList.toggle("hidden", !isIdle);
    optionsRow.classList.toggle("hidden", !isIdle);
    startBtn.classList.toggle("hidden", !isIdle);
    pauseBtn.classList.toggle("hidden", state.status !== "running");
    resumeBtn.classList.toggle("hidden", state.status !== "paused");
    stopBtn.classList.toggle("hidden", isIdle);
  }
  function startCountdown() {
    stopCountdown();
    countdownInterval = setInterval(async () => {
      const remaining = await getRemainingMs();
      const state = await getTimerState();
      if (state.status === "idle") {
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
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedMinutes = Number(btn.dataset.minutes);
      customMinutes.value = "";
      timerTime.textContent = formatTime(selectedMinutes * 60 * 1e3);
    });
  });
  customMinutes.addEventListener("input", () => {
    const val = Number(customMinutes.value);
    if (val > 0) {
      selectedMinutes = val;
      document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
      timerTime.textContent = formatTime(selectedMinutes * 60 * 1e3);
    }
  });
  startBtn.addEventListener("click", async () => {
    const durationMs = selectedMinutes * 60 * 1e3;
    await sendMessage({
      type: "START_TIMER" /* START_TIMER */,
      durationMs,
      isRecurring: recurringToggle.checked,
      autoRestart: autoRestartToggle.checked
    });
    const state = await getTimerState();
    const remaining = await getRemainingMs();
    updateUI(state, remaining);
    startCountdown();
  });
  pauseBtn.addEventListener("click", async () => {
    await sendMessage({ type: "PAUSE_TIMER" /* PAUSE_TIMER */ });
    const state = await getTimerState();
    const remaining = await getRemainingMs();
    updateUI(state, remaining);
    stopCountdown();
  });
  resumeBtn.addEventListener("click", async () => {
    await sendMessage({ type: "RESUME_TIMER" /* RESUME_TIMER */ });
    const state = await getTimerState();
    const remaining = await getRemainingMs();
    updateUI(state, remaining);
    startCountdown();
  });
  stopBtn.addEventListener("click", async () => {
    await sendMessage({ type: "STOP_TIMER" /* STOP_TIMER */ });
    const state = await getTimerState();
    updateUI(state, 0);
    stopCountdown();
  });
  settingsLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  async function init() {
    const state = await getTimerState();
    const remaining = await getRemainingMs();
    if (state.status !== "idle") {
      selectedMinutes = state.durationMs / 6e4;
      recurringToggle.checked = state.isRecurring;
      autoRestartToggle.checked = state.autoRestart;
    }
    updateUI(state, remaining);
    if (state.status === "running") {
      startCountdown();
    }
    const drafts = await getDrafts();
    if (drafts.length > 0) {
      draftCount.textContent = String(drafts.length);
      draftBadge.classList.remove("hidden");
    }
  }
  init();
})();
