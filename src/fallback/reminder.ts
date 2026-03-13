import { DEFAULT_FORM_SCHEMA } from '../shared/form-schema';
import { renderForm } from '../shared/form-renderer';
import { MessageType, sendMessage } from '../shared/messages';

const formContainer = document.getElementById('formContainer')!;
const toast = document.getElementById('toast')!;
const submitBtn = document.getElementById('submitBtn')!;
const snoozeBtn = document.getElementById('snoozeBtn')!;
const skipBtn = document.getElementById('skipBtn')!;
const draftBtn = document.getElementById('draftBtn')!;
const actions = document.getElementById('actions')!;

// Render form fields
const { collectData } = renderForm(formContainer, DEFAULT_FORM_SCHEMA);

// Submit
submitBtn.addEventListener('click', async () => {
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

// Snooze
snoozeBtn.addEventListener('click', async () => {
  await sendMessage({ type: MessageType.SNOOZE });
  window.close();
});

// Skip
skipBtn.addEventListener('click', async () => {
  await sendMessage({ type: MessageType.SKIP });
  window.close();
});

// Save Draft
draftBtn.addEventListener('click', async () => {
  const formData = collectData();
  await sendMessage({ type: MessageType.SAVE_DRAFT, formData });
  showToast('Draft saved locally.', 'success');
  setTimeout(() => window.close(), 1200);
});

// Keyboard shortcuts
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
