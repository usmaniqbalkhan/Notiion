import type { CheckInFormData, NotionSettings } from './types';
import { mapFormDataToNotionProperties } from './field-mapping';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

interface NotionApiResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

// Extract the 32-char database ID from a full Notion URL or raw ID
export function parseDatabaseId(input: string): string {
  const trimmed = input.trim();

  // If it's a URL, extract the ID from the path
  if (trimmed.startsWith('http')) {
    try {
      const url = new URL(trimmed);
      // Notion URL format: notion.so/{workspace}/{id}?v=... or notion.so/{id}?v=...
      const pathParts = url.pathname.split('/').filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1] || '';
      // Remove any dashes (Notion sometimes uses dashed UUIDs)
      return lastPart.replace(/-/g, '');
    } catch {
      // Not a valid URL, fall through
    }
  }

  // Already a raw ID — strip dashes just in case
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

// Database property info returned from schema fetch
export interface NotionProperty {
  name: string;
  type: string;
}

// Extract property names and types from a database schema response
export function extractDatabaseProperties(dbData: Record<string, unknown>): NotionProperty[] {
  const properties = dbData.properties as Record<string, { type: string }> | undefined;
  if (!properties) return [];
  return Object.entries(properties).map(([name, prop]) => ({
    name,
    type: prop.type,
  }));
}

// Create a new page (row) in the Notion database
export async function createCheckInPage(
  settings: NotionSettings,
  formData: CheckInFormData
): Promise<NotionApiResult> {
  try {
    const properties = mapFormDataToNotionProperties(formData, settings.fieldMappings);

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
