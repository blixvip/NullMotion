(() => {
  "use strict";

  const pages = [
    { key: "templates", href: "./", label: "Templates", icon: '<rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M4 9h16M9 9v11"></path>' },
    { key: "reference", href: "create.html", label: "Reference", icon: '<rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="8.5" cy="9" r="1.5"></circle><path d="m21 15-4.2-4.2L8 19"></path>' },
    { key: "script", href: "script.html", label: "Script", icon: '<path d="M6 3h8l4 4v14H6z"></path><path d="M14 3v5h5M9 12h6M9 16h4"></path>' },
    { key: "pipeline", href: "system-map.html", label: "Pipeline", icon: '<circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="5" r="2"></circle><circle cx="19" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle><path d="m6.5 10.5 4-4m3 0 4 4m0 3-4 4m-3 0-4-4"></path>' },
    { key: "control", href: "control-center.html", label: "Control", icon: '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5"></path><circle cx="16" cy="6" r="2"></circle><circle cx="8" cy="12" r="2"></circle><circle cx="13" cy="18" r="2"></circle>' },
    { key: "renders", href: "renders.html", label: "Renders", icon: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m10 9 5 3-5 3z"></path>' }
  ];
  const tools = {
    grok: { name: "Grok", url: "https://x.com/i/grok" },
    perplexity: { name: "Perplexity", url: "https://www.perplexity.ai/" },
    chatgpt: { name: "ChatGPT", url: "https://chatgpt.com/" },
    gemini: { name: "Gemini", url: "https://gemini.google.com/app" }
  };
  const OPEN_KEY = "nullMotionAiDockOpen";
  const WIDTH_KEY = "nullMotionAiDockWidth";
  const TOOL_KEY = "nullMotionAiDockTool";
  let activeTool = read(TOOL_KEY) || "grok";
  if (!tools[activeTool]) activeTool = "grok";
  let dockOpen = read(OPEN_KEY) === "1";
  let popup = null;
  let dragging = false;

  function read(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function write(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
  function activePage() {
    const file = location.pathname.split("/").pop().toLowerCase();
    if (file === "create.html") return "reference";
    if (file === "script.html") return "script";
    if (file === "system-map.html") return "pipeline";
    if (file === "control-center.html") return "control";
    if (file === "renders.html") return "renders";
    return "templates";
  }
  function pageLink(page) {
    const current = activePage() === page.key ? ' aria-current="page"' : "";
    return `<a class="null-shell-link" href="${page.href}" title="${page.label}"${current}><span class="null-shell-glyph" aria-hidden="true"><svg viewBox="0 0 24 24">${page.icon}</svg></span><span class="null-shell-label">${page.label}</span></a>`;
  }

  function mount() {
    const main = document.querySelector("main, body > section");
    if (main && !main.id) main.id = "nullMainContent";

    const skipLink = document.createElement("a");
    skipLink.className = "null-skip-link";
    skipLink.href = `#${main?.id || "nullMainContent"}`;
    skipLink.textContent = "Skip to content";

    const topbar = document.createElement("header");
    topbar.className = "null-site-topbar";
    topbar.setAttribute("aria-label", "Null Motion navigation");
    topbar.innerHTML = `<a class="null-shell-brand" href="./" aria-label="Null Motion home"><span class="null-shell-brand-mark" aria-hidden="true">N</span><span class="null-shell-brand-copy"><b>Null</b><small>Motion</small></span></a><nav class="null-shell-nav" aria-label="Workspace">${pages.map(pageLink).join("")}</nav><span class="null-shell-spacer" aria-hidden="true"></span><button class="null-shell-action null-shell-manage" id="nullShellManage" type="button" title="Manage templates"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18"></path></svg><span class="null-shell-label">Manage</span></button><button class="null-shell-action null-shell-ai-toggle" id="nullAiToggle" type="button" aria-controls="nullAiDock" aria-expanded="false"><span class="null-shell-health" id="nullShellHealth" aria-hidden="true"></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v9a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 14.5z"></path><path d="M8 8h8M8 12h5"></path></svg><span class="null-shell-label">AI tools</span><span class="null-shell-ai-state">Open</span></button>`;

    const dock = document.createElement("aside");
    dock.className = "null-ai-dock";
    dock.id = "nullAiDock";
    dock.setAttribute("aria-label", "AI tools");
    dock.innerHTML = `<div class="null-ai-dock-head"><div class="null-ai-tabs" role="tablist" aria-label="AI workspace">${Object.entries(tools).map(([key, tool]) => `<button class="null-ai-tab" type="button" role="tab" data-tool="${key}" aria-selected="false">${tool.name}</button>`).join("")}</div><div class="null-ai-actions"><button class="null-ai-action" id="nullAiReload" type="button" title="Reload this AI tab" aria-label="Reload this AI tab">↻</button><button class="null-ai-action" id="nullAiOpen" type="button">Open ↗</button><button class="null-ai-action" id="nullAiClose" type="button">Hide</button></div></div><div class="null-ai-dock-body"><div class="null-ai-loading" id="nullAiLoading" role="status"><span></span><b>Loading ${tools[activeTool].name}</b><small>Preparing your signed-in session…</small></div>${Object.entries(tools).map(([key, tool]) => `<iframe class="null-ai-frame" data-tool-frame="${key}" title="${tool.name}" allow="clipboard-read; clipboard-write; microphone; camera; fullscreen" referrerpolicy="no-referrer"></iframe>`).join("")}</div>`;

    const splitter = document.createElement("div");
    splitter.className = "null-ai-splitter";
    splitter.id = "nullAiSplitter";
    splitter.setAttribute("role", "separator");
    splitter.setAttribute("aria-label", "Resize workspace and AI dock");
    splitter.setAttribute("aria-orientation", "vertical");
    splitter.tabIndex = -1;
    document.body.prepend(skipLink, topbar);
    const notice = document.createElement("p");
    notice.className = "null-public-notice";
    notice.setAttribute("role", "note");
    notice.textContent = "UI preview · Browse templates and explore the workspace. Generation, rendering, and Premiere are not connected yet.";
    topbar.after(notice);
    document.body.append(splitter, dock);
    bind(topbar, dock, splitter);
    applySavedWidth();
    selectTool(activeTool);
    setDockOpen(dockOpen, false);
    checkHealth();
    if (activePage() === "templates" && new URLSearchParams(location.search).get("manage") === "1") {
      document.getElementById("addTemplateBtn")?.click();
      history.replaceState(null, "", location.pathname + location.hash);
    }
  }

  function bind(topbar, dock, splitter) {
    const toggle = topbar.querySelector("#nullAiToggle");
    toggle.addEventListener("click", () => setDockOpen(!dockOpen));
    dock.querySelector("#nullAiClose").addEventListener("click", () => setDockOpen(false));
    dock.querySelector("#nullAiOpen").addEventListener("click", openTool);
    dock.querySelector("#nullAiReload").addEventListener("click", reloadActiveTool);
    dock.querySelectorAll(".null-ai-tab").forEach(tab => tab.addEventListener("click", () => selectTool(tab.dataset.tool)));
    dock.querySelectorAll(".null-ai-frame").forEach(frame => frame.addEventListener("load", () => {
      if (frame.dataset.toolFrame === activeTool) setLoading(false);
    }));
    topbar.querySelector("#nullShellManage").addEventListener("click", () => {
      const manager = document.getElementById("addTemplateBtn");
      if (manager) manager.click();
      else location.href = "./?manage=1";
    });
    splitter.addEventListener("pointerdown", event => {
      if (!dockOpen || innerWidth <= 860) return;
      dragging = true;
      splitter.classList.add("dragging");
      document.body.style.userSelect = "none";
      splitter.setPointerCapture?.(event.pointerId);
    });
    splitter.addEventListener("keydown", event => {
      if (!dockOpen || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const current = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--null-shell-dock"), 10) || 620;
      setDockWidth(current + (event.key === "ArrowLeft" ? 24 : -24));
    });
    addEventListener("pointermove", event => {
      if (!dragging) return;
      setDockWidth(innerWidth - event.clientX, false);
    });
    addEventListener("pointerup", () => {
      if (!dragging) return;
      dragging = false;
      splitter.classList.remove("dragging");
      document.body.style.userSelect = "";
      write(WIDTH_KEY, getComputedStyle(document.documentElement).getPropertyValue("--null-shell-dock").trim());
    });
    addEventListener("keydown", event => { if (event.key === "Escape" && dockOpen) setDockOpen(false); });
    addEventListener("message", event => {
      if (event.source !== window || event.data?.source !== "null-quick") return;
      if (event.data?.type === "embedReady" && dockOpen) loadActiveTool(true);
    });
  }

  function setDockOpen(open, persist = true) {
    dockOpen = Boolean(open);
    document.body.classList.toggle("null-ai-dock-open", dockOpen);
    const dock = document.getElementById("nullAiDock");
    const toggle = document.getElementById("nullAiToggle");
    const state = toggle.querySelector(".null-shell-ai-state");
    dock.classList.toggle("open", dockOpen);
    dock.setAttribute("aria-hidden", dockOpen ? "false" : "true");
    dock.inert = !dockOpen;
    toggle.setAttribute("aria-expanded", dockOpen ? "true" : "false");
    state.textContent = dockOpen ? "Hide" : "Open";
    document.getElementById("nullAiSplitter").tabIndex = dockOpen ? 0 : -1;
    if (dockOpen) loadActiveTool();
    if (persist) write(OPEN_KEY, dockOpen ? "1" : "0");
  }

  function setDockWidth(value, persist = true) {
    const min = Math.min(420, innerWidth * .44);
    const max = Math.max(min, innerWidth - 560);
    const width = Math.round(Math.min(Math.max(Number(value) || 620, min), max));
    document.documentElement.style.setProperty("--null-shell-dock", `${width}px`);
    if (persist) write(WIDTH_KEY, `${width}px`);
  }
  function applySavedWidth() { setDockWidth(parseInt(read(WIDTH_KEY), 10) || Math.max(520, innerWidth * .36), false); }

  function selectTool(key) {
    if (!tools[key]) return;
    activeTool = key;
    write(TOOL_KEY, key);
    document.querySelectorAll(".null-ai-tab").forEach(tab => {
      const selected = tab.dataset.tool === key;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", selected ? "true" : "false");
    });
    document.querySelectorAll(".null-ai-frame").forEach(frame => frame.classList.toggle("active", frame.dataset.toolFrame === key));
    if (dockOpen) loadActiveTool();
  }

  function activeFrame() { return document.querySelector(`.null-ai-frame[data-tool-frame="${activeTool}"]`); }
  function setLoading(loading) {
    const panel = document.getElementById("nullAiLoading");
    if (!panel) return;
    panel.classList.toggle("show", loading);
    panel.querySelector("b").textContent = `Loading ${tools[activeTool].name}`;
  }
  function loadActiveTool(force = false) {
    const frame = activeFrame();
    if (!frame || (frame.src && !force)) return;
    setLoading(true);
    frame.src = tools[activeTool].url;
  }
  function reloadActiveTool() {
    const frame = activeFrame();
    if (!frame) return;
    setLoading(true);
    frame.src = tools[activeTool].url;
  }

  function openTool() {
    const tool = tools[activeTool];
    const width = Math.max(460, Math.min(650, Math.round((screen.availWidth || 1440) * .36)));
    const left = (Number(screen.availLeft) || 0) + Math.max(0, (screen.availWidth || 1440) - width);
    popup = window.open(tool.url, `null-motion-${activeTool}`, `popup=yes,width=${width},height=${screen.availHeight || 900},left=${left},top=0`);
    popup?.focus();
  }

  async function checkHealth() {
    const indicator = document.getElementById("nullShellHealth");
    try {
      const response = await fetch("/health", { cache: "no-store" });
      indicator.className = `null-shell-health ${response.ok ? "online" : "offline"}`;
      indicator.title = response.ok ? "UI server ready" : "UI server unavailable";
    } catch (_) {
      indicator.className = "null-shell-health offline";
      indicator.title = "Companion offline";
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
