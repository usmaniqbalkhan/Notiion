import type { FormFieldSchema, CheckInFormData } from './types';

// Renders form fields from schema into a container element
// Returns a function to collect form data
export function renderForm(
  container: HTMLElement,
  schema: FormFieldSchema[]
): { collectData: () => CheckInFormData } {
  const formEl = document.createElement('div');
  formEl.className = 'notiion-form';

  for (const field of schema) {
    const group = document.createElement('div');
    group.className = 'notiion-field-group';

    const label = document.createElement('label');
    label.className = 'notiion-label';
    label.textContent = field.label;
    label.setAttribute('for', `notiion-${field.id}`);
    if (field.required) {
      const req = document.createElement('span');
      req.className = 'notiion-required';
      req.textContent = ' *';
      label.appendChild(req);
    }
    group.appendChild(label);

    switch (field.type) {
      case 'text': {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `notiion-${field.id}`;
        input.className = 'notiion-input';
        input.placeholder = field.placeholder || '';
        input.dataset.fieldId = field.id;
        group.appendChild(input);
        break;
      }

      case 'textarea': {
        const textarea = document.createElement('textarea');
        textarea.id = `notiion-${field.id}`;
        textarea.className = 'notiion-textarea';
        textarea.placeholder = field.placeholder || '';
        textarea.rows = 3;
        textarea.dataset.fieldId = field.id;
        group.appendChild(textarea);
        break;
      }

      case 'datetime': {
        const input = document.createElement('input');
        input.type = 'datetime-local';
        input.id = `notiion-${field.id}`;
        input.className = 'notiion-input';
        input.dataset.fieldId = field.id;
        if (field.autoFill) {
          input.value = new Date().toISOString().slice(0, 16);
        }
        group.appendChild(input);
        break;
      }

      case 'rating': {
        const ratingContainer = document.createElement('div');
        ratingContainer.className = 'notiion-rating';
        ratingContainer.id = `notiion-${field.id}`;
        ratingContainer.dataset.fieldId = field.id;
        ratingContainer.dataset.value = '0';
        const min = field.min || 1;
        const max = field.max || 5;
        for (let i = min; i <= max; i++) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'notiion-rating-btn';
          btn.textContent = String(i);
          btn.dataset.rating = String(i);
          btn.addEventListener('click', () => {
            ratingContainer.dataset.value = String(i);
            // Update active states
            ratingContainer.querySelectorAll('.notiion-rating-btn').forEach(b => {
              b.classList.toggle('active', Number((b as HTMLButtonElement).dataset.rating) <= i);
            });
          });
          ratingContainer.appendChild(btn);
        }
        group.appendChild(ratingContainer);
        break;
      }

      case 'tags': {
        const tagsWrapper = document.createElement('div');
        tagsWrapper.className = 'notiion-tags-wrapper';
        tagsWrapper.id = `notiion-${field.id}`;
        tagsWrapper.dataset.fieldId = field.id;

        const tagsDisplay = document.createElement('div');
        tagsDisplay.className = 'notiion-tags-display';
        tagsWrapper.appendChild(tagsDisplay);

        const tagsInput = document.createElement('input');
        tagsInput.type = 'text';
        tagsInput.className = 'notiion-input notiion-tags-input';
        tagsInput.placeholder = field.placeholder || 'Add tag and press Enter';
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
    }

    formEl.appendChild(group);
  }

  container.appendChild(formEl);

  // Collect data from rendered form
  function collectData(): CheckInFormData {
    const data: Record<string, unknown> = {};
    for (const field of schema) {
      const el = container.querySelector(`#notiion-${field.id}`) as HTMLElement | null;
      if (!el) continue;

      switch (field.type) {
        case 'text':
        case 'datetime':
          data[field.id] = (el as HTMLInputElement).value;
          break;
        case 'textarea':
          data[field.id] = (el as HTMLTextAreaElement).value;
          break;
        case 'rating':
          data[field.id] = Number(el.dataset.value) || 0;
          break;
        case 'tags': {
          const tagEls = el.querySelectorAll('.notiion-tag-text');
          data[field.id] = Array.from(tagEls).map(t => t.textContent || '');
          break;
        }
      }
    }
    return data as unknown as CheckInFormData;
  }

  return { collectData };
}

function addTag(container: HTMLElement, text: string) {
  const tag = document.createElement('span');
  tag.className = 'notiion-tag';

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
