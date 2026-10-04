// Resultify Anti-Inspection & Integrity Guard
(function () {
  'use strict';

  function trigger403SecurityBlock(reason) {
    try {
      window.stop();
    } catch (e) {}

    // Clear all running timers
    const highestId = window.setTimeout(() => {}, 0);
    for (let i = 0; i < highestId; i++) {
      window.clearTimeout(i);
      window.clearInterval(i);
    }

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
          <p>Inspect tool, source viewer, or unauthorized debug environment detected. Access has been restricted.</p>
          <div class="code">VIOLATION: ${reason}</div>
        </div>
      </body>
      </html>
    `;

    document.head.innerHTML = "";
    throw new Error("Execution terminated by security protocol: " + reason);
  }

  // 1. Mobile In-Page Inspector (Eruda, vConsole) Real-Time Detection
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

    const shadowHost = document.querySelector('div[style*="z-index: 99999"]') || 
                       document.querySelector('div[style*="z-index: 2147483647"]');
    if (shadowHost && shadowHost.innerHTML.toLowerCase().includes("console")) {
      trigger403SecurityBlock("INJECTED_INSPECTOR_DETECTED");
    }
  }

  // 2. Remove HTML Comments from DOM Tree (Hides leaked structures in Source viewers)
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

  // 3. Desktop DevTools Keyboard Shortcuts Block
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

  // 4. Context Menu, Selection & Drag Lock
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

  // 5. Initialize Safe Guards
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", removeHtmlComments);
  } else {
    removeHtmlComments();
  }

  setInterval(detectMobileDevTools, 400);
  setInterval(removeHtmlComments, 2000);
  detectMobileDevTools();
})();
