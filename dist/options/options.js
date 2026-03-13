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
    fieldMappings: {},
    dbProperties: []
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
  function mapDynamicFormToNotion(formData, dbProperties) {
    const properties = {};
    for (const prop of dbProperties) {
      const value = formData[prop.name];
      if (value === void 0 || value === "" || value === null) continue;
      switch (prop.type) {
        case "title":
          properties[prop.name] = {
            title: [{ text: { content: String(value) } }]
          };
          break;
        case "rich_text":
          properties[prop.name] = {
            rich_text: [{ text: { content: String(value) } }]
          };
          break;
        case "date":
          if (String(value).trim()) {
            properties[prop.name] = {
              date: { start: new Date(String(value)).toISOString() }
            };
          }
          break;
        case "number":
          properties[prop.name] = {
            number: Number(value) || 0
          };
          break;
        case "select":
          properties[prop.name] = {
            select: { name: String(value) }
          };
          break;
        case "multi_select": {
          const tags = Array.isArray(value) ? value : String(value).split(",").map((s) => s.trim()).filter(Boolean);
          if (tags.length > 0) {
            properties[prop.name] = {
              multi_select: tags.map((tag) => ({ name: tag }))
            };
          }
          break;
        }
        case "checkbox":
          properties[prop.name] = {
            checkbox: value === true || value === "true" || value === "1"
          };
          break;
        case "url":
          properties[prop.name] = { url: String(value) };
          break;
        case "email":
          properties[prop.name] = { email: String(value) };
          break;
        case "phone_number":
          properties[prop.name] = { phone_number: String(value) };
          break;
        default:
          if (String(value).trim()) {
            properties[prop.name] = {
              rich_text: [{ text: { content: String(value) } }]
            };
          }
          break;
      }
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
    return Object.entries(properties).map(([name, prop]) => {
      const dbProp = {
        name,
        type: prop.type
      };
      if (prop.type === "select" && prop.select) {
        const selectConfig = prop.select;
        dbProp.selectOptions = (selectConfig.options || []).map((o) => o.name);
      }
      if (prop.type === "multi_select" && prop.multi_select) {
        const msConfig = prop.multi_select;
        dbProp.selectOptions = (msConfig.options || []).map((o) => o.name);
      }
      return dbProp;
    });
  }
  async function createCheckInPage(settings, formData) {
    try {
      const properties = mapDynamicFormToNotion(formData, settings.dbProperties);
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
  var currentDbProperties = [];
  toggleTokenBtn.addEventListener("click", () => {
    const isPassword = notionToken.type === "password";
    notionToken.type = isPassword ? "text" : "password";
    toggleTokenBtn.textContent = isPassword ? "Hide" : "Show";
  });
  testConnectionBtn.addEventListener("click", async () => {
    connectionStatus.textContent = "Testing...";
    connectionStatus.className = "status-text";
    const result = await testConnection(notionToken.value, databaseId.value);
    if (result.success) {
      currentDbProperties = extractDatabaseProperties(result.data);
      await setNotionSettings({
        token: notionToken.value.trim(),
        databaseId: databaseId.value.trim(),
        fieldMappings: {},
        dbProperties: currentDbProperties
      });
      renderDetectedProperties(currentDbProperties);
      connectionStatus.textContent = `Connected! Found ${currentDbProperties.length} properties. Form will use these columns.`;
      connectionStatus.className = "status-text success";
    } else {
      connectionStatus.textContent = result.error || "Connection failed";
      connectionStatus.className = "status-text error";
    }
  });
  function renderDetectedProperties(properties) {
    fieldMappingsContainer.innerHTML = "";
    if (properties.length === 0) {
      fieldMappingsContainer.innerHTML = '<p style="color:#888">No properties detected. Click "Test Connection" to fetch your database columns.</p>';
      return;
    }
    const header = document.createElement("p");
    header.style.color = "#4ade80";
    header.style.marginBottom = "12px";
    header.style.fontSize = "13px";
    header.textContent = "These columns from your Notion database will appear in the check-in form:";
    fieldMappingsContainer.appendChild(header);
    for (const prop of properties) {
      if (isComputedProperty(prop.type)) continue;
      const row = document.createElement("div");
      row.className = "mapping-row";
      const nameEl = document.createElement("span");
      nameEl.className = "mapping-label";
      nameEl.style.textAlign = "left";
      nameEl.style.flex = "1";
      nameEl.textContent = prop.name;
      const typeEl = document.createElement("span");
      typeEl.className = "prop-type-badge";
      typeEl.textContent = prop.type;
      const inputType = document.createElement("span");
      inputType.style.color = "#888";
      inputType.style.fontSize = "12px";
      inputType.style.flex = "0 0 140px";
      inputType.textContent = getInputDescription(prop.type);
      row.appendChild(nameEl);
      row.appendChild(typeEl);
      row.appendChild(inputType);
      fieldMappingsContainer.appendChild(row);
      if (prop.selectOptions && prop.selectOptions.length > 0) {
        const optionsRow = document.createElement("div");
        optionsRow.style.paddingLeft = "12px";
        optionsRow.style.marginBottom = "8px";
        optionsRow.style.display = "flex";
        optionsRow.style.flexWrap = "wrap";
        optionsRow.style.gap = "4px";
        for (const opt of prop.selectOptions) {
          const chip = document.createElement("span");
          chip.style.padding = "2px 8px";
          chip.style.background = "#2d2b55";
          chip.style.borderRadius = "12px";
          chip.style.fontSize = "11px";
          chip.style.color = "#c4b5fd";
          chip.textContent = opt;
          optionsRow.appendChild(chip);
        }
        fieldMappingsContainer.appendChild(optionsRow);
      }
    }
  }
  function isComputedProperty(type) {
    return [
      "formula",
      "rollup",
      "created_time",
      "created_by",
      "last_edited_time",
      "last_edited_by",
      "unique_id",
      "verification",
      "button"
    ].includes(type);
  }
  function getInputDescription(type) {
    const map = {
      title: "Text input",
      rich_text: "Text input",
      date: "Date picker",
      number: "Number input",
      select: "Dropdown",
      multi_select: "Tag picker",
      checkbox: "Checkbox",
      url: "URL input",
      email: "Email input",
      phone_number: "Phone input"
    };
    return map[type] || "Text input";
  }
  saveBtn.addEventListener("click", async () => {
    const notionSettings = {
      token: notionToken.value.trim(),
      databaseId: databaseId.value.trim(),
      fieldMappings: {},
      dbProperties: currentDbProperties
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
      const titleValue = Object.values(draft.formData).find((v) => typeof v === "string" && v.length > 0) || "Untitled";
      const titleEl = document.createElement("span");
      titleEl.className = "draft-item-title";
      titleEl.textContent = String(titleValue);
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
    currentDbProperties = settings.dbProperties || [];
    renderDetectedProperties(currentDbProperties);
    const prefs = await getTimerPreferences();
    defaultDuration.value = String(prefs.defaultDurationMs / 6e4);
    snoozeDuration.value = String(prefs.snoozeDurationMs / 6e4);
    defaultRecurring.checked = prefs.isRecurring;
    defaultAutoRestart.checked = prefs.autoRestart;
    await renderDrafts();
  }
  init();
})();
