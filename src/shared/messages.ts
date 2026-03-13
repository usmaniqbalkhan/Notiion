import type { DynamicFormData, TimerState } from './types';

// Message types for chrome.runtime messaging
export enum MessageType {
  START_TIMER = 'START_TIMER',
  PAUSE_TIMER = 'PAUSE_TIMER',
  RESUME_TIMER = 'RESUME_TIMER',
  STOP_TIMER = 'STOP_TIMER',
  GET_TIMER_STATE = 'GET_TIMER_STATE',
  TIMER_FIRED = 'TIMER_FIRED',
  SUBMIT_CHECKIN = 'SUBMIT_CHECKIN',
  SNOOZE = 'SNOOZE',
  SKIP = 'SKIP',
  SAVE_DRAFT = 'SAVE_DRAFT',
}

export interface StartTimerMessage {
  type: MessageType.START_TIMER;
  durationMs: number;
  isRecurring: boolean;
  autoRestart: boolean;
}

export interface PauseTimerMessage { type: MessageType.PAUSE_TIMER; }
export interface ResumeTimerMessage { type: MessageType.RESUME_TIMER; }
export interface StopTimerMessage { type: MessageType.STOP_TIMER; }
export interface GetTimerStateMessage { type: MessageType.GET_TIMER_STATE; }
export interface TimerFiredMessage { type: MessageType.TIMER_FIRED; }
export interface SnoozeMessage { type: MessageType.SNOOZE; }
export interface SkipMessage { type: MessageType.SKIP; }

export interface SubmitCheckInMessage {
  type: MessageType.SUBMIT_CHECKIN;
  formData: DynamicFormData;
}

export interface SaveDraftMessage {
  type: MessageType.SAVE_DRAFT;
  formData: DynamicFormData;
}

export type ExtensionMessage =
  | StartTimerMessage
  | PauseTimerMessage
  | ResumeTimerMessage
  | StopTimerMessage
  | GetTimerStateMessage
  | TimerFiredMessage
  | SubmitCheckInMessage
  | SnoozeMessage
  | SkipMessage
  | SaveDraftMessage;

export interface MessageResponse {
  success: boolean;
  error?: string;
  data?: TimerState | unknown;
}

export function sendMessage(message: ExtensionMessage): Promise<MessageResponse> {
  return chrome.runtime.sendMessage(message);
}
