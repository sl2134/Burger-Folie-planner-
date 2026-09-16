const STORAGE_KEY = "burger-folie-planner-v2";
const ACCESS_STORAGE_KEY = "burger-folie-access-v1";
const ACCESS_HASH = "5ca54fb8647d5ac5e559ef9e26fc1b1fb6400351e50923d50ae5876b20c36d77";
const LOGO_URL = "./assets/burger-folie-logo.png";
const DEFAULT_END_TIME = "22:00";
const REGULAR_STARTS = {
  weekday: ["17:30", "18:00"],
  weekend: ["17:00", "17:30"]
};

const weekdays = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
const calendarWeekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const PAGE_LABELS = {
  planner: "Planner",
  people: "People",
  transfer: "Export Data"
};

const elements = {
  accessGate: document.getElementById("accessGate"),
  accessForm: document.getElementById("accessForm"),
  accessInput: document.getElementById("accessInput"),
  accessStatus: document.getElementById("accessStatus"),
  menuButton: document.getElementById("menuButton"),
  menuBackdrop: document.getElementById("menuBackdrop"),
  appMenu: document.getElementById("appMenu"),
  activePageLabel: document.getElementById("activePageLabel"),
  pageViews: document.querySelectorAll("[data-page-view]"),
  menuLinks: document.querySelectorAll("[data-page]"),
  pageJumpButtons: document.querySelectorAll("[data-page-target]"),
  titleInput: document.getElementById("titleInput"),
  weekStartInput: document.getElementById("weekStartInput"),
  weekEndInput: document.getElementById("weekEndInput"),
  personForm: document.getElementById("personForm"),
  personInput: document.getElementById("personInput"),
  personSelect: document.getElementById("personSelect"),
  peopleList: document.getElementById("peopleList"),
  dateInput: document.getElementById("dateInput"),
  regularTimeMode: document.getElementById("regularTimeMode"),
  customTimeMode: document.getElementById("customTimeMode"),
  regularStartField: document.getElementById("regularStartField"),
  customStartField: document.getElementById("customStartField"),
  regularStartButtons: document.getElementById("regularStartButtons"),
  startInput: document.getElementById("startInput"),
  endInput: document.getElementById("endInput"),
  shiftForm: document.getElementById("shiftForm"),
  manualEntryToggle: document.getElementById("manualEntryToggle"),
  shiftTable: document.getElementById("shiftTable"),
  clearShiftsButton: document.getElementById("clearShiftsButton"),
  resetFormButton: document.getElementById("resetFormButton"),
  pdfButton: document.getElementById("pdfButton"),
  pdfButtonLabel: document.querySelector("#pdfButton .button-text"),
  appleCalendarButton: document.getElementById("appleCalendarButton"),
  googleCalendarButton: document.getElementById("googleCalendarButton"),
  whatsappButton: document.getElementById("whatsappButton"),
  whatsappButtonLabel: document.querySelector("#whatsappButton .button-text"),
  installAppButton: document.getElementById("installAppButton"),
  installOverlay: document.getElementById("installOverlay"),
  installCopy: document.getElementById("installCopy"),
  installConfirmButton: document.getElementById("installConfirmButton"),
  closeInstallOverlayButton: document.getElementById("closeInstallOverlayButton"),
  shareOverlay: document.getElementById("shareOverlay"),
  whatsappMessage: document.getElementById("whatsappMessage"),
  sharePdfLink: document.getElementById("sharePdfLink"),
  shareAppleLink: document.getElementById("shareAppleLink"),
  shareGoogleLink: document.getElementById("shareGoogleLink"),
  nativeShareButton: document.getElementById("nativeShareButton"),
  downloadAllShareButton: document.getElementById("downloadAllShareButton"),
  copyWhatsappButton: document.getElementById("copyWhatsappButton"),
  openWhatsappLink: document.getElementById("openWhatsappLink"),
  closeShareButton: document.getElementById("closeShareButton"),
  saveButton: document.getElementById("saveButton"),
  saveState: document.getElementById("saveState"),
  plannerSaveState: document.getElementById("plannerSaveState"),
  peopleCount: document.getElementById("peopleCount"),
  shiftCount: document.getElementById("shiftCount"),
  dateRange: document.getElementById("dateRange"),
  prevMonthButton: document.getElementById("prevMonthButton"),
  nextMonthButton: document.getElementById("nextMonthButton"),
  calendarMonthLabel: document.getElementById("calendarMonthLabel"),
  calendarGrid: document.getElementById("calendarGrid"),
  selectedDateLabel: document.getElementById("selectedDateLabel"),
  calendarPeople: document.getElementById("calendarPeople")
};

let people = [];
let shifts = [];
let saveTimer = 0;
let selectedDateIso = "";
let calendarCursorDate = new Date();
let preparedShareUrls = [];
let preparedNativeFiles = [];
let appStarted = false;
let accessFormBound = false;
let deferredInstallPrompt = null;

async function boot() {
  if (!await ensureAccess()) {
    return;
  }
  startApp();
}

function startApp() {
  if (appStarted) {
    return;
  }
  appStarted = true;

  const today = new Date();
  selectedDateIso = toIsoDate(today);
  calendarCursorDate = new Date(today.getFullYear(), today.getMonth(), 1);
  elements.dateInput.value = selectedDateIso;
  elements.weekStartInput.value = startOfWeek(today);
  elements.weekEndInput.value = endOfWeek(today);
  elements.startInput.value = "18:00";
  elements.endInput.value = DEFAULT_END_TIME;

  const stored = readStoredState();
  if (stored) {
    elements.titleInput.value = stored.title || "Planning Burger Folie";
    elements.weekStartInput.value = stored.weekStart || elements.weekStartInput.value;
    elements.weekEndInput.value = stored.weekEnd || elements.weekEndInput.value;
    people = Array.isArray(stored.people) ? stored.people : [];
    shifts = Array.isArray(stored.shifts) ? stored.shifts : [];
  }

  bindEvents();
  installInteractionEffects();
  updateRegularStartOptions();
  updateTimeModeControls();
  render();
  syncPageFromHash();
  registerServiceWorker();
}

async function ensureAccess() {
  const hashAccess = getAccessFromHash();
  if (hashAccess) {
    if (await isAccessValid(hashAccess.code)) {
      localStorage.setItem(ACCESS_STORAGE_KEY, "granted");
      unlockAccess(hashAccess.page);
      return true;
    }
    showAccessGate("That access key is not valid.");
    return false;
  }

  if (localStorage.getItem(ACCESS_STORAGE_KEY) === "granted") {
    unlockAccess(getPageFromHash());
    return true;
  }

  showAccessGate("");
  return false;
}

function showAccessGate(message) {
  document.body.classList.add("is-access-locked");
  elements.accessGate?.classList.remove("is-hidden");
  if (elements.accessStatus) {
    elements.accessStatus.textContent = message || "Use the private Burger Folie link, or paste the access key.";
    elements.accessStatus.classList.toggle("is-error", Boolean(message));
  }
  bindAccessForm();
  window.setTimeout(() => elements.accessInput?.focus(), 80);
}

function bindAccessForm() {
  if (accessFormBound || !elements.accessForm) {
    return;
  }
  accessFormBound = true;
  elements.accessForm.addEventListener("submit", async event => {
    event.preventDefault();
    const code = elements.accessInput.value.trim();
    if (!code) {
      showAccessGate("Paste the private access key first.");
      return;
    }
    if (!await isAccessValid(code)) {
      elements.accessInput.select();
      showAccessGate("That access key is not valid.");
      return;
    }
    localStorage.setItem(ACCESS_STORAGE_KEY, "granted");
    unlockAccess(getPageFromHash());
    startApp();
  });
}

function unlockAccess(page = "planner") {
  document.body.classList.remove("is-access-locked");
  elements.accessGate?.classList.add("is-hidden");
  sanitizeAccessHash(page);
}

function getAccessFromHash() {
  const raw = location.hash.slice(1);
  if (!raw) {
    return null;
  }

  const params = new URLSearchParams(raw);
  const code = params.get("access") || params.get("key") || params.get("bf");
  if (code) {
    return {
      code,
      page: PAGE_LABELS[params.get("page")] ? params.get("page") : "planner"
    };
  }

  if (raw !== "people" && raw.length > 24 && !raw.includes("=")) {
    return { code: raw, page: "planner" };
  }

  return null;
}

function getPageFromHash() {
  const raw = location.hash.slice(1);
  if (PAGE_LABELS[raw]) {
    return raw;
  }
  const params = new URLSearchParams(raw);
  return PAGE_LABELS[params.get("page")] ? params.get("page") : "planner";
}

function sanitizeAccessHash(page) {
  if (!getAccessFromHash()) {
    return;
  }
  const nextPage = PAGE_LABELS[page] ? page : "planner";
  const nextUrl = nextPage === "planner"
    ? `${location.pathname}${location.search}`
    : `${location.pathname}${location.search}#${nextPage}`;
  history.replaceState(null, "", nextUrl);
}

async function isAccessValid(code) {
  if (!code || !window.crypto?.subtle || !window.TextEncoder) {
    return false;
  }
  const encoded = new TextEncoder().encode(code.trim());
  const digest = await window.crypto.subtle.digest("SHA-256", encoded);
  return timingSafeEqual(bytesToHex(new Uint8Array(digest)), ACCESS_HASH);
}

function bytesToHex(bytes) {
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function bindEvents() {
  elements.menuButton.addEventListener("click", toggleMenu);
  elements.menuBackdrop.addEventListener("click", closeMenu);
  window.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeMenu();
      closeSharePanel();
      closeInstallPanel();
    }
  });
  elements.appMenu.addEventListener("click", event => {
    const button = event.target.closest("button[data-page]");
    if (!button) {
      return;
    }
    showPage(button.dataset.page);
  });
  elements.pageJumpButtons.forEach(button => {
    button.addEventListener("click", () => showPage(button.dataset.pageTarget));
  });
  window.addEventListener("hashchange", syncPageFromHash);

  elements.personForm.addEventListener("submit", event => {
    event.preventDefault();
    addPerson(elements.personInput.value);
    elements.personInput.value = "";
    elements.personInput.focus();
  });

  elements.peopleList.addEventListener("click", event => {
    const button = event.target.closest("button[data-person]");
    if (!button) {
      return;
    }
    people = people.filter(person => person !== button.dataset.person);
    render();
    saveState();
  });

  elements.shiftForm.addEventListener("submit", event => {
    event.preventDefault();
    addShiftFromForm();
  });

  elements.manualEntryToggle?.addEventListener("click", () => {
    const nowHidden = elements.shiftForm.classList.toggle("is-hidden");
    elements.manualEntryToggle.setAttribute("aria-expanded", String(!nowHidden));
    elements.manualEntryToggle.classList.toggle("is-active", !nowHidden);
  });

  elements.resetFormButton.addEventListener("click", () => {
    elements.shiftForm.reset();
    selectDate(toIsoDate(new Date()), { syncWeek: false });
    elements.endInput.value = DEFAULT_END_TIME;
    elements.regularTimeMode.checked = true;
    updateRegularStartOptions();
    updateTimeModeControls();
    renderPersonSelect();
  });

  elements.clearShiftsButton.addEventListener("click", () => {
    if (!confirm("Clear all shifts?")) {
      return;
    }
    shifts = [];
    render();
    saveState();
    setStatus("Cleared");
  });

  elements.saveButton?.addEventListener("click", () => {
    saveState();
    setStatus("Saved");
  });

  elements.pdfButton.addEventListener("click", exportPdf);
  elements.appleCalendarButton.addEventListener("click", () => exportCalendar("apple"));
  elements.googleCalendarButton.addEventListener("click", () => exportCalendar("google"));
  elements.whatsappButton.addEventListener("click", shareToWhatsApp);
  elements.installAppButton?.addEventListener("click", handleInstallApp);
  elements.closeInstallOverlayButton?.addEventListener("click", closeInstallPanel);
  elements.installConfirmButton?.addEventListener("click", confirmInstallAction);
  elements.installOverlay?.addEventListener("click", event => {
    if (event.target === elements.installOverlay) {
      closeInstallPanel();
    }
  });
  elements.closeShareButton.addEventListener("click", closeSharePanel);
  elements.shareOverlay.addEventListener("click", event => {
    if (event.target === elements.shareOverlay) {
      closeSharePanel();
    }
  });
  elements.copyWhatsappButton.addEventListener("click", async () => {
    const copied = await copyText(elements.whatsappMessage.value);
    setStatus(copied ? "Message copied" : "Copy unavailable");
  });
  elements.nativeShareButton.addEventListener("click", shareNativePackage);
  elements.downloadAllShareButton.addEventListener("click", () => {
    downloadPreparedShareFiles();
    setStatus("Downloads started");
  });

  elements.prevMonthButton.addEventListener("click", () => {
    calendarCursorDate = new Date(calendarCursorDate.getFullYear(), calendarCursorDate.getMonth() - 1, 1);
    renderCalendar();
  });

  elements.nextMonthButton.addEventListener("click", () => {
    calendarCursorDate = new Date(calendarCursorDate.getFullYear(), calendarCursorDate.getMonth() + 1, 1);
    renderCalendar();
  });

  elements.calendarGrid.addEventListener("click", event => {
    const button = event.target.closest("button[data-date]");
    if (!button) {
      return;
    }
    selectDate(button.dataset.date);
    render();
  });

  elements.calendarPeople.addEventListener("click", event => {
    const timeButton = event.target.closest("button[data-person][data-time]");
    if (timeButton) {
      addQuickShift(timeButton.dataset.person, timeButton.dataset.time);
      return;
    }

    const personButton = event.target.closest("button[data-person]");
    if (personButton) {
      const wrap = personButton.closest(".calendar-person-wrap");
      elements.calendarPeople.querySelectorAll(".calendar-person-wrap.is-open").forEach(openWrap => {
        if (openWrap !== wrap) {
          openWrap.classList.remove("is-open");
        }
      });
      wrap?.classList.toggle("is-open");
    }
  });

  elements.dateInput.addEventListener("input", () => {
    selectDate(elements.dateInput.value, { syncWeek: true });
    render();
    queueSave();
  });

  elements.regularTimeMode.addEventListener("change", () => {
    updateRegularStartOptions();
    updateTimeModeControls();
  });

  elements.customTimeMode.addEventListener("change", () => {
    updateTimeModeControls();
  });

  elements.regularStartButtons.addEventListener("click", event => {
    const button = event.target.closest("button[data-time]");
    if (!button) {
      return;
    }
    elements.startInput.value = button.dataset.time;
    renderRegularStartButtons();
    queueSave();
  });

  [elements.titleInput, elements.weekStartInput, elements.weekEndInput].forEach(element => {
    element.addEventListener("input", () => {
      renderSummary();
      queueSave();
    });
  });

  elements.shiftTable.addEventListener("input", event => {
    updateShiftFromTable(event);
  });

  elements.shiftTable.addEventListener("change", event => {
    updateShiftFromTable(event);
  });

  elements.shiftTable.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const id = button.closest("tr[data-id]")?.dataset.id;
    if (!id) {
      return;
    }

    if (button.dataset.action === "delete") {
      shifts = shifts.filter(shift => shift.id !== id);
    }

    if (button.dataset.action === "copy") {
      const source = shifts.find(shift => shift.id === id);
      if (source) {
        shifts.push({ ...source, id: createId() });
      }
    }

    render();
    saveState();
  });
}

function installInteractionEffects() {
  document.addEventListener("pointerdown", event => {
    const target = event.target.closest(".button, .icon-button, .calendar-day, .calendar-person-button, .time-option-button, .person-time-button, .menu-link");
    if (!target || target.matches(":disabled")) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "tap-ripple";
    ripple.style.left = `${event.clientX - rect.left}px`;
    ripple.style.top = `${event.clientY - rect.top}px`;
    target.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
  });
}

function setupInstallExperience() {
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallButtonState();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    closeInstallPanel();
    updateInstallButtonState();
    setStatus("App installed");
  });

  updateInstallButtonState();
}

function isStandaloneApp() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function updateInstallButtonState() {
  if (!elements.installAppButton) {
    return;
  }
  elements.installAppButton.hidden = isStandaloneApp();
}

async function handleInstallApp() {
  if (isStandaloneApp()) {
    setStatus("Already installed");
    updateInstallButtonState();
    return;
  }

  if (deferredInstallPrompt) {
    await promptForInstall();
    return;
  }

  showInstallPanel();
}

async function promptForInstall() {
  const promptEvent = deferredInstallPrompt;
  if (!promptEvent) {
    showInstallPanel();
    return;
  }

  promptEvent.prompt();
  const choice = await promptEvent.userChoice.catch(() => null);
  deferredInstallPrompt = null;
  updateInstallButtonState();

  if (choice?.outcome === "accepted") {
    setStatus("App installed");
  } else {
    showInstallPanel();
  }
}

function showInstallPanel() {
  if (!elements.installOverlay) {
    return;
  }

  const isAppleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
  if (elements.installCopy) {
    elements.installCopy.textContent = isAppleMobile
      ? "Add this planner to your home screen for a clean full-screen iPhone app."
      : "Add this planner to your home screen for a cleaner full-screen app.";
  }
  if (elements.installConfirmButton) {
    elements.installConfirmButton.textContent = deferredInstallPrompt ? "Install now" : "Got it";
  }

  elements.installOverlay.classList.remove("is-hidden");
  document.body.classList.add("is-install-open");
}

function closeInstallPanel() {
  elements.installOverlay?.classList.add("is-hidden");
  document.body.classList.remove("is-install-open");
}

async function confirmInstallAction() {
  if (deferredInstallPrompt) {
    await promptForInstall();
    return;
  }
  closeInstallPanel();
}

function toggleMenu() {
  const isOpen = elements.appMenu.classList.toggle("is-open");
  elements.menuBackdrop.classList.toggle("is-hidden", !isOpen);
  elements.menuButton.setAttribute("aria-expanded", String(isOpen));
}

function closeMenu() {
  elements.appMenu.classList.remove("is-open");
  elements.menuBackdrop.classList.add("is-hidden");
  elements.menuButton.setAttribute("aria-expanded", "false");
}

function showPage(page, options = {}) {
  const nextPage = PAGE_LABELS[page] ? page : "planner";
  elements.pageViews.forEach(view => {
    const isActive = view.dataset.pageView === nextPage;
    view.classList.toggle("is-active", isActive);
    view.setAttribute("aria-hidden", String(!isActive));
  });
  elements.menuLinks.forEach(link => {
    link.classList.toggle("is-active", link.dataset.page === nextPage);
  });
  elements.activePageLabel.textContent = PAGE_LABELS[nextPage];
  closeMenu();

  if (options.updateHash !== false) {
    const nextUrl = nextPage === "planner"
      ? `${location.pathname}${location.search}`
      : `#${nextPage}`;
    history.replaceState(null, "", nextUrl);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function syncPageFromHash() {
  showPage(getPageFromHash(), { updateHash: false });
}

function selectDate(dateIso, options = {}) {
  if (!dateIso) {
    return;
  }
  selectedDateIso = dateIso;
  elements.dateInput.value = dateIso;
  const selectedDate = dateFromIso(dateIso);
  calendarCursorDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);

  if (options.syncWeek !== false) {
    elements.weekStartInput.value = startOfWeek(selectedDate);
    elements.weekEndInput.value = endOfWeek(selectedDate);
  }

  updateRegularStartOptions();
  updateTimeModeControls();
}

function updateRegularStartOptions() {
  const options = regularStartsForDate(selectedDateIso || elements.dateInput.value);
  const selectedStart = options.includes(elements.startInput.value) ? elements.startInput.value : options[0];
  elements.startInput.value = selectedStart;
  renderRegularStartButtons();

  if (elements.regularTimeMode.checked) {
    elements.startInput.value = selectedStart;
  }

  if (!elements.endInput.value) {
    elements.endInput.value = DEFAULT_END_TIME;
  }
}

function renderRegularStartButtons() {
  const options = regularStartsForDate(selectedDateIso || elements.dateInput.value);
  elements.regularStartButtons.innerHTML = options.map(start => `
    <button type="button" class="time-option-button${start === elements.startInput.value ? " is-selected" : ""}" data-time="${escapeAttribute(start)}" aria-pressed="${start === elements.startInput.value}">
      ${escapeHtml(start)}
    </button>
  `).join("");
}

function updateTimeModeControls() {
  const custom = elements.customTimeMode.checked;
  elements.regularStartField.classList.toggle("is-hidden", custom);
  elements.customStartField.classList.toggle("is-hidden", !custom);

  if (!custom) {
    updateRegularStartOptions();
  }
}

function regularStartsForDate(dateIso) {
  return isWeekend(dateIso || toIsoDate(new Date())) ? REGULAR_STARTS.weekend : REGULAR_STARTS.weekday;
}

function currentShiftTimes() {
  return {
    start: elements.startInput.value,
    end: elements.endInput.value || DEFAULT_END_TIME
  };
}

function addQuickShift(person, startOverride = "") {
  if (!person) {
    return;
  }

  addPerson(person, false);
  const times = currentShiftTimes();
  if (startOverride) {
    times.start = startOverride;
  }
  const duplicate = shifts.some(shift =>
    shift.date === selectedDateIso &&
    shift.name === person &&
    shift.start === times.start
  );

  if (duplicate) {
    setStatus("Already planned");
    return;
  }

  shifts.push({
    id: createId(),
    date: selectedDateIso || elements.dateInput.value || toIsoDate(new Date()),
    name: person,
    start: times.start,
    end: times.end
  });

  elements.personSelect.value = person;
  render();
  saveState();
  setStatus("Shift added");
}

function updateShiftFromTable(event) {
  const target = event.target;
  const row = target.closest("tr[data-id]");
  if (!row || !target.dataset.field) {
    return;
  }

  const shift = shifts.find(item => item.id === row.dataset.id);
  if (!shift) {
    return;
  }

  shift[target.dataset.field] = target.value;
  if (target.dataset.field === "name") {
    addPerson(target.value, false);
  }
  renderCalendar();
  renderSummary();
  queueSave();
}

function addPerson(rawName, shouldRender = true) {
  const name = normalizeName(rawName);
  if (!name) {
    return;
  }
  if (!people.some(person => person.toLowerCase() === name.toLowerCase())) {
    people.push(name);
    people.sort((left, right) => left.localeCompare(right));
  }
  if (shouldRender) {
    render();
    saveState();
    setStatus("Person added");
  }
}

function addShiftFromForm() {
  const name = elements.personSelect.value;
  if (!name) {
    elements.personSelect.focus();
    return;
  }

  addPerson(name, false);
  const times = currentShiftTimes();
  shifts.push({
    id: createId(),
    date: elements.dateInput.value || toIsoDate(new Date()),
    name,
    start: times.start,
    end: times.end
  });

  elements.personSelect.focus();
  render();
  saveState();
}

function render() {
  sortShifts();
  renderPeople();
  renderPersonSelect();
  renderCalendar();
  renderCalendarPeople();
  renderTable();
  renderSummary();
}

function renderPeople() {
  elements.peopleList.innerHTML = "";
  if (!people.length) {
    const empty = document.createElement("span");
    empty.className = "empty-list";
    empty.textContent = "No people yet";
    elements.peopleList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  people.forEach(person => {
    const chip = document.createElement("span");
    chip.className = "person-chip";
    chip.innerHTML = `
      <span class="avatar-dot sm ${personAvatarClass(person)}">${escapeHtml(personInitials(person))}</span>
      <span>${escapeHtml(person)}</span>
      <button type="button" data-person="${escapeAttribute(person)}" title="Remove ${escapeAttribute(person)}" aria-label="Remove ${escapeAttribute(person)}">×</button>
    `;
    fragment.appendChild(chip);
  });
  elements.peopleList.appendChild(fragment);
}

function renderCalendarPeople() {
  elements.calendarPeople.innerHTML = "";

  if (!people.length) {
    const empty = document.createElement("span");
    empty.className = "empty-list";
    empty.textContent = "No people yet";
    elements.calendarPeople.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  people.forEach(person => {
    const wrap = document.createElement("span");
    wrap.className = "calendar-person-wrap";
    wrap.innerHTML = `
      <span class="calendar-person-times">
        ${regularStartsForDate(selectedDateIso || elements.dateInput.value).map(start => `
          <button type="button" class="person-time-button" data-person="${escapeAttribute(person)}" data-time="${escapeAttribute(start)}">${escapeHtml(start)}</button>
        `).join("")}
      </span>
    `;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-person-button";
    button.dataset.person = person;
    button.innerHTML = `
      <span class="avatar-dot sm ${personAvatarClass(person)}">${escapeHtml(personInitials(person))}</span>
      <span>${escapeHtml(person)}</span>
    `;
    wrap.appendChild(button);
    fragment.appendChild(wrap);
  });

  elements.calendarPeople.appendChild(fragment);
}

function renderCalendar() {
  const monthStart = new Date(calendarCursorDate.getFullYear(), calendarCursorDate.getMonth(), 1);
  elements.calendarMonthLabel.textContent = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric"
  }).format(monthStart);
  elements.selectedDateLabel.textContent = selectedDateIso ? formatDateLongUi(selectedDateIso) : "No date selected";

  const shiftMap = shiftsByDate();
  const todayIso = toIsoDate(new Date());
  const dates = monthGridDates(monthStart);
  const fragment = document.createDocumentFragment();
  elements.calendarGrid.innerHTML = "";

  dates.forEach(date => {
    const iso = toIsoDate(date);
    const dayShifts = shiftMap.get(iso) || [];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.dataset.date = iso;
    button.setAttribute("aria-label", `${formatDateLongUi(iso)}, ${dayShifts.length} shifts`);
    button.classList.toggle("is-outside", date.getMonth() !== monthStart.getMonth());
    button.classList.toggle("is-selected", iso === selectedDateIso);
    button.classList.toggle("is-today", iso === todayIso);
    button.innerHTML = `
      <span class="calendar-day-number">${date.getDate()}</span>
      <span class="calendar-day-meta">${dayShifts.length ? `${dayShifts.length} shift${dayShifts.length === 1 ? "" : "s"}` : calendarWeekdays[(date.getDay() + 6) % 7]}</span>
      <span class="calendar-shift-list">${calendarShiftPreview(dayShifts)}</span>
    `;
    fragment.appendChild(button);
  });

  elements.calendarGrid.appendChild(fragment);
}

function calendarShiftPreview(dayShifts) {
  const visible = dayShifts.slice(0, 4).map(shift => {
    const title = `${shift.name}${shift.start ? ` ${shift.start}` : ""}`;
    return `<span class="avatar-dot sm ${personAvatarClass(shift.name)}" title="${escapeAttribute(title)}">${escapeHtml(personInitials(shift.name))}</span>`;
  }).join("");

  const overflow = dayShifts.length > 4
    ? `<span class="calendar-shift-more">+${dayShifts.length - 4}</span>`
    : "";

  return visible + overflow;
}

function personAvatarClass(name) {
  const value = String(name || "");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 10;
  }
  return `avatar-hue-${hash < 0 ? hash + 10 : hash}`;
}

function personInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "?";
  }
  const initials = parts.length === 1
    ? parts[0].slice(0, 2)
    : parts[0][0] + parts[parts.length - 1][0];
  return initials.toUpperCase();
}

function renderPersonSelect(selectedValue = elements.personSelect.value) {
  elements.personSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = people.length ? "Choose person" : "Add a person first";
  elements.personSelect.appendChild(placeholder);

  people.forEach(person => {
    const option = document.createElement("option");
    option.value = person;
    option.textContent = person;
    elements.personSelect.appendChild(option);
  });

  if (people.includes(selectedValue)) {
    elements.personSelect.value = selectedValue;
  }
}

function renderTable() {
  elements.shiftTable.innerHTML = "";

  if (!shifts.length) {
    const empty = document.createElement("tr");
    empty.className = "empty-row";
    empty.innerHTML = `<td colspan="5">No shifts yet</td>`;
    elements.shiftTable.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  shifts.forEach(shift => {
    const row = document.createElement("tr");
    row.dataset.id = shift.id;
    row.innerHTML = `
      <td class="date-cell" data-label="Date"><input aria-label="Date" data-field="date" type="date" value="${escapeAttribute(shift.date)}"></td>
      <td class="person-cell" data-label="Person">${personSelectHtml(shift.name)}</td>
      <td class="time-cell" data-label="Start"><input aria-label="Start time" data-field="start" type="time" value="${escapeAttribute(shift.start)}"></td>
      <td class="time-cell" data-label="End"><input aria-label="End time" data-field="end" type="time" value="${escapeAttribute(shift.end)}"></td>
      <td data-label="Actions">
        <div class="row-actions">
          <button type="button" class="icon-button" data-action="copy" title="Duplicate" aria-label="Duplicate">+</button>
          <button type="button" class="icon-button delete" data-action="delete" title="Delete" aria-label="Delete">×</button>
        </div>
      </td>
    `;
    fragment.appendChild(row);
  });

  elements.shiftTable.appendChild(fragment);
}

function personSelectHtml(selectedName) {
  const names = people.includes(selectedName) || !selectedName ? people : [...people, selectedName];
  const options = names.map(person => {
    const selected = person === selectedName ? " selected" : "";
    return `<option value="${escapeAttribute(person)}"${selected}>${escapeHtml(person)}</option>`;
  }).join("");

  return `<select aria-label="Person" data-field="name">${options}</select>`;
}

function renderSummary() {
  elements.peopleCount.textContent = `${people.length} ${people.length === 1 ? "person" : "people"}`;
  elements.shiftCount.textContent = `${shifts.length} ${shifts.length === 1 ? "shift" : "shifts"}`;

  const dates = shifts.map(shift => shift.date).filter(Boolean).sort();
  elements.dateRange.textContent = dates.length ? `${formatDateShort(dates[0])} - ${formatDateShort(dates[dates.length - 1])}` : "No dates";
}

function sortShifts() {
  shifts.sort((left, right) => {
    const dateSort = (left.date || "").localeCompare(right.date || "");
    if (dateSort) {
      return dateSort;
    }

    const timeSort = (left.start || "99:99").localeCompare(right.start || "99:99");
    if (timeSort) {
      return timeSort;
    }

    return (left.name || "").localeCompare(right.name || "");
  });
}

function readStoredState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function queueSave() {
  window.clearTimeout(saveTimer);
  setSaveIndicators("Editing");
  saveTimer = window.setTimeout(saveState, 450);
}

function saveState() {
  const state = {
    title: elements.titleInput.value,
    weekStart: elements.weekStartInput.value,
    weekEnd: elements.weekEndInput.value,
    people,
    shifts
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  setSaveIndicators("Saved");
}

function setStatus(message) {
  setSaveIndicators(message);
  window.setTimeout(() => {
    setSaveIndicators("Saved");
  }, 1800);
}

function setSaveIndicators(message) {
  [elements.saveState, elements.plannerSaveState].forEach(element => {
    if (element) {
      element.textContent = message;
    }
  });
}

async function exportPdf() {
  elements.pdfButton.disabled = true;
  setButtonLabel(elements.pdfButton, "Making PDF");

  try {
    const pdf = await createPdfBlob();
    const url = URL.createObjectURL(pdf);
    downloadUrl(url, makePdfFilename());
    setStatus("PDF ready");
  } catch (error) {
    console.error(error);
    setStatus("PDF error");
    alert("The PDF could not be created.");
  } finally {
    elements.pdfButton.disabled = false;
    setButtonLabel(elements.pdfButton, "Export PDF");
  }
}

function exportCalendar(provider) {
  if (!shifts.length) {
    setStatus("No shifts");
    return;
  }

  const blob = createCalendarBlob(provider);
  const url = URL.createObjectURL(blob);
  downloadUrl(url, makeCalendarFilename(provider));
  setStatus(`${provider === "google" ? "Google" : "Apple"} ready`);
}

async function shareToWhatsApp() {
  if (!shifts.length) {
    setStatus("No shifts");
    return;
  }

  elements.whatsappButton.disabled = true;
  setButtonLabel(elements.whatsappButton, "Preparing");

  try {
    const message = buildWhatsappMessage();
    const pdf = await createPdfBlob();
    const appleCalendar = createCalendarBlob("apple");
    const googleCalendar = createCalendarBlob("google");
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

    openSharePanel({
      message,
      whatsappUrl,
      files: {
        pdf: { blob: pdf, filename: makePdfFilename() },
        apple: { blob: appleCalendar, filename: makeCalendarFilename("apple") },
        google: { blob: googleCalendar, filename: makeCalendarFilename("google") }
      }
    });
    window.setTimeout(downloadPreparedShareFiles, 120);
    await copyText(message);
    setStatus("Share package ready");
  } catch (error) {
    console.error(error);
    setStatus("Share error");
    alert("The WhatsApp share could not be prepared.");
  } finally {
    elements.whatsappButton.disabled = false;
    setButtonLabel(elements.whatsappButton, "WhatsApp");
  }
}

function openSharePanel({ message, whatsappUrl, files }) {
  revokePreparedShareUrls();
  elements.whatsappMessage.value = message;
  elements.openWhatsappLink.href = whatsappUrl;
  setDownloadLink(elements.sharePdfLink, files.pdf);
  setDownloadLink(elements.shareAppleLink, files.apple);
  setDownloadLink(elements.shareGoogleLink, files.google);
  prepareNativeShareFiles(files, message);
  elements.shareOverlay.classList.remove("is-hidden");
  (elements.nativeShareButton.hidden ? elements.copyWhatsappButton : elements.nativeShareButton).focus();
}

function closeSharePanel() {
  elements.shareOverlay.classList.add("is-hidden");
}

function setDownloadLink(link, file) {
  const url = URL.createObjectURL(file.blob);
  preparedShareUrls.push(url);
  link.href = url;
  link.download = file.filename;
}

function prepareNativeShareFiles(files, message) {
  preparedNativeFiles = [];

  if (typeof File !== "function" || !navigator.share) {
    elements.nativeShareButton.hidden = true;
    return;
  }

  preparedNativeFiles = [
    new File([files.pdf.blob], files.pdf.filename, { type: "application/pdf" }),
    new File([files.apple.blob], files.apple.filename, { type: "text/calendar" }),
    new File([files.google.blob], files.google.filename, { type: "text/calendar" })
  ];

  const payload = {
    title: elements.titleInput.value.trim() || "Planning Burger Folie",
    text: message,
    files: preparedNativeFiles
  };

  elements.nativeShareButton.hidden = Boolean(navigator.canShare) && !navigator.canShare(payload);
}

async function shareNativePackage() {
  if (!navigator.share || !preparedNativeFiles.length) {
    setStatus("Share unavailable");
    return;
  }

  try {
    await navigator.share({
      title: elements.titleInput.value.trim() || "Planning Burger Folie",
      text: elements.whatsappMessage.value,
      files: preparedNativeFiles
    });
    setStatus("Share opened");
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      setStatus("Share unavailable");
    }
  }
}

function downloadPreparedShareFiles() {
  [elements.sharePdfLink, elements.shareAppleLink, elements.shareGoogleLink].forEach(link => {
    if (link.href && link.href !== "#") {
      link.click();
    }
  });
}

function revokePreparedShareUrls() {
  preparedShareUrls.forEach(url => URL.revokeObjectURL(url));
  preparedShareUrls = [];
  preparedNativeFiles = [];
}

function setButtonLabel(button, label) {
  const text = button.querySelector(".button-text");
  if (text) {
    text.textContent = label;
  } else {
    button.textContent = label;
  }
}

async function createPdfBlob() {
  let logo = null;
  try {
    logo = await loadLogoForPdf();
  } catch {
    logo = null;
  }

  return buildPlannerPdf({
    title: elements.titleInput.value.trim() || "Planning Burger Folie",
    weekStart: elements.weekStartInput.value,
    weekEnd: elements.weekEndInput.value,
    shifts: [...shifts],
    logo
  });
}

function createCalendarBlob(provider) {
  const calendar = buildCalendarFile({
    title: `${elements.titleInput.value.trim() || "Planning Burger Folie"} - ${provider === "google" ? "Google Calendar" : "Apple Calendar"}`,
    shifts: [...shifts]
  });
  return new Blob([calendar], { type: "text/calendar;charset=utf-8" });
}

async function loadLogoForPdf() {
  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const image = new Image();
    image.onload = () => {
      try {
        const targetWidth = 360;
        const targetHeight = Math.round(targetWidth * image.naturalHeight / image.naturalWidth);
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const context = canvas.getContext("2d");
        if (!context) {
          finish(null);
          return;
        }
        context.fillStyle = "#070707";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
        finish({
          bytes: base64ToBytes(base64),
          width: canvas.width,
          height: canvas.height
        });
      } catch {
        finish(null);
      }
    };
    image.onerror = () => finish(null);
    image.src = LOGO_URL;
    window.setTimeout(() => finish(null), 1200);
  });
}

function buildPlannerPdf({ title, weekStart, weekEnd, shifts: rows, logo }) {
  rows.sort((left, right) => {
    const dateSort = (left.date || "").localeCompare(right.date || "");
    if (dateSort) {
      return dateSort;
    }
    return (left.start || "99:99").localeCompare(right.start || "99:99");
  });

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 42;
  const bottom = 54;
  const tableWidth = pageWidth - margin * 2;
  const pages = [];
  let commands = [];
  let cursorY = 0;

  function newPage() {
    if (commands.length) {
      pages.push(commands);
    }
    commands = [];
    drawPageHeader(commands, title, logo, pageWidth, pageHeight, margin);
    cursorY = pageHeight - 138;
    drawSummary(commands, rows, weekStart, weekEnd, cursorY, margin, tableWidth);
    cursorY -= 38;
  }

  function ensureSpace(height) {
    if (cursorY - height < bottom) {
      newPage();
    }
  }

  newPage();
  const grouped = groupByDate(rows);

  if (!grouped.length) {
    ensureSpace(34);
    cursorY -= 30;
    rect(commands, margin, cursorY, tableWidth, 28, [255, 253, 249]);
    strokeRect(commands, margin, cursorY, tableWidth, 28, [232, 226, 217]);
    text(commands, margin + 14, cursorY + 10, "No shifts planned yet", 10, "F2", [84, 79, 69]);
  }

  grouped.forEach(group => {
    const dayHeaderHeight = 28;
    const rowHeight = 24;
    ensureSpace(dayHeaderHeight + rowHeight);
    cursorY -= dayHeaderHeight;
    drawDayHeader(commands, group.date, group.items.length, margin, cursorY, tableWidth, dayHeaderHeight);

    group.items.forEach((shift, index) => {
      ensureSpace(rowHeight);
      cursorY -= rowHeight;
      drawShiftRow(commands, shift, margin, cursorY, tableWidth, rowHeight, index);
    });

    cursorY -= 8;
  });

  if (commands.length) {
    pages.push(commands);
  }

  pages.forEach((pageCommands, index) => {
    drawFooter(pageCommands, index + 1, pages.length, pageWidth, margin);
  });

  const contentStreams = pages.map(pageCommands => pageCommands.join("\n"));
  return assemblePdf(contentStreams, logo, pageWidth, pageHeight);
}

function drawPageHeader(commands, title, logo, pageWidth, pageHeight, margin) {
  rect(commands, margin - 10, pageHeight - 102, pageWidth - margin * 2 + 20, 70, [17, 17, 16]);
  rect(commands, margin - 10, pageHeight - 36, pageWidth - margin * 2 + 20, 4, [240, 190, 70]);
  rect(commands, margin - 10, pageHeight - 40, 170, 4, [201, 65, 45]);
  rect(commands, margin + 160, pageHeight - 40, 170, 4, [47, 125, 76]);

  if (logo) {
    image(commands, "Im1", margin, pageHeight - 94, 58, 52);
  }

  text(commands, margin + 76, pageHeight - 65, "Burger Folie", 20, "F2", [255, 255, 255]);
  text(commands, margin + 76, pageHeight - 84, title, 11, "F1", [255, 255, 255]);
  text(commands, pageWidth - margin - 122, pageHeight - 62, "Timeplanning", 12, "F2", [240, 190, 70]);
  text(commands, pageWidth - margin - 122, pageHeight - 81, todayDisplay(), 9, "F1", [255, 255, 255]);
}

function drawSummary(commands, rows, weekStart, weekEnd, y, margin, width) {
  const dateRange = weekStart && weekEnd ? `${formatDateShort(weekStart)} - ${formatDateShort(weekEnd)}` : planningRange(rows);
  rect(commands, margin, y - 22, width, 28, [250, 247, 238]);
  strokeRect(commands, margin, y - 22, width, 28, [217, 212, 202]);
  text(commands, margin + 12, y - 4, `Period: ${dateRange}`, 10, "F2", [21, 21, 21]);
  text(commands, margin + 265, y - 4, `Shifts: ${rows.length}`, 10, "F2", [21, 21, 21]);
}

function drawDayHeader(commands, dateIso, count, x, y, width, height) {
  rect(commands, x, y, width, height, [24, 24, 23]);
  rect(commands, x, y, 7, height, [201, 65, 45]);
  text(commands, x + 16, y + 10, `${formatDateLong(dateIso)} (${count})`, 11, "F2", [255, 255, 255]);
  text(commands, x + width - 96, y + 10, "Person / hours", 9, "F1", [240, 190, 70]);
}

function drawShiftRow(commands, shift, x, y, width, height, index) {
  if (index % 2 === 0) {
    rect(commands, x, y, width, height, [255, 253, 249]);
  }
  strokeLine(commands, x, y, x + width, y, [232, 226, 217]);
  text(commands, x + 14, y + 8, truncateText(shift.name || "-", 28), 10, "F2", [21, 21, 21]);
  text(commands, x + 185, y + 8, formatHours(shift), 10, "F1", [21, 21, 21]);
}

function drawFooter(commands, page, total, pageWidth, margin) {
  strokeLine(commands, margin, 42, pageWidth - margin, 42, [217, 212, 202]);
  text(commands, margin, 25, "Burger Folie - Homemade Gourmet Dungens", 8, "F1", [110, 105, 95]);
  text(commands, pageWidth - margin - 62, 25, `Page ${page}/${total}`, 8, "F1", [110, 105, 95]);
}

function assemblePdf(pageContents, logo, pageWidth, pageHeight) {
  const encoder = new TextEncoder();
  let nextId = 1;
  const catalogId = nextId++;
  const pagesId = nextId++;
  const fontRegularId = nextId++;
  const fontBoldId = nextId++;
  const imageId = logo ? nextId++ : 0;
  const pageIds = [];
  const contentIds = [];
  pageContents.forEach(() => {
    pageIds.push(nextId++);
    contentIds.push(nextId++);
  });

  const objects = [];
  objects.push(pdfObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`));
  objects.push(pdfObject(pagesId, `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`));
  objects.push(pdfObject(fontRegularId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"));
  objects.push(pdfObject(fontBoldId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"));

  if (logo) {
    const imageDictionary = `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>\nstream\n`;
    objects.push(pdfObject(imageId, [encoder.encode(imageDictionary), logo.bytes, encoder.encode("\nendstream")]));
  }

  pageContents.forEach((content, index) => {
    const resources = `<< /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >>${logo ? ` /XObject << /Im1 ${imageId} 0 R >>` : ""} >>`;
    objects.push(pdfObject(
      pageIds[index],
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources ${resources} /Contents ${contentIds[index]} 0 R >>`
    ));

    const streamBytes = encoder.encode(content);
    objects.push(pdfObject(contentIds[index], [
      encoder.encode(`<< /Length ${streamBytes.length} >>\nstream\n`),
      streamBytes,
      encoder.encode("\nendstream")
    ]));
  });

  objects.sort((left, right) => left.id - right.id);

  const chunks = [];
  const offsets = [];
  let offset = 0;
  const push = bytes => {
    chunks.push(bytes);
    offset += bytes.length;
  };
  const pushText = value => push(encoder.encode(value));

  pushText("%PDF-1.4\n% Burger Folie planner\n");
  objects.forEach(object => {
    offsets[object.id] = offset;
    pushText(`${object.id} 0 obj\n`);
    object.parts.forEach(push);
    pushText("\nendobj\n");
  });

  const xrefOffset = offset;
  pushText(`xref\n0 ${nextId}\n0000000000 65535 f \n`);
  for (let id = 1; id < nextId; id += 1) {
    pushText(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  pushText(`trailer\n<< /Size ${nextId} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const bytes = new Uint8Array(offset);
  let position = 0;
  chunks.forEach(chunk => {
    bytes.set(chunk, position);
    position += chunk.length;
  });

  return new Blob([bytes], { type: "application/pdf" });
}

function pdfObject(id, body) {
  const encoder = new TextEncoder();
  const parts = Array.isArray(body) ? body : [encoder.encode(body)];
  return { id, parts };
}

function rect(commands, x, y, width, height, color) {
  commands.push(`${fillColor(color)} ${n(x)} ${n(y)} ${n(width)} ${n(height)} re f`);
}

function strokeRect(commands, x, y, width, height, color) {
  commands.push(`${strokeColor(color)} ${n(x)} ${n(y)} ${n(width)} ${n(height)} re S`);
}

function strokeLine(commands, x1, y1, x2, y2, color) {
  commands.push(`${strokeColor(color)} ${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S`);
}

function image(commands, name, x, y, width, height) {
  commands.push(`q ${n(width)} 0 0 ${n(height)} ${n(x)} ${n(y)} cm /${name} Do Q`);
}

function text(commands, x, y, value, size, font, color) {
  commands.push(`${fillColor(color)} BT /${font} ${n(size)} Tf ${n(x)} ${n(y)} Td (${escapePdfText(value)}) Tj ET`);
}

function fillColor(color) {
  return `${n(color[0] / 255)} ${n(color[1] / 255)} ${n(color[2] / 255)} rg`;
}

function strokeColor(color) {
  return `${n(color[0] / 255)} ${n(color[1] / 255)} ${n(color[2] / 255)} RG`;
}

function escapePdfText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function n(value) {
  return Number(value).toFixed(2).replace(/\.00$/, "");
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

function makePdfFilename() {
  const title = (elements.titleInput.value || "planning-burger-folie")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${title || "planning-burger-folie"}.pdf`;
}

function makeCalendarFilename(provider = "apple") {
  const title = (elements.titleInput.value || "planning-burger-folie")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const suffix = provider === "google" ? "google-calendar" : "apple-calendar";
  return `${title || "planning-burger-folie"}-${suffix}.ics`;
}

function buildWhatsappMessage() {
  const title = elements.titleInput.value.trim() || "Planning Burger Folie";
  const period = elements.weekStartInput.value && elements.weekEndInput.value
    ? `${formatDateShort(elements.weekStartInput.value)} - ${formatDateShort(elements.weekEndInput.value)}`
    : planningRange(shifts);
  const lines = [
    title,
    `Periode: ${period}`,
    "",
    "Planning:"
  ];

  groupByDate([...shifts]).forEach(group => {
    lines.push(formatDateLong(group.date));
    group.items.forEach(shift => {
      lines.push(`- ${shift.name}: ${formatHours(shift)}`);
    });
  });

  const googleLink = buildGoogleCalendarPlanningLink(shifts);
  if (googleLink) {
    lines.push("", "Google Agenda:", googleLink);
  }

  return lines.join("\n");
}

function buildGoogleCalendarPlanningLink(rows) {
  const validRows = [...rows]
    .filter(shift => shift.date && shift.name)
    .sort((left, right) => {
      const dateSort = (left.date || "").localeCompare(right.date || "");
      if (dateSort) {
        return dateSort;
      }
      return (left.start || "99:99").localeCompare(right.start || "99:99");
    });

  if (!validRows.length) {
    return "";
  }

  const title = elements.titleInput.value.trim() || "Planning Burger Folie";
  const firstDate = dateFromIso(validRows[0].date);
  const lastDate = dateFromIso(validRows[validRows.length - 1].date);
  lastDate.setDate(lastDate.getDate() + 1);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${googleAllDayDate(firstDate)}/${googleAllDayDate(lastDate)}`,
    ctz: "Europe/Brussels",
    details: googlePlanningDescription(validRows),
    location: "Burger Folie"
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function googlePlanningDescription(rows) {
  const lines = ["Planning Burger Folie", ""];
  groupByDate([...rows]).forEach(group => {
    lines.push(formatDateLong(group.date));
    group.items.forEach(shift => {
      lines.push(`- ${shift.name}: ${formatHours(shift)}`);
    });
  });
  return lines.join("\n");
}

function buildCalendarFile({ title, shifts: rows }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Burger Folie//Timeplanning//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(title)}`
  ];

  rows
    .filter(shift => shift.date && shift.name)
    .sort((left, right) => {
      const dateSort = (left.date || "").localeCompare(right.date || "");
      if (dateSort) {
        return dateSort;
      }
      return (left.start || "99:99").localeCompare(right.start || "99:99");
    })
    .forEach(shift => {
      const times = calendarTimes(shift);
      lines.push(
        "BEGIN:VEVENT",
        `UID:${escapeIcs(shift.id)}@burger-folie-timeplanning`,
        `DTSTAMP:${icsUtcDateTime(new Date())}`,
        `DTSTART;TZID=Europe/Brussels:${icsLocalDateTime(times.start)}`,
        `DTEND;TZID=Europe/Brussels:${icsLocalDateTime(times.end)}`,
        `SUMMARY:${escapeIcs(`Burger Folie - ${shift.name}`)}`,
        `DESCRIPTION:${escapeIcs(calendarDescription(shift))}`,
        "LOCATION:Burger Folie",
        "END:VEVENT"
      );
    });

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n");
}

function calendarTimes(shift) {
  const start = localDateTime(shift.date, shift.start || "09:00");
  const end = shift.end ? localDateTime(shift.date, shift.end) : addHours(start, 4);
  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }
  return { start, end };
}

function calendarDescription(shift) {
  return [`Person: ${shift.name}`, `Hours: ${formatHours(shift)}`].join("\n");
}

function localDateTime(dateIso, timeValue) {
  const date = dateFromIso(dateIso);
  const [hours, minutes] = String(timeValue).split(":").map(Number);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

function addHours(date, hours) {
  const copy = new Date(date.getTime());
  copy.setHours(copy.getHours() + hours);
  return copy;
}

function icsLocalDateTime(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    "T",
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    "00"
  ].join("");
}

function icsUtcDateTime(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
    "T",
    String(date.getUTCHours()).padStart(2, "0"),
    String(date.getUTCMinutes()).padStart(2, "0"),
    String(date.getUTCSeconds()).padStart(2, "0"),
    "Z"
  ].join("");
}

function googleAllDayDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("");
}

function googleLocalDateTime(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    "T",
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    "00"
  ].join("");
}

function escapeIcs(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldIcsLine(line) {
  const parts = [];
  for (let index = 0; index < line.length; index += 73) {
    parts.push(line.slice(index, index + 73));
  }
  return parts.join("\r\n ");
}

function downloadUrl(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(value) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function planningRange(rows) {
  const dates = rows.map(row => row.date).filter(Boolean).sort();
  return dates.length ? `${formatDateShort(dates[0])} - ${formatDateShort(dates[dates.length - 1])}` : "No dates";
}

function shiftsByDate() {
  const map = new Map();
  shifts.forEach(shift => {
    if (!map.has(shift.date)) {
      map.set(shift.date, []);
    }
    map.get(shift.date).push(shift);
  });
  return map;
}

function todayDisplay() {
  return new Intl.DateTimeFormat("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
}

function formatDateShort(iso) {
  if (!iso) {
    return "-";
  }
  const date = dateFromIso(iso);
  return new Intl.DateTimeFormat("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function formatDateLong(iso) {
  if (!iso || iso === "No date") {
    return "No date";
  }
  const date = dateFromIso(iso);
  const weekday = weekdays[date.getDay()];
  return `${weekday} ${formatDateShort(iso)}`;
}

function formatDateLongUi(iso) {
  if (!iso || iso === "No date") {
    return "No date";
  }
  const date = dateFromIso(iso);
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(date);
  return `${weekday} ${formatDateShort(iso)}`;
}

function formatHours(shift) {
  if (shift.start && shift.end) {
    return `${shift.start} - ${shift.end}`;
  }
  return shift.start || "-";
}

function dateFromIso(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isWeekend(dateIso) {
  if (!dateIso) {
    return false;
  }
  const day = dateFromIso(dateIso).getDay();
  return day === 0 || day === 6;
}

function monthGridDates(monthStart) {
  const first = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  first.setDate(first.getDate() - offset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return date;
  });
}

function toIsoDate(date) {
  return isoFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function isoFromParts(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function startOfWeek(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  return toIsoDate(copy);
}

function endOfWeek(date) {
  const copy = dateFromIso(startOfWeek(date));
  copy.setDate(copy.getDate() + 6);
  return toIsoDate(copy);
}

function truncateText(value, maxLength) {
  const textValue = String(value ?? "");
  return textValue.length > maxLength ? `${textValue.slice(0, maxLength - 3)}...` : textValue;
}

function normalizeName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
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

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js")
      .then(registration => registration.update?.())
      .catch(() => {});
  }
}

setupInstallExperience();
boot();
