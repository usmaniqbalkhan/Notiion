import type { DynamicFormData, NotionSettings, DbProperty } from './types';
import { mapDynamicFormToNotion } from './field-mapping';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

export interface NotionApiResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

// Extract the 32-char database ID from a full Notion URL or raw ID
export function parseDatabaseId(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith('http')) {
    try {
      const url = new URL(trimmed);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1] || '';
      return lastPart.replace(/-/g, '');
    } catch { /* fall through */ }
  }
  return trimmed.replace(/-/g, '');
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
    const id = parseDatabaseId(databaseId);
    const resp = await fetch(`${NOTION_API_BASE}/databases/${id}`, {
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

// Extract property names, types, and select options from a database schema response
export function extractDatabaseProperties(dbData: Record<string, unknown>): DbProperty[] {
  const properties = dbData.properties as Record<string, Record<string, unknown>> | undefined;
  if (!properties) return [];

  return Object.entries(properties).map(([name, prop]) => {
    const dbProp: DbProperty = {
      name,
      type: prop.type as string,
    };

    // Extract select/multi_select options
    if (prop.type === 'select' && prop.select) {
      const selectConfig = prop.select as { options?: Array<{ name: string }> };
      dbProp.selectOptions = (selectConfig.options || []).map(o => o.name);
    }
    if (prop.type === 'multi_select' && prop.multi_select) {
      const msConfig = prop.multi_select as { options?: Array<{ name: string }> };
      dbProp.selectOptions = (msConfig.options || []).map(o => o.name);
    }

    return dbProp;
  });
}

// Create a new page (row) in the Notion database using dynamic form data
export async function createCheckInPage(
  settings: NotionSettings,
  formData: DynamicFormData
): Promise<NotionApiResult> {
  try {
    const properties = mapDynamicFormToNotion(formData, settings.dbProperties);

    const id = parseDatabaseId(settings.databaseId);
    const body = {
      parent: { database_id: id },
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
