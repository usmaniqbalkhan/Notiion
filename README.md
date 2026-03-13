# Notiion - Productivity Check-in Chrome Extension

A Chrome extension (Manifest V3) that lets you set productivity timers and log check-ins directly to a Notion database. When the timer fires, a large modal form appears on the active tab so you can quickly fill out your check-in without opening Notion manually.

## Features

- **Timer controls** — Preset (15/30/45/60 min) or custom duration, pause/resume, recurring mode, auto-restart
- **Check-in modal** — Full-screen overlay injected into the active tab with a clean form
- **Fallback window** — Opens a standalone popup if content injection fails (e.g., on chrome:// pages)
- **Notion integration** — Submit check-ins directly as rows in your Notion database
- **Field mapping** — Map form fields to any Notion database property names
- **Draft system** — Automatically saves locally if Notion submission fails; retry later
- **Schema-driven forms** — Extensible form system via a single schema definition
- **Snooze & skip** — Defer the check-in with a 5-minute snooze or skip entirely

## Setup Instructions

### 1. Install dependencies and build

```bash
npm install
npm run build
```

### 2. Load the extension in Chrome

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `dist/` folder from this project

### 3. Configure Notion integration

1. Create a Notion integration at [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Copy the **Internal Integration Token** (starts with `secret_...`)
3. Create or open a Notion database and share it with your integration
4. Copy the **Database ID** from the database URL:
   - URL format: `https://www.notion.so/{workspace}/{database_id}?v=...`
   - The database ID is the 32-character hex string before `?v=`
5. Click the Notiion extension icon → **Settings** link
6. Paste your **Integration Token** and **Database ID**
7. Click **Test Connection** to verify
8. Adjust **Field Mappings** to match your Notion database property names
9. Click **Save Settings**

### 4. Set up your Notion database

Create a Notion database with these properties (or customize via field mappings):

| Property Name | Type | Description |
|---|---|---|
| Name | Title | Session name |
| Date | Date | Check-in date/time |
| Worked On | Rich text | What you worked on |
| Completed | Rich text | What you completed |
| Activity | Rich text | Activity performed |
| Participants | Rich text | Who was involved |
| Challenges | Rich text | Blockers encountered |
| Next Step | Rich text | What to do next |
| Focus Score | Number | Focus rating 1-5 |
| Tags | Multi-select | Categorization tags |

## How the Timer Flow Works

1. **Start** — User clicks a duration preset (or enters custom minutes) and clicks "Start Timer"
2. **Alarm created** — `chrome.alarms.create()` sets a one-shot alarm for the specified duration
3. **Timer state persisted** — State is saved to `chrome.storage.local` so it survives service worker restarts
4. **Alarm fires** — The service worker receives `chrome.alarms.onAlarm`
5. **Injection attempt** — Service worker queries the active tab and tries `chrome.scripting.executeScript` to inject the modal
6. **Fallback** — If injection fails (restricted URL, no active tab), opens a standalone reminder window via `chrome.windows.create`
7. **User action** — User can Submit, Snooze (5 min), Skip, or Save Draft
8. **Submit** — Form data is sent to Notion API via the service worker. On failure, automatically saved as a local draft
9. **Recurring** — If enabled, a new timer automatically starts after submission/skip

## Error Handling & Fallback Logic

- **Content injection fails** → Opens fallback window (`chrome.windows.create`)
- **Notion API error** → Draft saved locally with error message; user can retry from Settings
- **Notion not configured** → Draft saved automatically with "not configured" note
- **Service worker restarts** → Timer state restored from `chrome.storage.local`, alarm re-registered
- **Timer paused** → Alarm cleared; on resume, remaining time recalculated and new alarm created

## Project Structure

```
src/
├── manifest.json              # Chrome Extension MV3 manifest
├── background/
│   └── service-worker.ts      # Alarm handling, message routing, fallback window
├── popup/
│   ├── popup.html             # Timer controls UI
│   ├── popup.css
│   └── popup.ts               # Timer start/pause/resume/stop logic
├── options/
│   ├── options.html           # Settings page
│   ├── options.css
│   └── options.ts             # Notion config, field mapping, drafts
├── content/
│   ├── modal.ts               # Injected check-in form modal
│   └── modal.css              # Modal styles
├── fallback/
│   ├── reminder.html          # Fallback window
│   ├── reminder.css
│   └── reminder.ts
├── shared/
│   ├── types.ts               # TypeScript interfaces
│   ├── storage.ts             # chrome.storage.local wrappers
│   ├── timer.ts               # Timer/alarm management
│   ├── messages.ts            # Message types for chrome.runtime
│   ├── notion-api.ts          # Notion API client
│   ├── field-mapping.ts       # Form data → Notion properties
│   ├── form-schema.ts         # Schema-driven form definitions
│   └── form-renderer.ts       # DOM form renderer from schema
└── assets/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Development

```bash
npm run watch    # Watch mode — rebuilds on file changes
npm run build    # One-time production build
npm run clean    # Remove dist/
```

After rebuilding, go to `chrome://extensions/` and click the refresh icon on the Notiion extension card.

## Extending

The architecture is designed for future additions:

- **Multiple templates** — Add new schemas to `form-schema.ts` and a template selector
- **Multiple forms** — The form renderer is schema-driven; add new schemas as needed
- **Analytics** — Track submission counts/times in `chrome.storage.local`
- **Streaks** — Calculate consecutive days with check-ins from stored data
- **AI summaries** — Send collected check-in data to an LLM API for weekly summaries
