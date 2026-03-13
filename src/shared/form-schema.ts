import type { FormFieldSchema } from './types';

// Default productivity check-in form schema
export const DEFAULT_FORM_SCHEMA: FormFieldSchema[] = [
  {
    id: 'title',
    label: 'Session Name',
    type: 'text',
    required: true,
    placeholder: 'e.g., Morning coding session',
  },
  {
    id: 'datetime',
    label: 'Date & Time',
    type: 'datetime',
    autoFill: true,
  },
  {
    id: 'workedOn',
    label: 'What did you work on?',
    type: 'textarea',
    placeholder: 'Describe what you focused on...',
  },
  {
    id: 'completed',
    label: 'What did you complete?',
    type: 'textarea',
    placeholder: 'List completed tasks...',
  },
  {
    id: 'activity',
    label: 'Activity performed',
    type: 'text',
    placeholder: 'e.g., Coding, Writing, Design',
  },
  {
    id: 'participants',
    label: 'Participants',
    type: 'text',
    placeholder: 'Who else was involved?',
  },
  {
    id: 'challenges',
    label: 'Challenges / Blockers',
    type: 'textarea',
    placeholder: 'Any obstacles encountered?',
  },
  {
    id: 'nextStep',
    label: 'Next step',
    type: 'textarea',
    placeholder: 'What will you do next?',
  },
  {
    id: 'focusScore',
    label: 'Focus Score',
    type: 'rating',
    min: 1,
    max: 5,
  },
  {
    id: 'tags',
    label: 'Tags',
    type: 'tags',
    placeholder: 'Add tags (press Enter)',
  },
];
