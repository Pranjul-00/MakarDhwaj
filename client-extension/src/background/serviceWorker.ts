import { sanitizeScreenshot, BoundingBox } from '../services/privacyFilter';

export interface AgentLog {
  timestamp: string;
  stage: 'capture' | 'redact' | 'server' | 'execution' | 'error';
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
  userGoal: 'Click the primary action button on screen',
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
  if (sessionState.logs.length > 50) sessionState.logs.pop();
  chrome.runtime.sendMessage({ action: 'STATE_UPDATED', state: sessionState }).catch(() => {});
}

export async function processVisionAgentLoop() {
  if (sessionState.isProcessing) return;
  sessionState.isProcessing = true;
  const loopStartTime = performance.now();
  addLog('capture', `Starting perception loop for goal: "${sessionState.userGoal}"`);

  try {
    // 1. Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('No active browser tab found');
    }

    // 2. Capture viewport screenshot
    addLog('capture', 'Capturing viewport screenshot...');
    const rawDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

    // 3. Extract DOM structural metadata from content script
    addLog('capture', 'Extracting structural DOM metadata and input locations...');
    let domData: any = { elements: [], piiBoundingBoxes: [] };
    try {
      domData = await chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_DOM' });
    } catch (e) {
      addLog('capture', 'Content script injection fallback required...');
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['src/content/extractor.js']
      });
      domData = await chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_DOM' });
    }

    // 4. Run local privacy filter (WASM / WebGPU accelerated)
    addLog('redact', `Applying ${sessionState.redactionMode} filter on detected PII elements...`);
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

    addLog('redact', `Sanitized ${redactRes.redactedCount} regions in ${redactRes.durationMs}ms (WASM: ${redactRes.wasmAccelerated})`);

    // 5. Send sanitized image + DOM tree to Go backend
    addLog('server', `Sending payload to backend reasoning engine (${sessionState.serverUrl})...`);
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
      throw new Error(`Server returned HTTP ${res.status}: ${await res.text()}`);
    }

    const actionResult = await res.json();
    sessionState.stats.serverTimeMs = Math.round(performance.now() - serverStartTime);
    sessionState.lastAction = actionResult;

    addLog('server', `VLM suggested action: ${actionResult.action} (Confidence: ${actionResult.confidence || '100%'})`, actionResult);

    // 6. Execute action in active tab
    if (actionResult.action && actionResult.action !== 'none') {
      addLog('execution', `Dispatching DOM event for ${actionResult.action} on tab...`);
      const execRes = await chrome.tabs.sendMessage(tab.id, {
        action: 'EXECUTE_ACTION',
        payload: actionResult
      });
      addLog('execution', `Execution complete: ${JSON.stringify(execRes)}`);
    } else {
      addLog('execution', 'Goal completed or no action required.');
    }

    sessionState.stats.totalTimeMs = Math.round(performance.now() - loopStartTime);
  } catch (err: any) {
    addLog('error', `Agent loop failed: ${err.message}`);
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
  }
  return true;
});
