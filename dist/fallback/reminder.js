"use strict";
(() => {
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

  // src/shared/form-renderer.ts
  function renderForm(container, schema) {
    const formEl = document.createElement("div");
    formEl.className = "notiion-form";
    for (const field of schema) {
      const group = document.createElement("div");
      group.className = "notiion-field-group";
      const label = document.createElement("label");
      label.className = "notiion-label";
      label.textContent = field.label;
      label.setAttribute("for", `notiion-${field.id}`);
      if (field.required) {
        const req = document.createElement("span");
        req.className = "notiion-required";
        req.textContent = " *";
        label.appendChild(req);
      }
      group.appendChild(label);
      switch (field.type) {
        case "text": {
          const input = document.createElement("input");
          input.type = "text";
          input.id = `notiion-${field.id}`;
          input.className = "notiion-input";
          input.placeholder = field.placeholder || "";
          input.dataset.fieldId = field.id;
          group.appendChild(input);
          break;
        }
        case "textarea": {
          const textarea = document.createElement("textarea");
          textarea.id = `notiion-${field.id}`;
          textarea.className = "notiion-textarea";
          textarea.placeholder = field.placeholder || "";
          textarea.rows = 3;
          textarea.dataset.fieldId = field.id;
          group.appendChild(textarea);
          break;
        }
        case "datetime": {
          const input = document.createElement("input");
          input.type = "datetime-local";
          input.id = `notiion-${field.id}`;
          input.className = "notiion-input";
          input.dataset.fieldId = field.id;
          if (field.autoFill) {
            input.value = (/* @__PURE__ */ new Date()).toISOString().slice(0, 16);
          }
          group.appendChild(input);
          break;
        }
        case "rating": {
          const ratingContainer = document.createElement("div");
          ratingContainer.className = "notiion-rating";
          ratingContainer.id = `notiion-${field.id}`;
          ratingContainer.dataset.fieldId = field.id;
          ratingContainer.dataset.value = "0";
          const min = field.min || 1;
          const max = field.max || 5;
          for (let i = min; i <= max; i++) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "notiion-rating-btn";
            btn.textContent = String(i);
            btn.dataset.rating = String(i);
            btn.addEventListener("click", () => {
              ratingContainer.dataset.value = String(i);
              ratingContainer.querySelectorAll(".notiion-rating-btn").forEach((b) => {
                b.classList.toggle("active", Number(b.dataset.rating) <= i);
              });
            });
            ratingContainer.appendChild(btn);
          }
          group.appendChild(ratingContainer);
          break;
        }
        case "tags": {
          const tagsWrapper = document.createElement("div");
          tagsWrapper.className = "notiion-tags-wrapper";
          tagsWrapper.id = `notiion-${field.id}`;
          tagsWrapper.dataset.fieldId = field.id;
          const tagsDisplay = document.createElement("div");
          tagsDisplay.className = "notiion-tags-display";
          tagsWrapper.appendChild(tagsDisplay);
          const tagsInput = document.createElement("input");
          tagsInput.type = "text";
          tagsInput.className = "notiion-input notiion-tags-input";
          tagsInput.placeholder = field.placeholder || "Add tag and press Enter";
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
      }
      formEl.appendChild(group);
    }
    container.appendChild(formEl);
    function collectData2() {
      const data = {};
      for (const field of schema) {
        const el = container.querySelector(`#notiion-${field.id}`);
        if (!el) continue;
        switch (field.type) {
          case "text":
          case "datetime":
            data[field.id] = el.value;
            break;
          case "textarea":
            data[field.id] = el.value;
            break;
          case "rating":
            data[field.id] = Number(el.dataset.value) || 0;
            break;
          case "tags": {
            const tagEls = el.querySelectorAll(".notiion-tag-text");
            data[field.id] = Array.from(tagEls).map((t) => t.textContent || "");
            break;
          }
        }
      }
      return data;
    }
    return { collectData: collectData2 };
  }
  function addTag(container, text) {
    const tag = document.createElement("span");
    tag.className = "notiion-tag";
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

  // src/fallback/reminder.ts
  var formContainer = document.getElementById("formContainer");
  var toast = document.getElementById("toast");
  var submitBtn = document.getElementById("submitBtn");
  var snoozeBtn = document.getElementById("snoozeBtn");
  var skipBtn = document.getElementById("skipBtn");
  var draftBtn = document.getElementById("draftBtn");
  var actions = document.getElementById("actions");
  var { collectData } = renderForm(formContainer, DEFAULT_FORM_SCHEMA);
  submitBtn.addEventListener("click", async () => {
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
})();
