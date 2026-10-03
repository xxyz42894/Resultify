// Resultify Live Diagnostic Logger Widget
// To completely remove in production, simply remove its <script> tag from index.html

(function() {
  const ENABLE_LOGGER = true;
  if (!ENABLE_LOGGER) return;

  const logs = [];
  const MAX_LOGS = 40;

  const container = document.createElement("div");
  container.id = "resultify-debugger-widget";
  container.style.cssText = "position:fixed;bottom:16px;left:16px;z-index:99999;font-family:monospace;font-size:12px;";

  const button = document.createElement("button");
  button.style.cssText = "background:#0f172a;color:#38bdf8;border:1px solid #38bdf8;padding:8px 14px;border-radius:24px;box-shadow:0 4px 14px rgba(0,0,0,0.4);cursor:pointer;display:flex;align-items:center;gap:6px;font-weight:bold;";
  button.innerHTML = `<span>🐞 Logs</span> <span id="debug-badge" style="background:#ef4444;color:white;border-radius:10px;padding:1px 6px;font-size:10px;display:none;">0</span>`;

  const panel = document.createElement("div");
  panel.style.cssText = "display:none;position:fixed;bottom:64px;left:16px;width:calc(100vw - 32px);max-width:540px;height:360px;background:#090d16;color:#e2e8f0;border:1px solid #1e293b;border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,0.6);flex-direction:column;overflow:hidden;";

  const header = document.createElement("div");
  header.style.cssText = "padding:10px 14px;background:#0f172a;border-bottom:1px solid #1e293b;display:flex;justify-content:space-between;align-items:center;";
  header.innerHTML = `
    <span style="font-weight:bold;color:#38bdf8;">Resultify Diagnostic Console</span>
    <div style="display:flex;gap:8px;">
      <button id="debug-copy-btn" style="background:#1e293b;color:#cbd5e1;border:none;padding:4px 8px;border-radius:6px;cursor:pointer;">Copy</button>
      <button id="debug-clear-btn" style="background:#1e293b;color:#cbd5e1;border:none;padding:4px 8px;border-radius:6px;cursor:pointer;">Clear</button>
      <button id="debug-close-btn" style="background:#ef4444;color:white;border:none;padding:4px 8px;border-radius:6px;cursor:pointer;">✕</button>
    </div>
  `;

  const body = document.createElement("div");
  body.id = "debug-log-list";
  body.style.cssText = "flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px;";

  panel.appendChild(header);
  panel.appendChild(body);
  container.appendChild(button);
  container.appendChild(panel);
  document.body.appendChild(container);

  let errorCount = 0;
  const badge = container.querySelector("#debug-badge");

  function addLog(type, message, source = "", line = "") {
    const time = new Date().toLocaleTimeString();
    const entry = { type, message, source, line, time };
    logs.push(entry);
    if (logs.length > MAX_LOGS) logs.shift();

    if (type === "ERROR") {
      errorCount++;
      badge.textContent = errorCount;
      badge.style.display = "inline-block";
    }

    renderLogs();
  }

  function renderLogs() {
    body.innerHTML = logs.length === 0 ? `<div style="color:#64748b;text-align:center;padding:40px 0;">No errors detected. Everything running smooth!</div>` : "";
    logs.forEach(log => {
      const item = document.createElement("div");
      const isErr = log.type === "ERROR";
      item.style.cssText = `padding:8px 10px;border-radius:8px;background:${isErr ? "#1f1315" : "#0f172a"};border-left:3px solid ${isErr ? "#ef4444" : "#38bdf8"};font-size:11px;word-break:break-word;`;
      item.innerHTML = `
        <div style="display:flex;justify-content:space-between;color:${isErr ? "#fca5a5" : "#94a3b8"};font-weight:bold;margin-bottom:2px;">
          <span>[${log.type}] ${log.time}</span>
          <span>${log.line ? `Line: ${log.line}` : ""}</span>
        </div>
        <div style="color:${isErr ? "#f87171" : "#f1f5f9"};margin-bottom:2px;">${log.message}</div>
        ${log.source ? `<div style="color:#64748b;font-size:10px;">Source: ${log.source}</div>` : ""}
      `;
      body.appendChild(item);
    });
    body.scrollTop = body.scrollHeight;
  }

  button.addEventListener("click", () => {
    panel.style.display = panel.style.display === "none" ? "flex" : "none";
  });
  header.querySelector("#debug-close-btn").addEventListener("click", () => { panel.style.display = "none"; });
  header.querySelector("#debug-clear-btn").addEventListener("click", () => {
    logs.length = 0;
    errorCount = 0;
    badge.style.display = "none";
    renderLogs();
  });
  header.querySelector("#debug-copy-btn").addEventListener("click", () => {
    navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
    alert("Diagnostic logs copied to clipboard!");
  });

  window.addEventListener("error", (e) => {
    addLog("ERROR", e.message, e.filename ? e.filename.split("/").pop() : "Script", e.lineno);
  });

  window.addEventListener("unhandledrejection", (e) => {
    const msg = e.reason?.message || String(e.reason);
    addLog("ERROR", `Unhandled Rejection: ${msg}`);
  });

  const origError = console.error;
  console.error = function(...args) {
    origError.apply(console, args);
    const text = args.map(a => {
      if (a instanceof Error) return a.message;
      if (a && typeof a === "object" && a.message) return a.message;
      if (typeof a === "object") {
        try { return JSON.stringify(a); } catch { return String(a); }
      }
      return String(a);
    }).join(" ");
    addLog("ERROR", text);
  };

  renderLogs();
})();