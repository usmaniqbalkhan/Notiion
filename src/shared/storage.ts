import {
  STORAGE_KEYS,
  DEFAULT_TIMER_STATE,
  DEFAULT_NOTION_SETTINGS,
  DEFAULT_TIMER_PREFERENCES,
  type TimerState,
  type NotionSettings,
  type TimerPreferences,
  type Draft,
  type LastSubmission,
} from './types';

// Generic get/set wrappers for chrome.storage.local

async function getItem<T>(key: string, defaultValue: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return result[key] !== undefined ? result[key] : defaultValue;
}

async function setItem<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

// Timer state
export async function getTimerState(): Promise<TimerState> {
  return getItem(STORAGE_KEYS.TIMER_STATE, { ...DEFAULT_TIMER_STATE });
}

export async function setTimerState(state: TimerState): Promise<void> {
  return setItem(STORAGE_KEYS.TIMER_STATE, state);
}

// Notion settings
export async function getNotionSettings(): Promise<NotionSettings> {
  return getItem(STORAGE_KEYS.NOTION_SETTINGS, { ...DEFAULT_NOTION_SETTINGS });
}

export async function setNotionSettings(settings: NotionSettings): Promise<void> {
  return setItem(STORAGE_KEYS.NOTION_SETTINGS, settings);
}

// Timer preferences
export async function getTimerPreferences(): Promise<TimerPreferences> {
  return getItem(STORAGE_KEYS.TIMER_PREFERENCES, { ...DEFAULT_TIMER_PREFERENCES });
}

export async function setTimerPreferences(prefs: TimerPreferences): Promise<void> {
  return setItem(STORAGE_KEYS.TIMER_PREFERENCES, prefs);
}

// Drafts
export async function getDrafts(): Promise<Draft[]> {
  return getItem(STORAGE_KEYS.DRAFTS, []);
}

export async function saveDraft(draft: Draft): Promise<void> {
  const drafts = await getDrafts();
  drafts.push(draft);
  return setItem(STORAGE_KEYS.DRAFTS, drafts);
}

export async function removeDraft(id: string): Promise<void> {
  const drafts = await getDrafts();
  const filtered = drafts.filter(d => d.id !== id);
  return setItem(STORAGE_KEYS.DRAFTS, filtered);
}

export async function clearDrafts(): Promise<void> {
  return setItem(STORAGE_KEYS.DRAFTS, []);
}

// Last submission
export async function getLastSubmission(): Promise<LastSubmission | null> {
  return getItem<LastSubmission | null>(STORAGE_KEYS.LAST_SUBMISSION, null);
}

export async function setLastSubmission(submission: LastSubmission): Promise<void> {
  return setItem(STORAGE_KEYS.LAST_SUBMISSION, submission);
}
