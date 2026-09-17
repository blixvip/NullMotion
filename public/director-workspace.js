(() => {
  "use strict";

  const API = window.location.origin;
  const TOKEN_KEY = "null-motion-bridge-token";
  const LEGACY_TOKEN_KEYS = ["null-motion-browser-token", "nullMotionBridgeToken", "nullBridgeToken"];
  const PIPELINE_KEY = "null-director-pipeline-v1";
  const SCRIPT_DRAFT_KEY = "null-script-workspace-draft";
  const PROMPT_HANDOFF_KEY = "null-motion-prompt-handoff";
  const PIPELINE_VERSION = 1;
  const defaultStages = [
    {
      code: "01", icon: "GO", title: "Trigger", short: "Choose the source and define the request.",
      heading: "Start from an explicit editorial intention",
      body: "The editor chooses a complete Premiere sequence, a marked range, a timestamped script, or a single motion brief. Null records the active sequence, dimensions, frame rate, source range, provider, asset policy, render quality, and review mode before analysis begins.",
      contracts: [["Input", "Transcript, caption track, timed script, or prompt"], ["Context", "Sequence size, FPS, range, origin, and editor guidance"], ["Guard", "Never infer a different sequence, range, provider, or asset policy"]],
      status: "ready", notes: ""
    },
    {
      code: "02", icon: "TC", title: "Read timing", short: "Extract words and preserve where they live.",
      heading: "Build one trustworthy timeline map",
      body: "Null reads corrected Premiere captions first, then a corrected source transcript or pasted timed text. Every cue is normalized into both sequence time and overlay-local time so graphics land on the intended words without passing absolute Premiere offsets into animation code.",
      contracts: [["Source", "Prefer corrected caption timing; preserve the declared timestamp origin"], ["Mapping", "Keep sequence time and composition-local time as separate fields"], ["Guard", "Do not invent, double-apply, or silently shift timestamps"]],
      status: "ready", notes: ""
    },
    {
      code: "03", icon: "WHY", title: "Understand", short: "Read the whole video before choosing graphics.",
      heading: "Understand meaning before decorating moments",
      body: "The director examines the complete source for audience, argument, subtext, emotional arc, pacing, named entities, quantitative claims, footage competition, and moments where a graphic materially improves comprehension or impact. Leaving footage clean is a valid decision.",
      contracts: [["Analyze", "Narrative, audience, emotion, entities, data, pacing, and footage pressure"], ["Select", "Prefer sparse high-value moments over wall-to-wall motion"], ["Guard", "Expose concise evidence and decisions without hidden chain-of-thought"]],
      status: "ready", notes: ""
    },
    {
      code: "04", icon: "IMG", title: "Plan assets", short: "Resolve authentic logos, products, and photos.",
      heading: "Treat authenticity as a production input",
      body: "Every named brand, app, person, place, interface, or product creates an explicit asset-needs decision. Required assets are researched, validated, approved, downloaded, and frozen locally before composition. Null never redraws a recognizable entity from memory.",
      contracts: [["Classify", "Required, helpful, or not-needed for every planned graphic"], ["Research", "Prefer supplied files and official sources; preserve provenance"], ["Guard", "Strict mode stops before rendering when a required asset is unresolved"]],
      status: "ready", notes: ""
    },
    {
      code: "05", icon: "THM", title: "Set theme", short: "Create one campaign system for the video.",
      heading: "Create continuity without making every shot identical",
      body: "A theme is generated from brand evidence, subject, footage, audience, and emotional tone when the editor has not supplied one. It defines semantic color roles, typography, material, spacing, asset treatment, transition family, and motion character.",
      contracts: [["Stable", "Palette roles, typography, material, spacing, and transition family"], ["Variable", "Template, crop, density, scale, emphasis, and asset arrangement"], ["Guard", "Never introduce a competing dominant palette inside one campaign"]],
      status: "ready", notes: ""
    },
    {
      code: "06", icon: "TPL", title: "Plan shots", short: "Choose useful 5–10 second motion windows.",
      heading: "Turn the storyboard into independent authored shots",
      body: "The director proposes a start time, duration, on-screen copy, authentic asset assignments, compatible template ID, slot values, transition notes, and a quality checklist. Most overlays live between five and ten seconds, while meaning and readability determine the final duration.",
      contracts: [["Timing", "Prefer independent 5–10 second overlays with exact cue anchors"], ["Selection", "Rank only compatible templates from the live website catalog"], ["Guard", "Do not use a data graphic when the narration contains no real data"]],
      status: "ready", notes: ""
    },
    {
      code: "07", icon: "MOV", title: "Adapt & return", short: "Render, review, and place the finished overlays.",
      heading: "Apply identity without replacing authored motion craft",
      body: "Null fills approved copy and asset slots, applies campaign tokens and bounded controls, renders transparent media, and reviews sampled frames. Only accepted results return to Null Motion and insert above the footage at their verified sequence times.",
      contracts: [["Allowed", "Copy, authentic assets, campaign tokens, duration, and authored controls"], ["Locked", "Structure, hierarchy, geometry, masks, and recognizable choreography"], ["Output", "Reviewed transparent MOV, sidecar metadata, provenance, and safe placement"]],
      status: "ready", notes: ""
    }
  ];

  const flowIcons = {
    workspace: '<rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 9h18M9 9v11"></path>',
    link: '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"></path>',
    plan: '<path d="M9.5 4.5A3.5 3.5 0 0 0 6 8v1a3 3 0 0 0-2 2.8A3.2 3.2 0 0 0 7.2 15H9v4M14.5 4.5A3.5 3.5 0 0 1 18 8v1a3 3 0 0 1 2 2.8 3.2 3.2 0 0 1-3.2 3.2H15v4M9 8h6M9 12h6M9 16h6"></path>',
    render: '<path d="M5 3h14v18H5zM9 3v4M15 3v4M9 17v4M15 17v4M5 9h14M5 15h14"></path>',
    review: '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"></path><circle cx="12" cy="12" r="2.5"></circle>',
    deliver: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"></path>',
    sequence: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M7 9h10M7 13h6M7 17h3"></path>',
    transcript: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h6M9 16h4"></path>',
    storyboard: '<rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M8 4v16M16 4v16M3 10h18M3 15h18"></path>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5"></path>',
    timeline: '<path d="M4 5v14M20 5v14M4 12h16M8 9v6M13 8v8M17 10v4"></path>',
    history: '<path d="M4 4v5h5M4.7 9A8 8 0 1 1 5 16M12 8v5l3 2"></path>'
  };

  const flowDefinitions = {
    website: [
      {
        icon: "workspace", title: "Choose a workspace", short: "Start with a prompt, reference, or complete script.",
        detail: "Templates and Manual handle one graphic. Reference Studio starts from captured visual evidence. Script to Motion plans a complete edit before it renders anything.",
        where: "Browser page under templates/", output: "A prompt, reference package, or timestamped script", boundary: "The website cannot read or change a Premiere timeline.",
        evidence: "templates/index.html · create.html · script.html", link: "./", linkLabel: "Open website workspaces"
      },
      {
        icon: "link", title: "Connect locally", short: "The browser talks to the loopback companion.",
        detail: "This public starter serves UI data from its own origin. Generation and provider access require a new backend integration.",
        where: "Browser to local HTTP API", output: "An authenticated, versioned request", boundary: "The per-install secret is never returned to the browser.",
        evidence: "POST /api/v1/pair · GET /api/v1/client-contract", link: "control-center.html", linkLabel: "Open connection diagnostics"
      },
      {
        icon: "plan", title: "Build the plan", short: "Meaning, timing, theme, and useful graphic moments come first.",
        detail: "Scripts use the psychology/storyboard route. Single prompts use the optimization route. The result is reviewable planning data, not hidden reasoning and not a render.",
        where: "Local companion planning modules", output: "Storyboard segments or an optimized production brief", boundary: "Sparse planning may leave weak moments as footage-only.",
        evidence: "POST /api/v1/psychology-analyze · POST /api/prompts/optimize"
      },
      {
        icon: "render", title: "Resolve and render", short: "Authentic assets are frozen before the composition is built.",
        detail: "The companion validates required assets, builds authored-template or provider HTML, renders it through HyperFrames and Chrome, then produces transparent media with FFmpeg.",
        where: "server/runPipeline() and focused companion modules", output: "Transparent MOV, preview frames, provenance, and sidecar metadata", boundary: "Strict asset mode stops before composition when a required real asset is unresolved.",
        evidence: "POST /generate · asset-resolver.js · builder.js"
      },
      {
        icon: "review", title: "Review the job", short: "Progress and accepted outputs survive a page reload.",
        detail: "Jobs are durable in SQLite. The website follows progress, displays review results and warnings, and can reopen completed or failed work from Renders.",
        where: "Companion job store plus website status UI", output: "Accepted result, retryable failure, or explicit warning", boundary: "A skipped vision review is labeled unreviewed; it is not presented as reviewed.",
        evidence: "GET /api/v1/jobs · SSE progress · server/db.js", link: "renders.html", linkLabel: "Open render history"
      },
      {
        icon: "deliver", title: "Download or hand off", short: "Use the MOV directly or send a deliberate request to Premiere.",
        detail: "The browser can download the transparent MOV. A paired website can also create a durable Premiere inbox or native action request, which the CEP panel must claim before anything happens in Premiere.",
        where: "Download service or durable Premiere inbox", output: "Downloaded MOV or pending CEP action", boundary: "The browser never receives a general-purpose Premiere or filesystem bridge.",
        evidence: "Premiere integration is not connected in this project."
      }
    ],
    cep: [
      {
        icon: "sequence", title: "Read the sequence", short: "Auto starts from the active Premiere edit.",
        detail: "The CEP panel asks host.jsx for sequence size, frame rate, playhead, In/Out range, and safe project context. It saves the project before caption extraction when required.",
        where: "CEP panel to ExtendScript through evalScript", output: "Bounded sequence context with an explicit timestamp origin", boundary: "Premiere reads and writes stay in jsx/host.jsx.",
        evidence: "HF_getSequenceInfo() · HF_getCaptionProjectContext()"
      },
      {
        icon: "transcript", title: "Get corrected words", short: "Captions come first; corrected source transcripts are fallback.",
        detail: "Null reads bounded caption records from the saved Premiere project. If captions are absent, the invisible read-only helper can return corrected source transcript data. SRT, CSV, and markers remain recovery inputs.",
        where: "Companion caption reader or read-only transcript helper", output: "Timestamped cues tied to the selected sequence range", boundary: "The helper has no visible panel, generation logic, or timeline-write capability.",
        evidence: "/api/v1/premiere-captions/extract · uxp-transcript-helper/"
      },
      {
        icon: "storyboard", title: "Plan and review", short: "The complete edit becomes a sparse storyboard.",
        detail: "Auto posts the transcript and sequence context for psychology analysis. Automatic mode continues after planning; Review first pauses so the editor can adjust segments, templates, assets, and timing.",
        where: "CEP Auto UI plus companion storyboard module", output: "Selected 4–12 second overlay windows with relative and absolute timing", boundary: "Source-video duration never becomes one monolithic composition.",
        evidence: "POST /api/v1/psychology-analyze"
      },
      {
        icon: "layers", title: "Render overlays", short: "Each selected moment becomes an independent job.",
        detail: "The panel submits a durable sequence batch. The companion runs bounded parallel jobs, emits incremental results, and keeps successful siblings when one segment fails.",
        where: "Companion sequence scheduler and render pipeline", output: "Independent transparent MOVs plus absolute insertion times", boundary: "Provider identity, asset mode, render mode, and review policy remain explicit.",
        evidence: "POST /api/v1/generate-sequence · script_batches · batch_items"
      },
      {
        icon: "timeline", title: "Place at exact times", short: "Accepted overlays go above the footage, not under it.",
        detail: "host.jsx validates the target sequence and chooses a dedicated or first safe track above every overlapping footage track. It places clips with Premiere time objects at returned absolute sequence times.",
        where: "Premiere host transaction in jsx/host.jsx", output: "Placed timeline clips and a durable insertion receipt", boundary: "Overlay-local cues stay relative; absolute sequence offsets are applied only at placement.",
        evidence: "HF_importAutoSequence() · TickTime/host time objects"
      },
      {
        icon: "history", title: "Recover safely", short: "History survives panel and companion restarts.",
        detail: "History reopens Auto batches and manual renders, shows partial success, retries failed items, and processes durable website inbox actions. Claimed actions use stored receipts so an acknowledgment retry cannot repeat a timeline mutation.",
        where: "CEP History plus durable companion records", output: "Retry, insert, save, dismiss, or receipt-guarded rollback", boundary: "Uncertain claimed actions are not replayed automatically.",
        evidence: "/api/v1/premiere-actions · premiere_inbox · premiere_actions"
      }
    ]
  };

  let stages = loadStages();
  let selectedStage = 0;
  let mode = "script";
  let templates = [];
  let activeTheme = null;
  let clientContract = null;
  let latestPlan = null;
  const activeFlowSteps = { website: 0, cep: 0 };
  let saveTimer = null;
  let toastTimer = null;
  let resetTimer = null;

  function byId(id) { return document.getElementById(id); }
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
  function escapeHtml(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
  function unique(values) { return Array.from(new Set(values.filter(Boolean))); }
  function cleanText(value, fallback, max = 5000) { const text = String(value == null ? "" : value).trim(); return (text || fallback || "").slice(0, max); }

  function flowIcon(name) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${flowIcons[name] || flowIcons.workspace}</svg>`;
  }

  function renderFlowDetail(name) {
    const detail = byId(`${name}FlowDetail`);
    const step = flowDefinitions[name]?.[activeFlowSteps[name]];
    if (!detail || !step) return;
    detail.innerHTML = `
      <div class="flow-detail-copy">
        <span class="flow-detail-icon">${flowIcon(step.icon)}</span>
        <div><small>Step ${String(activeFlowSteps[name] + 1).padStart(2, "0")}</small><h4>${escapeHtml(step.title)}</h4><p>${escapeHtml(step.detail)}</p></div>
      </div>
      <dl class="flow-facts">
        <div><dt>Runs in</dt><dd>${escapeHtml(step.where)}</dd></div>
        <div><dt>Produces</dt><dd>${escapeHtml(step.output)}</dd></div>
        <div><dt>Safety boundary</dt><dd>${escapeHtml(step.boundary)}</dd></div>
      </dl>
      <div class="flow-evidence"><span>Code path</span><code>${escapeHtml(step.evidence)}</code>${step.link ? `<a href="${escapeHtml(step.link)}">${escapeHtml(step.linkLabel)}</a>` : ""}</div>`;
  }

  function selectFlowStep(name, index, focus = false) {
    const steps = flowDefinitions[name] || [];
    activeFlowSteps[name] = clamp(index, 0, steps.length - 1);
    const track = byId(`${name}Flow`);
    track?.querySelectorAll("[data-flow-step]").forEach((button, buttonIndex) => {
      const selected = buttonIndex === activeFlowSteps[name];
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      button.tabIndex = selected ? 0 : -1;
    });
    renderFlowDetail(name);
    if (focus) track?.querySelector(`[data-flow-step="${activeFlowSteps[name]}"]`)?.focus({ preventScroll: true });
  }

  function renderFlow(name) {
    const track = byId(`${name}Flow`);
    const steps = flowDefinitions[name] || [];
    if (!track) return;
    track.innerHTML = steps.map((step, index) => `
      <button class="flow-node${index === activeFlowSteps[name] ? " active" : ""}" type="button" data-flow-step="${index}" aria-pressed="${index === activeFlowSteps[name] ? "true" : "false"}" aria-controls="${name}FlowDetail" tabindex="${index === activeFlowSteps[name] ? "0" : "-1"}">
        <span class="flow-node-count">${String(index + 1).padStart(2, "0")}</span>
        <span class="flow-node-icon">${flowIcon(step.icon)}</span>
        <span class="flow-node-copy"><b>${escapeHtml(step.title)}</b><span>${escapeHtml(step.short)}</span></span>
      </button>`).join("");
    track.addEventListener("click", event => {
      const button = event.target.closest("[data-flow-step]");
      if (button) selectFlowStep(name, Number(button.dataset.flowStep), true);
    });
    track.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const last = steps.length - 1;
      let next = activeFlowSteps[name];
      if (["ArrowRight", "ArrowDown"].includes(event.key)) next = next === last ? 0 : next + 1;
      if (["ArrowLeft", "ArrowUp"].includes(event.key)) next = next === 0 ? last : next - 1;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = last;
      selectFlowStep(name, next, true);
    });
    renderFlowDetail(name);
  }

  function initializeFlowExplainers() {
    renderFlow("website");
    renderFlow("cep");
  }

  function normalizeStages(input) {
    const source = Array.isArray(input) ? input : [];
    return defaultStages.map((fallback, index) => {
      const value = source[index] && typeof source[index] === "object" ? source[index] : {};
      const contracts = Array.isArray(value.contracts) ? value.contracts : fallback.contracts;
      return {
        code: fallback.code,
        icon: cleanText(value.icon, fallback.icon, 4).toUpperCase(),
        title: cleanText(value.title, fallback.title, 80),
        short: cleanText(value.short, fallback.short, 180),
        heading: cleanText(value.heading, fallback.heading, 180),
        body: cleanText(value.body, fallback.body, 2500),
        contracts: fallback.contracts.map((contract, contractIndex) => {
          const incoming = Array.isArray(contracts[contractIndex]) ? contracts[contractIndex] : contract;
          return [cleanText(incoming[0], contract[0], 48), cleanText(incoming[1], contract[1], 320)];
        }),
        status: ["ready", "review", "optional"].includes(value.status) ? value.status : "ready",
        notes: cleanText(value.notes, "", 1800)
      };
    });
  }

  function loadStages() {
    try { return normalizeStages(JSON.parse(localStorage.getItem(PIPELINE_KEY) || "null")?.stages); }
    catch (_) { return clone(defaultStages); }
  }

  function saveStages() {
    clearTimeout(saveTimer);
    byId("saveState")?.classList.add("saving");
    if (byId("saveState")) byId("saveState").textContent = "Saving…";
    saveTimer = setTimeout(() => {
      localStorage.setItem(PIPELINE_KEY, JSON.stringify({ version: PIPELINE_VERSION, updatedAt: new Date().toISOString(), stages }));
      byId("saveState")?.classList.remove("saving");
      if (byId("saveState")) byId("saveState").textContent = "Saved locally";
    }, 220);
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    byId("toast").textContent = message;
    byId("toast").classList.add("show");
    toastTimer = setTimeout(() => byId("toast").classList.remove("show"), 2400);
  }

  function renderPipeline() {
    byId("pipeline").innerHTML = stages.map((stage, index) => `
      <button class="stage${index === selectedStage ? " active" : ""}" type="button" data-stage="${index}">
        <span class="stage-icon">${escapeHtml(stage.icon)}</span>
        <span class="stage-copy"><b>${escapeHtml(stage.title)}</b><span>${escapeHtml(stage.short)}</span></span>
        <span class="stage-num">${stage.code}</span><i class="stage-status ${stage.status}" aria-label="${escapeHtml(stage.status)}"></i>
      </button>`).join("");
  }

  function renderEditor() {
    const stage = stages[selectedStage];
    byId("stageEditor").innerHTML = `
      <div class="editor-head">
        <div class="editor-identity"><span class="editor-badge">${escapeHtml(stage.icon)}</span><div><small>Stage ${stage.code} · editable</small><h3>${escapeHtml(stage.title)}</h3></div></div>
        <div class="editor-nav"><button id="previousStage" type="button" aria-label="Previous stage"${selectedStage === 0 ? " disabled" : ""}>←</button><button id="nextStage" type="button" aria-label="Next stage"${selectedStage === stages.length - 1 ? " disabled" : ""}>→</button></div>
      </div>
      <div class="editor-form">
        <div class="form-row">
          <label class="field"><span>Stage name</span><input data-field="title" value="${escapeHtml(stage.title)}" /></label>
          <label class="field"><span>Status</span><select data-field="status"><option value="ready"${stage.status === "ready" ? " selected" : ""}>Ready · required</option><option value="review"${stage.status === "review" ? " selected" : ""}>Needs review</option><option value="optional"${stage.status === "optional" ? " selected" : ""}>Optional</option></select></label>
        </div>
        <label class="field"><span>One-line purpose</span><input data-field="short" value="${escapeHtml(stage.short)}" /></label>
        <label class="field"><span>Editorial objective</span><input data-field="heading" value="${escapeHtml(stage.heading)}" /></label>
        <label class="field"><span>Operating instruction</span><textarea data-field="body">${escapeHtml(stage.body)}</textarea></label>
        <div class="contract-editor"><div class="contract-editor-head"><span>Production contract</span><small>Label + enforceable rule</small></div>${stage.contracts.map((contract, index) => `<div class="contract-edit-row"><input data-contract="${index}" data-part="0" value="${escapeHtml(contract[0])}" aria-label="Contract ${index + 1} label" /><input data-contract="${index}" data-part="1" value="${escapeHtml(contract[1])}" aria-label="Contract ${index + 1} rule" /></div>`).join("")}</div>
        <label class="field notes"><span>Your notes</span><textarea data-field="notes" placeholder="Add references, exceptions, acceptance criteria, or reminders for this stage…">${escapeHtml(stage.notes)}</textarea></label>
      </div>`;
    byId("previousStage").onclick = () => selectStage(selectedStage - 1);
    byId("nextStage").onclick = () => selectStage(selectedStage + 1);
    byId("stageEditor").querySelectorAll("[data-field]").forEach(input => {
      const eventName = input.tagName === "SELECT" ? "change" : "input";
      input.addEventListener(eventName, () => {
        stage[input.dataset.field] = input.value;
        saveStages(); renderPreview(); renderPipeline();
        if (["title", "icon"].includes(input.dataset.field)) renderEditorHeading();
      });
    });
    byId("stageEditor").querySelectorAll("[data-contract]").forEach(input => input.addEventListener("input", () => {
      stage.contracts[Number(input.dataset.contract)][Number(input.dataset.part)] = input.value;
      saveStages(); renderPreview();
    }));
  }

  function renderEditorHeading() {
    const stage = stages[selectedStage];
    const heading = byId("stageEditor").querySelector(".editor-identity h3");
    if (heading) heading.textContent = stage.title;
  }

  function renderPreview() {
    const stage = stages[selectedStage];
    byId("stagePreview").innerHTML = `<div class="readable-stage"><span class="stage-kicker">${stage.code} · ${escapeHtml(stage.icon)} · ${escapeHtml(stage.status)}</span><h3>${escapeHtml(stage.heading)}</h3><p>${escapeHtml(stage.body)}</p><div class="readable-contracts">${stage.contracts.map(contract => `<div class="readable-contract"><b>${escapeHtml(contract[0])}</b><span>${escapeHtml(contract[1])}</span></div>`).join("")}</div>${stage.notes ? `<div class="readable-notes"><small>Your notes</small><p>${escapeHtml(stage.notes)}</p></div>` : ""}</div>`;
  }

  function selectStage(index) {
    selectedStage = clamp(index, 0, stages.length - 1);
    renderPipeline(); renderEditor(); renderPreview();
  }

  function stageMarkdown(stage) {
    return `## ${stage.code}. ${stage.title}\n\n**Purpose:** ${stage.short}\n\n### ${stage.heading}\n\n${stage.body}\n\n${stage.contracts.map(contract => `- **${contract[0]}:** ${contract[1]}`).join("\n")}${stage.notes ? `\n\n**Notes:** ${stage.notes}` : ""}`;
  }
  function pipelineMarkdown() { return `# Null Motion Director Pipeline\n\n${stages.map(stageMarkdown).join("\n\n---\n\n")}`; }
  function pipelineJson() { return JSON.stringify({ version: PIPELINE_VERSION, exportedAt: new Date().toISOString(), stages }, null, 2); }
  function planningGuidance() {
    return stages.map(stage => `${stage.code} ${stage.title}: ${stage.short}\n${stage.body}\n${stage.contracts.map(contract => `${contract[0]}=${contract[1]}`).join("; ")}${stage.notes ? `\nEditor notes: ${stage.notes}` : ""}`).join("\n\n").slice(0, 7000);
  }

  async function copyText(text, success) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const textarea = document.createElement("textarea"); textarea.value = text; textarea.style.position = "fixed"; textarea.style.opacity = "0";
        document.body.appendChild(textarea); textarea.select(); document.execCommand("copy"); textarea.remove();
      }
      showToast(success);
    } catch (_) { showToast("Clipboard access was unavailable"); }
  }

  function exportPipeline() {
    const blob = new Blob([pipelineJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "null-motion-director-pipeline.json"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); showToast("Pipeline exported");
  }

  function importPipeline() {
    try {
      const parsed = JSON.parse(byId("importInput").value);
      stages = normalizeStages(Array.isArray(parsed) ? parsed : parsed.stages);
      selectedStage = 0; saveStages(); selectStage(0); byId("importDialog").close(); byId("importInput").value = ""; showToast("Pipeline imported");
    } catch (_) { showToast("Paste valid pipeline JSON"); }
  }

  async function api(path, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    const token = bridgeToken();
    if (token) headers["X-Null-Bridge-Token"] = token;
    const response = await fetch(API + path, Object.assign({}, options, { headers }));
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Null bridge failed (${response.status})`);
    return data;
  }

  function emptyOutput(title, copy) {
    byId("labOutput").innerHTML = `<div class="output-empty"><div class="output-orbit">7</div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(copy)}</span></div>`;
  }

  function setMode(nextMode) {
    mode = nextMode;
    byId("scriptMode").classList.toggle("active", mode === "script"); byId("promptMode").classList.toggle("active", mode === "prompt");
    byId("scriptMode").setAttribute("aria-selected", mode === "script" ? "true" : "false"); byId("promptMode").setAttribute("aria-selected", mode === "prompt" ? "true" : "false");
    byId("sourceLabel").textContent = mode === "script" ? "Timestamped transcript" : "Motion brief";
    byId("sourceInput").placeholder = mode === "script" ? "Paste a transcript, SRT, VTT, or finished script…" : "Describe one graphic, its meaning, assets, timing, and desired tone…";
    byId("duration").placeholder = mode === "script" ? "Auto, 01:30, or 90" : "5–10 seconds";
    latestPlan = null;
    emptyOutput(mode === "script" ? "Build a complete edit plan" : "Build a single-graphic plan", mode === "script" ? "The director will examine the complete transcript and propose only useful motion windows." : "The director will strengthen the brief, identify authentic assets, establish a theme, and prepare a template-ready handoff.");
  }

  function updateSourceCount() {
    const text = byId("sourceInput").value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    byId("sourceCount").textContent = `${words} word${words === 1 ? "" : "s"} · ${text.length} characters`;
  }
  function parseDuration(value) {
    const clean = String(value || "").trim().toLowerCase().replace(/seconds?|secs?/g, "").trim();
    if (!clean) return null;
    if (/^\d+(?:\.\d+)?$/.test(clean)) return Number(clean);
    const parts = clean.split(":").map(Number); if (parts.some(part => !Number.isFinite(part))) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return null;
  }
  function detectedTimelineEnd(text) {
    let end = 0, match;
    const pattern = /(?:^|\n)\s*(?:\d+\s*\n\s*)?\[?(\d{1,2}:\d{2}(?::\d{2})?(?:[,.]\d{1,3})?)\]?/g;
    while ((match = pattern.exec(String(text || "")))) end = Math.max(end, parseDuration(match[1].replace(",", ".")) || 0);
    const srt = /-->\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[,.]\d{1,3})?)/g;
    while ((match = srt.exec(String(text || "")))) end = Math.max(end, parseDuration(match[1].replace(",", ".")) || 0);
    return end;
  }
  function sourceDuration(text) {
    const explicit = parseDuration(byId("duration").value); if (explicit) return explicit;
    if (mode === "prompt") return 7;
    const timed = detectedTimelineEnd(text); if (timed) return timed + 3;
    return Math.max(8, Math.ceil(text.split(/\s+/).filter(Boolean).length / 2.55));
  }

  function inferTheme(source) {
    const text = String(source || "").toLowerCase();
    if (/\b(ai|software|app|code|robot|grok|claude|notion|twitter|technology)\b/.test(text)) return { name:"Signal Graphite", style:"Precise technological editorial", colors:["#0A0D12","#EAF7FA","#63D9EB","#6D7BFF"], type:"Inter / compact mono labels", motion:"Productive with one expressive reveal" };
    if (/\b(finance|money|market|stock|revenue|growth|business)\b/.test(text)) return { name:"Ledger", style:"Confident analytical editorial", colors:["#0D120F","#F1F7F3","#60D394","#F4C95D"], type:"Inter / tabular numerals", motion:"Measured, directional, and data-led" };
    if (/\b(health|wellness|nature|calm|mind|fitness)\b/.test(text)) return { name:"Quiet Field", style:"Warm, calm, and human", colors:["#101310","#F5F1E8","#9BCF9F","#E7B879"], type:"Humanist sans / generous leading", motion:"Soft continuity and low-amplitude emphasis" };
    return { name:"Editorial Signal", style:"Neutral premium documentary", colors:["#0E0F12","#F1F2F4","#F4C95D","#A78BFA"], type:"Inter / restrained display scale", motion:"Fast comprehension with selective expression" };
  }
  function normalizeTheme(theme) {
    const colors = theme?.colors || {};
    return { name:theme?.name || "Saved campaign theme", style:theme?.aestheticStyle || theme?.description || "Saved brand direction", colors:[colors.background || "#0E0F12", colors.text || "#F1F2F4", colors.primary || "#63D9EB", colors.accent || "#A78BFA"], type:theme?.fontFamily || "Inter", motion:theme?.motionCurve || theme?.transitionFamily || "Purposeful non-linear motion" };
  }

  async function runPlan() {
    const source = byId("sourceInput").value.trim();
    if (!source) { byId("sourceInput").focus(); showToast("Paste a source first"); return; }
    if (mode === "script" && source.length < 32) { showToast("Add enough script for a complete-video read"); return; }
    const button = byId("runButton"); button.disabled = true; button.firstElementChild.textContent = mode === "script" ? "Reading complete edit…" : "Strengthening brief…";
    emptyOutput("Director is building the plan", "Reading meaning, timing, entities, theme evidence, your edited pipeline, and the approved template catalog.");
    try {
      const duration = sourceDuration(source); const generator = byId("provider").value; const customPipeline = planningGuidance(); let response;
      if (mode === "script") {
        response = await api("/api/v1/psychology-analyze", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
          transcript:source, sequenceInfo:{width:1920,height:1080,fps:30,duration},
          userPrompt:`Apply this editor-approved pipeline specification:\n\n${customPipeline}\n\nPrefer independent five-to-ten-second overlays, authentic assets, exact timestamp cues, and one coherent campaign theme.`,
          generator, mode:"auto-sequence", origin:"website-director-lab", deepAnalysis:true, directorMode:"auto", planningDensity:byId("pacing").value,
          minimumClipDuration:5, maxSegmentDuration:10, assetResolutionMode:"strict", themeMode:byId("themeMode").value === "active" ? "saved" : "auto", themeId:byId("themeMode").value === "active" && activeTheme ? activeTheme.id : null
        }) });
        const storyboard = response.storyboard || {};
        const theme = storyboard.campaignTheme ? normalizeTheme(storyboard.campaignTheme) : byId("themeMode").value === "active" && activeTheme ? normalizeTheme(activeTheme) : inferTheme(source);
        latestPlan = { mode, source, duration, storyboard, storyboardId:response.storyboardId, theme };
      } else {
        response = await api("/api/prompts/optimize", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
          prompt:`${source}\n\nEDITOR PIPELINE:\n${customPipeline}\n\nUse an authored Null Motion template as the structural motion system. Target a readable five-to-ten-second graphic, use authentic supplied or researched assets, and preserve a transparent full-frame background.`,
          generator, engine:"hyperframes", duration:clamp(duration,5,10), width:1920,height:1080,fps:30, themeId:byId("themeMode").value === "active" && activeTheme ? activeTheme.id : null
        }) });
        latestPlan = { mode, source, duration:clamp(duration,5,10), optimized:response, theme:response.theme ? normalizeTheme(response.theme) : inferTheme(source) };
      }
      renderResult(latestPlan);
    } catch (error) {
      byId("labOutput").innerHTML = `<div class="error-box"><b>Could not build the director plan.</b><br>${escapeHtml(error.message || error)}</div>`;
    } finally { button.disabled = false; button.firstElementChild.textContent = "Build director plan"; }
  }

  function candidateId(candidate) { return typeof candidate === "string" ? candidate : candidate && (candidate.id || candidate.templateId); }
  function templateName(id) { const template = templates.find(item => item.id === id); return template ? template.name : id || "Unselected"; }
  function formatTime(seconds) { const value = Math.max(0, Number(seconds) || 0); const minutes = Math.floor(value / 60); const rest = value - minutes * 60; return `${String(minutes).padStart(2,"0")}:${rest.toFixed(rest % 1 ? 1 : 0).padStart(2,"0")}`; }
  function resultStat(label, value) { return `<div class="result-stat"><small>${escapeHtml(label)}</small><b title="${escapeHtml(value)}">${escapeHtml(value)}</b></div>`; }

  function renderResult(plan) {
    const storyboard = plan.storyboard || null;
    const segments = storyboard && Array.isArray(storyboard.segments) ? storyboard.segments : [];
    const selected = segments.filter(segment => segment.shouldRenderGraphic !== false);
    const assets = plan.mode === "script" ? unique(segments.flatMap(segment => (segment.assetQueries || segment.assetRecommendations || []).map(asset => typeof asset === "string" ? asset : asset.query || asset.entity || asset.name))) : (plan.optimized.assetQueries || []).map(asset => typeof asset === "string" ? asset : asset.query || asset.entity || asset.name);
    const meaning = plan.mode === "script" ? storyboard.decisionSummary || storyboard.designRationale || "Complete-video narrative analysis returned a reviewable storyboard." : plan.optimized.analysis?.intent || plan.optimized.analysis?.summary || "The brief was expanded into a production-ready motion direction.";
    const theme = plan.theme; const beats = selected.slice(0, 8); const optimizedPrompt = plan.mode === "prompt" ? plan.optimized.optimizedPrompt : "";
    const assetHtml = assets.length ? `<div class="chip-row">${assets.slice(0,8).map(asset => `<span class="chip" title="${escapeHtml(asset)}">${escapeHtml(asset)}</span>`).join("")}</div>` : "<p>No recognizable entity requires an external asset, or none was found in this planning pass.</p>";
    const detailHtml = plan.mode === "script" ? `<article class="result-card wide"><div class="result-card-head"><b>Proposed overlay windows</b><span>06 · TPL</span></div><div class="beats">${beats.length ? beats.map(segment => { const id = segment.templateId || candidateId((segment.bestTemplateCandidates || [])[0]); return `<div class="beat"><time>${formatTime(segment.graphicStartTime ?? segment.startTime)}</time><span title="${escapeHtml(segment.text || segment.spokenText || "")}">${escapeHtml(segment.text || segment.spokenText || "Motion beat")}</span><b>${escapeHtml(templateName(id))}</b></div>`; }).join("") : "<p>No overlay was justified. Leaving footage clean is a valid plan.</p>"}</div></article>` : `<article class="result-card wide"><div class="result-card-head"><b>Template-ready production prompt</b><span>06 · TPL</span></div><p>${escapeHtml(String(optimizedPrompt || plan.source).slice(0,1200))}</p></article>`;
    byId("labOutput").innerHTML = `<div class="result-summary">${resultStat("Source",plan.mode === "script" ? "Complete edit" : "Single prompt")}${resultStat("Duration",formatTime(plan.duration))}${resultStat("Graphics",plan.mode === "script" ? `${selected.length} selected` : "1 planned")}${resultStat("Theme",theme.name)}</div><div class="result-grid"><article class="result-card wide"><div class="result-card-head"><b>Whole-source understanding</b><span>03 · WHY</span></div><p>${escapeHtml(meaning)}</p></article><article class="result-card"><div class="result-card-head"><b>Authentic asset plan</b><span>04 · IMG</span></div>${assetHtml}</article><article class="result-card"><div class="result-card-head"><b>Campaign theme</b><span>05 · THM</span></div><div class="theme-preview"><div class="swatches">${theme.colors.map(color => `<i style="background:${escapeHtml(color)}"></i>`).join("")}</div><div class="theme-copy"><b>${escapeHtml(theme.name)}</b><span>${escapeHtml(`${theme.style} · ${theme.type} · ${theme.motion}`)}</span></div></div></article>${detailHtml}</div><div class="result-actions"><button type="button" id="copyPlan">Copy plan</button><button class="primary" type="button" id="continuePlan">${plan.mode === "script" ? "Continue in Script to Motion" : "Continue in prompt generator"}</button></div>`;
    byId("copyPlan").onclick = copyPlan; byId("continuePlan").onclick = continuePlan;
  }

  async function copyPlan() {
    if (!latestPlan) return;
    const text = latestPlan.mode === "script" ? JSON.stringify(latestPlan.storyboard, null, 2) : latestPlan.optimized.optimizedPrompt || latestPlan.source;
    copyText(text, "Director plan copied");
  }
  function continuePlan() {
    if (!latestPlan) return;
    if (latestPlan.mode === "script") {
      localStorage.setItem(SCRIPT_DRAFT_KEY, JSON.stringify({ script:latestPlan.source, duration:String(latestPlan.duration), format:"1920x1080", fps:"30", provider:byId("provider").value, density:byId("pacing").value, assetMode:"strict", renderMode:"high-end", guidance:`Use the edited director pipeline. ${planningGuidance().slice(0,3500)}` }));
      location.href = "script.html";
    } else { localStorage.setItem(PROMPT_HANDOFF_KEY, latestPlan.optimized.optimizedPrompt || latestPlan.source); location.href = "./"; }
  }
  function contractDeliveryLabel(value) {
    return ({
      "live-api": "Live API",
      "live-and-generated-fallback": "Live + bundled",
      "live-api-and-generated-fallback": "Live + bundled",
      "cep-host": "CEP native",
      "browser-workspace": "Website native"
    })[value] || String(value || "Contract").replaceAll("-", " ");
  }

  function renderClientContract(contract, online) {
    clientContract = contract && Number(contract.schemaVersion) === 1 ? contract : null;
    const status = byId("clientContractStatus");
    const version = byId("clientContractVersion");
    const grid = byId("clientContractGrid");
    if (!status || !version || !grid) return;
    if (!clientContract) {
      status.textContent = online ? "Contract unavailable" : "Bridge offline · architecture remains editable";
      version.textContent = "Offline fallback";
      grid.innerHTML = '<div class="contract-loading">Start or update the local companion to inspect live website and CEP parity.</div>';
      return;
    }
    const shared = (clientContract.capabilities || []).filter(capability => capability.scope === "shared");
    status.textContent = `${shared.length} shared capabilities verified by one contract`;
    version.textContent = `Contract ${clientContract.contractVersion}`;
    grid.innerHTML = shared.map(capability => {
      const route = (capability.serverRoutes || [])[0] || capability.sourceOfTruth || "Shared contract";
      return `<article class="contract-capability"><div class="contract-capability-head"><b title="${escapeHtml(capability.label)}">${escapeHtml(capability.label)}</b><span aria-label="Shared by both clients"></span></div><p>${escapeHtml(contractDeliveryLabel(capability.delivery))}<br><code>${escapeHtml(route)}</code></p></article>`;
    }).join("") || '<div class="contract-loading">No shared capabilities are declared.</div>';
  }

  function useExample() {
    byId("sourceInput").value = mode === "script" ? "00:00:00.000 --> 00:00:06.000\nMost AI tools make you jump between apps.\n\n00:00:06.000 --> 00:00:13.000\nGrok finds live conversations while Claude helps shape the idea.\n\n00:00:13.000 --> 00:00:20.000\nThen Notion becomes the place where the finished plan stays organized.\n\n00:00:20.000 --> 00:00:27.000\nThe point is not more software. It is one clear workflow with less friction." : "Show how Grok, Claude, and Notion work together in one AI research workflow. Use their real app logos, a clean technological campaign theme, and a concise 7-second authored motion template with a readable hold.";
    byId("duration").value = mode === "script" ? "30" : "7"; updateSourceCount(); byId("sourceInput").focus();
  }

  function bindWorkspace() {
    byId("pipeline").addEventListener("click", event => { const button = event.target.closest("[data-stage]"); if (button) selectStage(Number(button.dataset.stage)); });
    byId("copyStage").onclick = () => copyText(stageMarkdown(stages[selectedStage]), "Stage copied as Markdown");
    byId("copyPipeline").onclick = () => copyText(pipelineMarkdown(), "Full pipeline copied as Markdown");
    byId("copyJson").onclick = () => copyText(pipelineJson(), "Pipeline JSON copied");
    byId("exportPipeline").onclick = exportPipeline;
    byId("openImport").onclick = () => { byId("importInput").value = pipelineJson(); byId("importDialog").showModal(); byId("importInput").select(); };
    byId("importPipeline").onclick = importPipeline;
    byId("resetPipeline").onclick = () => {
      if (byId("resetPipeline").dataset.confirm !== "1") {
        byId("resetPipeline").dataset.confirm = "1"; byId("resetPipeline").textContent = "Click again to restore";
        clearTimeout(resetTimer); resetTimer = setTimeout(() => { byId("resetPipeline").dataset.confirm = ""; byId("resetPipeline").textContent = "Restore defaults"; }, 3000); return;
      }
      clearTimeout(resetTimer); stages = clone(defaultStages); selectedStage = 0; saveStages(); selectStage(0); byId("resetPipeline").dataset.confirm = ""; byId("resetPipeline").textContent = "Restore defaults"; showToast("Default pipeline restored");
    };
  }

  function bindLab() {
    byId("scriptMode").onclick = () => setMode("script"); byId("promptMode").onclick = () => setMode("prompt");
    byId("exampleButton").onclick = useExample; byId("runButton").onclick = runPlan;
    byId("clearSource").onclick = () => { byId("sourceInput").value = ""; byId("duration").value = ""; updateSourceCount(); byId("sourceInput").focus(); };
    byId("pasteSource").onclick = async () => { try { byId("sourceInput").value = await navigator.clipboard.readText(); updateSourceCount(); } catch (_) { showToast("Clipboard read permission was unavailable"); } };
    byId("sourceInput").addEventListener("input", updateSourceCount);
    byId("sourceInput").addEventListener("keydown", event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); runPlan(); } });
  }

  async function initialize() {
    initializeFlowExplainers(); renderPipeline(); renderEditor(); renderPreview(); renderClientContract(null, false); bindWorkspace(); bindLab(); updateSourceCount();
    try {
      const results = await Promise.all([api("/api/v1/health"), api("/api/v1/templates"), api("/api/user/active-theme"), api("/api/v1/client-contract").catch(() => null)]);
      templates = Array.isArray(results[1].templates) ? results[1].templates : []; activeTheme = results[2].theme || null;
      renderClientContract(results[3], true);
      byId("bridgeDot").classList.add("online"); byId("bridgeText").textContent = `UI ready · ${templates.length} templates · generation not connected`;
      if (!activeTheme) byId("themeMode").value = "auto";
    } catch (_) { renderClientContract(null, false); byId("bridgeText").textContent = "Bridge offline · editing still works"; }
  }

  initialize();
})();
