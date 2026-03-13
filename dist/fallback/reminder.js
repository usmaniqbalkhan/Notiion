"use strict";
(() => {
  // src/shared/form-renderer.ts
  function renderDynamicForm(container, dbProperties, autoFill) {
    const formEl = document.createElement("div");
    formEl.className = "notiion-form";
    const lastData = autoFill?.lastFormData || null;
    for (const prop of dbProperties) {
      if (isComputedProperty(prop.type)) continue;
      const group = document.createElement("div");
      group.className = "notiion-field-group";
      const label = document.createElement("label");
      label.className = "notiion-label";
      label.textContent = prop.name;
      label.setAttribute("for", `notiion-${sanitizeId(prop.name)}`);
      group.appendChild(label);
      const fieldId = sanitizeId(prop.name);
      switch (prop.type) {
        case "title":
        case "rich_text":
        case "url":
        case "email":
        case "phone_number": {
          const input = document.createElement("input");
          input.type = prop.type === "email" ? "email" : prop.type === "url" ? "url" : "text";
          input.id = `notiion-${fieldId}`;
          input.className = "notiion-input";
          input.dataset.propName = prop.name;
          input.placeholder = `Enter ${prop.name}...`;
          const autoValue = getAutoFillValue(prop.name, lastData);
          if (autoValue) {
            input.value = autoValue;
          }
          group.appendChild(input);
          break;
        }
        case "date": {
          const input = document.createElement("input");
          input.type = "datetime-local";
          input.id = `notiion-${fieldId}`;
          input.className = "notiion-input";
          input.dataset.propName = prop.name;
          input.value = (/* @__PURE__ */ new Date()).toISOString().slice(0, 16);
          group.appendChild(input);
          break;
        }
        case "number": {
          const input = document.createElement("input");
          input.type = "number";
          input.id = `notiion-${fieldId}`;
          input.className = "notiion-input";
          input.dataset.propName = prop.name;
          input.placeholder = `Enter ${prop.name}...`;
          group.appendChild(input);
          break;
        }
        case "select": {
          const select = document.createElement("select");
          select.id = `notiion-${fieldId}`;
          select.className = "notiion-input notiion-select";
          select.dataset.propName = prop.name;
          const emptyOpt = document.createElement("option");
          emptyOpt.value = "";
          emptyOpt.textContent = `Select ${prop.name}...`;
          select.appendChild(emptyOpt);
          if (prop.selectOptions) {
            for (const opt of prop.selectOptions) {
              const option = document.createElement("option");
              option.value = opt;
              option.textContent = opt;
              select.appendChild(option);
            }
          }
          group.appendChild(select);
          break;
        }
        case "multi_select": {
          const tagsWrapper = document.createElement("div");
          tagsWrapper.className = "notiion-tags-wrapper";
          tagsWrapper.id = `notiion-${fieldId}`;
          tagsWrapper.dataset.propName = prop.name;
          const tagsDisplay = document.createElement("div");
          tagsDisplay.className = "notiion-tags-display";
          tagsWrapper.appendChild(tagsDisplay);
          if (prop.selectOptions && prop.selectOptions.length > 0) {
            const optionsBar = document.createElement("div");
            optionsBar.className = "notiion-tag-options";
            for (const opt of prop.selectOptions) {
              const chip = document.createElement("button");
              chip.type = "button";
              chip.className = "notiion-tag-option";
              chip.textContent = opt;
              chip.addEventListener("click", () => {
                const existing = tagsDisplay.querySelector(`[data-tag-value="${CSS.escape(opt)}"]`);
                if (existing) {
                  existing.remove();
                  chip.classList.remove("active");
                } else {
                  addTag(tagsDisplay, opt);
                  chip.classList.add("active");
                }
              });
              optionsBar.appendChild(chip);
            }
            tagsWrapper.appendChild(optionsBar);
          }
          const tagsInput = document.createElement("input");
          tagsInput.type = "text";
          tagsInput.className = "notiion-input notiion-tags-input";
          tagsInput.placeholder = `Add ${prop.name} and press Enter`;
          tagsInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const val = tagsInput.value.trim();
              if (val) {
                addTag(tagsDisplay, val);
                tagsInput.value = "";
              }
            }
          });
          tagsWrapper.appendChild(tagsInput);
          group.appendChild(tagsWrapper);
          break;
        }
        case "checkbox": {
          const checkWrapper = document.createElement("div");
          checkWrapper.className = "notiion-checkbox-wrapper";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.id = `notiion-${fieldId}`;
          checkbox.dataset.propName = prop.name;
          checkWrapper.appendChild(checkbox);
          const checkLabel = document.createElement("span");
          checkLabel.textContent = prop.name;
          checkWrapper.appendChild(checkLabel);
          group.appendChild(checkWrapper);
          break;
        }
        default: {
          const input = document.createElement("input");
          input.type = "text";
          input.id = `notiion-${fieldId}`;
          input.className = "notiion-input";
          input.dataset.propName = prop.name;
          input.placeholder = `${prop.name}`;
          group.appendChild(input);
          break;
        }
      }
      formEl.appendChild(group);
    }
    container.appendChild(formEl);
    function collectData2() {
      const data = {};
      for (const prop of dbProperties) {
        if (isComputedProperty(prop.type)) continue;
        const fieldId = sanitizeId(prop.name);
        const el = container.querySelector(`#notiion-${fieldId}`);
        if (!el) continue;
        switch (prop.type) {
          case "title":
          case "rich_text":
          case "url":
          case "email":
          case "phone_number":
          case "date":
            data[prop.name] = el.value;
            break;
          case "number": {
            const val = el.value;
            if (val) data[prop.name] = Number(val);
            break;
          }
          case "select":
            data[prop.name] = el.value;
            break;
          case "multi_select": {
            const tagEls = el.querySelectorAll(".notiion-tag-text");
            const tags = Array.from(tagEls).map((t) => t.textContent || "");
            if (tags.length > 0) data[prop.name] = tags;
            break;
          }
          case "checkbox":
            data[prop.name] = el.checked ? "true" : "";
            break;
          default:
            data[prop.name] = el.value;
            break;
        }
      }
      return data;
    }
    return { collectData: collectData2 };
  }
  function getAutoFillValue(propName, lastData) {
    const nameLower = propName.toLowerCase().trim();
    if (nameLower === "start time" || nameLower === "start_time" || nameLower === "starttime") {
      if (lastData) {
        const endTimeKey = Object.keys(lastData).find((k) => {
          const kl = k.toLowerCase().trim();
          return kl === "end time" || kl === "end_time" || kl === "endtime";
        });
        if (endTimeKey && lastData[endTimeKey]) {
          return String(lastData[endTimeKey]);
        }
      }
      return formatTimeNow();
    }
    if (nameLower === "end time" || nameLower === "end_time" || nameLower === "endtime") {
      return formatTimeNow();
    }
    return "";
  }
  function formatTimeNow() {
    const now = /* @__PURE__ */ new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12 || 12;
    const minStr = minutes < 10 ? `0${minutes}` : String(minutes);
    return `${hours}:${minStr}${ampm}`;
  }
  function sanitizeId(name) {
    return name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
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
  function addTag(container, text) {
    if (container.querySelector(`[data-tag-value="${CSS.escape(text)}"]`)) return;
    const tag = document.createElement("span");
    tag.className = "notiion-tag";
    tag.dataset.tagValue = text;
    const tagText = document.createElement("span");
    tagText.className = "notiion-tag-text";
    tagText.textContent = text;
    tag.appendChild(tagText);
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "notiion-tag-remove";
    removeBtn.textContent = "\xD7";
    removeBtn.addEventListener("click", () => tag.remove());
    tag.appendChild(removeBtn);
    container.appendChild(tag);
  }

  // src/shared/messages.ts
  function sendMessage(message) {
    return chrome.runtime.sendMessage(message);
  }

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
    DRAFTS: "drafts",
    LAST_SUBMISSION: "lastSubmission"
  };

  // src/shared/storage.ts
  async function getItem(key, defaultValue) {
    const result = await chrome.storage.local.get(key);
    return result[key] !== void 0 ? result[key] : defaultValue;
  }
  async function getNotionSettings() {
    return getItem(STORAGE_KEYS.NOTION_SETTINGS, { ...DEFAULT_NOTION_SETTINGS });
  }
  async function getLastSubmission() {
    return getItem(STORAGE_KEYS.LAST_SUBMISSION, null);
  }

  // src/fallback/reminder.ts
  var formContainer = document.getElementById("formContainer");
  var toast = document.getElementById("toast");
  var submitBtn = document.getElementById("submitBtn");
  var snoozeBtn = document.getElementById("snoozeBtn");
  var skipBtn = document.getElementById("skipBtn");
  var draftBtn = document.getElementById("draftBtn");
  var actions = document.getElementById("actions");
  var collectData = null;
  async function init() {
    const settings = await getNotionSettings();
    const dbProps = settings.dbProperties && settings.dbProperties.length > 0 ? settings.dbProperties : fallbackProperties();
    const lastSub = await getLastSubmission();
    const autoFill = {
      lastFormData: lastSub?.formData || null,
      submittedAt: lastSub?.submittedAt || null
    };
    const form = renderDynamicForm(formContainer, dbProps, autoFill);
    collectData = form.collectData;
  }
  function fallbackProperties() {
    return [
      { name: "Activity", type: "title" },
      { name: "Date", type: "date" },
      { name: "Notes", type: "rich_text" }
    ];
  }
  submitBtn.addEventListener("click", async () => {
    if (!collectData) return;
    disableButtons();
    const formData = collectData();
    const resp = await sendMessage({ type: "SUBMIT_CHECKIN" /* SUBMIT_CHECKIN */, formData });
    if (resp.success) {
      showToast("Check-in saved to Notion!", "success");
      setTimeout(() => window.close(), 1500);
    } else {
      showToast(resp.error || "Failed to save. Draft saved locally.", "error");
      enableButtons();
    }
  });
  snoozeBtn.addEventListener("click", async () => {
    await sendMessage({ type: "SNOOZE" /* SNOOZE */ });
    window.close();
  });
  skipBtn.addEventListener("click", async () => {
    await sendMessage({ type: "SKIP" /* SKIP */ });
    window.close();
  });
  draftBtn.addEventListener("click", async () => {
    if (!collectData) return;
    const formData = collectData();
    await sendMessage({ type: "SAVE_DRAFT" /* SAVE_DRAFT */, formData });
    showToast("Draft saved locally.", "success");
    setTimeout(() => window.close(), 1200);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      sendMessage({ type: "SNOOZE" /* SNOOZE */ }).then(() => window.close());
    }
  });
  function showToast(message, type) {
    toast.textContent = message;
    toast.className = `notiion-toast notiion-toast-${type}`;
    toast.style.display = "block";
  }
  function disableButtons() {
    actions.querySelectorAll("button").forEach((btn) => btn.disabled = true);
  }
  function enableButtons() {
    actions.querySelectorAll("button").forEach((btn) => btn.disabled = false);
  }
  init();
})();
