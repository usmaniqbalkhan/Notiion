import { renderDynamicForm } from '../shared/form-renderer';
import { MessageType, sendMessage } from '../shared/messages';
import { getNotionSettings } from '../shared/storage';
import type { DbProperty } from '../shared/types';

const formContainer = document.getElementById('formContainer')!;
const toast = document.getElementById('toast')!;
const submitBtn = document.getElementById('submitBtn')!;
const snoozeBtn = document.getElementById('snoozeBtn')!;
const skipBtn = document.getElementById('skipBtn')!;
const draftBtn = document.getElementById('draftBtn')!;
const actions = document.getElementById('actions')!;

let collectData: (() => Record<string, string | number | string[]>) | null = null;

async function init() {
  const settings = await getNotionSettings();
  const dbProps = settings.dbProperties && settings.dbProperties.length > 0
    ? settings.dbProperties
    : fallbackProperties();

  const form = renderDynamicForm(formContainer, dbProps);
  collectData = form.collectData;
}

function fallbackProperties(): DbProperty[] {
  return [
    { name: 'Activity', type: 'title' },
    { name: 'Date', type: 'date' },
    { name: 'Notes', type: 'rich_text' },
  ];
}

// Submit
submitBtn.addEventListener('click', async () => {
  if (!collectData) return;
  disableButtons();
  const formData = collectData();
  const resp = await sendMessage({ type: MessageType.SUBMIT_CHECKIN, formData });
  if (resp.success) {
    showToast('Check-in saved to Notion!', 'success');
    setTimeout(() => window.close(), 1500);
  } else {
    showToast(resp.error || 'Failed to save. Draft saved locally.', 'error');
    enableButtons();
  }
});

snoozeBtn.addEventListener('click', async () => {
  await sendMessage({ type: MessageType.SNOOZE });
  window.close();
});

skipBtn.addEventListener('click', async () => {
  await sendMessage({ type: MessageType.SKIP });
  window.close();
});

draftBtn.addEventListener('click', async () => {
  if (!collectData) return;
  const formData = collectData();
  await sendMessage({ type: MessageType.SAVE_DRAFT, formData });
  showToast('Draft saved locally.', 'success');
  setTimeout(() => window.close(), 1200);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    sendMessage({ type: MessageType.SNOOZE }).then(() => window.close());
  }
});

function showToast(message: string, type: 'success' | 'error') {
  toast.textContent = message;
  toast.className = `notiion-toast notiion-toast-${type}`;
  toast.style.display = 'block';
}

function disableButtons() {
  actions.querySelectorAll('button').forEach(btn => (btn as HTMLButtonElement).disabled = true);
}

function enableButtons() {
  actions.querySelectorAll('button').forEach(btn => (btn as HTMLButtonElement).disabled = false);
}

init();
