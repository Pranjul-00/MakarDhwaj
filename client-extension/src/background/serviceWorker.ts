import { sanitizeScreenshot, BoundingBox } from '../services/privacyFilter';

export interface AgentLog {
  timestamp: string;
  stage: 'capture' | 'redact' | 'server' | 'execution' | 'error' | 'success';
  message: string;
  details?: any;
}

export interface AgentSessionState {
  isProcessing: boolean;
  userGoal: string;
  redactionMode: 'blackout' | 'pixelate' | 'blur';
  serverUrl: string;
  logs: AgentLog[];
  lastAction?: any;
  lastSanitizedImage?: string;
  stats: {
    redactedCount: number;
    wasmUsed: boolean;
    redactTimeMs: number;
    serverTimeMs: number;
    totalTimeMs: number;
  };
}

let sessionState: AgentSessionState = {
  isProcessing: false,
  userGoal: 'Click Submit Privacy Form',
  redactionMode: 'blackout',
  serverUrl: 'http://localhost:8080/api/v1/analyze',
  logs: [],
  stats: {
    redactedCount: 0,
    wasmUsed: false,
    redactTimeMs: 0,
    serverTimeMs: 0,
    totalTimeMs: 0
  }
};

function addLog(stage: AgentLog['stage'], message: string, details?: any) {
  const log: AgentLog = {
    timestamp: new Date().toLocaleTimeString(),
    stage,
    message,
    details
  };
  sessionState.logs.unshift(log);
  if (sessionState.logs.length > 100) sessionState.logs.pop();
  chrome.runtime.sendMessage({ action: 'STATE_UPDATED', state: sessionState }).catch(() => {});
}

export async function processVisionAgentLoop() {
  if (sessionState.isProcessing) return;
  sessionState.isProcessing = true;
  const loopStartTime = performance.now();
  addLog('capture', `Perception loop triggered for goal: "${sessionState.userGoal}"`);

  try {
    // 1. Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('No active browser tab found. Please switch to a web page.');
    }

    addLog('capture', `Active tab detected: ID=${tab.id} | URL=${tab.url?.substring(0, 60)}...`);

    // 2. Capture viewport screenshot (with fallback for Firefox/Zen and Chromium)
    let rawDataUrl: string = '';
    try {
      if (tab.windowId) {
        rawDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      } else {
        rawDataUrl = await (chrome.tabs as any).captureVisibleTab({ format: 'png' });
      }
    } catch (capErr: any) {
      addLog('capture', 'Standard window capture fallback invoked...');
      rawDataUrl = await (chrome.tabs as any).captureVisibleTab({ format: 'png' });
    }

    if (!rawDataUrl) {
      throw new Error('Failed to capture active viewport screenshot.');
    }

    // 3. Extract DOM structural metadata from content script
    addLog('capture', 'Extracting interactive DOM tree and locating PII bounding coordinates...');
    let domData: any = { elements: [], piiBoundingBoxes: [] };
    try {
      domData = await chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_DOM' });
    } catch (e) {
      addLog('capture', 'Injecting content extractor script dynamically...');
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['src/content/extractor.js']
      });
      domData = await chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_DOM' });
    }

    const interactiveCount = (domData.elements || []).length;
    const piiDetectedCount = (domData.piiBoundingBoxes || []).length;
    addLog('capture', `DOM Extracted: ${interactiveCount} interactive nodes, ${piiDetectedCount} PII fields identified`, {
      viewport: domData.viewport,
      piiBoxes: domData.piiBoundingBoxes
    });

    // 4. Run local privacy filter (Rust WASM engine)
    addLog('redact', `Executing ${sessionState.redactionMode} mask on ${piiDetectedCount} sensitive regions...`);
    const piiBoxes: BoundingBox[] = (domData.piiBoundingBoxes || []).map((b: any) => ({
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      label: b.type
    }));

    const redactRes = await sanitizeScreenshot(rawDataUrl, piiBoxes, sessionState.redactionMode);
    sessionState.lastSanitizedImage = redactRes.sanitizedBase64;
    sessionState.stats.redactedCount = redactRes.redactedCount;
    sessionState.stats.wasmUsed = redactRes.wasmAccelerated;
    sessionState.stats.redactTimeMs = redactRes.durationMs;

    addLog('redact', `Privacy filter finished in ${redactRes.durationMs}ms [WASM: ${redactRes.wasmAccelerated ? 'Active' : 'Fallback'}]`, {
      redactedCount: redactRes.redactedCount,
      durationMs: redactRes.durationMs
    });

    // 5. Send sanitized image + DOM tree to Go backend
    addLog('server', `Transmitting sanitized payload to backend (${sessionState.serverUrl})...`);
    const serverStartTime = performance.now();

    const payload = {
      user_goal: sessionState.userGoal,
      sanitized_image: redactRes.sanitizedBase64,
      viewport: domData.viewport || { width: 1280, height: 800, devicePixelRatio: 1 },
      dom_elements: domData.elements || []
    };

    const res = await fetch(sessionState.serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Backend returned HTTP ${res.status}: ${await res.text()}`);
    }

    const actionResult = await res.json();
    sessionState.stats.serverTimeMs = Math.round(performance.now() - serverStartTime);
    sessionState.lastAction = actionResult;

    addLog('server', `VLM Decision: action=${actionResult.action} on ${actionResult.selector || 'coordinates'} (${sessionState.stats.serverTimeMs}ms)`, actionResult);

    // 6. Execute action in active tab
    if (actionResult.action && actionResult.action !== 'none') {
      addLog('execution', `Dispatching ${actionResult.action.toUpperCase()} event on target: ${actionResult.selector}...`);
      const execRes = await chrome.tabs.sendMessage(tab.id, {
        action: 'EXECUTE_ACTION',
        payload: actionResult
      });

      if (execRes?.success) {
        addLog('success', `DOM Action executed successfully on <${execRes.tagName || 'ELEMENT'}> "${execRes.text || ''}"`, execRes);
      } else {
        addLog('error', `DOM execution failed: ${execRes?.error || 'Unknown element'}`, execRes);
      }
    } else {
      addLog('success', 'Goal already satisfied or scroll action completed.');
    }

    sessionState.stats.totalTimeMs = Math.round(performance.now() - loopStartTime);
  } catch (err: any) {
    addLog('error', `Perception loop failed: ${err.message}`, { stack: err.stack });
  } finally {
    sessionState.isProcessing = false;
    chrome.runtime.sendMessage({ action: 'STATE_UPDATED', state: sessionState }).catch(() => {});
  }
}

// Background Listener for Chrome Extension Messages
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'GET_STATE') {
    sendResponse(sessionState);
  } else if (message.action === 'SET_GOAL') {
    sessionState.userGoal = message.goal;
    sendResponse({ success: true });
  } else if (message.action === 'SET_MODE') {
    sessionState.redactionMode = message.mode;
    sendResponse({ success: true });
  } else if (message.action === 'START_AGENT') {
    processVisionAgentLoop();
    sendResponse({ success: true });
  } else if (message.action === 'CLEAR_LOGS') {
    sessionState.logs = [];
    sendResponse({ success: true });
  }
  return true;
});
