(() => {
  "use strict";

  const API = window.location.origin;
  const TOKEN_KEY = "null-motion-bridge-token";
  const LEGACY_TOKEN_KEYS = ["nullMotionBridgeToken", "null-motion-browser-token", "nullBridgeToken"];
  const SAVED_SEQUENCE_KEY = "null-motion-control-sequence-id";
  const TERMINAL_STATUSES = new Set(["done", "partial", "error", "cancelled", "interrupted"]);
  const SUCCESS_STATUSES = new Set(["done", "ok", "completed", "saved", "inserted", "rolledback", "rolled-back", "success", "succeeded"]);
  const FAILURE_STATUSES = new Set(["error", "failed", "cancelled", "interrupted", "rejected"]);
  const POLL_ONLINE_MS = 3500;
  const POLL_OFFLINE_MS = 7000;

  const state = {
    bridgeOnline: false,
    bridgeChecked: false,
    bridgeError: null,
    health: null,
    presence: null,
    presenceChecked: false,
    presenceError: null,
    templates: [],
    templatesError: null,
    theme: null,
    themeError: null,
    batches: [],
    batchesError: null,
    jobs: [],
    jobsError: null,
    inbox: [],
    inboxError: null,
    actions: [],
    actionsError: null,
    selectedSequenceId: null,
    sequence: null,
    storyboard: null,
    storyboardError: null,
    originalStoryboard: null,
    draftStoryboard: null,
    originalGenerationPolicy: null,
    baseUpdatedAt: null,
    hydratedUpdatedAt: null,
    selectedIndex: -1,
    dirty: false,
    remoteChangedWhileDirty: false,
    proposal: null,
    reviewByKey: new Map(),
    actionBusy: false,
    initializedSelection: false
  };

  let pollGeneration = 0;
  let pollTimer = null;
  let pollController = null;
  let toastTimer = null;

  const byId = id => document.getElementById(id);

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }

  function bridgeToken() {
    try {
      let token = localStorage.getItem(TOKEN_KEY) || "";
      if (token) return token;
      for (const key of LEGACY_TOKEN_KEYS) {
        token = localStorage.getItem(key) || "";
        if (!token) continue;
        localStorage.setItem(TOKEN_KEY, token);
        LEGACY_TOKEN_KEYS.forEach(legacyKey => localStorage.removeItem(legacyKey));
        return token;
      }
    } catch (_) {}
    return "";
  }

  function clone(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") {
      try { return structuredClone(value); } catch (_) {}
    }
    return JSON.parse(JSON.stringify(value));
  }

  function text(value) { return value == null ? "" : String(value); }
  function number(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
  function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
  function firstValue(...values) { return values.find(value => value !== undefined && value !== null && value !== ""); }
  function unique(values) { return Array.from(new Set(values.filter(value => value !== undefined && value !== null && value !== "").map(String))); }

  function arrayFrom(payload, keys) {
    if (Array.isArray(payload)) return payload;
    for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
    return [];
  }

  function unwrapSequence(payload) {
    return object(payload?.sequence || payload?.batch || payload?.data || payload);
  }

  function unwrapStoryboard(payload) {
    return object(payload?.storyboard || payload?.data || payload);
  }

  function segmentsOf(storyboard) {
    return Array.isArray(storyboard?.segments) ? storyboard.segments : Array.isArray(storyboard?.items) ? storyboard.items : [];
  }

  function normalizeStatus(value) {
    const status = text(value || "pending").trim().toLowerCase().replace(/\s+/g, "-");
    if (status === "completed" || status === "complete" || status === "succeeded" || status === "success") return "done";
    if (status === "failed" || status === "failure") return "error";
    if (status === "canceled") return "cancelled";
    if (["working", "processing", "generating", "queued-for-render"].includes(status)) return "running";
    return status || "pending";
  }

  function statusLabel(value) {
    const status = normalizeStatus(value);
    return ({
      done: "Ready",
      partial: "Partially complete",
      error: "Error",
      cancelled: "Cancelled",
      interrupted: "Interrupted",
      running: "In progress",
      rendering: "Rendering",
      pending: "Pending",
      queued: "Queued",
      draft: "Draft",
      claimed: "Claimed by CEP",
      inserted: "Inserted",
      dismissed: "Dismissed"
    })[status] || status.replace(/-/g, " ").replace(/^./, letter => letter.toUpperCase());
  }

  function statusTone(value) {
    const status = normalizeStatus(value);
    if (SUCCESS_STATUSES.has(status)) return "success";
    if (FAILURE_STATUSES.has(status)) return "error";
    if (["partial", "warning", "claimed", "queued"].includes(status)) return "warning";
    return "neutral";
  }

  function isTerminal(value) { return TERMINAL_STATUSES.has(normalizeStatus(value)); }

  function parseDate(value) {
    const date = new Date(typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value) {
    const date = parseDate(value);
    if (!date) return "Not recorded";
    return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }

  function formatRelativeDate(value) {
    const date = parseDate(value);
    if (!date) return "Not recorded";
    const seconds = Math.round((Date.now() - date.getTime()) / 1000);
    if (Math.abs(seconds) < 60) return "Just now";
    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60) return `${Math.abs(minutes)}m ${minutes >= 0 ? "ago" : "from now"}`;
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return `${Math.abs(hours)}h ${hours >= 0 ? "ago" : "from now"}`;
    return formatDate(value);
  }

  function formatTime(value, millis = true) {
    const total = Math.max(0, number(value));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = Math.floor(total % 60);
    const fraction = Math.round((total - Math.floor(total)) * 1000);
    const base = `${hours ? `${String(hours).padStart(2, "0")}:` : ""}${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    return millis && fraction ? `${base}.${String(fraction).padStart(3, "0")}` : base;
  }

  function safeHttpUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(String(value), API);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (_) { return ""; }
  }

  function canonicalAuthoredPlayerUrl(value) {
    if (!value) return "";
    let raw = String(value).trim();
    try {
      if (/^https?:/i.test(raw)) raw = new URL(raw).pathname;
    } catch (_) { return ""; }
    raw = raw.split(/[?#]/)[0].replace(/^\/+/, "").replace(/^null\//i, "");
    const parts = raw.split("/").filter(Boolean);
    if (!parts.length || parts.some(part => part === "." || part === "..")) return "";
    try {
      return `${API}/null/${parts.map(part => encodeURIComponent(decodeURIComponent(part))).join("/")}`;
    } catch (_) { return ""; }
  }

  class ApiError extends Error {
    constructor(message, status, path) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.path = path;
    }
  }

  async function api(path, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    const token = bridgeToken();
    if (token) headers["X-Null-Bridge-Token"] = token;
    const request = Object.assign({ cache: "no-store" }, options, { headers });
    let response;
    try {
      response = await fetch(`${API}${path}`, request);
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      throw new ApiError("Null Motion bridge is offline.", 0, path);
    }
    const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(data.error || data.message || `Null Motion request failed (${response.status}).`, response.status, path);
    return data;
  }

  async function settled(promise) {
    try { return { ok: true, value: await promise }; }
    catch (error) { return { ok: false, error }; }
  }

  function showToast(message, error = false) {
    const toast = byId("toast");
    toast.textContent = message;
    toast.classList.toggle("error", Boolean(error));
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.disabled = Boolean(busy);
    button.classList.toggle("is-busy", Boolean(busy));
    button.textContent = busy && label ? label : button.dataset.label;
  }

  function batchId(batch) {
    return text(firstValue(batch?.sequenceId, batch?.batchId, batch?.id, batch?._id));
  }

  function sequenceTitle(sequence, fallbackId = "") {
    return text(firstValue(sequence?.title, sequence?.name, sequence?.sequenceName, sequence?.label, sequence?.storyboard?.title, fallbackId ? `Sequence ${fallbackId.slice(0, 8)}` : "Untitled sequence"));
  }

  function sequenceUpdatedAt(sequence, storyboard) {
    return firstValue(sequence?.updatedAt, sequence?.finishedAt, sequence?.createdAt, storyboard?.updatedAt, storyboard?.createdAt, null);
  }

  function sequenceDuration(sequence = state.sequence, storyboard = state.draftStoryboard) {
    const explicit = firstValue(sequence?.sequenceInfo?.duration, sequence?.duration, sequence?.timelineDuration, storyboard?.sequenceInfo?.duration, storyboard?.overallDuration, storyboard?.duration);
    if (Number.isFinite(Number(explicit)) && Number(explicit) > 0) return Number(explicit);
    return segmentsOf(storyboard).reduce((maximum, segment) => Math.max(maximum, segmentStart(segment) + segmentDuration(segment)), 0);
  }

  function sequenceInfo(sequence = state.sequence, storyboard = state.draftStoryboard) {
    const source = object(sequence?.sequenceInfo || storyboard?.sequenceInfo);
    return {
      width: Math.max(0, number(firstValue(source.width, sequence?.width), 0)),
      height: Math.max(0, number(firstValue(source.height, sequence?.height), 0)),
      fps: Math.max(0, number(firstValue(source.fps, sequence?.fps), 0)),
      duration: sequenceDuration(sequence, storyboard)
    };
  }

  function segmentStart(segment) { return Math.max(0, number(firstValue(segment?.graphicStartTime, segment?.relativeStartTime, segment?.startTime, segment?.start), 0)); }
  function segmentDuration(segment) { return Math.max(0, number(firstValue(segment?.graphicDuration, segment?.durationOverride, segment?.duration, segment?.endTime != null ? number(segment.endTime) - segmentStart(segment) : null), 0)); }
  function segmentIdentifier(segment) { return text(firstValue(segment?.segmentId, segment?.itemId, segment?.id, segment?._id)); }
  function segmentPrompt(segment) { return text(firstValue(segment?.customPrompt, segment?.optimizedPrompt, segment?.motionPrompt, segment?.prompt, segment?.suggestedPromptEnhancements)); }
  function segmentTemplateId(segment) { return text(firstValue(segment?.templateId, segment?.template?.id, segment?.selectedTemplateId)); }
  function segmentCopy(segment, index) { return text(firstValue(segment?.title, segment?.text, segment?.spokenText, segment?.transcript, segment?.intent, `Beat ${index + 1}`)); }

  function entityJoinKeys(entity) {
    return unique([entity?.segmentId, entity?.itemId, entity?.storyboardSegmentId, entity?.storyboardItemId, entity?.segment?.id, entity?.item?.id]);
  }

  function sameJoinKey(left, right) {
    const leftKeys = entityJoinKeys(left);
    const rightKeys = entityJoinKeys(right);
    return leftKeys.some(key => rightKeys.includes(key));
  }

  function sequenceScoped(items) {
    const selected = text(state.selectedSequenceId);
    const scoped = items.filter(item => text(firstValue(item?.sequenceId, item?.batchId, item?.parentSequenceId)) === selected);
    return scoped.length ? scoped : items;
  }

  function joinBySegmentIdOrItemId(segment, items, index) {
    const exact = items.find(item => sameJoinKey(segment, item));
    if (exact) return exact;
    return sequenceScoped(items)[index] || null;
  }

  function combinedJobs() {
    const embedded = arrayFrom(state.sequence, ["jobs", "items", "renders"]);
    const all = embedded.concat(state.jobs);
    const seen = new Set();
    return all.filter(job => {
      const id = text(firstValue(job?.jobId, job?.id, job?._id));
      const key = id || `${entityJoinKeys(job).join(":")}:${firstValue(job?.index, job?.segmentIndex, "")}`;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function sequencePlacements() {
    const placements = arrayFrom(state.sequence, ["placements", "placementResults", "timelineItems"]);
    if (placements.length) return placements;
    return arrayFrom(state.sequence?.result, ["placements", "items"]);
  }

  function jobId(job) { return text(firstValue(job?.jobId, job?.id, job?._id)); }
  function inboxId(item) { return text(firstValue(item?.inboxId, item?.id, item?._id)); }
  function actionId(item) { return text(firstValue(item?.operationId, item?.id, item?._id)); }

  function inboxForRecord(segment, job, index) {
    const jobIdentifier = jobId(job);
    const scoped = sequenceScoped(state.inbox);
    const exact = scoped.filter(item => {
      if (jobIdentifier && text(item?.jobId) === jobIdentifier) return true;
      return sameJoinKey(segment, item);
    });
    const candidates = exact.length ? exact : scoped.length === segmentsOf(state.draftStoryboard).length ? [scoped[index]] : [];
    return candidates.filter(Boolean).sort((a, b) => (parseDate(firstValue(b.updatedAt, b.createdAt))?.getTime() || 0) - (parseDate(firstValue(a.updatedAt, a.createdAt))?.getTime() || 0))[0] || null;
  }

  function actionsForInbox(item) {
    const id = inboxId(item);
    if (!id) return [];
    return state.actions.filter(action => text(firstValue(action?.inboxId, action?.premiereInboxId)) === id).sort((a, b) => (parseDate(firstValue(a.createdAt, a.updatedAt))?.getTime() || 0) - (parseDate(firstValue(b.createdAt, b.updatedAt))?.getTime() || 0));
  }

  function records() {
    const segments = segmentsOf(state.draftStoryboard);
    const jobs = combinedJobs();
    const placements = sequencePlacements();
    return segments.map((segment, index) => {
      const job = joinBySegmentIdOrItemId(segment, jobs, index);
      const placement = joinBySegmentIdOrItemId(segment, placements, index) || object(job?.placement);
      const inbox = inboxForRecord(segment, job, index);
      return { segment, index, job, placement, inbox, actions: actionsForInbox(inbox) };
    });
  }

  function recordKey(record) {
    return `${state.selectedSequenceId || "sequence"}:${segmentIdentifier(record?.segment) || `index-${record?.index}`}`;
  }

  function selectedRecord() {
    return records()[state.selectedIndex] || null;
  }

  function templateFor(id) {
    return state.templates.find(template => text(firstValue(template?.id, template?.templateId, template?.slug)) === text(id)) || null;
  }

  function templateName(id) {
    const template = templateFor(id);
    return text(firstValue(template?.name, template?.title, id, "No template"));
  }

  function extractGenerationPolicy(sequence, storyboard) {
    const policy = firstValue(sequence?.originalGenerationPolicy, sequence?.generationPolicy, sequence?.policy, sequence?.generationOptions, sequence?.request?.generationPolicy, storyboard?.generationPolicy);
    if (policy && typeof policy === "object") return clone(policy);
    const legacyPolicy = {};
    ["generator", "quality", "themeId", "renderMode", "qualityReview", "cacheMode", "priority", "maxRepairPasses", "maxSegmentDuration", "planningDensity", "assetResolutionMode", "origin"].forEach(key => {
      if (sequence?.[key] !== undefined && sequence[key] !== null) legacyPolicy[key] = clone(sequence[key]);
    });
    return Object.keys(legacyPolicy).length ? legacyPolicy : null;
  }

  function setPresenceCard(id, mode, title, detail) {
    const card = byId(id);
    card.className = `presence-card is-${mode}`;
    byId(`${id}Text`).textContent = title;
    byId(`${id}Detail`).textContent = detail;
  }

  function presenceActive(presence) {
    if (!presence || typeof presence !== "object") return false;
    const explicit = firstValue(presence.connected, presence.online, presence.active, presence.present, presence.cepConnected);
    if (explicit !== undefined) return Boolean(explicit);
    const seen = parseDate(firstValue(presence.lastSeenAt, presence.updatedAt, presence.heartbeatAt));
    return Boolean(seen && Date.now() - seen.getTime() < 20000);
  }

  function activeBatchFromPresence() {
    return text(firstValue(state.presence?.activeBatchId, state.presence?.activeSequenceId, state.presence?.sequenceId, state.presence?.batchId));
  }

  function renderPresence() {
    if (!state.bridgeChecked) {
      setPresenceCard("bridgePresence", "checking", "Checking connection", "Waiting for the local health endpoint.");
    } else if (state.bridgeOnline) {
      const version = text(firstValue(state.health?.bridgeVersion, state.health?.version));
      const activeJobs = number(firstValue(state.health?.activeJobs, state.health?.queue?.active), 0);
      setPresenceCard("bridgePresence", "online", "UI server ready", "Generation and rendering are not connected.");
    } else {
      const pairing = /401|403|pair|token|unauthorized/i.test(text(state.bridgeError?.message));
      setPresenceCard("bridgePresence", "offline", pairing ? "Pairing required" : "Bridge offline", pairing ? "Pair the companion from Templates or Renders." : "Start the Null Motion companion on port 4242.");
    }

    if (!state.presenceChecked) {
      setPresenceCard("cepPresence", "checking", "Checking presence", "Waiting for the CEP heartbeat endpoint.");
      return;
    }
    if (state.presenceError) {
      setPresenceCard("cepPresence", "offline", "CEP presence unavailable", state.bridgeOnline ? "The presence endpoint did not respond." : "Bridge connection is required for a heartbeat.");
      return;
    }
    if (presenceActive(state.presence)) {
      const batch = activeBatchFromPresence();
      const sequence = text(firstValue(state.presence?.sequenceName, state.presence?.activeSequenceName, state.presence?.expectedSequenceId));
      setPresenceCard("cepPresence", "online", "Premiere panel present", sequence || (batch ? `Active batch ${batch.slice(0, 10)}` : "Heartbeat is current"));
    } else {
      const seen = firstValue(state.presence?.lastSeenAt, state.presence?.updatedAt, state.presence?.heartbeatAt);
      setPresenceCard("cepPresence", state.presence ? "idle" : "offline", state.presence ? "No active CEP heartbeat" : "Premiere panel not detected", seen ? `Last seen ${formatRelativeDate(seen)}` : "Open the Null Motion CEP panel to connect.");
    }
  }

  function renderSequencePicker() {
    const picker = byId("sequencePicker");
    const batches = state.batches.slice().sort((a, b) => (parseDate(firstValue(b.updatedAt, b.createdAt))?.getTime() || 0) - (parseDate(firstValue(a.updatedAt, a.createdAt))?.getTime() || 0));
    picker.replaceChildren();
    if (!batches.length && !state.selectedSequenceId) {
      const option = document.createElement("option");
      option.textContent = !state.bridgeChecked ? "Loading sequences…" : state.bridgeOnline ? "No sequences available" : "Bridge unavailable";
      picker.appendChild(option);
      picker.disabled = true;
      return;
    }
    const knownIds = new Set();
    for (const batch of batches) {
      const id = batchId(batch);
      if (!id || knownIds.has(id)) continue;
      knownIds.add(id);
      const option = document.createElement("option");
      option.value = id;
      option.textContent = `${sequenceTitle(batch, id)} · ${statusLabel(batch.status)}`;
      picker.appendChild(option);
    }
    if (state.selectedSequenceId && !knownIds.has(state.selectedSequenceId)) {
      const option = document.createElement("option");
      option.value = state.selectedSequenceId;
      option.textContent = sequenceTitle(state.sequence, state.selectedSequenceId);
      picker.prepend(option);
    }
    picker.disabled = false;
    picker.value = state.selectedSequenceId || picker.options[0]?.value || "";
  }

  function setPageState(mode, title, detail, hidden = false) {
    const node = byId("pageState");
    node.hidden = hidden;
    node.className = `inline-state ${mode}`;
    node.querySelector("strong").textContent = title;
    node.querySelector(":scope > div > span").textContent = detail;
  }

  function renderPageState() {
    if (!state.bridgeChecked) {
      setPageState("loading", "Connecting to Null Motion", "Sequence controls appear when the local bridge responds.");
      return;
    }
    if (!state.bridgeOnline && !state.sequence) {
      setPageState("error", "Control Center is offline", state.bridgeError?.message || "Start the local companion and refresh this page.");
      return;
    }
    if (state.selectedSequenceId && !state.sequence) {
      setPageState("error", "Sequence could not be loaded", state.storyboardError?.message || `The bridge did not return sequence ${state.selectedSequenceId}.`);
      return;
    }
    if (!state.selectedSequenceId) {
      if (state.batchesError) {
        setPageState("error", "Sequence history unavailable", state.batchesError.message || "The bridge could not load recent sequence batches.");
        return;
      }
      setPageState("empty", "No sequence runs yet", "Sequence history will appear after a generation backend is connected.");
      return;
    }
    if (state.storyboardError && !state.draftStoryboard) {
      setPageState("error", "Storyboard unavailable", state.storyboardError.message || "This sequence did not return an editable storyboard.");
      return;
    }
    setPageState("empty", "", "", true);
  }

  function renderSummary() {
    const sequence = state.sequence;
    const segments = segmentsOf(state.draftStoryboard);
    const enabled = segments.filter(segment => segment.shouldRenderGraphic !== false).length;
    const status = normalizeStatus(sequence?.status);
    byId("sequenceSubtitle").textContent = sequence ? `${sequenceTitle(sequence, state.selectedSequenceId)} · ${statusLabel(status)}` : "Choose a sequence run to inspect its storyboard and output.";
    byId("summaryStatus").textContent = sequence ? statusLabel(status) : "Waiting";
    byId("summaryGraphics").textContent = segments.length ? `${enabled} of ${segments.length}` : "No storyboard";
    const duration = sequenceDuration();
    byId("summaryDuration").textContent = duration > 0 ? formatTime(duration) : "Not recorded";
    byId("summaryUpdated").textContent = sequence ? formatRelativeDate(sequenceUpdatedAt(sequence, state.draftStoryboard)) : "—";
  }

  function jobStatusFor(record) {
    return normalizeStatus(firstValue(record?.job?.status, record?.segment?.renderStatus, record?.segment?.status, "pending"));
  }

  function renderStoryboard() {
    const list = byId("storyboardList");
    const empty = byId("storyboardEmpty");
    const items = records();
    list.replaceChildren();
    byId("storyboardCount").textContent = `${items.length} beat${items.length === 1 ? "" : "s"}`;
    empty.hidden = items.length > 0;
    list.hidden = items.length === 0;
    for (const record of items) {
      const segment = record.segment;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `storyboard-card${segment.shouldRenderGraphic === false ? " is-off" : ""}`;
      button.dataset.index = String(record.index);
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", record.index === state.selectedIndex ? "true" : "false");
      const ordinal = document.createElement("span");
      ordinal.className = "storyboard-number";
      ordinal.textContent = String(record.index + 1).padStart(2, "0");
      const copy = document.createElement("span");
      copy.className = "storyboard-copy";
      const title = document.createElement("strong");
      title.textContent = segmentCopy(segment, record.index);
      title.title = title.textContent;
      const rationale = document.createElement("span");
      rationale.textContent = text(firstValue(segment.whyGraphic, segment.visualRationale, segment.intent, segment.semanticCategory, "No rationale recorded"));
      const meta = document.createElement("small");
      meta.textContent = `${formatTime(segmentStart(segment))} · ${segmentDuration(segment).toFixed(2)}s · ${templateName(segmentTemplateId(segment))}`;
      copy.append(title, rationale, meta);
      const status = document.createElement("span");
      status.className = `card-state ${jobStatusFor(record)}`;
      status.textContent = statusLabel(jobStatusFor(record));
      button.append(ordinal, copy, status);
      list.appendChild(button);
    }
  }

  function timelineLanes(items) {
    const laneEnds = [];
    const lanes = new Map();
    items.slice().sort((a, b) => segmentStart(a.segment) - segmentStart(b.segment)).forEach(record => {
      const start = segmentStart(record.segment);
      const end = start + Math.max(.05, segmentDuration(record.segment));
      let lane = laneEnds.findIndex(laneEnd => laneEnd <= start);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = end;
      lanes.set(record.index, lane);
    });
    return { lanes, count: Math.max(1, laneEnds.length) };
  }

  function renderTimeline() {
    const track = byId("timelineTrack");
    const empty = byId("timelineEmpty");
    const ruler = byId("timelineRuler");
    const items = records();
    const duration = Math.max(.001, sequenceDuration());
    track.replaceChildren();
    ruler.replaceChildren();
    if (!items.length) {
      track.hidden = true;
      ruler.hidden = true;
      empty.hidden = false;
      byId("timelineHint").textContent = "No authored beats";
      return;
    }
    track.hidden = false;
    ruler.hidden = false;
    empty.hidden = true;
    for (let index = 0; index < 6; index += 1) {
      const label = document.createElement("span");
      label.textContent = formatTime(duration * index / 5, false);
      ruler.appendChild(label);
    }
    const laneData = timelineLanes(items);
    track.style.minHeight = `${18 + laneData.count * 49}px`;
    for (const record of items) {
      const start = segmentStart(record.segment);
      const length = Math.max(.05, segmentDuration(record.segment));
      const left = Math.min(99.5, start / duration * 100);
      const width = Math.max(.7, Math.min(100 - left, length / duration * 100));
      const button = document.createElement("button");
      const status = jobStatusFor(record);
      button.type = "button";
      button.className = `timeline-beat ${status === "done" ? "is-done" : FAILURE_STATUSES.has(status) ? "is-error" : ""}${record.segment.shouldRenderGraphic === false ? " is-off" : ""}`;
      button.dataset.index = String(record.index);
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", record.index === state.selectedIndex ? "true" : "false");
      button.setAttribute("aria-label", `Beat ${record.index + 1}, ${segmentCopy(record.segment, record.index)}, starts ${formatTime(start)}, duration ${length.toFixed(2)} seconds, ${statusLabel(status)}`);
      button.style.setProperty("--left", `${left}%`);
      button.style.setProperty("--width", `${width}%`);
      button.style.setProperty("--lane", String(laneData.lanes.get(record.index) || 0));
      const label = document.createElement("b");
      label.textContent = templateName(segmentTemplateId(record.segment));
      const timing = document.createElement("span");
      timing.textContent = formatTime(start);
      button.append(label, timing);
      track.appendChild(button);
    }
    byId("timelineHint").textContent = `${items.length} authored beat${items.length === 1 ? "" : "s"} across ${formatTime(duration, false)}`;
  }

  function qualityItems(segment) {
    const raw = firstValue(segment?.qualityChecklist, segment?.acceptanceCriteria, segment?.reviewChecklist, segment?.qualityChecks);
    if (!Array.isArray(raw)) return [];
    const saved = object(segment?.qualityChecklistState);
    return raw.map((entry, index) => {
      const value = typeof entry === "string" ? { label: entry } : object(entry);
      const label = text(firstValue(value.label, value.text, value.name, value.criterion, value.check, value.description));
      const status = normalizeStatus(firstValue(value.status, value.result, ""));
      const checked = saved[index] !== undefined ? Boolean(saved[index]) : Boolean(firstValue(value.checked, value.complete, value.passed, status === "done" || status === "pass"));
      return { source: entry, index, label, checked };
    }).filter(item => item.label);
  }

  function renderChecklist(record) {
    const root = byId("qualityChecklist");
    const empty = byId("checklistEmpty");
    const items = qualityItems(record.segment);
    root.replaceChildren();
    empty.hidden = items.length > 0;
    root.hidden = items.length === 0;
    const checked = items.filter(item => item.checked).length;
    byId("checklistProgress").textContent = items.length ? `${checked} of ${items.length} checked` : "No checklist";
    for (const item of items) {
      const label = document.createElement("label");
      label.className = "check-item";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = item.checked;
      input.dataset.checkIndex = String(item.index);
      const copy = document.createElement("span");
      copy.textContent = item.label;
      label.append(input, copy);
      root.appendChild(label);
    }
  }

  function customizerValueObject(segment, create = false) {
    const keys = ["customizerValues", "customizations", "templateValues", "slotValues", "controls"];
    for (const key of keys) {
      if (segment?.[key] && typeof segment[key] === "object" && !Array.isArray(segment[key])) return { key, values: segment[key] };
    }
    if (!create) return { key: "customizerValues", values: {} };
    segment.customizerValues = {};
    return { key: "customizerValues", values: segment.customizerValues };
  }

  function customizerDefinitions(segment, template) {
    const candidates = [template?.preview?.controls, template?.customizer?.fields, template?.customizer?.controls, template?.customizerControls, template?.editableControls, template?.controls, segment?.customizer?.controls, segment?.controlDefinitions];
    const defaults = object(template?.customizer?.defaults);
    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.length) return candidate.map((definition, index) => {
        const normalized = typeof definition === "string" ? { id: definition, label: definition } : Object.assign({ id: firstValue(definition?.id, definition?.key, definition?.name, `control-${index}`) }, object(definition));
        const id = text(firstValue(normalized.id, normalized.key, normalized.name));
        if (normalized.default === undefined && defaults[id] !== undefined) normalized.default = defaults[id];
        return normalized;
      });
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate) && Object.keys(candidate).length) return Object.entries(candidate).map(([id, definition]) => {
        const normalized = typeof definition === "object" ? Object.assign({ id }, definition) : { id, label: id, default: definition };
        if (normalized.default === undefined && defaults[id] !== undefined) normalized.default = defaults[id];
        return normalized;
      });
    }
    const current = customizerValueObject(segment).values;
    return Object.keys(current).map(id => ({ id, label: id, type: typeof current[id] === "boolean" ? "boolean" : typeof current[id] === "number" ? "number" : "text" }));
  }

  function controlType(definition, value) {
    const type = text(firstValue(definition?.type, definition?.control, definition?.kind)).toLowerCase();
    if (Array.isArray(definition?.options) || ["select", "enum", "dropdown"].includes(type)) return "select";
    if (["boolean", "toggle", "checkbox"].includes(type) || typeof value === "boolean") return "checkbox";
    if (["color", "colour"].includes(type) || /^#[0-9a-f]{3,8}$/i.test(text(value))) return "color";
    if (["number", "range", "slider"].includes(type) || typeof value === "number") return type === "range" || type === "slider" ? "range" : "number";
    if (["textarea", "multiline", "long-text"].includes(type)) return "textarea";
    return "text";
  }

  function renderCustomizer(record) {
    const root = byId("customizerControls");
    const empty = byId("customizerEmpty");
    const template = templateFor(segmentTemplateId(record.segment));
    const definitions = customizerDefinitions(record.segment, template);
    const values = customizerValueObject(record.segment).values;
    root.replaceChildren();
    empty.hidden = definitions.length > 0;
    root.hidden = definitions.length === 0;
    byId("customizerCount").textContent = `${definitions.length} control${definitions.length === 1 ? "" : "s"}`;
    for (const definition of definitions) {
      const id = text(firstValue(definition.id, definition.key, definition.name));
      if (!id) continue;
      const current = values[id] !== undefined ? values[id] : firstValue(definition.value, definition.default, "");
      const type = controlType(definition, current);
      const label = document.createElement("label");
      label.className = `field customizer-control${type === "textarea" ? " wide" : ""}`;
      const caption = document.createElement("span");
      caption.textContent = text(firstValue(definition.label, definition.title, definition.name, id)).replace(/[-_]/g, " ");
      let input;
      if (type === "select") {
        input = document.createElement("select");
        for (const optionValue of definition.options || []) {
          const normalized = typeof optionValue === "object" ? optionValue : { value: optionValue, label: optionValue };
          const option = document.createElement("option");
          option.value = text(firstValue(normalized.value, normalized.id, normalized.label));
          option.textContent = text(firstValue(normalized.label, normalized.name, normalized.value));
          input.appendChild(option);
        }
        input.value = text(current);
      } else if (type === "textarea") {
        input = document.createElement("textarea");
        input.rows = 3;
        input.value = text(current);
      } else {
        input = document.createElement("input");
        input.type = type;
        if (type === "checkbox") input.checked = Boolean(current);
        else input.value = text(current);
        if (["number", "range"].includes(type)) {
          if (definition.min !== undefined) input.min = definition.min;
          if (definition.max !== undefined) input.max = definition.max;
          input.step = firstValue(definition.step, "any");
        }
      }
      input.dataset.controlId = id;
      input.dataset.controlType = type;
      label.append(caption, input);
      root.appendChild(label);
    }
  }

  function authoredPlayerPath(record) {
    const template = templateFor(segmentTemplateId(record?.segment));
    return firstValue(record?.segment?.preview?.playerPath, record?.segment?.authoredPreview?.playerPath, record?.segment?.playerPath, template?.preview?.playerPath, template?.playerPath);
  }

  function renderAuthoredPreview(record) {
    const frame = byId("authoredFrame");
    const empty = byId("authoredEmpty");
    const badge = byId("authoredBadge");
    const url = canonicalAuthoredPlayerUrl(authoredPlayerPath(record));
    if (!url) {
      frame.hidden = true;
      frame.removeAttribute("src");
      frame.dataset.source = "";
      empty.hidden = false;
      badge.textContent = "Unavailable";
      badge.className = "preview-badge";
      ["playPreview", "pausePreview", "restartPreview"].forEach(id => { byId(id).disabled = true; });
      return;
    }
    empty.hidden = true;
    frame.hidden = false;
    if (frame.dataset.source !== url) {
      frame.dataset.source = url;
      frame.src = `${url}#play`;
    }
    badge.textContent = "Authored source";
    badge.className = "preview-badge is-ready";
    ["playPreview", "pausePreview", "restartPreview"].forEach(id => { byId(id).disabled = false; });
  }

  function renderedSources(record) {
    if (FAILURE_STATUSES.has(jobStatusFor(record))) return { player: "", frame: "" };
    const job = record?.job || {};
    const preview = object(job.preview);
    const instant = object(job.instantPreview);
    const player = safeHttpUrl(firstValue(job.renderedPlayerUrl, job.playerUrl, preview.renderedPlayerUrl, preview.playerUrl, instant.playerUrl, job.instantPlayerUrl));
    const instantUrl = safeHttpUrl(firstValue(job.instantPreviewUrl, instant.url, preview.instantUrl));
    const frame = safeHttpUrl(firstValue(job.frameUrl, job.reviewFrameUrl, preview.frameUrl, instant.frameUrl, job.thumbUrl, job.thumbnailUrl));
    const inferredInstantFrame = /\.(?:png|jpe?g|webp)(?:[?#]|$)/i.test(instantUrl) ? instantUrl : "";
    const inferredInstantPlayer = instantUrl && !inferredInstantFrame ? instantUrl : "";
    return { player: player || inferredInstantPlayer, frame: frame || inferredInstantFrame };
  }

  function renderRenderedPreview(record) {
    const frame = byId("renderedFrame");
    const image = byId("renderedImage");
    const empty = byId("renderedEmpty");
    const badge = byId("renderedBadge");
    const caption = byId("renderedCaption");
    const status = jobStatusFor(record);
    const sources = renderedSources(record);
    frame.hidden = true;
    image.hidden = true;
    empty.hidden = true;
    if (sources.player) {
      frame.hidden = false;
      if (frame.dataset.source !== sources.player) { frame.dataset.source = sources.player; frame.src = sources.player; }
    } else if (sources.frame) {
      image.hidden = false;
      if (image.dataset.source !== sources.frame) { image.dataset.source = sources.frame; image.src = sources.frame; }
      image.alt = `${segmentCopy(record.segment, record.index)} rendered frame`;
    } else {
      empty.hidden = false;
      empty.querySelector("strong").textContent = status === "done" ? "Preview URL not returned" : isTerminal(status) ? `Render ${statusLabel(status).toLowerCase()}` : "Rendered output pending";
      empty.querySelector("span").textContent = status === "done" ? "The render completed without a player, instant preview, or sampled frame URL." : text(firstValue(record?.job?.error, record?.job?.step, `Current status: ${statusLabel(status)}.`));
    }
    badge.textContent = statusLabel(status);
    badge.className = `preview-badge${status === "done" ? " is-ready" : FAILURE_STATUSES.has(status) ? " is-error" : ""}`;
    const jobIdentifier = jobId(record?.job);
    caption.textContent = jobIdentifier ? `Job ${jobIdentifier} · ${statusLabel(status)}${record?.job?.step ? ` · ${record.job.step}` : ""}` : state.jobsError ? `Render job library unavailable: ${state.jobsError.message}` : "No render job is joined to this storyboard beat.";
  }

  function existingReview(record) {
    const saved = state.reviewByKey.get(recordKey(record));
    if (saved) return saved;
    const direct = firstValue(record?.job?.qualityReview, record?.job?.review, record?.segment?.qualityReview, record?.segment?.review);
    if (direct) return direct;
    if (record?.job?.qualityAudit || record?.job?.visualReview) return { qualityAudit: record.job.qualityAudit, visualReview: record.job.visualReview, pass: record.job.visualReview?.pass };
    return null;
  }

  function reviewPassed(review) {
    if (!review) return null;
    const explicit = firstValue(review.pass, review.passed, review.accepted, review.ok, review.success);
    if (explicit !== undefined) return Boolean(explicit);
    const verdict = normalizeStatus(firstValue(review.status, review.verdict, review.result));
    if (["pass", "passed", "accepted", "approved", "done"].includes(verdict)) return true;
    if (["fail", "failed", "rejected", "error", "needs-repair"].includes(verdict)) return false;
    return null;
  }

  function reviewChecks(review) {
    const checks = arrayFrom(review, ["checks", "issues", "findings", "criteria", "results"])
      .concat(arrayFrom(review?.qualityAudit, ["issues", "criticalIssues"]))
      .concat(arrayFrom(review?.visualReview, ["criticalArtifacts", "frameNotes"]));
    return checks.map(item => typeof item === "string" ? { text: item, passed: null } : {
      text: text(firstValue(item?.label, item?.name, item?.message, item?.issue, item?.criterion, item?.description)),
      passed: firstValue(item?.passed, item?.ok, normalizeStatus(item?.status) === "pass" ? true : normalizeStatus(item?.status) === "fail" ? false : null)
    }).filter(item => item.text);
  }

  function setStatusPill(node, tone, label) {
    node.className = `status-pill ${tone}`;
    node.replaceChildren();
    const mark = document.createElement("span");
    mark.setAttribute("aria-hidden", "true");
    node.append(mark, document.createTextNode(label));
  }

  function renderReview(record) {
    const review = existingReview(record);
    const body = byId("reviewBody");
    const badge = byId("reviewBadge");
    body.replaceChildren();
    if (!review) {
      const paragraph = document.createElement("p");
      paragraph.textContent = "No rendered review has been run for this beat.";
      body.appendChild(paragraph);
      setStatusPill(badge, "neutral", "Not reviewed");
    } else {
      const passed = reviewPassed(review);
      setStatusPill(badge, passed === true ? "success" : passed === false ? "error" : "warning", passed === true ? "Review passed" : passed === false ? "Repair advised" : "Review returned");
      const summary = text(firstValue(review.summary, review.message, review.rationale, review.verdict, review.visualReview?.repairInstructions, Array.isArray(review.visualReview?.strengths) ? review.visualReview.strengths.join(" · ") : review.visualReview?.strengths));
      if (summary) {
        const paragraph = document.createElement("p");
        paragraph.textContent = summary;
        body.appendChild(paragraph);
      }
      const checks = reviewChecks(review);
      if (checks.length) {
        const list = document.createElement("ul");
        list.className = "review-list";
        for (const check of checks) {
          const item = document.createElement("li");
          item.className = check.passed === true ? "pass" : check.passed === false ? "fail" : "";
          item.textContent = check.text;
          list.appendChild(item);
        }
        body.appendChild(list);
      }
      if (!summary && !checks.length) {
        const paragraph = document.createElement("p");
        paragraph.textContent = "The review endpoint returned a result without a textual summary or checklist.";
        body.appendChild(paragraph);
      }
    }
    const done = jobStatusFor(record) === "done" && Boolean(jobId(record.job));
    byId("reviewButton").disabled = !done || state.actionBusy;
    byId("repairButton").disabled = !done || !review || reviewPassed(review) === true || state.actionBusy;
  }

  function actionStatus(action) { return normalizeStatus(firstValue(action?.status, action?.result?.status, action?.result, action?.error ? "error" : "pending")); }

  function renderPremiere(record) {
    const badge = byId("handoffBadge");
    const history = byId("actionHistory");
    const inbox = record.inbox;
    const actions = record.actions;
    const status = normalizeStatus(actions.length ? actionStatus(actions[actions.length - 1]) : inbox?.status || "pending");
    setStatusPill(badge, inbox ? statusTone(status) : "neutral", inbox ? statusLabel(status) : "Not sent");
    history.replaceChildren();
    if (!inbox) {
      const paragraph = document.createElement("p");
      paragraph.textContent = state.inboxError ? `Premiere inbox unavailable: ${state.inboxError.message}` : "No Premiere actions for this beat.";
      history.appendChild(paragraph);
    } else {
      const list = document.createElement("ul");
      list.className = "history-list";
      const inboxRow = { action: "send", status: inbox.status || "pending", createdAt: inbox.createdAt, updatedAt: inbox.updatedAt, error: inbox.error };
      for (const entry of [inboxRow].concat(actions)) {
        const item = document.createElement("li");
        const entryStatus = normalizeStatus(firstValue(entry?.status, entry?.result?.status, entry?.error ? "error" : "pending"));
        item.className = entryStatus;
        const mark = document.createElement("i");
        mark.setAttribute("aria-hidden", "true");
        const copy = document.createElement("span");
        const action = text(firstValue(entry?.action, "send")).replace(/-/g, " ");
        copy.textContent = `${action.replace(/^./, letter => letter.toUpperCase())} · ${entry?.error || statusLabel(entryStatus)}`;
        const time = document.createElement("time");
        time.textContent = formatRelativeDate(firstValue(entry?.updatedAt, entry?.createdAt));
        item.append(mark, copy, time);
        list.appendChild(item);
      }
      history.appendChild(list);
      if (state.actionsError) {
        const paragraph = document.createElement("p");
        paragraph.textContent = `Action history unavailable: ${state.actionsError.message}`;
        paragraph.className = "history-error";
        history.appendChild(paragraph);
      }
    }

    const done = jobStatusFor(record) === "done" && Boolean(jobId(record.job));
    const latestSuccessfulInsert = actions.some(action => text(action?.action) === "insert" && SUCCESS_STATUSES.has(actionStatus(action))) || status === "inserted";
    const rolledBack = actions.some(action => text(action?.action) === "rollback" && SUCCESS_STATUSES.has(actionStatus(action)));
    byId("sendCepButton").disabled = !done || state.actionBusy;
    byId("saveBinButton").disabled = !inbox || state.actionBusy;
    byId("insertButton").disabled = !inbox || state.actionBusy;
    byId("rollbackButton").disabled = !inbox || !latestSuccessfulInsert || rolledBack || state.actionBusy;
  }

  function renderProposal() {
    const panel = byId("proposalPanel");
    const proposal = state.proposal;
    panel.hidden = !proposal;
    if (!proposal) return;
    byId("proposalHeading").textContent = proposal.type === "analysis" ? "Beat analysis proposal" : "Prompt proposal";
    byId("proposalBefore").textContent = proposal.before;
    byId("proposalAfter").textContent = proposal.after;
    const list = byId("proposalChanges");
    list.replaceChildren();
    const changes = proposal.changes.length ? proposal.changes : ["The endpoint returned no material field changes."];
    for (const change of changes) {
      const item = document.createElement("li");
      item.textContent = change;
      list.appendChild(item);
    }
    byId("applyProposal").disabled = proposal.changes.length === 0;
  }

  function renderInspector(forceEditor = false) {
    const record = selectedRecord();
    const preserveDirtyEditor = state.dirty && !forceEditor;
    const empty = byId("inspectorEmpty");
    const form = byId("inspectorForm");
    empty.hidden = Boolean(record);
    form.hidden = !record;
    byId("dirtyState").textContent = state.dirty ? "Unsaved edits" : "No unsaved edits";
    byId("dirtyState").classList.toggle("is-dirty", state.dirty);
    if (!record) {
      renderProposal();
      return;
    }
    const segment = record.segment;
    byId("selectedNumber").textContent = String(record.index + 1).padStart(2, "0");
    byId("selectedTitle").textContent = segmentCopy(segment, record.index);
    byId("selectedMeta").textContent = `${formatTime(segmentStart(segment))} · ${segmentDuration(segment).toFixed(2)} seconds · ${statusLabel(jobStatusFor(record))}`;
    if (!preserveDirtyEditor) {
      byId("segmentEnabled").checked = segment.shouldRenderGraphic !== false;
      byId("promptEditor").value = segmentPrompt(segment);
      byId("promptMeta").textContent = `${segmentPrompt(segment).length.toLocaleString()} characters · edits remain local until a revision is created.`;
      byId("startTimeInput").value = String(segmentStart(segment));
      byId("durationInput").value = String(segmentDuration(segment));
      byId("absoluteTime").value = String(Math.max(0, number(firstValue(record.placement?.absoluteStartTime, record.job?.absoluteStartTime, record.placement?.startTime, segmentStart(segment)))));

      const select = byId("templateSelect");
      const currentTemplate = segmentTemplateId(segment);
      select.replaceChildren();
      const none = document.createElement("option");
      none.value = "";
      none.textContent = "No template selected";
      select.appendChild(none);
      const known = new Set();
      for (const template of state.templates) {
        const id = text(firstValue(template?.id, template?.templateId, template?.slug));
        if (!id || known.has(id)) continue;
        known.add(id);
        const option = document.createElement("option");
        option.value = id;
        option.textContent = text(firstValue(template?.name, template?.title, id));
        select.appendChild(option);
      }
      if (currentTemplate && !known.has(currentTemplate)) {
        const option = document.createElement("option");
        option.value = currentTemplate;
        option.textContent = `${currentTemplate} · unavailable in current catalog`;
        select.appendChild(option);
      }
      select.value = currentTemplate;
      renderCustomizer(record);
      renderChecklist(record);
    }
    const policy = state.originalGenerationPolicy;
    byId("generationPolicy").textContent = policy ? JSON.stringify(policy, null, 2) : "No generation policy was recorded for this sequence.";
    const revisionConflict = state.remoteChangedWhileDirty ? "The remote sequence changed after editing began. Saving may return a conflict; your local edits have not been overwritten." : "The original sequence stays available.";
    byId("revisionNote").textContent = revisionConflict;
    byId("saveDraftButton").disabled = !state.dirty || state.actionBusy;
    byId("renderRevisionButton").disabled = state.actionBusy;
    renderAuthoredPreview(record);
    renderRenderedPreview(record);
    renderReview(record);
    renderPremiere(record);
    renderProposal();
  }

  function renderAll(forceEditor = false) {
    renderPresence();
    renderSequencePicker();
    renderPageState();
    renderSummary();
    renderStoryboard();
    renderTimeline();
    renderInspector(forceEditor);
  }

  function updatedSignature(sequence, storyboard) {
    return text(sequenceUpdatedAt(sequence, storyboard) || `${segmentsOf(storyboard).length}:${sequence?.status || ""}`);
  }

  function hydrateDraft(sequence, storyboard) {
    state.originalStoryboard = storyboard ? clone(storyboard) : null;
    state.draftStoryboard = storyboard ? clone(storyboard) : null;
    state.storyboard = storyboard || null;
    state.originalGenerationPolicy = extractGenerationPolicy(sequence, storyboard);
    state.baseUpdatedAt = sequenceUpdatedAt(sequence, storyboard);
    state.hydratedUpdatedAt = updatedSignature(sequence, storyboard);
    state.dirty = false;
    state.remoteChangedWhileDirty = false;
    state.proposal = null;
    const count = segmentsOf(state.draftStoryboard).length;
    state.selectedIndex = count ? Math.min(Math.max(state.selectedIndex, 0), count - 1) : -1;
  }

  function applySequenceBundle(id, bundle) {
    const previousId = state.selectedSequenceId;
    const changedSelection = previousId !== id;
    state.selectedSequenceId = id;
    state.sequence = bundle.sequence;
    state.storyboardError = bundle.storyboardError || null;
    const signature = updatedSignature(bundle.sequence, bundle.storyboard);
    if (changedSelection || !state.draftStoryboard) {
      state.selectedIndex = segmentsOf(bundle.storyboard).length ? 0 : -1;
      hydrateDraft(bundle.sequence, bundle.storyboard);
      return;
    }
    if (state.dirty) {
      if (state.hydratedUpdatedAt && signature && signature !== state.hydratedUpdatedAt) state.remoteChangedWhileDirty = true;
      return;
    }
    if (signature !== state.hydratedUpdatedAt || bundle.storyboard !== state.storyboard) hydrateDraft(bundle.sequence, bundle.storyboard);
  }

  async function fetchSequenceBundle(id, signal) {
    const sequencePayload = await api(`/api/v1/sequences/${encodeURIComponent(id)}`, { signal });
    const sequence = unwrapSequence(sequencePayload);
    if (!Object.keys(sequence).length) throw new ApiError("The sequence endpoint returned an empty response.", 502, `/api/v1/sequences/${id}`);
    let storyboard = sequence.storyboard && typeof sequence.storyboard === "object" ? unwrapStoryboard(sequence.storyboard) : null;
    let storyboardError = null;
    const storyboardId = text(firstValue(sequence.storyboardId, sequence.storyboard?.id, sequence.storyboard?.storyboardId, sequencePayload?.storyboardId, id));
    if (!storyboard || !segmentsOf(storyboard).length) {
      try {
        const payload = await api(`/api/v1/storyboards/${encodeURIComponent(storyboardId)}`, { signal });
        const fetched = unwrapStoryboard(payload);
        if (Object.keys(fetched).length) storyboard = fetched;
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        storyboardError = error;
      }
    }
    return { sequence, storyboard, storyboardError };
  }

  function selectionCandidates() {
    const query = new URLSearchParams(location.search);
    const urlSequenceId = text(firstValue(query.get("sequence"), query.get("sequenceId"), query.get("batchId")));
    const cepActiveBatchId = activeBatchFromPresence();
    const savedSequenceId = text(storageGet(SAVED_SEQUENCE_KEY));
    const newestSequenceId = batchId(state.batches.slice().sort((a, b) => (parseDate(firstValue(b.updatedAt, b.createdAt))?.getTime() || 0) - (parseDate(firstValue(a.updatedAt, a.createdAt))?.getTime() || 0))[0]);
    return unique([urlSequenceId, cepActiveBatchId, savedSequenceId, newestSequenceId]);
  }

  function persistSelection(id) {
    storageSet(SAVED_SEQUENCE_KEY, id);
    try {
      const url = new URL(location.href);
      url.searchParams.set("sequence", id);
      url.searchParams.delete("sequenceId");
      url.searchParams.delete("batchId");
      history.replaceState(null, "", url);
    } catch (_) {}
  }

  async function resolveInitialSelection(signal) {
    const candidates = selectionCandidates();
    let lastError = null;
    for (const id of candidates) {
      try {
        const bundle = await fetchSequenceBundle(id, signal);
        applySequenceBundle(id, bundle);
        persistSelection(id);
        state.initializedSelection = true;
        return;
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        lastError = error;
      }
    }
    state.initializedSelection = true;
    if (lastError && candidates.length) state.storyboardError = lastError;
  }

  async function refreshSelectedSequence(signal) {
    if (!state.selectedSequenceId) return;
    try {
      const bundle = await fetchSequenceBundle(state.selectedSequenceId, signal);
      applySequenceBundle(state.selectedSequenceId, bundle);
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      state.storyboardError = error;
      if (!state.sequence) state.sequence = null;
    }
  }

  async function refreshCycle(signal, generation) {
    const [health, presence, catalog, theme, batches, jobs, inbox, actions] = await Promise.all([
      settled(api("/api/v1/health", { signal })),
      settled(api("/api/v1/premiere-presence", { signal })),
      settled(api("/api/v1/templates", { signal })),
      settled(api("/api/user/active-theme", { signal })),
      settled(api("/api/v1/sequence-batches?limit=60", { signal })),
      settled(api("/api/v1/jobs", { signal })),
      settled(api("/api/v1/premiere-inbox?status=pending,claimed,inserted,dismissed&limit=200", { signal })),
      settled(api("/api/v1/premiere-actions?limit=200", { signal }))
    ]);
    if (generation !== pollGeneration || signal.aborted) return;

    state.bridgeChecked = true;
    state.bridgeOnline = health.ok;
    state.bridgeError = health.ok ? null : health.error;
    if (health.ok) state.health = health.value;
    state.presenceChecked = true;
    state.presenceError = presence.ok ? null : presence.error;
    if (presence.ok) state.presence = object(presence.value?.presence || presence.value);
    state.templatesError = catalog.ok ? null : catalog.error;
    if (catalog.ok) state.templates = arrayFrom(catalog.value, ["templates", "items"]);
    state.themeError = theme.ok ? null : theme.error;
    if (theme.ok) state.theme = theme.value?.theme || theme.value?.activeTheme || null;
    state.batchesError = batches.ok ? null : batches.error;
    if (batches.ok) state.batches = arrayFrom(batches.value, ["batches", "sequences", "items"]);
    state.jobsError = jobs.ok ? null : jobs.error;
    if (jobs.ok) state.jobs = arrayFrom(jobs.value, ["jobs", "items"]);
    state.inboxError = inbox.ok ? null : inbox.error;
    if (inbox.ok) state.inbox = arrayFrom(inbox.value, ["items", "inbox", "entries"]);
    state.actionsError = actions.ok ? null : actions.error;
    if (actions.ok) state.actions = arrayFrom(actions.value, ["actions", "items", "entries"]);

    if (!state.selectedSequenceId) await resolveInitialSelection(signal);
    else await refreshSelectedSequence(signal);
    if (generation !== pollGeneration || signal.aborted) return;
    renderAll();
  }

  function startPolling(delay = 0) {
    pollGeneration += 1;
    const generation = pollGeneration;
    clearTimeout(pollTimer);
    pollController?.abort();

    const run = async () => {
      if (generation !== pollGeneration) return;
      if (document.hidden) {
        pollTimer = setTimeout(run, POLL_OFFLINE_MS);
        return;
      }
      const controller = new AbortController();
      pollController = controller;
      byId("refreshButton").classList.add("is-busy");
      try {
        await refreshCycle(controller.signal, generation);
      } catch (error) {
        if (error?.name !== "AbortError") {
          state.bridgeChecked = true;
          state.bridgeOnline = false;
          state.bridgeError = error;
          renderAll();
        }
      } finally {
        if (pollController === controller) pollController = null;
        byId("refreshButton").classList.remove("is-busy");
        if (generation === pollGeneration) pollTimer = setTimeout(run, state.bridgeOnline ? POLL_ONLINE_MS : POLL_OFFLINE_MS);
      }
    };

    pollTimer = setTimeout(run, delay);
  }

  function markDirty() {
    state.dirty = true;
    byId("dirtyState").textContent = "Unsaved edits";
    byId("dirtyState").classList.add("is-dirty");
    byId("saveDraftButton").disabled = state.actionBusy;
  }

  function selectRecord(index, focus = false) {
    const count = segmentsOf(state.draftStoryboard).length;
    if (!count) return;
    state.selectedIndex = Math.max(0, Math.min(count - 1, Number(index) || 0));
    state.proposal = null;
    renderStoryboard();
    renderTimeline();
    renderInspector(true);
    if (focus) byId("inspectorHeading").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  function updateSegmentPrompt(value) {
    const record = selectedRecord();
    if (!record) return;
    record.segment.customPrompt = value;
    markDirty();
    byId("promptMeta").textContent = `${value.length.toLocaleString()} characters · unsaved local edit.`;
  }

  function updateTiming() {
    const record = selectedRecord();
    if (!record) return;
    const durationLimit = sequenceDuration();
    const start = Math.max(0, number(byId("startTimeInput").value));
    const duration = Math.max(.1, number(byId("durationInput").value, .1));
    record.segment.graphicStartTime = durationLimit ? Math.min(start, durationLimit) : start;
    record.segment.graphicDuration = duration;
    record.segment.durationOverride = duration;
    byId("startTimeInput").value = String(record.segment.graphicStartTime);
    byId("durationInput").value = String(duration);
    if (firstValue(record.placement?.absoluteStartTime, record.job?.absoluteStartTime, record.placement?.startTime) === undefined) byId("absoluteTime").value = String(record.segment.graphicStartTime);
    markDirty();
    renderTimeline();
    renderStoryboard();
    byId("selectedMeta").textContent = `${formatTime(record.segment.graphicStartTime)} · ${duration.toFixed(2)} seconds · ${statusLabel(jobStatusFor(record))}`;
  }

  function proposalSummary(patch) {
    const summary = {};
    if (patch.customPrompt !== undefined) summary.prompt = patch.customPrompt;
    if (patch.graphicStartTime !== undefined) summary.startTime = patch.graphicStartTime;
    if (patch.graphicDuration !== undefined) summary.duration = patch.graphicDuration;
    if (patch.templateId !== undefined) summary.template = patch.templateId;
    if (patch.customizerValues !== undefined) summary.customizer = patch.customizerValues;
    return JSON.stringify(summary, null, 2);
  }

  function currentProposalSummary(segment, patch) {
    const current = {};
    if (patch.customPrompt !== undefined) current.prompt = segmentPrompt(segment);
    if (patch.graphicStartTime !== undefined) current.startTime = segmentStart(segment);
    if (patch.graphicDuration !== undefined) current.duration = segmentDuration(segment);
    if (patch.templateId !== undefined) current.template = segmentTemplateId(segment);
    if (patch.customizerValues !== undefined) current.customizer = clone(customizerValueObject(segment).values);
    return JSON.stringify(current, null, 2);
  }

  function changesForPatch(segment, patch) {
    const changes = [];
    if (patch.customPrompt !== undefined && text(patch.customPrompt) !== segmentPrompt(segment)) changes.push("Production prompt changed");
    if (patch.graphicStartTime !== undefined && number(patch.graphicStartTime) !== segmentStart(segment)) changes.push(`Start moves from ${formatTime(segmentStart(segment))} to ${formatTime(patch.graphicStartTime)}`);
    if (patch.graphicDuration !== undefined && number(patch.graphicDuration) !== segmentDuration(segment)) changes.push(`Duration changes from ${segmentDuration(segment).toFixed(2)}s to ${number(patch.graphicDuration).toFixed(2)}s`);
    if (patch.templateId !== undefined && text(patch.templateId) !== segmentTemplateId(segment)) changes.push(`Template changes from ${templateName(segmentTemplateId(segment))} to ${templateName(patch.templateId)}`);
    if (patch.customizerValues !== undefined && JSON.stringify(patch.customizerValues) !== JSON.stringify(customizerValueObject(segment).values)) changes.push("Template customizer values changed");
    return changes;
  }

  function setProposal(type, patch) {
    const record = selectedRecord();
    if (!record) return;
    state.proposal = {
      type,
      patch,
      before: currentProposalSummary(record.segment, patch),
      after: proposalSummary(patch),
      changes: changesForPatch(record.segment, patch)
    };
    renderProposal();
    byId("proposalPanel").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
  }

  function policyValue(...keys) {
    for (const key of keys) {
      const value = state.originalGenerationPolicy?.[key];
      if (value !== undefined && value !== null && value !== "") return value;
      const sequenceValue = state.sequence?.[key];
      if (sequenceValue !== undefined && sequenceValue !== null && sequenceValue !== "") return sequenceValue;
    }
    return undefined;
  }

  async function reprompt() {
    const record = selectedRecord();
    if (!record) return;
    const prompt = segmentPrompt(record.segment).trim();
    if (!prompt) { showToast("This beat has no prompt to optimize.", true); return; }
    const button = byId("repromptButton");
    setBusy(button, true, "Building proposal…");
    try {
      const info = sequenceInfo();
      const response = await api("/api/prompts/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          generator: policyValue("generator", "provider"),
          engine: policyValue("engine", "backend") || "hyperframes",
          duration: segmentDuration(record.segment),
          width: info.width || undefined,
          height: info.height || undefined,
          fps: info.fps || undefined,
          outputSpec: {
            duration: segmentDuration(record.segment),
            width: info.width || undefined,
            height: info.height || undefined,
            fps: info.fps || undefined
          },
          themeId: firstValue(state.theme?.id, policyValue("themeId")),
          templateId: segmentTemplateId(record.segment),
          origin: "website-control-center"
        })
      });
      const proposed = text(firstValue(response?.optimizedPrompt, response?.prompt, response?.result?.optimizedPrompt)).trim();
      if (!proposed) throw new Error("The optimizer returned no reviewable prompt.");
      setProposal("prompt", { customPrompt: proposed });
    } catch (error) {
      showToast(error.message || "Could not create a prompt proposal.", true);
    } finally { setBusy(button, false); }
  }

  function findProposedSegment(storyboard, current, index) {
    const candidates = segmentsOf(storyboard);
    const id = segmentIdentifier(current);
    return candidates.find(candidate => id && segmentIdentifier(candidate) === id) || candidates[index] || null;
  }

  async function reanalyze() {
    const record = selectedRecord();
    if (!record) return;
    const transcript = text(firstValue(state.sequence?.transcript, state.sequence?.sourceTranscript, state.draftStoryboard?.transcript, state.draftStoryboard?.source, record.segment?.text, record.segment?.spokenText)).trim();
    if (!transcript) { showToast("No transcript text is available for re-analysis.", true); return; }
    const button = byId("reanalyzeButton");
    setBusy(button, true, "Analyzing beat…");
    try {
      const response = await api("/api/v1/psychology-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          sequenceInfo: sequenceInfo(),
          userPrompt: `Re-analyze storyboard beat ${record.index + 1} without applying changes. Current production prompt:\n${segmentPrompt(record.segment)}`,
          generator: policyValue("generator", "provider"),
          mode: "control-center-reanalysis",
          origin: "website-control-center",
          deepAnalysis: true,
          directorMode: "review",
          themeId: firstValue(state.theme?.id, policyValue("themeId")),
          focusSegmentId: segmentIdentifier(record.segment) || undefined
        })
      });
      const proposedSegment = response?.segment || findProposedSegment(response?.storyboard || response, record.segment, record.index);
      if (!proposedSegment) throw new Error("The analysis returned no matching storyboard beat.");
      const patch = {};
      const proposedPrompt = segmentPrompt(proposedSegment);
      if (proposedPrompt) patch.customPrompt = proposedPrompt;
      const proposedStart = firstValue(proposedSegment.graphicStartTime, proposedSegment.relativeStartTime, proposedSegment.startTime);
      const proposedDuration = firstValue(proposedSegment.graphicDuration, proposedSegment.durationOverride, proposedSegment.duration);
      const proposedTemplate = segmentTemplateId(proposedSegment);
      if (proposedStart !== undefined) patch.graphicStartTime = number(proposedStart);
      if (proposedDuration !== undefined) patch.graphicDuration = Math.max(.1, number(proposedDuration, segmentDuration(record.segment)));
      if (proposedTemplate) patch.templateId = proposedTemplate;
      const proposedCustomizer = customizerValueObject(proposedSegment).values;
      if (Object.keys(proposedCustomizer).length) patch.customizerValues = clone(proposedCustomizer);
      if (!Object.keys(patch).length) throw new Error("The analysis returned no reviewable field proposal.");
      setProposal("analysis", patch);
    } catch (error) {
      showToast(error.message || "Could not create an analysis proposal.", true);
    } finally { setBusy(button, false); }
  }

  function applyProposal() {
    const record = selectedRecord();
    const proposal = state.proposal;
    if (!record || !proposal) return;
    const patch = proposal.patch;
    if (patch.customPrompt !== undefined) record.segment.customPrompt = text(patch.customPrompt);
    if (patch.graphicStartTime !== undefined) record.segment.graphicStartTime = Math.max(0, number(patch.graphicStartTime));
    if (patch.graphicDuration !== undefined) {
      record.segment.graphicDuration = Math.max(.1, number(patch.graphicDuration));
      record.segment.durationOverride = record.segment.graphicDuration;
    }
    if (patch.templateId !== undefined) record.segment.templateId = text(patch.templateId);
    if (patch.customizerValues !== undefined) record.segment.customizerValues = clone(patch.customizerValues);
    state.proposal = null;
    markDirty();
    renderAll(true);
    showToast("Proposal applied locally. Create a revision to save it.");
  }

  function revisionPayload({ render, repair = false }) {
    const originalPolicy = clone(state.originalGenerationPolicy || {});
    const generationPolicy = clone(originalPolicy);
    if (repair) {
      generationPolicy.cacheMode = "refresh";
      generationPolicy.qualityReview = "strict";
      generationPolicy.reviewMode = "strict";
      generationPolicy.maxRepairPasses = Math.max(1, number(generationPolicy.maxRepairPasses, 1));
    }
    return {
      baseUpdatedAt: state.baseUpdatedAt || null,
      storyboard: clone(state.draftStoryboard),
      editedStoryboard: clone(state.draftStoryboard),
      generationPolicy,
      originalGenerationPolicy: originalPolicy,
      render: Boolean(render),
      cacheMode: repair ? "refresh" : firstValue(generationPolicy.cacheMode, "use"),
      qualityReview: repair ? "strict" : generationPolicy.qualityReview,
      revisionType: repair ? "repair" : render ? "render" : "draft",
      preserveOriginal: true,
      origin: "website-control-center"
    };
  }

  function responseSequenceId(response) {
    return text(firstValue(response?.sequenceId, response?.batchId, response?.revisionId, response?.sequence?.id, response?.revision?.id, response?.id));
  }

  async function createRevision(render) {
    if (!state.selectedSequenceId || !state.draftStoryboard) return;
    const button = render ? byId("renderRevisionButton") : byId("saveDraftButton");
    state.actionBusy = true;
    renderInspector();
    setBusy(button, true, render ? "Starting revision…" : "Saving draft…");
    try {
      const response = await api(`/api/v1/sequences/${encodeURIComponent(state.selectedSequenceId)}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(revisionPayload({ render }))
      });
      const id = responseSequenceId(response);
      state.dirty = false;
      state.remoteChangedWhileDirty = false;
      if (id && id !== state.selectedSequenceId) {
        state.selectedSequenceId = id;
        state.sequence = null;
        state.draftStoryboard = null;
        state.initializedSelection = true;
        persistSelection(id);
      } else if (response?.sequence || response?.storyboard) {
        const sequence = unwrapSequence(response.sequence || response);
        const storyboard = response.storyboard ? unwrapStoryboard(response.storyboard) : state.draftStoryboard;
        applySequenceBundle(state.selectedSequenceId, { sequence, storyboard, storyboardError: null });
      }
      showToast(render ? "Render revision created." : "Draft revision saved.");
      startPolling(0);
    } catch (error) {
      if (error?.status === 409) state.remoteChangedWhileDirty = true;
      showToast(error.message || "Could not create the revision.", true);
    } finally {
      state.actionBusy = false;
      setBusy(button, false);
      renderInspector();
    }
  }

  async function runQualityReview() {
    const record = selectedRecord();
    if (!record || !jobId(record.job)) return;
    const button = byId("reviewButton");
    state.actionBusy = true;
    setBusy(button, true, "Reviewing frames…");
    renderInspector();
    try {
      const sources = renderedSources(record);
      const info = sequenceInfo();
      const response = await api("/api/quality/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: jobId(record.job),
          sequenceId: state.selectedSequenceId,
          segmentId: segmentIdentifier(record.segment) || undefined,
          duration: segmentDuration(record.segment),
          fps: info.fps || undefined,
          width: info.width || undefined,
          height: info.height || undefined,
          prompt: segmentPrompt(record.segment),
          themeId: firstValue(state.theme?.id, policyValue("themeId")),
          generator: policyValue("generator", "provider"),
          qualityChecklist: qualityItems(record.segment).map(item => item.label),
          playerUrl: sources.player || undefined,
          frameUrl: sources.frame || undefined,
          persist: true,
          mode: "strict",
          origin: "website-control-center"
        })
      });
      const review = response?.review || response?.qualityReview || response?.result || response;
      state.reviewByKey.set(recordKey(record), review);
      showToast(reviewPassed(review) === true ? "Quality review passed." : "Quality review is ready.");
    } catch (error) {
      showToast(error.message || "Quality review failed.", true);
    } finally {
      state.actionBusy = false;
      setBusy(button, false);
      renderInspector();
    }
  }

  async function repairRevision() {
    const record = selectedRecord();
    if (!record || !state.selectedSequenceId || !state.draftStoryboard) return;
    const button = byId("repairButton");
    state.actionBusy = true;
    setBusy(button, true, "Creating repair…");
    renderInspector();
    try {
      const payload = revisionPayload({ render: true, repair: true });
      payload.repairSegmentId = segmentIdentifier(record.segment) || undefined;
      payload.repairFromJobId = jobId(record.job) || undefined;
      payload.qualityReviewResult = clone(existingReview(record));
      const response = await api(`/api/v1/sequences/${encodeURIComponent(state.selectedSequenceId)}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const id = responseSequenceId(response);
      showToast(id ? `Repair revision ${id.slice(0, 10)} created; original preserved.` : "Repair revision created; original preserved.");
      startPolling(0);
    } catch (error) {
      showToast(error.message || "Could not create the repair revision.", true);
    } finally {
      state.actionBusy = false;
      setBusy(button, false);
      renderInspector();
    }
  }

  function currentPlacement(record) {
    const mode = byId("placementMode").value;
    const absoluteTime = Math.max(0, number(byId("absoluteTime").value, segmentStart(record.segment)));
    const expectedSequenceId = text(firstValue(state.presence?.activeSequenceId, state.presence?.expectedSequenceId, state.sequence?.expectedSequenceId));
    return {
      mode,
      placementMode: mode,
      currentPlayhead: mode === "currentPlayhead",
      absoluteTime: mode === "absoluteTime" ? absoluteTime : undefined,
      expectedSequenceId: expectedSequenceId || undefined
    };
  }

  async function sendToCep() {
    const record = selectedRecord();
    if (!record || !jobId(record.job)) return;
    const button = byId("sendCepButton");
    const placement = currentPlacement(record);
    state.actionBusy = true;
    setBusy(button, true, "Sending…");
    renderInspector();
    try {
      const payload = {
        jobId: jobId(record.job),
        title: segmentCopy(record.segment, record.index),
        placementMode: placement.placementMode,
        currentPlayhead: placement.currentPlayhead,
        absoluteTime: placement.absoluteTime,
        expectedSequenceId: placement.expectedSequenceId
      };
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
      const response = await api("/api/v1/premiere-inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const item = response?.inbox || response?.item || response?.entry || response;
      if (item && typeof item === "object") state.inbox.push(item);
      showToast(presenceActive(state.presence) ? "Sent to the Premiere panel." : "Queued for CEP; the panel is not currently present.");
      startPolling(500);
    } catch (error) {
      showToast(error.message || "Could not send this render to CEP.", true);
    } finally {
      state.actionBusy = false;
      setBusy(button, false);
      renderInspector();
    }
  }

  function operationId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `control-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async function premiereAction(action) {
    const record = selectedRecord();
    if (!record?.inbox || !inboxId(record.inbox)) return;
    const button = ({ save: byId("saveBinButton"), insert: byId("insertButton"), rollback: byId("rollbackButton") })[action];
    const placement = currentPlacement(record);
    state.actionBusy = true;
    setBusy(button, true, action === "save" ? "Saving…" : action === "insert" ? "Inserting…" : "Rolling back…");
    renderInspector();
    try {
      const payload = { operationId: operationId(), action };
      if (action === "insert") payload.placement = placement;
      const response = await api(`/api/v1/premiere-inbox/${encodeURIComponent(inboxId(record.inbox))}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = response?.action || response?.item || response?.result || response;
      if (result && typeof result === "object") state.actions.push(Object.assign({ inboxId: inboxId(record.inbox), action }, result));
      showToast(action === "save" ? "Save-to-bin action queued." : action === "insert" ? "Insert action queued." : "Rollback action queued.");
      startPolling(500);
    } catch (error) {
      showToast(error.message || `Premiere ${action} failed.`, true);
    } finally {
      state.actionBusy = false;
      setBusy(button, false);
      renderInspector();
    }
  }

  function controlAuthored(action) {
    const frame = byId("authoredFrame");
    const source = frame.dataset.source;
    if (!source) return;
    try {
      const timelines = Object.values(frame.contentWindow.__timelines || {});
      if (timelines.length) {
        timelines.forEach(timeline => {
          if (action === "play") timeline.play?.();
          if (action === "pause") timeline.pause?.();
          if (action === "restart") timeline.restart?.();
        });
        return;
      }
    } catch (_) {}
    if (action === "pause") frame.src = source;
    else if (action === "play") frame.src = `${source}#play`;
    else {
      frame.src = "about:blank";
      setTimeout(() => { frame.src = `${source}#play`; }, 0);
    }
  }

  function confirmSequenceChange() {
    return !state.dirty || window.confirm("Discard the unsaved edits for this sequence and open another one?");
  }

  function bindEvents() {
    byId("refreshButton").addEventListener("click", () => startPolling(0));
    byId("sequencePicker").addEventListener("change", event => {
      const next = event.target.value;
      if (!next || next === state.selectedSequenceId) return;
      if (!confirmSequenceChange()) { event.target.value = state.selectedSequenceId; return; }
      state.selectedSequenceId = next;
      state.sequence = null;
      state.storyboard = null;
      state.draftStoryboard = null;
      state.originalStoryboard = null;
      state.selectedIndex = -1;
      state.dirty = false;
      state.proposal = null;
      state.initializedSelection = true;
      persistSelection(next);
      renderAll();
      startPolling(0);
    });

    function activateListItem(event, selector) {
      const button = event.target.closest(selector);
      if (!button) return;
      selectRecord(Number(button.dataset.index), selector === ".timeline-beat");
    }
    byId("storyboardList").addEventListener("click", event => activateListItem(event, ".storyboard-card"));
    byId("timelineTrack").addEventListener("click", event => activateListItem(event, ".timeline-beat"));

    function listKeyboard(event, selector, horizontal) {
      const button = event.target.closest(selector);
      if (!button) return;
      const previousKey = horizontal ? "ArrowLeft" : "ArrowUp";
      const nextKey = horizontal ? "ArrowRight" : "ArrowDown";
      if (![previousKey, nextKey, "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const buttons = Array.from(event.currentTarget.querySelectorAll(selector));
      const current = buttons.indexOf(button);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, current + (event.key === previousKey ? -1 : 1)));
      buttons[next]?.focus();
      if (buttons[next]) selectRecord(Number(buttons[next].dataset.index));
    }
    byId("storyboardList").addEventListener("keydown", event => listKeyboard(event, ".storyboard-card", false));
    byId("timelineTrack").addEventListener("keydown", event => listKeyboard(event, ".timeline-beat", true));

    byId("segmentEnabled").addEventListener("change", event => {
      const record = selectedRecord();
      if (!record) return;
      record.segment.shouldRenderGraphic = event.target.checked;
      markDirty();
      renderStoryboard();
      renderTimeline();
    });
    byId("promptEditor").addEventListener("input", event => updateSegmentPrompt(event.target.value));
    byId("startTimeInput").addEventListener("change", updateTiming);
    byId("durationInput").addEventListener("change", updateTiming);
    byId("templateSelect").addEventListener("change", event => {
      const record = selectedRecord();
      if (!record) return;
      record.segment.templateId = event.target.value || null;
      markDirty();
      renderStoryboard();
      renderTimeline();
      renderCustomizer(record);
      renderAuthoredPreview(record);
    });
    byId("customizerControls").addEventListener("input", event => {
      const input = event.target.closest("[data-control-id]");
      const record = selectedRecord();
      if (!input || !record) return;
      const holder = customizerValueObject(record.segment, true);
      let value = input.type === "checkbox" ? input.checked : input.value;
      if (["number", "range"].includes(input.dataset.controlType)) value = number(value);
      holder.values[input.dataset.controlId] = value;
      markDirty();
    });
    byId("qualityChecklist").addEventListener("change", event => {
      const input = event.target.closest("[data-check-index]");
      const record = selectedRecord();
      if (!input || !record) return;
      record.segment.qualityChecklistState = object(record.segment.qualityChecklistState);
      record.segment.qualityChecklistState[input.dataset.checkIndex] = input.checked;
      markDirty();
      renderChecklist(record);
    });

    byId("repromptButton").addEventListener("click", reprompt);
    byId("reanalyzeButton").addEventListener("click", reanalyze);
    byId("discardProposal").addEventListener("click", () => { state.proposal = null; renderProposal(); });
    byId("applyProposal").addEventListener("click", applyProposal);
    byId("saveDraftButton").addEventListener("click", () => createRevision(false));
    byId("renderRevisionButton").addEventListener("click", () => createRevision(true));
    byId("reviewButton").addEventListener("click", runQualityReview);
    byId("repairButton").addEventListener("click", repairRevision);

    byId("placementMode").addEventListener("change", event => { byId("absoluteTimeField").hidden = event.target.value === "currentPlayhead"; });
    byId("sendCepButton").addEventListener("click", sendToCep);
    byId("saveBinButton").addEventListener("click", () => premiereAction("save"));
    byId("insertButton").addEventListener("click", () => premiereAction("insert"));
    byId("rollbackButton").addEventListener("click", () => premiereAction("rollback"));

    byId("playPreview").addEventListener("click", () => controlAuthored("play"));
    byId("pausePreview").addEventListener("click", () => controlAuthored("pause"));
    byId("restartPreview").addEventListener("click", () => controlAuthored("restart"));

    document.addEventListener("visibilitychange", () => { if (!document.hidden) startPolling(0); });
    window.addEventListener("beforeunload", event => {
      clearTimeout(pollTimer);
      pollController?.abort();
      if (!state.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  function initialize() {
    bridgeToken();
    bindEvents();
    renderAll();
    startPolling(0);
  }

  initialize();
})();
