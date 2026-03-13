import { renderDynamicForm, type AutoFillData } from '../shared/form-renderer';
import { MessageType, sendMessage } from '../shared/messages';
import { getNotionSettings, getLastSubmission } from '../shared/storage';
import type { DbProperty } from '../shared/types';

const formContainer = document.getElementById('formContainer')!;
const toast = document.getElementById('toast')!;
const submitBtn = document.getElementById('submitBtn')!;
const snoozeBtn = document.getElementById('snoozeBtn')!;
const draftBtn = document.getElementById('draftBtn')!;
const actions = document.getElementById('actions')!;
const autofillBadge = document.getElementById('autofillBadge')!;

let collectData: (() => Record<string, string | number | string[]>) | null = null;

async function init() {
  const settings = await getNotionSettings();
  const dbProps = settings.dbProperties && settings.dbProperties.length > 0
    ? settings.dbProperties
    : fallbackProperties();

  // Load last submission for auto-fill
  const lastSub = await getLastSubmission();
  const autoFill: AutoFillData = {
    lastFormData: lastSub?.formData || null,
    submittedAt: lastSub?.submittedAt || null,
  };

  // Show auto-fill badge if we have last data
  if (lastSub?.formData) {
    autofillBadge.style.display = 'inline-flex';
  }

  const form = renderDynamicForm(formContainer, dbProps, autoFill);
  collectData = form.collectData;

  // Focus first input
  requestAnimationFrame(() => {
    const firstInput = formContainer.querySelector<HTMLInputElement>('.notiion-input');
    if (firstInput) firstInput.focus();
  });
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
  submitBtn.innerHTML = '<span class="notiion-spinner"></span> Submitting...';
  const formData = collectData();
  const resp = await sendMessage({ type: MessageType.SUBMIT_CHECKIN, formData });
  if (resp.success) {
    showToast('Check-in saved to Notion!', 'success');
    submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg> Saved!';
    submitBtn.classList.add('notiion-btn-success');
    setTimeout(() => window.close(), 1500);
  } else {
    showToast(resp.error || 'Failed to save. Draft saved locally.', 'error');
    submitBtn.textContent = 'Submit Check-in';
    enableButtons();
  }
});

snoozeBtn.addEventListener('click', async () => {
  await sendMessage({ type: MessageType.SNOOZE });
  window.close();
});

// NO Skip button — popup is non-dismissable until submit/snooze/draft

draftBtn.addEventListener('click', async () => {
  if (!collectData) return;
  const formData = collectData();
  await sendMessage({ type: MessageType.SAVE_DRAFT, formData });
  showToast('Draft saved locally.', 'success');
  setTimeout(() => window.close(), 1200);
});

// NO Escape key dismiss — non-dismissable

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
