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

// Notion integration settings
export interface NotionSettings {
  token: string;
  databaseId: string;
  fieldMappings: Record<string, string>; // formFieldId -> Notion property name
}

export const DEFAULT_NOTION_SETTINGS: NotionSettings = {
  token: '',
  databaseId: '',
  fieldMappings: {
    title: 'Name',
    datetime: 'Date',
    workedOn: 'Worked On',
    completed: 'Completed',
    activity: 'Activity',
    participants: 'Participants',
    challenges: 'Challenges',
    nextStep: 'Next Step',
    focusScore: 'Focus Score',
    tags: 'Tags',
  },
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

// Check-in form data
export interface CheckInFormData {
  title: string;
  datetime: string;
  workedOn: string;
  completed: string;
  activity: string;
  participants: string;
  challenges: string;
  nextStep: string;
  focusScore: number;
  tags: string[];
}

// Draft saved locally when Notion submission fails
export interface Draft {
  id: string;
  formData: CheckInFormData;
  createdAt: number;
  error?: string;
}

// Form field schema for extensible form rendering
export type FormFieldType = 'text' | 'textarea' | 'datetime' | 'rating' | 'tags';

export interface FormFieldSchema {
  id: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  autoFill?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
}

// Storage keys
export const STORAGE_KEYS = {
  TIMER_STATE: 'timerState',
  NOTION_SETTINGS: 'notionSettings',
  TIMER_PREFERENCES: 'timerPreferences',
  DRAFTS: 'drafts',
} as const;
