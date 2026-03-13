import type { CheckInFormData } from './types';

// Map form data to Notion property format based on user-configured field mappings
export function mapFormDataToNotionProperties(
  formData: CheckInFormData,
  fieldMappings: Record<string, string>
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};

  // Title → Notion title property
  if (fieldMappings.title) {
    properties[fieldMappings.title] = {
      title: [{ text: { content: formData.title || 'Untitled Session' } }],
    };
  }

  // Date/time → Notion date property
  if (fieldMappings.datetime && formData.datetime) {
    properties[fieldMappings.datetime] = {
      date: { start: new Date(formData.datetime).toISOString() },
    };
  }

  // Text/textarea fields → Notion rich_text properties
  const richTextFields: (keyof CheckInFormData)[] = [
    'workedOn', 'completed', 'activity', 'participants', 'challenges', 'nextStep',
  ];

  for (const field of richTextFields) {
    const mappingKey = fieldMappings[field];
    if (mappingKey && formData[field]) {
      properties[mappingKey] = {
        rich_text: [{ text: { content: String(formData[field]) } }],
      };
    }
  }

  // Focus score → Notion number property
  if (fieldMappings.focusScore && formData.focusScore) {
    properties[fieldMappings.focusScore] = {
      number: formData.focusScore,
    };
  }

  // Tags → Notion multi_select property
  if (fieldMappings.tags && formData.tags && formData.tags.length > 0) {
    properties[fieldMappings.tags] = {
      multi_select: formData.tags.map(tag => ({ name: tag })),
    };
  }

  return properties;
}
