import {
  getNotionSettings,
  setNotionSettings,
  getTimerPreferences,
  setTimerPreferences,
  getDrafts,
  clearDrafts,
  removeDraft,
} from '../shared/storage';
import { testConnection, createCheckInPage } from '../shared/notion-api';
import { DEFAULT_NOTION_SETTINGS, type NotionSettings, type Draft } from '../shared/types';
import { DEFAULT_FORM_SCHEMA } from '../shared/form-schema';

// DOM elements
const notionToken = document.getElementById('notionToken') as HTMLInputElement;
const toggleTokenBtn = document.getElementById('toggleToken')!;
const databaseId = document.getElementById('databaseId') as HTMLInputElement;
const testConnectionBtn = document.getElementById('testConnection')!;
const connectionStatus = document.getElementById('connectionStatus')!;
const fieldMappingsContainer = document.getElementById('fieldMappings')!;
const defaultDuration = document.getElementById('defaultDuration') as HTMLInputElement;
const snoozeDuration = document.getElementById('snoozeDuration') as HTMLInputElement;
const defaultRecurring = document.getElementById('defaultRecurring') as HTMLInputElement;
const defaultAutoRestart = document.getElementById('defaultAutoRestart') as HTMLInputElement;
const saveBtn = document.getElementById('saveBtn')!;
const saveStatus = document.getElementById('saveStatus')!;
const draftInfo = document.getElementById('draftInfo')!;
const draftActions = document.getElementById('draftActions')!;
const draftList = document.getElementById('draftList')!;
const retryDraftsBtn = document.getElementById('retryDrafts')!;
const clearDraftsBtn = document.getElementById('clearDrafts')!;

// Toggle token visibility
toggleTokenBtn.addEventListener('click', () => {
  const isPassword = notionToken.type === 'password';
  notionToken.type = isPassword ? 'text' : 'password';
  toggleTokenBtn.textContent = isPassword ? 'Hide' : 'Show';
});

// Test connection
testConnectionBtn.addEventListener('click', async () => {
  connectionStatus.textContent = 'Testing...';
  connectionStatus.className = 'status-text';
  const result = await testConnection(notionToken.value, databaseId.value);
  if (result.success) {
    connectionStatus.textContent = 'Connected successfully!';
    connectionStatus.className = 'status-text success';
  } else {
    connectionStatus.textContent = result.error || 'Connection failed';
    connectionStatus.className = 'status-text error';
  }
});

// Render field mapping inputs
function renderFieldMappings(mappings: Record<string, string>) {
  fieldMappingsContainer.innerHTML = '';
  for (const field of DEFAULT_FORM_SCHEMA) {
    const row = document.createElement('div');
    row.className = 'mapping-row';

    const label = document.createElement('span');
    label.className = 'mapping-label';
    label.textContent = field.label;

    const arrow = document.createElement('span');
    arrow.className = 'mapping-arrow';
    arrow.textContent = '\u2192';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input mapping-input';
    input.dataset.fieldId = field.id;
    input.value = mappings[field.id] || '';
    input.placeholder = `Notion property name for "${field.label}"`;

    row.appendChild(label);
    row.appendChild(arrow);
    row.appendChild(input);
    fieldMappingsContainer.appendChild(row);
  }
}

// Collect field mappings from UI
function collectFieldMappings(): Record<string, string> {
  const mappings: Record<string, string> = {};
  const inputs = fieldMappingsContainer.querySelectorAll('input');
  inputs.forEach(input => {
    const fieldId = (input as HTMLInputElement).dataset.fieldId;
    if (fieldId) {
      mappings[fieldId] = (input as HTMLInputElement).value.trim();
    }
  });
  return mappings;
}

// Save settings
saveBtn.addEventListener('click', async () => {
  const notionSettings: NotionSettings = {
    token: notionToken.value.trim(),
    databaseId: databaseId.value.trim(),
    fieldMappings: collectFieldMappings(),
  };
  await setNotionSettings(notionSettings);

  await setTimerPreferences({
    defaultDurationMs: Number(defaultDuration.value) * 60 * 1000,
    isRecurring: defaultRecurring.checked,
    autoRestart: defaultAutoRestart.checked,
    snoozeDurationMs: Number(snoozeDuration.value) * 60 * 1000,
  });

  saveStatus.textContent = 'Saved!';
  saveStatus.className = 'status-text success';
  setTimeout(() => { saveStatus.textContent = ''; }, 2000);
});

// Render drafts
async function renderDrafts() {
  const drafts = await getDrafts();
  draftInfo.textContent = drafts.length > 0
    ? `${drafts.length} unsent draft(s)`
    : 'No unsent drafts.';

  if (drafts.length > 0) {
    draftActions.classList.remove('hidden');
  } else {
    draftActions.classList.add('hidden');
  }

  draftList.innerHTML = '';
  for (const draft of drafts) {
    const item = document.createElement('div');
    item.className = 'draft-item';

    const titleEl = document.createElement('span');
    titleEl.className = 'draft-item-title';
    titleEl.textContent = draft.formData.title || 'Untitled';

    const dateEl = document.createElement('span');
    dateEl.className = 'draft-item-date';
    dateEl.textContent = new Date(draft.createdAt).toLocaleString();

    item.appendChild(titleEl);
    item.appendChild(dateEl);
    draftList.appendChild(item);
  }
}

// Retry all drafts
retryDraftsBtn.addEventListener('click', async () => {
  const settings = await getNotionSettings();
  if (!settings.token || !settings.databaseId) {
    draftInfo.textContent = 'Please configure Notion integration first.';
    return;
  }

  const drafts = await getDrafts();
  let successCount = 0;

  for (const draft of drafts) {
    const result = await createCheckInPage(settings, draft.formData);
    if (result.success) {
      await removeDraft(draft.id);
      successCount++;
    }
  }

  draftInfo.textContent = `Sent ${successCount}/${drafts.length} drafts.`;
  await renderDrafts();
});

// Clear all drafts
clearDraftsBtn.addEventListener('click', async () => {
  await clearDrafts();
  await renderDrafts();
});

// Load saved settings
async function init() {
  const settings = await getNotionSettings();
  notionToken.value = settings.token;
  databaseId.value = settings.databaseId;
  renderFieldMappings(settings.fieldMappings || DEFAULT_NOTION_SETTINGS.fieldMappings);

  const prefs = await getTimerPreferences();
  defaultDuration.value = String(prefs.defaultDurationMs / 60000);
  snoozeDuration.value = String(prefs.snoozeDurationMs / 60000);
  defaultRecurring.checked = prefs.isRecurring;
  defaultAutoRestart.checked = prefs.autoRestart;

  await renderDrafts();
}

init();
