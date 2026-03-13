import type { TimerState } from './types';
import { DEFAULT_TIMER_STATE } from './types';
import { getTimerState, setTimerState } from './storage';

const ALARM_NAME = 'notiion-timer';
const SNOOZE_ALARM_NAME = 'notiion-snooze';

// Start a new timer
export async function startTimer(
  durationMs: number,
  isRecurring: boolean,
  autoRestart: boolean
): Promise<TimerState> {
  // Clear any existing alarm
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.clear(SNOOZE_ALARM_NAME);

  const state: TimerState = {
    status: 'running',
    durationMs,
    startedAt: Date.now(),
    pausedAt: null,
    pausedElapsed: 0,
    isRecurring,
    autoRestart,
    snoozeDurationMs: 5 * 60 * 1000,
  };

  // Create alarm — delayInMinutes from now
  const delayInMinutes = durationMs / 60000;
  await chrome.alarms.create(ALARM_NAME, { delayInMinutes });

  await setTimerState(state);
  return state;
}

// Pause the running timer
export async function pauseTimer(): Promise<TimerState> {
  const state = await getTimerState();
  if (state.status !== 'running') return state;

  // Clear the alarm while paused
  await chrome.alarms.clear(ALARM_NAME);

  state.status = 'paused';
  state.pausedAt = Date.now();

  await setTimerState(state);
  return state;
}

// Resume a paused timer
export async function resumeTimer(): Promise<TimerState> {
  const state = await getTimerState();
  if (state.status !== 'paused' || state.pausedAt === null) return state;

  // Calculate how long we were paused
  const pauseDuration = Date.now() - state.pausedAt;
  state.pausedElapsed += pauseDuration;

  // Calculate remaining time
  const elapsed = Date.now() - state.startedAt - state.pausedElapsed;
  const remaining = Math.max(state.durationMs - elapsed, 0);

  if (remaining <= 0) {
    // Timer should have already fired
    state.status = 'idle';
    await setTimerState(state);
    return state;
  }

  // Re-create alarm with remaining time
  const delayInMinutes = remaining / 60000;
  await chrome.alarms.create(ALARM_NAME, { delayInMinutes });

  state.status = 'running';
  state.pausedAt = null;

  await setTimerState(state);
  return state;
}

// Stop and reset the timer
export async function stopTimer(): Promise<TimerState> {
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.clear(SNOOZE_ALARM_NAME);

  const state = { ...DEFAULT_TIMER_STATE };
  await setTimerState(state);
  return state;
}

// Create a snooze alarm
export async function snoozeTimer(snoozeDurationMs: number): Promise<void> {
  await chrome.alarms.clear(SNOOZE_ALARM_NAME);
  const delayInMinutes = snoozeDurationMs / 60000;
  await chrome.alarms.create(SNOOZE_ALARM_NAME, { delayInMinutes });
}

// Get remaining time in ms (returns 0 if not running)
export async function getRemainingMs(): Promise<number> {
  const state = await getTimerState();

  if (state.status === 'idle') return 0;

  if (state.status === 'paused' && state.pausedAt !== null) {
    const elapsed = state.pausedAt - state.startedAt - state.pausedElapsed;
    return Math.max(state.durationMs - elapsed, 0);
  }

  // Running
  const elapsed = Date.now() - state.startedAt - state.pausedElapsed;
  return Math.max(state.durationMs - elapsed, 0);
}

// Check if alarm name is one of ours
export function isTimerAlarm(alarmName: string): boolean {
  return alarmName === ALARM_NAME || alarmName === SNOOZE_ALARM_NAME;
}

// Re-register alarm on service worker startup if timer was running
export async function restoreTimerAlarm(): Promise<void> {
  const state = await getTimerState();
  if (state.status !== 'running') return;

  const elapsed = Date.now() - state.startedAt - state.pausedElapsed;
  const remaining = state.durationMs - elapsed;

  if (remaining <= 0) {
    // Timer should have already fired — fire immediately
    return;
  }

  // Check if alarm already exists
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) {
    const delayInMinutes = remaining / 60000;
    await chrome.alarms.create(ALARM_NAME, { delayInMinutes });
  }
}
