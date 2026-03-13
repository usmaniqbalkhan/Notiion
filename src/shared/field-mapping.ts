import type { DynamicFormData, DbProperty } from './types';

// Map dynamic form data to Notion properties using the actual DB property types
export function mapDynamicFormToNotion(
  formData: DynamicFormData,
  dbProperties: DbProperty[]
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};

  for (const prop of dbProperties) {
    const value = formData[prop.name];
    if (value === undefined || value === '' || value === null) continue;

    switch (prop.type) {
      case 'title':
        properties[prop.name] = {
          title: [{ text: { content: String(value) } }],
        };
        break;

      case 'rich_text':
        properties[prop.name] = {
          rich_text: [{ text: { content: String(value) } }],
        };
        break;

      case 'date':
        if (String(value).trim()) {
          properties[prop.name] = {
            date: { start: new Date(String(value)).toISOString() },
          };
        }
        break;

      case 'number':
        properties[prop.name] = {
          number: Number(value) || 0,
        };
        break;

      case 'select':
        properties[prop.name] = {
          select: { name: String(value) },
        };
        break;

      case 'multi_select': {
        const tags = Array.isArray(value)
          ? value
          : String(value).split(',').map(s => s.trim()).filter(Boolean);
        if (tags.length > 0) {
          properties[prop.name] = {
            multi_select: tags.map(tag => ({ name: tag })),
          };
        }
        break;
      }

      case 'checkbox':
        properties[prop.name] = {
          checkbox: value === true || value === 'true' || value === '1',
        };
        break;

      case 'url':
        properties[prop.name] = { url: String(value) };
        break;

      case 'email':
        properties[prop.name] = { email: String(value) };
        break;

      case 'phone_number':
        properties[prop.name] = { phone_number: String(value) };
        break;

      default:
        // For unknown types, try rich_text as fallback
        if (String(value).trim()) {
          properties[prop.name] = {
            rich_text: [{ text: { content: String(value) } }],
          };
        }
        break;
    }
  }

  return properties;
}
