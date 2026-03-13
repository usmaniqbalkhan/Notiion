import { MessageType, type ExtensionMessage, type MessageResponse } from '../shared/messages';
import {
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  snoozeTimer,
  isTimerAlarm,
  restoreTimerAlarm,
} from '../shared/timer';
import { getTimerState, setTimerState, getNotionSettings, saveDraft } from '../shared/storage';
import { createCheckInPage } from '../shared/notion-api';
import { DEFAULT_TIMER_STATE, type Draft } from '../shared/types';

// Restore timer alarm on service worker startup
restoreTimerAlarm();

// Handle alarm firing
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!isTimerAlarm(alarm.name)) return;

  // Mark timer as idle
  const state = await getTimerState();
  const wasRecurring = state.isRecurring;
  const wasAutoRestart = state.autoRestart;
  const durationMs = state.durationMs;

  await setTimerState({ ...DEFAULT_TIMER_STATE });

  // Try to inject content script into active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab?.id && tab.url && !isRestrictedUrl(tab.url)) {
      // Inject CSS first, then the content script
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content/modal.css'],
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/modal.js'],
      });
    } else {
      // Fallback: open reminder window
      openFallbackWindow();
    }
  } catch (err) {
    console.warn('Content script injection failed, opening fallback window:', err);
    openFallbackWindow();
  }

  // If auto-restart is on, restart the timer immediately
  if (wasAutoRestart && wasRecurring) {
    await startTimer(durationMs, wasRecurring, wasAutoRestart);
  }
});

// URLs where content scripts cannot be injected
function isRestrictedUrl(url: string): boolean {
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('about:') ||
    url.startsWith('edge://') ||
    url.startsWith('brave://') ||
    url.startsWith('chrome-search://') ||
    url === ''
  );
}

// Open the fallback reminder window
function openFallbackWindow() {
  chrome.windows.create({
    url: chrome.runtime.getURL('fallback/reminder.html'),
    type: 'popup',
    width: 700,
    height: 800,
    focused: true,
  });
}

// Handle messages from popup, content script, and fallback window
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse: (response: MessageResponse) => void) => {
    handleMessage(message).then(sendResponse);
    return true; // Keep the message channel open for async response
  }
);

async function handleMessage(message: ExtensionMessage): Promise<MessageResponse> {
  try {
    switch (message.type) {
      case MessageType.START_TIMER: {
        const state = await startTimer(
          message.durationMs,
          message.isRecurring,
          message.autoRestart
        );
        return { success: true, data: state };
      }

      case MessageType.PAUSE_TIMER: {
        const state = await pauseTimer();
        return { success: true, data: state };
      }

      case MessageType.RESUME_TIMER: {
        const state = await resumeTimer();
        return { success: true, data: state };
      }

      case MessageType.STOP_TIMER: {
        const state = await stopTimer();
        return { success: true, data: state };
      }

      case MessageType.GET_TIMER_STATE: {
        const state = await getTimerState();
        return { success: true, data: state };
      }

      case MessageType.SUBMIT_CHECKIN: {
        const settings = await getNotionSettings();
        if (!settings.token || !settings.databaseId) {
          // Save as draft if not configured
          const draft: Draft = {
            id: crypto.randomUUID(),
            formData: message.formData,
            createdAt: Date.now(),
            error: 'Notion not configured',
          };
          await saveDraft(draft);
          return { success: false, error: 'Notion integration not configured. Saved as draft.' };
        }

        const result = await createCheckInPage(settings, message.formData);

        if (!result.success) {
          // Save as draft on failure
          const draft: Draft = {
            id: crypto.randomUUID(),
            formData: message.formData,
            createdAt: Date.now(),
            error: result.error,
          };
          await saveDraft(draft);
          return { success: false, error: `${result.error} — Saved as draft.` };
        }

        // If recurring mode (non-auto), restart timer after successful submission
        const state = await getTimerState();
        if (state.status === 'idle') {
          const currentState = await getTimerState();
          if (currentState.isRecurring && !currentState.autoRestart) {
            await startTimer(
              currentState.durationMs || 30 * 60 * 1000,
              true,
              false
            );
          }
        }

        return { success: true };
      }

      case MessageType.SNOOZE: {
        const state = await getTimerState();
        await snoozeTimer(state.snoozeDurationMs || 5 * 60 * 1000);
        return { success: true };
      }

      case MessageType.SKIP: {
        // If recurring, restart timer
        const currentState = await getTimerState();
        if (currentState.isRecurring) {
          await startTimer(
            currentState.durationMs || 30 * 60 * 1000,
            currentState.isRecurring,
            currentState.autoRestart
          );
        }
        return { success: true };
      }

      case MessageType.SAVE_DRAFT: {
        const draft: Draft = {
          id: crypto.randomUUID(),
          formData: message.formData,
          createdAt: Date.now(),
        };
        await saveDraft(draft);
        return { success: true };
      }

      default:
        return { success: false, error: 'Unknown message type' };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
