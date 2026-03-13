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

  // Header — branded, no close button (non-dismissable)
  const header = document.createElement('div');
  header.className = 'notiion-modal-header';

  const brandRow = document.createElement('div');
  brandRow.className = 'notiion-brand-row';

  const logoIcon = document.createElement('div');
  logoIcon.className = 'notiion-logo-icon';
  logoIcon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

  const brandText = document.createElement('div');
  brandText.className = 'notiion-brand-text';

  const title = document.createElement('h2');
  title.className = 'notiion-modal-title';
  title.textContent = 'Productivity Check-in';

  const subtitle = document.createElement('p');
  subtitle.className = 'notiion-modal-subtitle';
  subtitle.textContent = 'Log your session to stay on track';

  brandText.appendChild(title);
  brandText.appendChild(subtitle);
  brandRow.appendChild(logoIcon);
  brandRow.appendChild(brandText);
  header.appendChild(brandRow);

  // Auto-fill indicator
  if (autoFill?.lastFormData) {
    const badge = document.createElement('div');
    badge.className = 'notiion-autofill-badge';
    badge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Times auto-filled from last session`;
    header.appendChild(badge);
  }

  modal.appendChild(header);

  // Dynamic form from DB properties
  const formContainer = document.createElement('div');
  formContainer.className = 'notiion-form-container';
  const { collectData } = renderDynamicForm(formContainer, dbProperties, autoFill);
  modal.appendChild(formContainer);

  // Toast area
  const toast = document.createElement('div');
  toast.className = 'notiion-toast';
  toast.style.display = 'none';
  modal.appendChild(toast);

  // Action buttons — Submit primary, Snooze & Draft secondary (no Skip, no Close)
  const actions = document.createElement('div');
  actions.className = 'notiion-actions';

  const submitBtn = createButton('Submit Check-in', 'notiion-btn notiion-btn-submit', async () => {
    disableButtons(actions);
    submitBtn.innerHTML = '<span class="notiion-spinner"></span> Submitting...';
    const formData = collectData();
    const resp = await sendMessage({ type: MessageType.SUBMIT_CHECKIN, formData });
    if (resp.success) {
      showToast(toast, 'Check-in saved to Notion!', 'success');
      submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg> Saved!';
      submitBtn.classList.add('notiion-btn-success');
      setTimeout(() => removeModal(overlay), 1500);
    } else {
      showToast(toast, resp.error || 'Failed to save. Draft saved locally.', 'error');
      submitBtn.textContent = 'Submit Check-in';
      enableButtons(actions);
    }
  });

  const secondaryRow = document.createElement('div');
  secondaryRow.className = 'notiion-secondary-actions';

  const snoozeBtn = createButton('Snooze 5 min', 'notiion-btn notiion-btn-snooze', async () => {
    await sendMessage({ type: MessageType.SNOOZE });
    removeModal(overlay);
  });

  const draftBtn = createButton('Save as Draft', 'notiion-btn notiion-btn-draft', async () => {
    const formData = collectData();
    await sendMessage({ type: MessageType.SAVE_DRAFT, formData });
    showToast(toast, 'Draft saved locally.', 'success');
    setTimeout(() => removeModal(overlay), 1200);
  });

  secondaryRow.appendChild(snoozeBtn);
  secondaryRow.appendChild(draftBtn);

  actions.appendChild(submitBtn);
  actions.appendChild(secondaryRow);
  modal.appendChild(actions);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // NO Escape key dismiss — popup is non-dismissable
  // NO overlay click dismiss — must submit or snooze

  // Focus first input
  requestAnimationFrame(() => {
    const firstInput = modal.querySelector<HTMLInputElement>('.notiion-input');
    if (firstInput) firstInput.focus();
  });
}

function createButton(text: string, className: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}

function removeModal(overlay: HTMLElement) {
  overlay.classList.add('notiion-overlay-exit');
  const modal = overlay.querySelector('.notiion-modal');
  if (modal) modal.classList.add('notiion-modal-exit');
  setTimeout(() => overlay.remove(), 300);
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
