/*
 * Cross-device sync via a JSON file committed to this GitHub repo.
 *
 * IMPORTANT: GITHUB_TOKEN below ships inside this public JS file and is
 * visible to anyone who opens the page (view-source / devtools / network
 * tab). Only ever put a FINE-GRAINED token here, scoped to this one
 * repository, with "Contents: Read and write" and nothing else. Never use
 * a classic token or one with access to other repos or account settings.
 *
 * Create one at https://github.com/settings/personal-access-tokens/new:
 *   - Resource owner: sl2134
 *   - Repository access: Only select repositories -> Burger-Folie-planner-
 *   - Permissions: Contents -> Read and write
 * Paste the generated token below in place of the placeholder.
 */
(() => {
  const GITHUB_OWNER = "sl2134";
  const GITHUB_REPO = "Burger-Folie-planner-";
  const GITHUB_BRANCH = "main";
  const GITHUB_PATH = "data/planning.json";
  const GITHUB_TOKEN = "PASTE_YOUR_FINE_GRAINED_GITHUB_TOKEN_HERE";

  const API_BASE = "https://api.github.com";
  const STORAGE_KEY = "burger-folie-planner-v2";
  const PULL_INTERVAL_MS = 20000;
  const PUSH_DEBOUNCE_MS = 1200;

  let remoteSha = null;
  let pushTimer = 0;
  let pushInFlight = false;
  let pushPending = false;
  let unlockObserver = null;

  function tokenConfigured() {
    return Boolean(GITHUB_TOKEN) && !GITHUB_TOKEN.startsWith("PASTE_");
  }

  function isUnlocked() {
    return !document.body.classList.contains("is-access-locked");
  }

  function init() {
    if (!tokenConfigured()) {
      console.warn("GitHub sync: no token configured in sync.js, sync is disabled.");
      return;
    }

    patchSaveState();

    if (isUnlocked()) {
      startSyncing();
    } else {
      unlockObserver = new MutationObserver(() => {
        if (isUnlocked()) {
          unlockObserver.disconnect();
          unlockObserver = null;
          startSyncing();
        }
      });
      unlockObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }
  }

  function startSyncing() {
    pullFromGitHub();
    window.setInterval(pullFromGitHub, PULL_INTERVAL_MS);
  }

  function patchSaveState() {
    const originalSave = window.saveState;
    if (typeof originalSave !== "function") {
      return;
    }
    window.saveState = function patchedSaveState(...args) {
      const result = originalSave.apply(this, args);
      stampLocalUpdatedAt();
      queuePush();
      return result;
    };
  }

  function queuePush() {
    if (!isUnlocked()) {
      return;
    }
    window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(pushToGitHub, PUSH_DEBOUNCE_MS);
  }

  function currentLocalState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function stampLocalUpdatedAt() {
    const state = currentLocalState();
    state.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  async function pullFromGitHub() {
    if (!isUnlocked()) {
      return;
    }
    try {
      const response = await fetch(
        `${API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}?ref=${GITHUB_BRANCH}`,
        { headers: authHeaders() }
      );

      if (response.status === 404) {
        remoteSha = null;
        return;
      }
      if (!response.ok) {
        throw new Error(`GitHub read failed (${response.status})`);
      }

      const payload = await response.json();
      remoteSha = payload.sha;
      const remoteState = JSON.parse(decodeBase64(payload.content));
      applyRemoteState(remoteState);
    } catch (error) {
      console.error("GitHub sync (pull) failed", error);
    }
  }

  function applyRemoteState(remoteState) {
    const local = currentLocalState();
    const localUpdated = local.updatedAt || 0;
    const remoteUpdated = remoteState.updatedAt || 0;

    if (remoteUpdated <= localUpdated) {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteState));
    window.location.reload();
  }

  async function pushToGitHub() {
    if (!isUnlocked()) {
      return;
    }
    if (pushInFlight) {
      pushPending = true;
      return;
    }
    pushInFlight = true;

    if (typeof window.setStatus === "function") {
      window.setStatus("Syncing...");
    }

    try {
      const state = currentLocalState();
      const body = {
        message: "Update planning data",
        content: encodeBase64(JSON.stringify(state, null, 2)),
        branch: GITHUB_BRANCH
      };
      if (remoteSha) {
        body.sha = remoteSha;
      }

      const response = await fetch(
        `${API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`,
        {
          method: "PUT",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }
      );

      if (response.status === 409 || response.status === 422) {
        // Another device wrote first: refresh the known sha and retry once.
        pushInFlight = false;
        await pullFromGitHub();
        return pushToGitHub();
      }
      if (!response.ok) {
        throw new Error(`GitHub write failed (${response.status})`);
      }

      const payload = await response.json();
      remoteSha = payload.content.sha;
      if (typeof window.setStatus === "function") {
        window.setStatus("Synced");
      }
    } catch (error) {
      console.error("GitHub sync (push) failed", error);
      if (typeof window.setStatus === "function") {
        window.setStatus("Sync failed");
      }
    } finally {
      pushInFlight = false;
      if (pushPending) {
        pushPending = false;
        pushToGitHub();
      }
    }
  }

  function authHeaders() {
    return {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json"
    };
  }

  function encodeBase64(value) {
    return btoa(unescape(encodeURIComponent(value)));
  }

  function decodeBase64(value) {
    return decodeURIComponent(escape(atob(value.replace(/\n/g, ""))));
  }

  init();
})();
