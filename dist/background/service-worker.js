"use strict";
(() => {
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
  var DEFAULT_NOTION_SETTINGS = {
    token: "",
    databaseId: "",
    fieldMappings: {},
    dbProperties: []
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
    DRAFTS: "drafts"
  };

  // src/shared/storage.ts
  async function getItem(key, defaultValue) {
    const result = await chrome.storage.local.get(key);
    return result[key] !== void 0 ? result[key] : defaultValue;
  }
  async function setItem(key, value) {
    await chrome.storage.local.set({ [key]: value });
  }
  async function getTimerState() {
    return getItem(STORAGE_KEYS.TIMER_STATE, { ...DEFAULT_TIMER_STATE });
  }
  async function setTimerState(state) {
    return setItem(STORAGE_KEYS.TIMER_STATE, state);
  }
  async function getNotionSettings() {
    return getItem(STORAGE_KEYS.NOTION_SETTINGS, { ...DEFAULT_NOTION_SETTINGS });
  }
  async function getDrafts() {
    return getItem(STORAGE_KEYS.DRAFTS, []);
  }
  async function saveDraft(draft) {
    const drafts = await getDrafts();
    drafts.push(draft);
    return setItem(STORAGE_KEYS.DRAFTS, drafts);
  }

  // src/shared/timer.ts
  var ALARM_NAME = "notiion-timer";
  var SNOOZE_ALARM_NAME = "notiion-snooze";
  async function startTimer(durationMs, isRecurring, autoRestart) {
    await chrome.alarms.clear(ALARM_NAME);
    await chrome.alarms.clear(SNOOZE_ALARM_NAME);
    const state = {
      status: "running",
      durationMs,
      startedAt: Date.now(),
      pausedAt: null,
      pausedElapsed: 0,
      isRecurring,
      autoRestart,
      snoozeDurationMs: 5 * 60 * 1e3
    };
    const delayInMinutes = durationMs / 6e4;
    await chrome.alarms.create(ALARM_NAME, { delayInMinutes });
    await setTimerState(state);
    return state;
  }
  async function pauseTimer() {
    const state = await getTimerState();
    if (state.status !== "running") return state;
    await chrome.alarms.clear(ALARM_NAME);
    state.status = "paused";
    state.pausedAt = Date.now();
    await setTimerState(state);
    return state;
  }
  async function resumeTimer() {
    const state = await getTimerState();
    if (state.status !== "paused" || state.pausedAt === null) return state;
    const pauseDuration = Date.now() - state.pausedAt;
    state.pausedElapsed += pauseDuration;
    const elapsed = Date.now() - state.startedAt - state.pausedElapsed;
    const remaining = Math.max(state.durationMs - elapsed, 0);
    if (remaining <= 0) {
      state.status = "idle";
      await setTimerState(state);
      return state;
    }
    const delayInMinutes = remaining / 6e4;
    await chrome.alarms.create(ALARM_NAME, { delayInMinutes });
    state.status = "running";
    state.pausedAt = null;
    await setTimerState(state);
    return state;
  }
  async function stopTimer() {
    await chrome.alarms.clear(ALARM_NAME);
    await chrome.alarms.clear(SNOOZE_ALARM_NAME);
    const state = { ...DEFAULT_TIMER_STATE };
    await setTimerState(state);
    return state;
  }
  async function snoozeTimer(snoozeDurationMs) {
    await chrome.alarms.clear(SNOOZE_ALARM_NAME);
    const delayInMinutes = snoozeDurationMs / 6e4;
    await chrome.alarms.create(SNOOZE_ALARM_NAME, { delayInMinutes });
  }
  function isTimerAlarm(alarmName) {
    return alarmName === ALARM_NAME || alarmName === SNOOZE_ALARM_NAME;
  }
  async function restoreTimerAlarm() {
    const state = await getTimerState();
    if (state.status !== "running") return;
    const elapsed = Date.now() - state.startedAt - state.pausedElapsed;
    const remaining = state.durationMs - elapsed;
    if (remaining <= 0) {
      return;
    }
    const existing = await chrome.alarms.get(ALARM_NAME);
    if (!existing) {
      const delayInMinutes = remaining / 6e4;
      await chrome.alarms.create(ALARM_NAME, { delayInMinutes });
    }
  }

  // src/shared/field-mapping.ts
  function mapDynamicFormToNotion(formData, dbProperties) {
    const properties = {};
    for (const prop of dbProperties) {
      const value = formData[prop.name];
      if (value === void 0 || value === "" || value === null) continue;
      switch (prop.type) {
        case "title":
          properties[prop.name] = {
            title: [{ text: { content: String(value) } }]
          };
          break;
        case "rich_text":
          properties[prop.name] = {
            rich_text: [{ text: { content: String(value) } }]
          };
          break;
        case "date":
          if (String(value).trim()) {
            properties[prop.name] = {
              date: { start: new Date(String(value)).toISOString() }
            };
          }
          break;
        case "number":
          properties[prop.name] = {
            number: Number(value) || 0
          };
          break;
        case "select":
          properties[prop.name] = {
            select: { name: String(value) }
          };
          break;
        case "multi_select": {
          const tags = Array.isArray(value) ? value : String(value).split(",").map((s) => s.trim()).filter(Boolean);
          if (tags.length > 0) {
            properties[prop.name] = {
              multi_select: tags.map((tag) => ({ name: tag }))
            };
          }
          break;
        }
        case "checkbox":
          properties[prop.name] = {
            checkbox: value === true || value === "true" || value === "1"
          };
          break;
        case "url":
          properties[prop.name] = { url: String(value) };
          break;
        case "email":
          properties[prop.name] = { email: String(value) };
          break;
        case "phone_number":
          properties[prop.name] = { phone_number: String(value) };
          break;
        default:
          if (String(value).trim()) {
            properties[prop.name] = {
              rich_text: [{ text: { content: String(value) } }]
            };
          }
          break;
      }
    }
    return properties;
  }

  // src/shared/notion-api.ts
  var NOTION_API_BASE = "https://api.notion.com/v1";
  var NOTION_VERSION = "2022-06-28";
  function parseDatabaseId(input) {
    const trimmed = input.trim();
    if (trimmed.startsWith("http")) {
      try {
        const url = new URL(trimmed);
        const pathParts = url.pathname.split("/").filter(Boolean);
        const lastPart = pathParts[pathParts.length - 1] || "";
        return lastPart.replace(/-/g, "");
      } catch {
      }
    }
    return trimmed.replace(/-/g, "");
  }
  function getHeaders(token) {
    return {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json"
    };
  }
  async function createCheckInPage(settings, formData) {
    try {
      const properties = mapDynamicFormToNotion(formData, settings.dbProperties);
      const id = parseDatabaseId(settings.databaseId);
      const body = {
        parent: { database_id: id },
        properties
      };
      const resp = await fetch(`${NOTION_API_BASE}/pages`, {
        method: "POST",
        headers: getHeaders(settings.token),
        body: JSON.stringify(body)
      });
      if (!resp.ok) {
        const errorBody = await resp.json().catch(() => ({}));
        return {
          success: false,
          error: `Notion API error ${resp.status}: ${errorBody.message || resp.statusText}`
        };
      }
      const data = await resp.json();
      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: `Submission failed: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }

  // src/background/service-worker.ts
  restoreTimerAlarm();
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (!isTimerAlarm(alarm.name)) return;
    const state = await getTimerState();
    const wasRecurring = state.isRecurring;
    const wasAutoRestart = state.autoRestart;
    const durationMs = state.durationMs;
    await setTimerState({ ...DEFAULT_TIMER_STATE });
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && tab.url && !isRestrictedUrl(tab.url)) {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ["content/modal.css"]
        });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content/modal.js"]
        });
      } else {
        openFallbackWindow();
      }
    } catch (err) {
      console.warn("Content script injection failed, opening fallback window:", err);
      openFallbackWindow();
    }
    if (wasAutoRestart && wasRecurring) {
      await startTimer(durationMs, wasRecurring, wasAutoRestart);
    }
  });
  function isRestrictedUrl(url) {
    return url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("about:") || url.startsWith("edge://") || url.startsWith("brave://") || url.startsWith("chrome-search://") || url === "";
  }
  function openFallbackWindow() {
    chrome.windows.create({
      url: chrome.runtime.getURL("fallback/reminder.html"),
      type: "popup",
      width: 700,
      height: 800,
      focused: true
    });
  }
  chrome.runtime.onMessage.addListener(
    (message, _sender, sendResponse) => {
      handleMessage(message).then(sendResponse);
      return true;
    }
  );
  async function handleMessage(message) {
    try {
      switch (message.type) {
        case "START_TIMER" /* START_TIMER */: {
          const state = await startTimer(
            message.durationMs,
            message.isRecurring,
            message.autoRestart
          );
          return { success: true, data: state };
        }
        case "PAUSE_TIMER" /* PAUSE_TIMER */: {
          const state = await pauseTimer();
          return { success: true, data: state };
        }
        case "RESUME_TIMER" /* RESUME_TIMER */: {
          const state = await resumeTimer();
          return { success: true, data: state };
        }
        case "STOP_TIMER" /* STOP_TIMER */: {
          const state = await stopTimer();
          return { success: true, data: state };
        }
        case "GET_TIMER_STATE" /* GET_TIMER_STATE */: {
          const state = await getTimerState();
          return { success: true, data: state };
        }
        case "SUBMIT_CHECKIN" /* SUBMIT_CHECKIN */: {
          const settings = await getNotionSettings();
          if (!settings.token || !settings.databaseId) {
            const draft = {
              id: crypto.randomUUID(),
              formData: message.formData,
              createdAt: Date.now(),
              error: "Notion not configured"
            };
            await saveDraft(draft);
            return { success: false, error: "Notion integration not configured. Saved as draft." };
          }
          const result = await createCheckInPage(settings, message.formData);
          if (!result.success) {
            const draft = {
              id: crypto.randomUUID(),
              formData: message.formData,
              createdAt: Date.now(),
              error: result.error
            };
            await saveDraft(draft);
            return { success: false, error: `${result.error} \u2014 Saved as draft.` };
          }
          const state = await getTimerState();
          if (state.status === "idle") {
            const currentState = await getTimerState();
            if (currentState.isRecurring && !currentState.autoRestart) {
              await startTimer(
                currentState.durationMs || 30 * 60 * 1e3,
                true,
                false
              );
            }
          }
          return { success: true };
        }
        case "SNOOZE" /* SNOOZE */: {
          const state = await getTimerState();
          await snoozeTimer(state.snoozeDurationMs || 5 * 60 * 1e3);
          return { success: true };
        }
        case "SKIP" /* SKIP */: {
          const currentState = await getTimerState();
          if (currentState.isRecurring) {
            await startTimer(
              currentState.durationMs || 30 * 60 * 1e3,
              currentState.isRecurring,
              currentState.autoRestart
            );
          }
          return { success: true };
        }
        case "SAVE_DRAFT" /* SAVE_DRAFT */: {
          const draft = {
            id: crypto.randomUUID(),
            formData: message.formData,
            createdAt: Date.now()
          };
          await saveDraft(draft);
          return { success: true };
        }
        default:
          return { success: false, error: "Unknown message type" };
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }
})();
