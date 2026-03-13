import {
  getNotionSettings,
  setNotionSettings,
  getTimerPreferences,
  setTimerPreferences,
  getDrafts,
  clearDrafts,
  removeDraft,
} from '../shared/storage';
import { testConnection, createCheckInPage, extractDatabaseProperties, type NotionProperty } from '../shared/notion-api';
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

// Detected Notion database properties (populated on successful connection)
let detectedProperties: NotionProperty[] = [];

// Test connection — auto-save settings and fetch DB schema on success
testConnectionBtn.addEventListener('click', async () => {
  connectionStatus.textContent = 'Testing...';
  connectionStatus.className = 'status-text';
  const result = await testConnection(notionToken.value, databaseId.value);
  if (result.success) {
    connectionStatus.textContent = 'Connected successfully!';
    connectionStatus.className = 'status-text success';

    // Auto-save token and database ID immediately so check-ins work
    const currentMappings = collectFieldMappings();
    await setNotionSettings({
      token: notionToken.value.trim(),
      databaseId: databaseId.value.trim(),
      fieldMappings: currentMappings,
    });

    // Extract database properties and re-render field mappings with dropdowns
    detectedProperties = extractDatabaseProperties(result.data as Record<string, unknown>);
    if (detectedProperties.length > 0) {
      const autoMappings = autoMapFields(detectedProperties, currentMappings);
      renderFieldMappings(autoMappings, detectedProperties);
      // Auto-save the improved mappings
      await setNotionSettings({
        token: notionToken.value.trim(),
        databaseId: databaseId.value.trim(),
        fieldMappings: autoMappings,
      });
      connectionStatus.textContent = `Connected! Found ${detectedProperties.length} properties. Mappings updated.`;
    }
  } else {
    connectionStatus.textContent = result.error || 'Connection failed';
    connectionStatus.className = 'status-text error';
  }
});

// Auto-map form fields to Notion properties by matching names (fuzzy)
function autoMapFields(
  properties: NotionProperty[],
  currentMappings: Record<string, string>
): Record<string, string> {
  const mappings = { ...currentMappings };
  const propNames = properties.map(p => p.name);

  for (const field of DEFAULT_FORM_SCHEMA) {
    // If already mapped to an existing property, keep it
    if (mappings[field.id] && propNames.includes(mappings[field.id])) continue;

    // Try to find a matching Notion property
    const match = propNames.find(name => {
      const lower = name.toLowerCase();
      const fieldLower = field.label.toLowerCase();
      const fieldIdLower = field.id.toLowerCase();
      return lower === fieldLower || lower === fieldIdLower
        || lower.includes(fieldIdLower) || fieldIdLower.includes(lower);
    });
    if (match) {
      mappings[field.id] = match;
    }
  }
  return mappings;
}

// Render field mapping inputs — uses dropdowns if database properties are detected
function renderFieldMappings(mappings: Record<string, string>, properties?: NotionProperty[]) {
  fieldMappingsContainer.innerHTML = '';
  const props = properties || detectedProperties;

  for (const field of DEFAULT_FORM_SCHEMA) {
    const row = document.createElement('div');
    row.className = 'mapping-row';

    const label = document.createElement('span');
    label.className = 'mapping-label';
    label.textContent = field.label;

    const arrow = document.createElement('span');
    arrow.className = 'mapping-arrow';
    arrow.textContent = '\u2192';

    if (props.length > 0) {
      // Render a dropdown select with detected properties
      const select = document.createElement('select');
      select.className = 'input mapping-input';
      select.dataset.fieldId = field.id;

      // Empty option
      const emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = '-- Not mapped --';
      select.appendChild(emptyOpt);

      for (const prop of props) {
        const opt = document.createElement('option');
        opt.value = prop.name;
        opt.textContent = `${prop.name} (${prop.type})`;
        if (mappings[field.id] === prop.name) {
          opt.selected = true;
        }
        select.appendChild(opt);
      }

      row.appendChild(label);
      row.appendChild(arrow);
      row.appendChild(select);
    } else {
      // Fallback: text input
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'input mapping-input';
      input.dataset.fieldId = field.id;
      input.value = mappings[field.id] || '';
      input.placeholder = `Notion property name for "${field.label}"`;

      row.appendChild(label);
      row.appendChild(arrow);
      row.appendChild(input);
    }

    fieldMappingsContainer.appendChild(row);
  }
}

// Collect field mappings from UI (supports both <input> and <select>)
function collectFieldMappings(): Record<string, string> {
  const mappings: Record<string, string> = {};
  const elements = fieldMappingsContainer.querySelectorAll('input, select');
  elements.forEach(el => {
    const element = el as HTMLInputElement | HTMLSelectElement;
    const fieldId = element.dataset.fieldId;
    if (fieldId) {
      mappings[fieldId] = element.value.trim();
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
