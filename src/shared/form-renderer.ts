import type { DbProperty, DynamicFormData } from './types';

// Auto-fill options from last submission
export interface AutoFillData {
  lastFormData: DynamicFormData | null;
  submittedAt: number | null; // timestamp of last submission
}

// Renders form fields from Notion database properties into a container element
// lastData is used for smart auto-fill (e.g., Start Time = last End Time)
export function renderDynamicForm(
  container: HTMLElement,
  dbProperties: DbProperty[],
  autoFill?: AutoFillData
): { collectData: () => DynamicFormData } {
  const formEl = document.createElement('div');
  formEl.className = 'notiion-form';

  const lastData = autoFill?.lastFormData || null;

  for (const prop of dbProperties) {
    if (isComputedProperty(prop.type)) continue;

    const group = document.createElement('div');
    group.className = 'notiion-field-group';

    const label = document.createElement('label');
    label.className = 'notiion-label';
    label.textContent = prop.name;
    label.setAttribute('for', `notiion-${sanitizeId(prop.name)}`);
    group.appendChild(label);

    const fieldId = sanitizeId(prop.name);

    switch (prop.type) {
      case 'title':
      case 'rich_text':
      case 'url':
      case 'email':
      case 'phone_number': {
        const input = document.createElement('input');
        input.type = prop.type === 'email' ? 'email' : prop.type === 'url' ? 'url' : 'text';
        input.id = `notiion-${fieldId}`;
        input.className = 'notiion-input';
        input.dataset.propName = prop.name;
        input.placeholder = `Enter ${prop.name}...`;

        // Smart auto-fill for time fields
        const autoValue = getAutoFillValue(prop.name, lastData);
        if (autoValue) {
          input.value = autoValue;
        }

        group.appendChild(input);
        break;
      }

      case 'date': {
        const input = document.createElement('input');
        input.type = 'datetime-local';
        input.id = `notiion-${fieldId}`;
        input.className = 'notiion-input';
        input.dataset.propName = prop.name;
        // Always auto-fill with current date/time
        input.value = new Date().toISOString().slice(0, 16);
        group.appendChild(input);
        break;
      }

      case 'number': {
        const input = document.createElement('input');
        input.type = 'number';
        input.id = `notiion-${fieldId}`;
        input.className = 'notiion-input';
        input.dataset.propName = prop.name;
        input.placeholder = `Enter ${prop.name}...`;
        group.appendChild(input);
        break;
      }

      case 'select': {
        const select = document.createElement('select');
        select.id = `notiion-${fieldId}`;
        select.className = 'notiion-input notiion-select';
        select.dataset.propName = prop.name;

        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = `Select ${prop.name}...`;
        select.appendChild(emptyOpt);

        if (prop.selectOptions) {
          for (const opt of prop.selectOptions) {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            select.appendChild(option);
          }
        }
        group.appendChild(select);
        break;
      }

      case 'multi_select': {
        const tagsWrapper = document.createElement('div');
        tagsWrapper.className = 'notiion-tags-wrapper';
        tagsWrapper.id = `notiion-${fieldId}`;
        tagsWrapper.dataset.propName = prop.name;

        const tagsDisplay = document.createElement('div');
        tagsDisplay.className = 'notiion-tags-display';
        tagsWrapper.appendChild(tagsDisplay);

        // Show existing options as clickable chips
        if (prop.selectOptions && prop.selectOptions.length > 0) {
          const optionsBar = document.createElement('div');
          optionsBar.className = 'notiion-tag-options';
          for (const opt of prop.selectOptions) {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'notiion-tag-option';
            chip.textContent = opt;
            chip.addEventListener('click', () => {
              const existing = tagsDisplay.querySelector(`[data-tag-value="${CSS.escape(opt)}"]`);
              if (existing) {
                existing.remove();
                chip.classList.remove('active');
              } else {
                addTag(tagsDisplay, opt);
                chip.classList.add('active');
              }
            });
            optionsBar.appendChild(chip);
          }
          tagsWrapper.appendChild(optionsBar);
        }

        const tagsInput = document.createElement('input');
        tagsInput.type = 'text';
        tagsInput.className = 'notiion-input notiion-tags-input';
        tagsInput.placeholder = `Add ${prop.name} and press Enter`;
        tagsInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const val = tagsInput.value.trim();
            if (val) {
              addTag(tagsDisplay, val);
              tagsInput.value = '';
            }
          }
        });
        tagsWrapper.appendChild(tagsInput);
        group.appendChild(tagsWrapper);
        break;
      }

      case 'checkbox': {
        const checkWrapper = document.createElement('div');
        checkWrapper.className = 'notiion-checkbox-wrapper';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `notiion-${fieldId}`;
        checkbox.dataset.propName = prop.name;
        checkWrapper.appendChild(checkbox);
        const checkLabel = document.createElement('span');
        checkLabel.textContent = prop.name;
        checkWrapper.appendChild(checkLabel);
        group.appendChild(checkWrapper);
        break;
      }

      default: {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `notiion-${fieldId}`;
        input.className = 'notiion-input';
        input.dataset.propName = prop.name;
        input.placeholder = `${prop.name}`;
        group.appendChild(input);
        break;
      }
    }

    formEl.appendChild(group);
  }

  container.appendChild(formEl);

  function collectData(): DynamicFormData {
    const data: DynamicFormData = {};

    for (const prop of dbProperties) {
      if (isComputedProperty(prop.type)) continue;
      const fieldId = sanitizeId(prop.name);
      const el = container.querySelector(`#notiion-${fieldId}`) as HTMLElement | null;
      if (!el) continue;

      switch (prop.type) {
        case 'title':
        case 'rich_text':
        case 'url':
        case 'email':
        case 'phone_number':
        case 'date':
          data[prop.name] = (el as HTMLInputElement).value;
          break;

        case 'number': {
          const val = (el as HTMLInputElement).value;
          if (val) data[prop.name] = Number(val);
          break;
        }

        case 'select':
          data[prop.name] = (el as HTMLSelectElement).value;
          break;

        case 'multi_select': {
          const tagEls = el.querySelectorAll('.notiion-tag-text');
          const tags = Array.from(tagEls).map(t => t.textContent || '');
          if (tags.length > 0) data[prop.name] = tags;
          break;
        }

        case 'checkbox':
          data[prop.name] = (el as HTMLInputElement).checked ? 'true' : '';
          break;

        default:
          data[prop.name] = (el as HTMLInputElement).value;
          break;
      }
    }

    return data;
  }

  return { collectData };
}

// Smart auto-fill logic:
// - "Start Time" gets last session's "End Time" value
// - "End Time" gets current time formatted as h:mmam/pm
// - Date fields get today's date
function getAutoFillValue(
  propName: string,
  lastData: DynamicFormData | null
): string {
  const nameLower = propName.toLowerCase().trim();

  // "Start Time" → use last session's "End Time"
  if (nameLower === 'start time' || nameLower === 'start_time' || nameLower === 'starttime') {
    if (lastData) {
      // Find the "End Time" value from last submission
      const endTimeKey = Object.keys(lastData).find(k => {
        const kl = k.toLowerCase().trim();
        return kl === 'end time' || kl === 'end_time' || kl === 'endtime';
      });
      if (endTimeKey && lastData[endTimeKey]) {
        return String(lastData[endTimeKey]);
      }
    }
    // Fallback: current time
    return formatTimeNow();
  }

  // "End Time" → current time
  if (nameLower === 'end time' || nameLower === 'end_time' || nameLower === 'endtime') {
    return formatTimeNow();
  }

  return '';
}

// Format current time as h:mmam/pm (e.g., "11:30am")
function formatTimeNow(): string {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  const minStr = minutes < 10 ? `0${minutes}` : String(minutes);
  return `${hours}:${minStr}${ampm}`;
}

function sanitizeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}

function isComputedProperty(type: string): boolean {
  return [
    'formula', 'rollup', 'created_time', 'created_by',
    'last_edited_time', 'last_edited_by', 'unique_id',
    'verification', 'button',
  ].includes(type);
}

function addTag(container: HTMLElement, text: string) {
  if (container.querySelector(`[data-tag-value="${CSS.escape(text)}"]`)) return;

  const tag = document.createElement('span');
  tag.className = 'notiion-tag';
  tag.dataset.tagValue = text;

  const tagText = document.createElement('span');
  tagText.className = 'notiion-tag-text';
  tagText.textContent = text;
  tag.appendChild(tagText);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'notiion-tag-remove';
  removeBtn.textContent = '\u00d7';
  removeBtn.addEventListener('click', () => tag.remove());
  tag.appendChild(removeBtn);

  container.appendChild(tag);
}
