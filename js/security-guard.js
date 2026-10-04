// Resultify Maximum Security & Anti-Inspection Protocol

// Security Guard is temporarily disabled for development & debugging.
console.log("[Dev Mode] Security Guard Disabled for Debugging.");

 (function () {
  'use strict';

  // 1. Instant 403 Page Render & Memory Wiper
  function trigger403SecurityBlock(reason) {
    try {
      window.stop();
    } catch (e) {}

    // Kill all running background timers
    const highestId = window.setTimeout(() => {}, 0);
    for (let i = 0; i < highestId; i++) {
      window.clearTimeout(i);
      window.clearInterval(i);
    }

    // Completely wipe and replace DOM to hide original source tree
    document.documentElement.innerHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>403 - Forbidden Security Protocol</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background-color: #121820;
            color: #E8E2D5;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 20px;
            user-select: none;
          }
          .card {
            background: #1B2834;
            border: 1px solid #BE123C;
            padding: 30px 20px;
            border-radius: 20px;
            max-width: 360px;
            width: 100%;
            box-shadow: 0 10px 40px rgba(0,0,0,0.6);
          }
          .badge {
            display: inline-block;
            background: rgba(190, 18, 60, 0.15);
            color: #BE123C;
            font-weight: 800;
            font-size: 11px;
            padding: 4px 10px;
            border-radius: 8px;
            margin-bottom: 12px;
            border: 1px solid rgba(190,18,60,0.3);
          }
          h1 { font-size: 19px; font-weight: bold; color: #FFFFFF; margin-bottom: 8px; }
          p { font-size: 12px; color: #8F9CA8; line-height: 1.6; margin-bottom: 18px; }
          .code {
            font-family: monospace;
            font-size: 10px;
            color: #BE123C;
            background: rgba(0,0,0,0.35);
            padding: 8px;
            border-radius: 8px;
            word-break: break-all;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <span class="badge">403 ACCESS TERMINATED</span>
          <h1>Security Policy Violation</h1>
          <p>Inspect tool, source viewer, debugger, or proxy protocol detected. Console access is permanently blocked.</p>
          <div class="code">VIOLATION: ${reason}</div>
        </div>
      </body>
      </html>
    `;

    document.head.innerHTML = "";
    throw new Error("Execution terminated by security protocol: " + reason);
  }

  // 2. Mobile In-Page Inspector (Eruda, vConsole, Floating Widgets) Killer
  function detectMobileDevTools() {
    if (
      window.eruda || 
      document.getElementById('eruda') || 
      document.querySelector('.eruda-container') || 
      document.querySelector('div[class*="eruda"]')
    ) {
      trigger403SecurityBlock("MOBILE_ERUDA_DEVTOOLS_DETECTED");
    }

    if (
      window.vConsole || 
      document.getElementById('__vconsole') || 
      document.querySelector('.vc-panel') || 
      document.querySelector('div[class*="vconsole"]')
    ) {
      trigger403SecurityBlock("MOBILE_VCONSOLE_DETECTED");
    }

    // High z-index injected inspector shadow elements
    const shadowHost = document.querySelector('div[style*="z-index: 99999"]') || 
                       document.querySelector('div[style*="z-index: 2147483647"]');
    if (shadowHost && shadowHost.innerHTML.toLowerCase().includes("console")) {
      trigger403SecurityBlock("INJECTED_INSPECTOR_DETECTED");
    }
  }

  // 3. Clean All HTML Comments from DOM Tree (Hides leaked comments in Sources)
  function removeHtmlComments() {
    const iterator = document.createNodeIterator(
      document.documentElement,
      NodeFilter.SHOW_COMMENT,
      () => NodeFilter.FILTER_ACCEPT,
      false
    );
    let curNode;
    while ((curNode = iterator.nextNode())) {
      curNode.remove();
    }
  }

  // 4. High-Frequency Console Overwrite & Trap
  try {
    Object.defineProperty(window, 'console', {
      get: function () {
        trigger403SecurityBlock("CONSOLE_OBJECT_ACCESSED");
      },
      set: function () {}
    });
  } catch (e) {}

  // 5. Continuous Hard Debugger Loop (Freezes execution if inspector opened)
  const antiDebug = function () {
    const startTime = performance.now();
    (function () {
      return false;
    }
    ["constructor"]("debugger")());
    const endTime = performance.now();
    if (endTime - startTime > 70) {
      trigger403SecurityBlock("DEBUGGER_PAUSE_DETECTED");
    }
  };

  // 6. Keyboard Shortcuts Block (Desktop & Mobile Hardware Keyboard)
  window.addEventListener('keydown', function (e) {
    if (
      e.key === 'F12' || 
      e.keyCode === 123 ||
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C' || e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) ||
      (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.keyCode === 85)) ||
      (e.metaKey && e.altKey && (e.key === 'i' || e.key === 'j' || e.key === 'c'))
    ) {
      e.preventDefault();
      e.stopPropagation();
      trigger403SecurityBlock("DEVTOOLS_KEYBOARD_ATTEMPT");
    }
  }, true);

  // 7. Context Menu, Selection & Drag Lock
  window.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    return false;
  }, true);

  window.addEventListener('dragstart', function (e) {
    e.preventDefault();
  }, false);

  window.addEventListener('selectstart', function (e) {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  }, true);

  // 8. Fast Real-Time VPN / Proxy Verification Hook
  async function verifyConnectionIntegrity() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch("https://ipapi.co/json/", { signal: timeoutId.signal });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json();
        const org = (data.org || "").toLowerCase();
        const asn = (data.asn || "").toLowerCase();
        
        const isSuspicious = 
          org.includes("hosting") || 
          org.includes("vpn") || 
          org.includes("proxy") || 
          org.includes("cloud") ||
          asn.includes("hosting");

        if (isSuspicious) {
          trigger403SecurityBlock("SUSPICIOUS_VPN_PROXY_IP");
        }
      }
    } catch (err) {}
  }

  // Bind Listeners & Intervals
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", removeHtmlComments);
  } else {
    removeHtmlComments();
  }

  setInterval(detectMobileDevTools, 300);
  setInterval(antiDebug, 800);
  setInterval(removeHtmlComments, 2000);
  verifyConnectionIntegrity();
  detectMobileDevTools();
})();


