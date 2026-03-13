// Timer state persisted in chrome.storage.local
export interface TimerState {
  status: 'idle' | 'running' | 'paused';
  durationMs: number;       // Total timer duration in ms
  startedAt: number;        // Date.now() when timer was started
  pausedAt: number | null;  // Date.now() when paused (null if not paused)
  pausedElapsed: number;    // Total ms spent paused (accumulated across multiple pauses)
  isRecurring: boolean;     // Auto-restart after submission/skip
  autoRestart: boolean;     // Restart without user action
  snoozeDurationMs: number; // Snooze duration in ms
}

export const DEFAULT_TIMER_STATE: TimerState = {
  status: 'idle',
  durationMs: 30 * 60 * 1000,
  startedAt: 0,
  pausedAt: null,
  pausedElapsed: 0,
  isRecurring: false,
  autoRestart: false,
  snoozeDurationMs: 5 * 60 * 1000,
};

// A Notion database property with name and type
export interface DbProperty {
  name: string;
  type: string; // title, rich_text, date, number, select, multi_select, checkbox, url, email, etc.
  selectOptions?: string[]; // Available options for select/multi_select
}

// Notion integration settings
export interface NotionSettings {
  token: string;
  databaseId: string;
  fieldMappings: Record<string, string>; // kept for backwards compat but not used in dynamic mode
  dbProperties: DbProperty[];            // Detected database properties — drives the form
}

export const DEFAULT_NOTION_SETTINGS: NotionSettings = {
  token: '',
  databaseId: '',
  fieldMappings: {},
  dbProperties: [],
};

// Timer preferences stored separately from active timer state
export interface TimerPreferences {
  defaultDurationMs: number;
  isRecurring: boolean;
  autoRestart: boolean;
  snoozeDurationMs: number;
}

export const DEFAULT_TIMER_PREFERENCES: TimerPreferences = {
  defaultDurationMs: 30 * 60 * 1000,
  isRecurring: false,
  autoRestart: false,
  snoozeDurationMs: 5 * 60 * 1000,
};

// Dynamic form data — key is the Notion property name, value is the user input
export type DynamicFormData = Record<string, string | number | string[]>;

// Draft saved locally when Notion submission fails
export interface Draft {
  id: string;
  formData: DynamicFormData;
  createdAt: number;
  error?: string;
}

// Storage keys
export const STORAGE_KEYS = {
  TIMER_STATE: 'timerState',
  NOTION_SETTINGS: 'notionSettings',
  TIMER_PREFERENCES: 'timerPreferences',
  DRAFTS: 'drafts',
} as const;
