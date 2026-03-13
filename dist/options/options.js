"use strict";
(() => {
  // src/shared/types.ts
  var DEFAULT_TIMER_STATE = {
    status: "idle",
    durationMs: 30 * 60 * 1e3,
    startedAt: 0,
    pausedAt: null,
    pausedElapsed: 0,
    isRecurring: false,
    autoRestart: false,
    snoozeDurationMs: 5 * 60 * 1e3
  };
  var DEFAULT_NOTION_SETTINGS = {
    token: "",
    databaseId: "",
    fieldMappings: {
      title: "Name",
      datetime: "Date",
      workedOn: "Worked On",
      completed: "Completed",
      activity: "Activity",
      participants: "Participants",
      challenges: "Challenges",
      nextStep: "Next Step",
      focusScore: "Focus Score",
      tags: "Tags"
    }
  };
  var DEFAULT_TIMER_PREFERENCES = {
    defaultDurationMs: 30 * 60 * 1e3,
    isRecurring: false,
    autoRestart: false,
    snoozeDurationMs: 5 * 60 * 1e3
  };
  var STORAGE_KEYS = {
    TIMER_STATE: "timerState",
    NOTION_SETTINGS: "notionSettings",
    TIMER_PREFERENCES: "timerPreferences",
    DRAFTS: "drafts"
  };

  // src/shared/storage.ts
  async function getItem(key, defaultValue) {
    const result = await chrome.storage.local.get(key);
    return result[key] !== void 0 ? result[key] : defaultValue;
  }
  async function setItem(key, value) {
    await chrome.storage.local.set({ [key]: value });
  }
  async function getNotionSettings() {
    return getItem(STORAGE_KEYS.NOTION_SETTINGS, { ...DEFAULT_NOTION_SETTINGS });
  }
  async function setNotionSettings(settings) {
    return setItem(STORAGE_KEYS.NOTION_SETTINGS, settings);
  }
  async function getTimerPreferences() {
    return getItem(STORAGE_KEYS.TIMER_PREFERENCES, { ...DEFAULT_TIMER_PREFERENCES });
  }
  async function setTimerPreferences(prefs) {
    return setItem(STORAGE_KEYS.TIMER_PREFERENCES, prefs);
  }
  async function getDrafts() {
    return getItem(STORAGE_KEYS.DRAFTS, []);
  }
  async function removeDraft(id) {
    const drafts = await getDrafts();
    const filtered = drafts.filter((d) => d.id !== id);
    return setItem(STORAGE_KEYS.DRAFTS, filtered);
  }
  async function clearDrafts() {
    return setItem(STORAGE_KEYS.DRAFTS, []);
  }

  // src/shared/field-mapping.ts
  function mapFormDataToNotionProperties(formData, fieldMappings) {
    const properties = {};
    if (fieldMappings.title) {
      properties[fieldMappings.title] = {
        title: [{ text: { content: formData.title || "Untitled Session" } }]
      };
    }
    if (fieldMappings.datetime && formData.datetime) {
      properties[fieldMappings.datetime] = {
        date: { start: new Date(formData.datetime).toISOString() }
      };
    }
    const richTextFields = [
      "workedOn",
      "completed",
      "activity",
      "participants",
      "challenges",
      "nextStep"
    ];
    for (const field of richTextFields) {
      const mappingKey = fieldMappings[field];
      if (mappingKey && formData[field]) {
        properties[mappingKey] = {
          rich_text: [{ text: { content: String(formData[field]) } }]
        };
      }
    }
    if (fieldMappings.focusScore && formData.focusScore) {
      properties[fieldMappings.focusScore] = {
        number: formData.focusScore
      };
    }
    if (fieldMappings.tags && formData.tags && formData.tags.length > 0) {
      properties[fieldMappings.tags] = {
        multi_select: formData.tags.map((tag) => ({ name: tag }))
      };
    }
    return properties;
  }

  // src/shared/notion-api.ts
  var NOTION_API_BASE = "https://api.notion.com/v1";
  var NOTION_VERSION = "2022-06-28";
  function parseDatabaseId(input) {
    const trimmed = input.trim();
    if (trimmed.startsWith("http")) {
      try {
        const url = new URL(trimmed);
        const pathParts = url.pathname.split("/").filter(Boolean);
        const lastPart = pathParts[pathParts.length - 1] || "";
        return lastPart.replace(/-/g, "");
      } catch {
      }
    }
    return trimmed.replace(/-/g, "");
  }
  function getHeaders(token) {
    return {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json"
    };
  }
  async function testConnection(token, databaseId2) {
    try {
      const id = parseDatabaseId(databaseId2);
      const resp = await fetch(`${NOTION_API_BASE}/databases/${id}`, {
        method: "GET",
        headers: getHeaders(token)
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        return {
          success: false,
          error: `Notion API error ${resp.status}: ${body.message || resp.statusText}`
        };
      }
      const data = await resp.json();
      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: `Connection failed: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }
  function extractDatabaseProperties(dbData) {
    const properties = dbData.properties;
    if (!properties) return [];
    return Object.entries(properties).map(([name, prop]) => ({
      name,
      type: prop.type
    }));
  }
  async function createCheckInPage(settings, formData) {
    try {
      const properties = mapFormDataToNotionProperties(formData, settings.fieldMappings);
      const id = parseDatabaseId(settings.databaseId);
      const body = {
        parent: { database_id: id },
        properties
      };
      const resp = await fetch(`${NOTION_API_BASE}/pages`, {
        method: "POST",
        headers: getHeaders(settings.token),
        body: JSON.stringify(body)
      });
      if (!resp.ok) {
        const errorBody = await resp.json().catch(() => ({}));
        return {
          success: false,
          error: `Notion API error ${resp.status}: ${errorBody.message || resp.statusText}`
        };
      }
      const data = await resp.json();
      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: `Submission failed: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }

  // src/shared/form-schema.ts
  var DEFAULT_FORM_SCHEMA = [
    {
      id: "title",
      label: "Session Name",
      type: "text",
      required: true,
      placeholder: "e.g., Morning coding session"
    },
    {
      id: "datetime",
      label: "Date & Time",
      type: "datetime",
      autoFill: true
    },
    {
      id: "workedOn",
      label: "What did you work on?",
      type: "textarea",
      placeholder: "Describe what you focused on..."
    },
    {
      id: "completed",
      label: "What did you complete?",
      type: "textarea",
      placeholder: "List completed tasks..."
    },
    {
      id: "activity",
      label: "Activity performed",
      type: "text",
      placeholder: "e.g., Coding, Writing, Design"
    },
    {
      id: "participants",
      label: "Participants",
      type: "text",
      placeholder: "Who else was involved?"
    },
    {
      id: "challenges",
      label: "Challenges / Blockers",
      type: "textarea",
      placeholder: "Any obstacles encountered?"
    },
    {
      id: "nextStep",
      label: "Next step",
      type: "textarea",
      placeholder: "What will you do next?"
    },
    {
      id: "focusScore",
      label: "Focus Score",
      type: "rating",
      min: 1,
      max: 5
    },
    {
      id: "tags",
      label: "Tags",
      type: "tags",
      placeholder: "Add tags (press Enter)"
    }
  ];

  // src/options/options.ts
  var notionToken = document.getElementById("notionToken");
  var toggleTokenBtn = document.getElementById("toggleToken");
  var databaseId = document.getElementById("databaseId");
  var testConnectionBtn = document.getElementById("testConnection");
  var connectionStatus = document.getElementById("connectionStatus");
  var fieldMappingsContainer = document.getElementById("fieldMappings");
  var defaultDuration = document.getElementById("defaultDuration");
  var snoozeDuration = document.getElementById("snoozeDuration");
  var defaultRecurring = document.getElementById("defaultRecurring");
  var defaultAutoRestart = document.getElementById("defaultAutoRestart");
  var saveBtn = document.getElementById("saveBtn");
  var saveStatus = document.getElementById("saveStatus");
  var draftInfo = document.getElementById("draftInfo");
  var draftActions = document.getElementById("draftActions");
  var draftList = document.getElementById("draftList");
  var retryDraftsBtn = document.getElementById("retryDrafts");
  var clearDraftsBtn = document.getElementById("clearDrafts");
  toggleTokenBtn.addEventListener("click", () => {
    const isPassword = notionToken.type === "password";
    notionToken.type = isPassword ? "text" : "password";
    toggleTokenBtn.textContent = isPassword ? "Hide" : "Show";
  });
  var detectedProperties = [];
  testConnectionBtn.addEventListener("click", async () => {
    connectionStatus.textContent = "Testing...";
    connectionStatus.className = "status-text";
    const result = await testConnection(notionToken.value, databaseId.value);
    if (result.success) {
      connectionStatus.textContent = "Connected successfully!";
      connectionStatus.className = "status-text success";
      const currentMappings = collectFieldMappings();
      await setNotionSettings({
        token: notionToken.value.trim(),
        databaseId: databaseId.value.trim(),
        fieldMappings: currentMappings
      });
      detectedProperties = extractDatabaseProperties(result.data);
      if (detectedProperties.length > 0) {
        const autoMappings = autoMapFields(detectedProperties, currentMappings);
        renderFieldMappings(autoMappings, detectedProperties);
        await setNotionSettings({
          token: notionToken.value.trim(),
          databaseId: databaseId.value.trim(),
          fieldMappings: autoMappings
        });
        connectionStatus.textContent = `Connected! Found ${detectedProperties.length} properties. Mappings updated.`;
      }
    } else {
      connectionStatus.textContent = result.error || "Connection failed";
      connectionStatus.className = "status-text error";
    }
  });
  function autoMapFields(properties, currentMappings) {
    const mappings = { ...currentMappings };
    const propNames = properties.map((p) => p.name);
    for (const field of DEFAULT_FORM_SCHEMA) {
      if (mappings[field.id] && propNames.includes(mappings[field.id])) continue;
      const match = propNames.find((name) => {
        const lower = name.toLowerCase();
        const fieldLower = field.label.toLowerCase();
        const fieldIdLower = field.id.toLowerCase();
        return lower === fieldLower || lower === fieldIdLower || lower.includes(fieldIdLower) || fieldIdLower.includes(lower);
      });
      if (match) {
        mappings[field.id] = match;
      }
    }
    return mappings;
  }
  function renderFieldMappings(mappings, properties) {
    fieldMappingsContainer.innerHTML = "";
    const props = properties || detectedProperties;
    for (const field of DEFAULT_FORM_SCHEMA) {
      const row = document.createElement("div");
      row.className = "mapping-row";
      const label = document.createElement("span");
      label.className = "mapping-label";
      label.textContent = field.label;
      const arrow = document.createElement("span");
      arrow.className = "mapping-arrow";
      arrow.textContent = "\u2192";
      if (props.length > 0) {
        const select = document.createElement("select");
        select.className = "input mapping-input";
        select.dataset.fieldId = field.id;
        const emptyOpt = document.createElement("option");
        emptyOpt.value = "";
        emptyOpt.textContent = "-- Not mapped --";
        select.appendChild(emptyOpt);
        for (const prop of props) {
          const opt = document.createElement("option");
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
        const input = document.createElement("input");
        input.type = "text";
        input.className = "input mapping-input";
        input.dataset.fieldId = field.id;
        input.value = mappings[field.id] || "";
        input.placeholder = `Notion property name for "${field.label}"`;
        row.appendChild(label);
        row.appendChild(arrow);
        row.appendChild(input);
      }
      fieldMappingsContainer.appendChild(row);
    }
  }
  function collectFieldMappings() {
    const mappings = {};
    const elements = fieldMappingsContainer.querySelectorAll("input, select");
    elements.forEach((el) => {
      const element = el;
      const fieldId = element.dataset.fieldId;
      if (fieldId) {
        mappings[fieldId] = element.value.trim();
      }
    });
    return mappings;
  }
  saveBtn.addEventListener("click", async () => {
    const notionSettings = {
      token: notionToken.value.trim(),
      databaseId: databaseId.value.trim(),
      fieldMappings: collectFieldMappings()
    };
    await setNotionSettings(notionSettings);
    await setTimerPreferences({
      defaultDurationMs: Number(defaultDuration.value) * 60 * 1e3,
      isRecurring: defaultRecurring.checked,
      autoRestart: defaultAutoRestart.checked,
      snoozeDurationMs: Number(snoozeDuration.value) * 60 * 1e3
    });
    saveStatus.textContent = "Saved!";
    saveStatus.className = "status-text success";
    setTimeout(() => {
      saveStatus.textContent = "";
    }, 2e3);
  });
  async function renderDrafts() {
    const drafts = await getDrafts();
    draftInfo.textContent = drafts.length > 0 ? `${drafts.length} unsent draft(s)` : "No unsent drafts.";
    if (drafts.length > 0) {
      draftActions.classList.remove("hidden");
    } else {
      draftActions.classList.add("hidden");
    }
    draftList.innerHTML = "";
    for (const draft of drafts) {
      const item = document.createElement("div");
      item.className = "draft-item";
      const titleEl = document.createElement("span");
      titleEl.className = "draft-item-title";
      titleEl.textContent = draft.formData.title || "Untitled";
      const dateEl = document.createElement("span");
      dateEl.className = "draft-item-date";
      dateEl.textContent = new Date(draft.createdAt).toLocaleString();
      item.appendChild(titleEl);
      item.appendChild(dateEl);
      draftList.appendChild(item);
    }
  }
  retryDraftsBtn.addEventListener("click", async () => {
    const settings = await getNotionSettings();
    if (!settings.token || !settings.databaseId) {
      draftInfo.textContent = "Please configure Notion integration first.";
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
  clearDraftsBtn.addEventListener("click", async () => {
    await clearDrafts();
    await renderDrafts();
  });
  async function init() {
    const settings = await getNotionSettings();
    notionToken.value = settings.token;
    databaseId.value = settings.databaseId;
    renderFieldMappings(settings.fieldMappings || DEFAULT_NOTION_SETTINGS.fieldMappings);
    const prefs = await getTimerPreferences();
    defaultDuration.value = String(prefs.defaultDurationMs / 6e4);
    snoozeDuration.value = String(prefs.snoozeDurationMs / 6e4);
    defaultRecurring.checked = prefs.isRecurring;
    defaultAutoRestart.checked = prefs.autoRestart;
    await renderDrafts();
  }
  init();
})();
