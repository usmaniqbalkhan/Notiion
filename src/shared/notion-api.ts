import type { CheckInFormData, NotionSettings } from './types';
import { mapFormDataToNotionProperties } from './field-mapping';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

interface NotionApiResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

function getHeaders(token: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

// Test connection by retrieving the database
export async function testConnection(
  token: string,
  databaseId: string
): Promise<NotionApiResult> {
  try {
    const resp = await fetch(`${NOTION_API_BASE}/databases/${databaseId}`, {
      method: 'GET',
      headers: getHeaders(token),
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      return {
        success: false,
        error: `Notion API error ${resp.status}: ${(body as Record<string, string>).message || resp.statusText}`,
      };
    }

    const data = await resp.json();
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// Create a new page (row) in the Notion database
export async function createCheckInPage(
  settings: NotionSettings,
  formData: CheckInFormData
): Promise<NotionApiResult> {
  try {
    const properties = mapFormDataToNotionProperties(formData, settings.fieldMappings);

    const body = {
      parent: { database_id: settings.databaseId },
      properties,
    };

    const resp = await fetch(`${NOTION_API_BASE}/pages`, {
      method: 'POST',
      headers: getHeaders(settings.token),
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errorBody = await resp.json().catch(() => ({}));
      return {
        success: false,
        error: `Notion API error ${resp.status}: ${(errorBody as Record<string, string>).message || resp.statusText}`,
      };
    }

    const data = await resp.json();
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: `Submission failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
