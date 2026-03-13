import { renderDynamicForm, type AutoFillData } from '../shared/form-renderer';
import { MessageType, sendMessage } from '../shared/messages';
import { getNotionSettings, getLastSubmission } from '../shared/storage';
import type { DbProperty } from '../shared/types';

// Prevent multiple injections
if (!document.querySelector('.notiion-overlay')) {
  initModal();
}

async function initModal() {
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

  createModal(dbProps, autoFill);
}

// Minimal fallback if DB not connected yet
function fallbackProperties(): DbProperty[] {
  return [
    { name: 'Activity', type: 'title' },
    { name: 'Date', type: 'date' },
    { name: 'Notes', type: 'rich_text' },
  ];
}

function createModal(dbProperties: DbProperty[], autoFill?: AutoFillData) {
  const overlay = document.createElement('div');
  overlay.className = 'notiion-overlay';

  const modal = document.createElement('div');
  modal.className = 'notiion-modal';

  // Header
  const header = document.createElement('div');
  header.className = 'notiion-modal-header';

  const title = document.createElement('h2');
  title.className = 'notiion-modal-title';
  title.textContent = 'Productivity Check-in';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'notiion-modal-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.title = 'Close (Skip)';
  closeBtn.addEventListener('click', () => handleSkip(overlay));

  header.appendChild(title);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // Dynamic form from DB properties
  const formContainer = document.createElement('div');
  const { collectData } = renderDynamicForm(formContainer, dbProperties, autoFill);
  modal.appendChild(formContainer);

  // Toast area
  const toast = document.createElement('div');
  toast.className = 'notiion-toast';
  toast.style.display = 'none';
  modal.appendChild(toast);

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'notiion-actions';

  const submitBtn = createButton('Submit', 'notiion-btn-submit', async () => {
    disableButtons(actions);
    const formData = collectData();
    const resp = await sendMessage({ type: MessageType.SUBMIT_CHECKIN, formData });
    if (resp.success) {
      showToast(toast, 'Check-in saved to Notion!', 'success');
      setTimeout(() => removeModal(overlay), 1500);
    } else {
      showToast(toast, resp.error || 'Failed to save. Draft saved locally.', 'error');
      enableButtons(actions);
      setTimeout(() => removeModal(overlay), 3000);
    }
  });

  const snoozeBtn = createButton('Snooze', 'notiion-btn-snooze', async () => {
    await sendMessage({ type: MessageType.SNOOZE });
    removeModal(overlay);
  });

  const skipBtn = createButton('Skip', 'notiion-btn-skip', () => handleSkip(overlay));

  const draftBtn = createButton('Save Draft', 'notiion-btn-draft', async () => {
    const formData = collectData();
    await sendMessage({ type: MessageType.SAVE_DRAFT, formData });
    showToast(toast, 'Draft saved locally.', 'success');
    setTimeout(() => removeModal(overlay), 1200);
  });

  actions.appendChild(submitBtn);
  actions.appendChild(snoozeBtn);
  actions.appendChild(skipBtn);
  actions.appendChild(draftBtn);
  modal.appendChild(actions);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.addEventListener('keydown', function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleSnooze(overlay);
      document.removeEventListener('keydown', onKey);
    }
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) handleSnooze(overlay);
  });
}

function createButton(text: string, className: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `notiion-btn ${className}`;
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}

async function handleSkip(overlay: HTMLElement) {
  await sendMessage({ type: MessageType.SKIP });
  removeModal(overlay);
}

async function handleSnooze(overlay: HTMLElement) {
  await sendMessage({ type: MessageType.SNOOZE });
  removeModal(overlay);
}

function removeModal(overlay: HTMLElement) {
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 0.2s';
  setTimeout(() => overlay.remove(), 200);
}

function showToast(el: HTMLElement, message: string, type: 'success' | 'error') {
  el.textContent = message;
  el.className = `notiion-toast notiion-toast-${type}`;
  el.style.display = 'block';
}

function disableButtons(container: HTMLElement) {
  container.querySelectorAll('button').forEach(btn => btn.disabled = true);
}

function enableButtons(container: HTMLElement) {
  container.querySelectorAll('button').forEach(btn => btn.disabled = false);
}
