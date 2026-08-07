(() => {
  const STORAGE_KEY = "burger-folie-planner-v2";
  const TRANSFER_PREFIX = "BFPLAN1.";
  const WEEKDAYS_NL = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];

  const transfer = {};
  const exportRange = {
    action: "",
    preset: "all"
  };

  document.addEventListener("DOMContentLoaded", () => {
    bindExportRangeSelector();
    bindTransferPage();
    bindTransferTools();
    renderTransferCode();

    if (location.hash === "#transfer") {
      window.setTimeout(() => showTransferPage(false), 0);
    }
  });

  function bindExportRangeSelector() {
    Object.assign(exportRange, {
      overlay: document.getElementById("exportRangeOverlay"),
      title: document.getElementById("exportRangeTitle"),
      startInput: document.getElementById("exportStartInput"),
      endInput: document.getElementById("exportEndInput"),
      count: document.getElementById("exportRangeCount"),
      label: document.getElementById("exportRangeLabel"),
      confirmButton: document.getElementById("confirmExportRangeButton"),
      closeButton: document.getElementById("closeExportRangeButton"),
      presetButtons: document.querySelectorAll("[data-range-preset]")
    });

    [
      ["pdfButton", "pdf"],
      ["appleCalendarButton", "apple"],
      ["googleCalendarButton", "google"],
      ["whatsappButton", "whatsapp"]
    ].forEach(([id, action]) => {
      document.getElementById(id)?.addEventListener("click", event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openExportRange(action);
      }, true);
    });

    exportRange.closeButton?.addEventListener("click", closeExportRange);
    exportRange.overlay?.addEventListener("click", event => {
      if (event.target === exportRange.overlay) {
        closeExportRange();
      }
    });

    exportRange.presetButtons?.forEach(button => {
      button.addEventListener("click", () => {
        exportRange.preset = button.dataset.rangePreset || "all";
        applyExportPreset(exportRange.preset);
        updateExportRangePreview();
      });
    });

    [exportRange.startInput, exportRange.endInput].forEach(input => {
      input?.addEventListener("input", () => {
        exportRange.preset = "custom";
        updateExportPresetButtons();
        updateExportRangePreview();
      });
    });

    exportRange.confirmButton?.addEventListener("click", runSelectedExport);

    window.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeExportRange();
      }
    });
  }

  function openExportRange(action) {
    exportRange.action = action;
    exportRange.preset = "all";
    if (exportRange.title) {
      exportRange.title.textContent = exportTitle(action);
    }
    if (exportRange.confirmButton) {
      exportRange.confirmButton.textContent = exportConfirmText(action);
    }
    applyExportPreset("all");
    updateExportRangePreview();
    exportRange.overlay?.classList.remove("is-hidden");
    document.body.classList.add("is-export-range-open");
  }

  function closeExportRange() {
    exportRange.overlay?.classList.add("is-hidden");
    document.body.classList.remove("is-export-range-open");
  }

  function exportTitle(action) {
    const labels = {
      pdf: "Choose dates for PDF",
      apple: "Choose dates for Apple Calendar",
      google: "Choose dates for Google Calendar",
      whatsapp: "Choose dates for WhatsApp"
    };
    return labels[action] || "Choose dates";
  }

  function exportConfirmText(action) {
    const labels = {
      pdf: "Export PDF",
      apple: "Export Apple Calendar",
      google: "Open Google Calendar",
      whatsapp: "Prepare WhatsApp"
    };
    return labels[action] || "Continue export";
  }

  function applyExportPreset(preset) {
    const state = collectPlannerState();
    const dates = state.shifts.map(shift => shift.date).filter(Boolean).sort();
    let start = dates[0] || "";
    let end = dates[dates.length - 1] || "";

    if (preset === "week") {
      start = document.getElementById("weekStartInput")?.value || start;
      end = document.getElementById("weekEndInput")?.value || end;
    }

    if (preset === "month") {
      const selected = document.getElementById("dateInput")?.value || start || toIsoDate(new Date());
      const date = dateFromIso(selected);
      start = toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
      end = toIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
    }

    if (preset !== "custom") {
      if (exportRange.startInput) {
        exportRange.startInput.value = start;
      }
      if (exportRange.endInput) {
        exportRange.endInput.value = end;
      }
    }

    updateExportPresetButtons();
  }

  function updateExportPresetButtons() {
    exportRange.presetButtons?.forEach(button => {
      button.classList.toggle("is-selected", button.dataset.rangePreset === exportRange.preset);
    });
  }

  function updateExportRangePreview() {
    const { rows, start, end } = filteredExportRows();
    if (exportRange.count) {
      exportRange.count.textContent = `${rows.length} ${rows.length === 1 ? "shift" : "shifts"}`;
    }
    if (exportRange.label) {
      exportRange.label.textContent = start && end ? `${formatDateShort(start)} - ${formatDateShort(end)}` : "No dates";
    }
  }

  function filteredExportRows() {
    const state = collectPlannerState();
    let start = exportRange.startInput?.value || "";
    let end = exportRange.endInput?.value || "";

    if (start && end && start > end) {
      [start, end] = [end, start];
    }

    const rows = state.shifts
      .filter(shift => (!start || shift.date >= start) && (!end || shift.date <= end))
      .sort((left, right) => (left.date || "").localeCompare(right.date || "") || (left.start || "99:99").localeCompare(right.start || "99:99") || left.name.localeCompare(right.name));

    return { state, rows, start, end };
  }

  async function runSelectedExport() {
    const { state, rows, start, end } = filteredExportRows();
    if (!rows.length) {
      setAppStatus("No shifts in range");
      updateExportRangePreview();
      return;
    }

    exportRange.confirmButton.disabled = true;
    exportRange.confirmButton.textContent = "Preparing";

    try {
      if (exportRange.action === "pdf") {
        await exportFilteredPdf(state, rows, start, end);
      } else if (exportRange.action === "apple") {
        exportFilteredCalendar("apple", state, rows);
      } else if (exportRange.action === "google") {
        exportFilteredGoogle(state, rows);
      } else if (exportRange.action === "whatsapp") {
        await exportFilteredWhatsapp(state, rows, start, end);
      }
      closeExportRange();
    } catch (error) {
      console.error(error);
      alert("The export could not be created.");
      setAppStatus("Export error");
    } finally {
      exportRange.confirmButton.disabled = false;
      exportRange.confirmButton.textContent = exportConfirmText(exportRange.action);
    }
  }

  async function exportFilteredPdf(state, rows, start, end) {
    const logo = typeof window.loadLogoForPdf === "function" ? await window.loadLogoForPdf() : null;
    if (typeof window.buildPlannerPdf !== "function") {
      throw new Error("PDF builder unavailable");
    }
    const pdf = window.buildPlannerPdf({
      title: state.title || "Planning Burger Folie",
      weekStart: start,
      weekEnd: end,
      shifts: [...rows],
      logo
    });
    downloadBlob(pdf, `${fileBaseName(state.title)}-${dateRangeSlug(start, end)}.pdf`);
    setAppStatus("PDF ready");
  }

  function exportFilteredCalendar(provider, state, rows) {
    const calendar = createCalendarBlob(provider, state, rows);
    downloadBlob(calendar, `${fileBaseName(state.title)}-${provider}-calendar-${dateRangeSlug(rows[0].date, rows[rows.length - 1].date)}.ics`);
    setAppStatus(`${provider === "google" ? "Google" : "Apple"} ready`);
  }

  function exportFilteredGoogle(state, rows) {
    const googleLink = buildGoogleCalendarPlanningLink(state, rows);
    if (!googleLink) {
      setAppStatus("Google unavailable");
      return;
    }
    const popup = window.open(googleLink, "_blank", "noopener");
    if (!popup) {
      copyText(googleLink);
      setAppStatus("Google link copied");
      return;
    }
    setAppStatus("Google opened");
  }

  async function exportFilteredWhatsapp(state, rows, start, end) {
    const message = buildWhatsappMessageForRows(state, rows, start, end);
    const pdf = await createFilteredPdfBlob(state, rows, start, end);
    const appleCalendar = createCalendarBlob("apple", state, rows);
    const googleCalendar = createCalendarBlob("google", state, rows);
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

    if (typeof window.openSharePanel === "function") {
      window.openSharePanel({
        message,
        whatsappUrl,
        files: {
          pdf: { blob: pdf, filename: `${fileBaseName(state.title)}-${dateRangeSlug(start, end)}.pdf` },
          apple: { blob: appleCalendar, filename: `${fileBaseName(state.title)}-apple-calendar-${dateRangeSlug(start, end)}.ics` },
          google: { blob: googleCalendar, filename: `${fileBaseName(state.title)}-google-calendar-${dateRangeSlug(start, end)}.ics` }
        }
      });
      window.setTimeout(() => document.getElementById("downloadAllShareButton")?.click(), 120);
    } else {
      window.open(whatsappUrl, "_blank", "noopener");
    }

    await copyText(message);
    setAppStatus("Share package ready");
  }

  async function createFilteredPdfBlob(state, rows, start, end) {
    const logo = typeof window.loadLogoForPdf === "function" ? await window.loadLogoForPdf() : null;
    if (typeof window.buildPlannerPdf !== "function") {
      throw new Error("PDF builder unavailable");
    }
    return window.buildPlannerPdf({
      title: state.title || "Planning Burger Folie",
      weekStart: start,
      weekEnd: end,
      shifts: [...rows],
      logo
    });
  }

  function createCalendarBlob(provider, state, rows) {
    if (typeof window.buildCalendarFile !== "function") {
      throw new Error("Calendar builder unavailable");
    }
    const title = `${state.title || "Planning Burger Folie"} - ${provider === "google" ? "Google Calendar" : "Apple Calendar"}`;
    return new Blob([window.buildCalendarFile({ title, shifts: [...rows] })], { type: "text/calendar;charset=utf-8" });
  }

  function buildWhatsappMessageForRows(state, rows, start, end) {
    const period = start && end
      ? `${formatDateShort(start)} - ${formatDateShort(end)}`
      : planningRange(rows);
    const lines = [
      state.title || "Planning Burger Folie",
      `Periode: ${period}`,
      "",
      "Planning:"
    ];

    groupByDate(rows).forEach(group => {
      lines.push(formatDateLongNl(group.date));
      group.items.forEach(shift => {
        lines.push(`- ${shift.name}: ${formatHours(shift)}`);
      });
    });

    const googleLink = buildGoogleCalendarPlanningLink(state, rows);
    if (googleLink) {
      lines.push("", "Google Agenda:", googleLink);
    }

    return lines.join("\n");
  }

  function buildGoogleCalendarPlanningLink(state, rows) {
    const validRows = [...rows].filter(shift => shift.date && shift.name);
    if (!validRows.length) {
      return "";
    }

    validRows.sort((left, right) => (left.date || "").localeCompare(right.date || "") || (left.start || "99:99").localeCompare(right.start || "99:99"));
    const firstDate = dateFromIso(validRows[0].date);
    const lastDate = dateFromIso(validRows[validRows.length - 1].date);
    lastDate.setDate(lastDate.getDate() + 1);

    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: state.title || "Planning Burger Folie",
      dates: `${googleAllDayDate(firstDate)}/${googleAllDayDate(lastDate)}`,
      ctz: "Europe/Brussels",
      details: googlePlanningDescription(validRows),
      location: "Burger Folie"
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function googlePlanningDescription(rows) {
    const lines = ["Planning Burger Folie", ""];
    groupByDate(rows).forEach(group => {
      lines.push(formatDateLongNl(group.date));
      group.items.forEach(shift => {
        lines.push(`- ${shift.name}: ${formatHours(shift)}`);
      });
    });
    return lines.join("\n");
  }

  function googleAllDayDate(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("");
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function fileBaseName(title) {
    return String(title || "planning-burger-folie")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "planning-burger-folie";
  }

  function dateRangeSlug(start, end) {
    if (!start && !end) {
      return "all";
    }
    return `${start || "start"}-${end || "end"}`;
  }

  function setAppStatus(message) {
    if (typeof window.setStatus === "function") {
      window.setStatus(message);
    }
    setTransferStatus("export", message);
  }

  function bindTransferPage() {
    const menu = document.getElementById("appMenu");
    const transferButtons = document.querySelectorAll("[data-transfer-page]");

    transferButtons.forEach(button => {
      button.addEventListener("click", () => showTransferPage(true));
    });

    menu?.addEventListener("click", event => {
      if (event.target.closest("button[data-page]")) {
        transferButtons.forEach(button => button.classList.remove("is-active"));
      }
    });

    window.addEventListener("hashchange", () => {
      if (location.hash === "#transfer") {
        window.setTimeout(() => showTransferPage(false), 0);
      } else {
        transferButtons.forEach(button => button.classList.remove("is-active"));
      }
    });
  }

  function showTransferPage(updateHash) {
    document.querySelectorAll("[data-page-view]").forEach(view => {
      const isActive = view.dataset.pageView === "transfer";
      view.classList.toggle("is-active", isActive);
      view.setAttribute("aria-hidden", String(!isActive));
    });

    document.querySelectorAll(".menu-link").forEach(link => {
      link.classList.toggle("is-active", link.dataset.transferPage === "transfer");
    });

    const label = document.getElementById("activePageLabel");
    if (label) {
      label.textContent = "Export Data";
    }

    closeMenu();
    renderTransferCode();

    if (updateHash) {
      history.replaceState(null, "", "#transfer");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function closeMenu() {
    document.getElementById("appMenu")?.classList.remove("is-open");
    document.getElementById("menuBackdrop")?.classList.add("is-hidden");
    document.getElementById("menuButton")?.setAttribute("aria-expanded", "false");
  }

  function bindTransferTools() {
    Object.assign(transfer, {
      code: document.getElementById("transferCode"),
      importCode: document.getElementById("importTransferCode"),
      refreshButton: document.getElementById("refreshTransferButton"),
      copyButton: document.getElementById("copyTransferButton"),
      mailButton: document.getElementById("mailTransferButton"),
      importButton: document.getElementById("importTransferButton"),
      exportStatus: document.getElementById("transferExportStatus"),
      importStatus: document.getElementById("transferImportStatus"),
      peopleCount: document.getElementById("transferPeopleCount"),
      shiftCount: document.getElementById("transferShiftCount"),
      dateRange: document.getElementById("transferDateRange")
    });

    transfer.refreshButton?.addEventListener("click", () => {
      renderTransferCode();
      setTransferStatus("export", "Refreshed");
    });

    transfer.copyButton?.addEventListener("click", async () => {
      renderTransferCode();
      const copied = await copyText(transfer.code?.value || "");
      setTransferStatus("export", copied ? "Copied" : "Copy failed");
    });

    transfer.mailButton?.addEventListener("click", () => {
      renderTransferCode();
      openMailWithTransferCode();
    });

    transfer.importCode?.addEventListener("input", () => {
      if (!transfer.importCode.value.trim()) {
        setTransferStatus("import", "Waiting");
        return;
      }

      try {
        const state = decodeTransferCode(transfer.importCode.value);
        setTransferStatus("import", `${state.shifts.length} shifts found`);
      } catch {
        setTransferStatus("import", "Invalid code", true);
      }
    });

    transfer.importButton?.addEventListener("click", importTransferCode);
  }

  function renderTransferCode() {
    if (!transfer.code) {
      return;
    }

    const state = collectPlannerState();
    transfer.code.value = encodeTransferCode(state);

    if (transfer.peopleCount) {
      transfer.peopleCount.textContent = String(state.people.length);
    }
    if (transfer.shiftCount) {
      transfer.shiftCount.textContent = String(state.shifts.length);
    }
    if (transfer.dateRange) {
      transfer.dateRange.textContent = planningRange(state.shifts);
    }
  }

  function collectPlannerState() {
    try {
      if (typeof window.saveState === "function") {
        window.saveState();
      }
    } catch {
      // The base app may still be locked. The stored state remains valid.
    }

    return normalizePlannerState({
      ...readStoredState(),
      title: document.getElementById("titleInput")?.value || readStoredState().title,
      weekStart: document.getElementById("weekStartInput")?.value || readStoredState().weekStart,
      weekEnd: document.getElementById("weekEndInput")?.value || readStoredState().weekEnd
    });
  }

  function encodeTransferCode(state) {
    const payload = {
      app: "burger-folie-planner",
      version: 1,
      exportedAt: new Date().toISOString(),
      state: normalizePlannerState(state)
    };
    return `${TRANSFER_PREFIX}${base64UrlEncode(JSON.stringify(payload))}`;
  }

  function decodeTransferCode(rawCode) {
    const compact = String(rawCode || "").replace(/\s+/g, "");
    const encoded = compact.startsWith(TRANSFER_PREFIX)
      ? compact.slice(TRANSFER_PREFIX.length)
      : compact;
    const payload = JSON.parse(base64UrlDecode(encoded));
    const state = payload?.state || payload;

    if (!state || !Array.isArray(state.people) || !Array.isArray(state.shifts)) {
      throw new Error("Invalid transfer state");
    }

    return normalizePlannerState(state);
  }

  async function copyText(value) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      // Fall back to a temporary textarea below.
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      return copied;
    } catch {
      return false;
    }
  }

  function openMailWithTransferCode() {
    const state = collectPlannerState();
    const code = transfer.code?.value || encodeTransferCode(state);
    const subject = "Burger Folie planning transfer";
    const body = [
      "Burger Folie planning transfer code:",
      "",
      code,
      "",
      "Open the planner on the other device, go to Export Data, paste this code under Import Data and press Import planning."
    ].join("\n");

    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setTransferStatus("export", "Mail opened");
  }

  function importTransferCode() {
    try {
      const incoming = decodeTransferCode(transfer.importCode?.value || "");
      const current = readStoredState();
      const shouldMerge = document.getElementById("transferMergeMode")?.checked;
      const nextState = shouldMerge ? mergePlannerStates(current, incoming) : incoming;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      setTransferStatus("import", "Imported");
      window.setTimeout(() => location.reload(), 550);
    } catch {
      setTransferStatus("import", "Invalid code", true);
    }
  }

  function setTransferStatus(type, message, isError = false) {
    const element = type === "import" ? transfer.importStatus : transfer.exportStatus;
    if (!element) {
      return;
    }
    element.textContent = message;
    element.classList.toggle("is-error", isError);
  }

  function normalizePlannerState(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const people = uniqueNames(source.people);
    const shifts = Array.isArray(source.shifts)
      ? source.shifts
        .map(shift => ({
          id: String(shift.id || createId()),
          date: String(shift.date || ""),
          name: String(shift.name || "").trim(),
          start: String(shift.start || ""),
          end: String(shift.end || "")
        }))
        .filter(shift => shift.date && shift.name)
      : [];

    shifts.forEach(shift => {
      if (!people.some(person => person.toLowerCase() === shift.name.toLowerCase())) {
        people.push(shift.name);
      }
    });
    people.sort((left, right) => left.localeCompare(right));

    return {
      title: String(source.title || "Planning Burger Folie"),
      weekStart: String(source.weekStart || ""),
      weekEnd: String(source.weekEnd || ""),
      people,
      shifts
    };
  }

  function mergePlannerStates(current, incoming) {
    const base = normalizePlannerState(current);
    const next = normalizePlannerState(incoming);
    const people = uniqueNames([...base.people, ...next.people]);
    const seen = new Set();
    const shifts = [];

    [...base.shifts, ...next.shifts].forEach(shift => {
      const key = [shift.date, shift.name.toLowerCase(), shift.start, shift.end].join("|");
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      shifts.push({ ...shift, id: shift.id || createId() });
    });

    return {
      title: next.title || base.title,
      weekStart: next.weekStart || base.weekStart,
      weekEnd: next.weekEnd || base.weekEnd,
      people,
      shifts
    };
  }

  function readStoredState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function uniqueNames(names) {
    const map = new Map();
    (Array.isArray(names) ? names : []).forEach(name => {
      const value = String(name || "").trim().replace(/\s+/g, " ");
      if (value) {
        map.set(value.toLowerCase(), value);
      }
    });
    return [...map.values()].sort((left, right) => left.localeCompare(right));
  }

  function base64UrlEncode(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlDecode(value) {
    const base64 = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new TextDecoder().decode(bytes);
  }

  function planningRange(rows) {
    const dates = rows.map(row => row.date).filter(Boolean).sort();
    return dates.length ? `${formatDateShort(dates[0])} - ${formatDateShort(dates[dates.length - 1])}` : "No dates";
  }

  function groupByDate(rows) {
    const map = new Map();
    rows.forEach(row => {
      const key = row.date || "No date";
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(row);
    });
    return [...map.entries()].map(([date, items]) => ({ date, items }));
  }

  function formatDateShort(iso) {
    if (!iso) {
      return "-";
    }
    return new Intl.DateTimeFormat("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(dateFromIso(iso));
  }

  function formatDateLongNl(iso) {
    if (!iso || iso === "No date") {
      return "Geen datum";
    }
    const date = dateFromIso(iso);
    return `${WEEKDAYS_NL[date.getDay()]} ${formatDateShort(iso)}`;
  }

  function formatDateLongUi(iso) {
    if (!iso) {
      return "Selected day";
    }
    const date = dateFromIso(iso);
    const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(date);
    return `${weekday} ${formatDateShort(iso)}`;
  }

  function formatHours(shift) {
    return shift.start && shift.end ? `${shift.start} - ${shift.end}` : shift.start || "-";
  }

  function dateFromIso(iso) {
    const [year, month, day] = String(iso || "").split("-").map(Number);
    return new Date(year || 1970, (month || 1) - 1, day || 1);
  }

  function toIsoDate(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/"/g, "&quot;");
  }

  function createId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `shift-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
})();
