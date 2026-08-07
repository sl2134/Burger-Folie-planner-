(() => {
  const STORAGE_KEY = "burger-folie-planner-v2";
  const DEFAULT_END_TIME = "22:00";
  const REGULAR_STARTS = {
    weekday: ["17:30", "18:00"],
    weekend: ["17:00", "17:30"]
  };

  const state = {
    dateIso: "",
    openPerson: "",
    lastDate: "",
    lastAt: 0
  };

  document.addEventListener("DOMContentLoaded", () => {
    const calendarGrid = document.getElementById("calendarGrid");
    calendarGrid?.addEventListener("pointerdown", openFromDateTap, { capture: true });
    calendarGrid?.addEventListener("touchend", openFromDateTap, { capture: true });
    calendarGrid?.addEventListener("click", openFromDateTap, { capture: true });

    document.getElementById("closeMobileDayButton")?.addEventListener("click", closeSheet);
    document.getElementById("mobileDayOverlay")?.addEventListener("click", event => {
      if (event.target === event.currentTarget) {
        closeSheet();
      }
    });

    document.getElementById("mobileDayPeople")?.addEventListener("click", event => {
      const timeButton = event.target.closest("button[data-mobile-person][data-mobile-time]");
      if (timeButton) {
        addShift(timeButton.dataset.mobilePerson, timeButton.dataset.mobileTime, DEFAULT_END_TIME);
        return;
      }

      const personButton = event.target.closest("button[data-mobile-person]");
      if (!personButton) {
        return;
      }
      state.openPerson = state.openPerson === personButton.dataset.mobilePerson
        ? ""
        : personButton.dataset.mobilePerson;
      renderSheet();
    });

    document.getElementById("mobileCustomAddButton")?.addEventListener("click", () => {
      const person = document.getElementById("mobileCustomPerson")?.value || "";
      const start = document.getElementById("mobileCustomStart")?.value || "";
      const end = document.getElementById("mobileCustomEnd")?.value || DEFAULT_END_TIME;
      addShift(person, start, end);
    });
  });

  function openFromDateTap(event) {
    const button = event.target.closest("button[data-date]");
    if (!button || !window.matchMedia("(max-width: 760px)").matches) {
      return;
    }

    const dateIso = button.dataset.date;
    const now = Date.now();
    const duplicate = state.lastDate === dateIso && now - state.lastAt < 520;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    if (duplicate) {
      return;
    }

    state.lastDate = dateIso;
    state.lastAt = now;
    openSheet(dateIso);
  }

  function openSheet(dateIso) {
    if (!dateIso) {
      return;
    }

    try {
      window.selectDate?.(dateIso, { syncWeek: true });
      window.render?.();
    } catch {}

    state.dateIso = dateIso;
    state.openPerson = "";
    renderSheet();
    document.getElementById("mobileDayOverlay")?.classList.remove("is-hidden");
    document.body.classList.add("is-mobile-day-open");
    document.getElementById("mobileDayOverlay")?.querySelector(".mobile-day-sheet")?.scrollTo({ top: 0 });
  }

  function closeSheet() {
    document.getElementById("mobileDayOverlay")?.classList.add("is-hidden");
    document.body.classList.remove("is-mobile-day-open");
  }

  function renderSheet() {
    const planner = readPlanner();
    const dayShifts = planner.shifts
      .filter(shift => shift.date === state.dateIso)
      .sort((left, right) => (left.start || "99:99").localeCompare(right.start || "99:99") || left.name.localeCompare(right.name));

    const title = document.getElementById("mobileDayTitle");
    const count = document.getElementById("mobileDayShiftCount");
    const list = document.getElementById("mobileDayShiftList");
    const people = document.getElementById("mobileDayPeople");
    const customPerson = document.getElementById("mobileCustomPerson");

    if (title) {
      title.textContent = formatDateLong(state.dateIso);
    }
    if (count) {
      count.textContent = String(dayShifts.length);
    }
    if (list) {
      list.innerHTML = dayShifts.length
        ? dayShifts.map((shift, index) => `
          <div class="mobile-shift-card" style="--item-index: ${index}">
            <strong>${escapeHtml(shift.name)}</strong>
            <span>${escapeHtml(formatHours(shift))}</span>
          </div>
        `).join("")
        : `<div class="mobile-empty">No shifts on this day</div>`;
    }
    if (people) {
      people.innerHTML = planner.people.length
        ? planner.people.map((person, index) => personButtonHtml(person, index)).join("")
        : `<div class="mobile-empty">Add people first</div>`;
    }
    if (customPerson) {
      const selected = customPerson.value;
      customPerson.innerHTML = planner.people.length
        ? planner.people.map(person => `<option value="${escapeAttribute(person)}">${escapeHtml(person)}</option>`).join("")
        : `<option value="">Add people first</option>`;
      if (planner.people.includes(selected)) {
        customPerson.value = selected;
      }
    }

    const starts = regularStartsForDate(state.dateIso);
    const customStart = document.getElementById("mobileCustomStart");
    const customEnd = document.getElementById("mobileCustomEnd");
    if (customStart && (!customStart.value || starts.includes(customStart.value))) {
      customStart.value = starts[0];
    }
    if (customEnd && !customEnd.value) {
      customEnd.value = DEFAULT_END_TIME;
    }
  }

  function personButtonHtml(person, index) {
    const starts = regularStartsForDate(state.dateIso);
    const open = person === state.openPerson;
    return `
      <div class="mobile-person-wrap${open ? " is-open" : ""}" style="--item-index: ${index}">
        <button type="button" class="mobile-person-button" data-mobile-person="${escapeAttribute(person)}">${escapeHtml(person)}</button>
        <div class="mobile-person-times">
          ${starts.map(time => `
            <button type="button" class="person-time-button" data-mobile-person="${escapeAttribute(person)}" data-mobile-time="${escapeAttribute(time)}">${escapeHtml(time)}</button>
          `).join("")}
        </div>
      </div>
    `;
  }

  function addShift(person, start, end) {
    if (!person || !start || !state.dateIso) {
      return;
    }

    try {
      window.selectDate?.(state.dateIso, { syncWeek: true });
      if (window.addQuickShift && end === DEFAULT_END_TIME) {
        window.addQuickShift(person, start);
      } else if (window.addShiftFromForm) {
        document.getElementById("customTimeMode").checked = true;
        document.getElementById("customTimeMode").dispatchEvent(new Event("change", { bubbles: true }));
        document.getElementById("personSelect").value = person;
        document.getElementById("startInput").value = start;
        document.getElementById("endInput").value = end;
        window.addShiftFromForm();
      } else {
        addShiftToStorage({ name: person, date: state.dateIso, start, end });
      }
    } catch {
      addShiftToStorage({ name: person, date: state.dateIso, start, end });
    }

    window.setTimeout(renderSheet, 80);
  }

  function addShiftToStorage(shift) {
    const planner = readPlanner();
    if (!planner.people.includes(shift.name)) {
      planner.people.push(shift.name);
    }
    const duplicate = planner.shifts.some(item =>
      item.date === shift.date &&
      item.name === shift.name &&
      item.start === shift.start
    );
    if (!duplicate) {
      planner.shifts.push({ id: createId(), ...shift });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(planner));
    }
  }

  function readPlanner() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
      const people = uniqueNames(raw.people);
      const shifts = Array.isArray(raw.shifts) ? raw.shifts
        .map(shift => ({
          id: String(shift.id || createId()),
          date: String(shift.date || ""),
          name: String(shift.name || "").trim(),
          start: String(shift.start || ""),
          end: String(shift.end || "")
        }))
        .filter(shift => shift.date && shift.name) : [];
      shifts.forEach(shift => {
        if (!people.some(person => person.toLowerCase() === shift.name.toLowerCase())) {
          people.push(shift.name);
        }
      });
      return { people: uniqueNames(people), shifts };
    } catch {
      return { people: [], shifts: [] };
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

  function regularStartsForDate(dateIso) {
    const day = dateFromIso(dateIso).getDay();
    return day === 0 || day === 6 ? REGULAR_STARTS.weekend : REGULAR_STARTS.weekday;
  }

  function formatDateLong(iso) {
    const date = dateFromIso(iso);
    const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(date);
    const shortDate = new Intl.DateTimeFormat("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
    return `${weekday} ${shortDate}`;
  }

  function formatHours(shift) {
    return shift.start && shift.end ? `${shift.start} - ${shift.end}` : shift.start || "-";
  }

  function dateFromIso(iso) {
    const [year, month, day] = String(iso || "").split("-").map(Number);
    return new Date(year || 1970, (month || 1) - 1, day || 1);
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
    return window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `shift-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
})();
