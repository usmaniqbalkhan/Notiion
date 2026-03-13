import {
  getNotionSettings,
  setNotionSettings,
  getTimerPreferences,
  setTimerPreferences,
  getDrafts,
  clearDrafts,
  removeDraft,
} from '../shared/storage';
import { testConnection, createCheckInPage, extractDatabaseProperties } from '../shared/notion-api';
import type { NotionSettings, DbProperty } from '../shared/types';

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

// Current detected properties
let currentDbProperties: DbProperty[] = [];

// Toggle token visibility
toggleTokenBtn.addEventListener('click', () => {
  const isPassword = notionToken.type === 'password';
  notionToken.type = isPassword ? 'text' : 'password';
  toggleTokenBtn.textContent = isPassword ? 'Hide' : 'Show';
});

// Test connection — auto-save settings + fetch DB schema
testConnectionBtn.addEventListener('click', async () => {
  connectionStatus.textContent = 'Testing...';
  connectionStatus.className = 'status-text';

  const result = await testConnection(notionToken.value, databaseId.value);
  if (result.success) {
    // Extract database properties (columns)
    currentDbProperties = extractDatabaseProperties(result.data as Record<string, unknown>);

    // Auto-save everything immediately
    await setNotionSettings({
      token: notionToken.value.trim(),
      databaseId: databaseId.value.trim(),
      fieldMappings: {},
      dbProperties: currentDbProperties,
    });

    // Show detected properties
    renderDetectedProperties(currentDbProperties);

    connectionStatus.textContent = `Connected! Found ${currentDbProperties.length} properties. Form will use these columns.`;
    connectionStatus.className = 'status-text success';
  } else {
    connectionStatus.textContent = result.error || 'Connection failed';
    connectionStatus.className = 'status-text error';
  }
});

// Render detected DB properties as a read-only list showing what the form will display
function renderDetectedProperties(properties: DbProperty[]) {
  fieldMappingsContainer.innerHTML = '';

  if (properties.length === 0) {
    fieldMappingsContainer.innerHTML = '<p style="color:#888">No properties detected. Click "Test Connection" to fetch your database columns.</p>';
    return;
  }

  const header = document.createElement('p');
  header.style.color = '#4ade80';
  header.style.marginBottom = '12px';
  header.style.fontSize = '13px';
  header.textContent = 'These columns from your Notion database will appear in the check-in form:';
  fieldMappingsContainer.appendChild(header);

  for (const prop of properties) {
    // Skip computed/auto fields
    if (isComputedProperty(prop.type)) continue;

    const row = document.createElement('div');
    row.className = 'mapping-row';

    const nameEl = document.createElement('span');
    nameEl.className = 'mapping-label';
    nameEl.style.textAlign = 'left';
    nameEl.style.flex = '1';
    nameEl.textContent = prop.name;

    const typeEl = document.createElement('span');
    typeEl.className = 'prop-type-badge';
    typeEl.textContent = prop.type;

    const inputType = document.createElement('span');
    inputType.style.color = '#888';
    inputType.style.fontSize = '12px';
    inputType.style.flex = '0 0 140px';
    inputType.textContent = getInputDescription(prop.type);

    row.appendChild(nameEl);
    row.appendChild(typeEl);
    row.appendChild(inputType);
    fieldMappingsContainer.appendChild(row);

    // Show select options if available
    if (prop.selectOptions && prop.selectOptions.length > 0) {
      const optionsRow = document.createElement('div');
      optionsRow.style.paddingLeft = '12px';
      optionsRow.style.marginBottom = '8px';
      optionsRow.style.display = 'flex';
      optionsRow.style.flexWrap = 'wrap';
      optionsRow.style.gap = '4px';
      for (const opt of prop.selectOptions) {
        const chip = document.createElement('span');
        chip.style.padding = '2px 8px';
        chip.style.background = '#2d2b55';
        chip.style.borderRadius = '12px';
        chip.style.fontSize = '11px';
        chip.style.color = '#c4b5fd';
        chip.textContent = opt;
        optionsRow.appendChild(chip);
      }
      fieldMappingsContainer.appendChild(optionsRow);
    }
  }
}

function isComputedProperty(type: string): boolean {
  return ['formula', 'rollup', 'created_time', 'created_by',
    'last_edited_time', 'last_edited_by', 'unique_id',
    'verification', 'button'].includes(type);
}

function getInputDescription(type: string): string {
  const map: Record<string, string> = {
    title: 'Text input',
    rich_text: 'Text input',
    date: 'Date picker',
    number: 'Number input',
    select: 'Dropdown',
    multi_select: 'Tag picker',
    checkbox: 'Checkbox',
    url: 'URL input',
    email: 'Email input',
    phone_number: 'Phone input',
  };
  return map[type] || 'Text input';
}

// Save settings
saveBtn.addEventListener('click', async () => {
  const notionSettings: NotionSettings = {
    token: notionToken.value.trim(),
    databaseId: databaseId.value.trim(),
    fieldMappings: {},
    dbProperties: currentDbProperties,
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

    // Try to find the title property value from the dynamic form data
    const titleValue = Object.values(draft.formData).find(v => typeof v === 'string' && v.length > 0) || 'Untitled';

    const titleEl = document.createElement('span');
    titleEl.className = 'draft-item-title';
    titleEl.textContent = String(titleValue);

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

  // Load saved DB properties
  currentDbProperties = settings.dbProperties || [];
  renderDetectedProperties(currentDbProperties);

  const prefs = await getTimerPreferences();
  defaultDuration.value = String(prefs.defaultDurationMs / 60000);
  snoozeDuration.value = String(prefs.snoozeDurationMs / 60000);
  defaultRecurring.checked = prefs.isRecurring;
  defaultAutoRestart.checked = prefs.autoRestart;

  await renderDrafts();
}

init();
