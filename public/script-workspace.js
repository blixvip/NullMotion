(function () {
  "use strict";

  var API = window.location.origin;
  var TOKEN_KEY = "null-motion-bridge-token";
  var LEGACY_TOKEN_KEYS = ["nullMotionBridgeToken", "null-motion-browser-token", "nullBridgeToken"];
  var DRAFT_KEY = "nullMotionScriptDraftV1";
  var TERMINAL = new Set(["done", "partial", "error", "cancelled", "interrupted"]);
  var templates = [];
  var storyboard = null;
  var storyboardId = null;
  var sequenceInfo = null;
  var activeBatchId = null;
  var activeThemeId = null;
  var eventSource = null;
  var pollTimer = null;
  var toastTimer = null;

  function byId(id) { return document.getElementById(id); }

  function bridgeToken() {
    try {
      var token = localStorage.getItem(TOKEN_KEY) || "";
      if (token) return token;
      for (var index = 0; index < LEGACY_TOKEN_KEYS.length; index += 1) {
        token = localStorage.getItem(LEGACY_TOKEN_KEYS[index]) || "";
        if (!token) continue;
        localStorage.setItem(TOKEN_KEY, token);
        LEGACY_TOKEN_KEYS.forEach(function (key) { localStorage.removeItem(key); });
        return token;
      }
    } catch (error) {}
    return "";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  async function api(path, options) {
    options = options || {};
    var headers = Object.assign({}, options.headers || {});
    var token = bridgeToken();
    if (token) headers["X-Null-Bridge-Token"] = token;
    var response = await fetch(API + path, Object.assign({}, options, { headers: headers }));
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || "Null bridge failed (" + response.status + ")");
    return data;
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    byId("toast").textContent = message;
    byId("toast").classList.add("show");
    toastTimer = setTimeout(function () { byId("toast").classList.remove("show"); }, 2600);
  }

  function setStatus(id, message, error) {
    var node = byId(id);
    node.textContent = message || "";
    node.classList.toggle("show", Boolean(message));
    node.classList.toggle("error", Boolean(error));
  }

  function setStep(number) {
    [1, 2, 3].forEach(function (index) {
      byId("step" + index).classList.toggle("active", index === number);
      byId("step" + index).classList.toggle("done", index < number);
    });
  }

  async function initialize() {
    restoreDraft();
    updateScriptStats();
    try {
      var responses = await Promise.all([api("/api/v1/health"), api("/api/v1/templates"), api("/api/user/active-theme")]);
      var health = responses[0];
      var catalog = responses[1];
      var themeResponse = responses[2];
      byId("bridge").className = "bridge online";
      byId("bridgeText").textContent = "UI ready · generation not connected";
      templates = Array.isArray(catalog.templates) ? catalog.templates : [];
      activeThemeId = themeResponse.theme && themeResponse.theme.id || null;
    } catch (error) {
      byId("bridge").className = "bridge offline";
      byId("bridgeText").textContent = "Bridge offline";
      setStatus("inputStatus", "Start the Null Motion companion, then reload this page.", true);
    }
  }

  function parseDuration(value) {
    var clean = String(value || "").trim().toLowerCase().replace(/seconds?|secs?/g, "").trim();
    if (!clean) return null;
    if (/^\d+(?:\.\d+)?$/.test(clean)) return Number(clean);
    var parts = clean.split(":").map(Number);
    if (parts.some(function (part) { return !Number.isFinite(part); })) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return null;
  }

  function detectedTimelineEnd(text) {
    var end = 0;
    var pattern = /(?:^|\n)\s*(?:\d+\s*\n\s*)?\[?(\d{1,2}:\d{2}(?::\d{2})?(?:[,.]\d{1,3})?)\]?/g;
    var match;
    while ((match = pattern.exec(String(text || "")))) end = Math.max(end, parseDuration(match[1].replace(",", ".")) || 0);
    var srtPattern = /-->\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[,.]\d{1,3})?)/g;
    while ((match = srtPattern.exec(String(text || "")))) end = Math.max(end, parseDuration(match[1].replace(",", ".")) || 0);
    return end;
  }

  function estimatedDuration(text) {
    var words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
    return Math.max(8, Math.ceil(words / 2.55));
  }

  function currentSequenceInfo() {
    var dimensions = byId("videoFormat").value.split("x").map(Number);
    var transcript = byId("scriptInput").value;
    var explicit = parseDuration(byId("videoDuration").value);
    var timed = detectedTimelineEnd(transcript);
    var duration = Math.max(4, explicit || (timed ? timed + 4 : estimatedDuration(transcript)));
    return {
      width: dimensions[0],
      height: dimensions[1],
      fps: Number(byId("videoFps").value) || 30,
      duration: Math.round(duration * 1000) / 1000
    };
  }

  function formatTime(seconds, includeMillis) {
    var value = Math.max(0, Number(seconds) || 0);
    var hours = Math.floor(value / 3600);
    var minutes = Math.floor((value % 3600) / 60);
    var whole = Math.floor(value % 60);
    var millis = Math.round((value - Math.floor(value)) * 1000);
    var base = (hours ? String(hours).padStart(2, "0") + ":" : "") +
      String(minutes).padStart(2, "0") + ":" + String(whole).padStart(2, "0");
    return includeMillis && millis ? base + "." + String(millis).padStart(3, "0") : base;
  }

  function saveDraft() {
    var draft = {
      script: byId("scriptInput").value,
      duration: byId("videoDuration").value,
      format: byId("videoFormat").value,
      fps: byId("videoFps").value,
      provider: byId("provider").value,
      density: byId("density").value,
      assetMode: byId("assetMode").value,
      renderMode: byId("renderMode").value,
      guidance: byId("guidance").value
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }

  function restoreDraft() {
    try {
      var draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (!draft) return;
      byId("scriptInput").value = draft.script || "";
      byId("videoDuration").value = draft.duration || "";
      [["videoFormat", "format"], ["videoFps", "fps"], ["provider", "provider"], ["density", "density"], ["assetMode", "assetMode"], ["renderMode", "renderMode"]].forEach(function (pair) {
        var node = byId(pair[0]);
        var value = draft[pair[1]];
        if (value && Array.from(node.options).some(function (option) { return option.value === String(value); })) node.value = String(value);
      });
      byId("guidance").value = draft.guidance || "";
    } catch (error) {}
  }

  function updateScriptStats() {
    var value = byId("scriptInput").value;
    var words = value.trim().split(/\s+/).filter(Boolean).length;
    byId("scriptStats").textContent = words.toLocaleString() + " words · about " + formatTime(currentSequenceInfo().duration);
    saveDraft();
  }

  async function analyzeScript() {
    var transcript = byId("scriptInput").value.trim();
    if (!transcript) {
      byId("scriptInput").focus();
      setStatus("inputStatus", "Paste or import a script first.", true);
      return;
    }
    if (transcript.length < 32) {
      setStatus("inputStatus", "Add a little more script so the director has enough context.", true);
      return;
    }
    var button = byId("analyzeButton");
    button.disabled = true;
    button.classList.add("busy");
    button.textContent = "Directing the story…";
    setStatus("inputStatus", "Analyzing narrative beats, timing, real entities, and the approved template catalog.");
    sequenceInfo = currentSequenceInfo();
    try {
      var response = await api("/api/v1/psychology-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcript,
          sequenceInfo: sequenceInfo,
          userPrompt: byId("guidance").value.trim(),
          generator: byId("provider").value,
          mode: "auto-sequence",
          origin: "website-script",
          deepAnalysis: true,
          directorMode: "auto",
          planningDensity: byId("density").value,
          minimumClipDuration: 4,
          assetResolutionMode: byId("assetMode").value,
          themeId: activeThemeId
        })
      });
      storyboard = response.storyboard;
      storyboardId = response.storyboardId || (storyboard && storyboard.id) || null;
      if (!storyboard || !Array.isArray(storyboard.segments) || !storyboard.segments.length) {
        throw new Error("The director returned no timeline segments.");
      }
      byId("planPanel").hidden = false;
      renderPlan();
      setStatus("inputStatus", "");
      setStep(2);
      byId("planPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setStatus("inputStatus", error.message || "Could not build the timeline.", true);
    } finally {
      button.disabled = false;
      button.classList.remove("busy");
      button.textContent = "Build motion timeline";
    }
  }

  function selectedSegments() {
    return storyboard && Array.isArray(storyboard.segments)
      ? storyboard.segments.filter(function (segment) { return segment.shouldRenderGraphic !== false; })
      : [];
  }

  function candidateId(candidate) {
    return typeof candidate === "string" ? candidate : candidate && candidate.id;
  }

  function templateName(id) {
    var template = templates.find(function (item) { return item.id === id; });
    return (template && template.name) || id || "No template";
  }

  function renderSummary() {
    var selected = selectedSegments();
    var insights = storyboard.overallCampaignInsights || {};
    var warning = insights.longVideoWarning;
    var coverage = selected.reduce(function (sum, segment) { return sum + (Number(segment.graphicDuration) || 0); }, 0);
    var cards = [
      ["Video length", formatTime(sequenceInfo.duration)],
      ["Motion graphics", selected.length + " selected"],
      ["Graphic coverage", Math.round(coverage) + " seconds"],
      [warning ? "Long-video plan" : "Complexity", warning ? "Sparse highlights" : (insights.complexityBudget || "Balanced")]
    ];
    byId("summaryGrid").innerHTML = cards.map(function (card, index) {
      var title = warning && index === 3 ? warning : card[1];
      var className = "summary-card" + (warning && index === 3 ? " warning" : "");
      return '<div class="' + className + '"><small>' + escapeHtml(card[0]) + '</small><b title="' +
        escapeHtml(title) + '">' + escapeHtml(card[1]) + "</b></div>";
    }).join("");
    byId("rationale").textContent = storyboard.decisionSummary || storyboard.designRationale ||
      "Null selected the beats where motion most improves comprehension or emphasis.";
    byId("generateButton").disabled = selected.length === 0;
  }

  function renderTimeline() {
    var duration = Math.max(1, sequenceInfo.duration || storyboard.overallDuration || 60);
    byId("timelineRuler").innerHTML = Array.from({ length: 6 }, function (_, index) {
      return "<span>" + formatTime(duration * index / 6) + "</span>";
    }).join("");
    byId("timelineTrack").innerHTML = storyboard.segments.map(function (segment, index) {
      var start = Math.max(0, Number(segment.graphicStartTime) || 0);
      var length = Math.max(0.2, Number(segment.graphicDuration) || 0.2);
      var left = Math.min(99.5, start / duration * 100);
      var width = Math.max(0.5, Math.min(100 - left, length / duration * 100));
      var classes = ["timeline-block"];
      if (segment.criticality === "low") classes.push("low");
      if (segment.shouldRenderGraphic === false) classes.push("off");
      var label = segment.templateId ? templateName(segment.templateId) : "Beat " + (index + 1);
      return '<button class="' + classes.join(" ") + '" type="button" data-index="' + index +
        '" style="left:' + left + "%;width:" + width + '%" title="' +
        escapeHtml(formatTime(start, true) + " · " + (segment.text || "")) + '"><b>' +
        escapeHtml(label) + "</b><span>" + formatTime(start, true) + "</span></button>";
    }).join("");
    byId("timelineTrack").querySelectorAll("button").forEach(function (button) {
      button.onclick = function () {
        var card = byId("segmentList").children[Number(button.dataset.index)];
        if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
      };
    });
  }

  function renderSegments() {
    var root = byId("segmentList");
    root.innerHTML = storyboard.segments.map(function (segment, index) {
      var candidateIds = (segment.bestTemplateCandidates || []).map(candidateId);
      var allIds = [segment.templateId].concat(candidateIds, templates.map(function (template) { return template.id; })).filter(Boolean);
      var ids = Array.from(new Set(allIds));
      var templateOptions = ids.map(function (id) {
        return '<option value="' + escapeHtml(id) + '"' + (id === segment.templateId ? " selected" : "") + ">" +
          escapeHtml(templateName(id)) + "</option>";
      }).join("");
      var enabled = segment.shouldRenderGraphic !== false;
      return '<article class="segment' + (enabled ? "" : " is-off") + '" data-index="' + index + '">' +
        '<div class="segment-toggle"><input class="segment-enabled" type="checkbox" aria-label="Generate graphic for beat ' + (index + 1) + '"' + (enabled ? " checked" : "") + " /></div>" +
        '<div class="segment-copy"><div class="segment-kicker">Beat ' + String(index + 1).padStart(2, "0") +
        ' <span class="criticality ' + escapeHtml(segment.criticality || "medium") + '">' +
        escapeHtml(segment.criticality || "medium") + "</span> " + escapeHtml(segment.semanticCategory || "") +
        '</div><div class="spoken">' + escapeHtml(segment.text || "") + '</div><div class="why">' +
        escapeHtml(segment.whyGraphic || segment.visualRationale || segment.intent || "") + "</div></div>" +
        '<div class="segment-controls">' +
        '<div class="field"><label>Starts at</label><input class="segment-start" type="number" min="0" max="' +
        sequenceInfo.duration + '" step="0.1" value="' + (Number(segment.graphicStartTime) || 0) + '" /></div>' +
        '<div class="field"><label>Duration</label><input class="segment-duration" type="number" min="3" max="7" step="0.1" value="' +
        (Number(segment.graphicDuration) || 4) + '" /></div>' +
        '<div class="field template-field"><label>Template</label><select class="segment-template">' + templateOptions + "</select></div>" +
        '<div class="field prompt-field"><label>Motion direction</label><textarea class="segment-prompt" placeholder="Optional segment-specific direction">' +
        escapeHtml(segment.customPrompt || segment.suggestedPromptEnhancements || "") + "</textarea></div></div></article>";
    }).join("");

    Array.from(root.children).forEach(function (card, index) {
      var segment = storyboard.segments[index];
      card.querySelector(".segment-enabled").onchange = function (event) {
        segment.shouldRenderGraphic = event.target.checked;
        card.classList.toggle("is-off", !event.target.checked);
        renderSummary();
        renderTimeline();
      };
      card.querySelector(".segment-start").onchange = function (event) {
        segment.graphicStartTime = Math.max(0, Math.min(sequenceInfo.duration, Number(event.target.value) || 0));
        event.target.value = segment.graphicStartTime;
        renderTimeline();
      };
      card.querySelector(".segment-duration").onchange = function (event) {
        segment.graphicDuration = Math.max(3, Math.min(7, Number(event.target.value) || 4));
        segment.durationOverride = segment.graphicDuration;
        event.target.value = segment.graphicDuration;
        renderSummary();
        renderTimeline();
      };
      card.querySelector(".segment-template").onchange = function (event) {
        segment.templateId = event.target.value;
        renderTimeline();
      };
      card.querySelector(".segment-prompt").onchange = function (event) {
        segment.customPrompt = event.target.value.trim();
      };
    });
  }

  function renderPlan() {
    renderSummary();
    renderTimeline();
    renderSegments();
  }

  function timelineText() {
    var header = "NULL MOTION TIMELINE\nVideo: " + formatTime(sequenceInfo.duration) + " · " +
      sequenceInfo.width + "x" + sequenceInfo.height + " · " + sequenceInfo.fps + " fps\nGraphics: " +
      selectedSegments().length + "\n";
    return header + storyboard.segments.map(function (segment, index) {
      var status = segment.shouldRenderGraphic === false ? "FOOTAGE ONLY" :
        "NULL MOTION · " + templateName(segment.templateId) + " · " + Number(segment.graphicDuration).toFixed(1) + "s";
      return "\n" + String(index + 1).padStart(2, "0") + "  " + formatTime(segment.graphicStartTime, true) + "  " +
        status + "\n" + segment.text + "\n" + (segment.customPrompt || segment.whyGraphic || "");
    }).join("\n");
  }

  async function copyTimeline() {
    try {
      await navigator.clipboard.writeText(timelineText());
      showToast("Timeline script copied");
    } catch (error) {
      showToast("Clipboard access was blocked");
    }
  }

  function downloadTimeline() {
    var payload = {
      apiVersion: 1,
      storyboardId: storyboardId,
      sequenceInfo: sequenceInfo,
      transcript: byId("scriptInput").value,
      storyboard: storyboard
    };
    var url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "null-motion-timeline-" + Date.now() + ".json";
    anchor.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  async function generateSequence() {
    if (!storyboard || !selectedSegments().length) {
      setStatus("planStatus", "Select at least one graphic.", true);
      return;
    }
    var button = byId("generateButton");
    button.disabled = true;
    button.classList.add("busy");
    button.textContent = "Starting sequence…";
    setStatus("planStatus", "");
    try {
      var renderMode = byId("renderMode").value;
      var response = await api("/api/v1/generate-sequence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyboard: storyboard,
          storyboardId: storyboardId,
          transcript: byId("scriptInput").value,
          sequenceInfo: sequenceInfo,
          generator: byId("provider").value,
          quality: renderMode === "high-end" ? "high" : "standard",
          origin: "website-script",
          renderMode: renderMode,
          qualityReview: renderMode === "preview" ? "skip" : renderMode === "high-end" ? "strict" : "auto",
          cacheMode: "use",
          priority: "high",
          assetResolutionMode: byId("assetMode").value,
          themeId: activeThemeId,
          maxRepairPasses: renderMode === "high-end" ? 2 : renderMode === "preview" ? 0 : 1,
          minimumClipDuration: 4,
          maxSegmentDuration: 7,
          planningDensity: byId("density").value
        })
      });
      activeBatchId = response.sequenceId || response.batchId;
      if (!activeBatchId) throw new Error("The companion did not return a sequence ID.");
      byId("runPanel").hidden = false;
      setStep(3);
      applyBatch(response);
      watchBatch(activeBatchId);
      byId("runPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setStatus("planStatus", error.message || "Could not start the sequence.", true);
      button.disabled = false;
    } finally {
      button.classList.remove("busy");
      button.textContent = "Generate selected graphics";
    }
  }

  function stopWatch() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function watchBatch(batchId) {
    stopWatch();
    function poll() {
      api("/api/v1/sequences/" + encodeURIComponent(batchId)).then(applyBatch).catch(function (error) {
        byId("runStatus").textContent = error.message;
      });
    }
    pollTimer = setInterval(poll, 1800);
    poll();
    try {
      eventSource = new EventSource(API + "/api/v1/sequences/" + encodeURIComponent(batchId) + "/events");
      eventSource.onmessage = function (event) {
        try { applyBatch(JSON.parse(event.data)); } catch (error) {}
      };
      eventSource.onerror = function () {
        if (eventSource) eventSource.close();
        eventSource = null;
      };
    } catch (error) {}
  }

  function jobLabel(job, index) {
    return job.templateName || templateName(job.templateId) || "Graphic " + (index + 1);
  }

  function applyBatch(batch) {
    if (!batch) return;
    var status = String(batch.status || "pending").toLowerCase();
    var jobs = Array.isArray(batch.jobs) ? batch.jobs : [];
    var complete = jobs.filter(function (job) { return job.status === "done"; }).length;
    var failed = jobs.filter(function (job) { return ["error", "cancelled", "interrupted"].includes(job.status); }).length;
    byId("runTitle").textContent = TERMINAL.has(status)
      ? status === "done" ? "Motion sequence ready" : status === "partial" ? "Sequence partially complete" : "Sequence " + status
      : "Generating motion sequence";
    byId("runStatus").textContent = complete + " of " + (jobs.length || selectedSegments().length) + " ready" +
      (failed ? " · " + failed + " failed" : "") + (batch.etaSeconds ? " · about " + batch.etaSeconds + "s remaining" : "");
    byId("runProgress").style.transform = "scaleX(" + Math.max(0, Math.min(100, Number(batch.progress) || 0)) / 100 + ")";
    byId("cancelButton").disabled = TERMINAL.has(status);
    byId("retryButton").hidden = !["partial", "error", "cancelled", "interrupted"].includes(status) || failed === 0;
    byId("runList").innerHTML = jobs.length ? jobs.map(function (job, index) {
      var jobStatus = String(job.status || "pending").toLowerCase();
      var renderHref = safeHttpUrl(job.downloadUrl) || (job.jobId
        ? API + "/api/v1/jobs/" + encodeURIComponent(job.jobId) + "/download"
        : job.mp4Name ? API + "/renders/" + encodeURIComponent(job.mp4Name) : "");
      var thumb = job.thumbUrl
        ? '<img src="' + escapeHtml(job.thumbUrl) + '" alt="' + escapeHtml(jobLabel(job, index)) + ' preview" />'
        : escapeHtml(jobStatus === "done" ? "Preview ready" : job.step || jobStatus);
      var actions = jobStatus === "done"
        ? (job.playerUrl ? '<a href="' + escapeHtml(job.playerUrl) + '" target="_blank" rel="noopener">Preview</a>' : "") +
          (renderHref ? '<a href="' + escapeHtml(renderHref) + '" download>Download</a>' : "")
        : "";
      return '<article class="run-item ' + escapeHtml(jobStatus) + '"><div class="run-thumb">' + thumb +
        '</div><div class="run-item-body"><div class="run-item-title"><span>' + escapeHtml(jobLabel(job, index)) +
        "</span><span>" + formatTime(job.relativeStartTime, true) + '</span></div><div class="run-item-status">' +
        escapeHtml(jobStatus === "done" ? "Transparent MOV ready" : job.error || job.step || jobStatus) +
        '</div><div class="run-item-actions">' + actions + "</div></div></article>";
    }).join("") : '<div class="empty">The sequence is queued. Segment jobs will appear shortly.</div>';
    if (TERMINAL.has(status)) {
      stopWatch();
      byId("generateButton").disabled = false;
      if (status === "done") showToast("Your Null Motion sequence is ready");
    }
  }

  async function cancelBatch() {
    if (!activeBatchId) return;
    try {
      applyBatch(await api("/api/v1/sequences/" + encodeURIComponent(activeBatchId) + "/cancel", { method: "POST" }));
    } catch (error) {
      showToast(error.message);
    }
  }

  async function retryBatch() {
    if (!activeBatchId) return;
    byId("retryButton").disabled = true;
    try {
      var batch = await api("/api/v1/sequences/" + encodeURIComponent(activeBatchId) + "/retry-failed", { method: "POST" });
      applyBatch(batch);
      watchBatch(activeBatchId);
    } catch (error) {
      showToast(error.message);
    } finally {
      byId("retryButton").disabled = false;
    }
  }

  byId("scriptInput").addEventListener("input", updateScriptStats);
  ["videoDuration", "videoFormat", "videoFps", "provider", "density", "assetMode", "renderMode", "guidance"].forEach(function (id) {
    byId(id).addEventListener("change", updateScriptStats);
  });
  byId("scriptFile").onchange = function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      byId("scriptInput").value = String(reader.result || "");
      updateScriptStats();
      showToast(file.name + " imported");
    };
    reader.readAsText(file);
  };
  byId("analyzeButton").onclick = analyzeScript;
  byId("copyTimeline").onclick = copyTimeline;
  byId("downloadTimeline").onclick = downloadTimeline;
  byId("generateButton").onclick = generateSequence;
  byId("cancelButton").onclick = cancelBatch;
  byId("retryButton").onclick = retryBatch;
  window.addEventListener("beforeunload", stopWatch);
  initialize();
}());
