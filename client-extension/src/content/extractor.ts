export interface DOMNodeMeta {
  id: string;
  tag: string;
  type?: string;
  selector: string;
  text?: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isInteractive: boolean;
  isSensitive: boolean;
}

export interface ExtractDOMResult {
  viewport: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
  url: string;
  title: string;
  elements: DOMNodeMeta[];
  piiBoundingBoxes: Array<{ x: number; y: number; width: number; height: number; type: string }>;
}

// Generate unique CSS selector for element
function getUniqueSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  if (el.getAttribute('name')) return `${el.tagName.toLowerCase()}[name="${el.getAttribute('name')}"]`;
  
  let path: string[] = [];
  let current: Element | null = el;
  while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    if (current.className && typeof current.className === 'string' && current.className.trim()) {
      const firstClass = current.className.trim().split(/\s+/)[0];
      if (firstClass && !firstClass.includes(':')) {
        selector += `.${firstClass}`;
      }
    }
    path.unshift(selector);
    current = current.parentElement;
  }
  return path.join(' > ');
}

export function extractDOMState(): ExtractDOMResult {
  const elements: DOMNodeMeta[] = [];
  const piiBoxes: Array<{ x: number; y: number; width: number; height: number; type: string }> = [];

  const candidateSelector = 'button, input, select, textarea, a, [role="button"], [role="link"], [onclick], form';
  const nodes = document.querySelectorAll(candidateSelector);

  let nodeCounter = 0;

  nodes.forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const isVisible = rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;
    if (!isVisible) return;

    const inputType = (el as HTMLInputElement).type ? (el as HTMLInputElement).type.toLowerCase() : '';
    const isPassword = inputType === 'password';
    const isSensitiveInput = isPassword || 
      el.id.toLowerCase().includes('card') || 
      el.id.toLowerCase().includes('cvv') ||
      el.id.toLowerCase().includes('ssn') ||
      el.id.toLowerCase().includes('pass') ||
      el.getAttribute('name')?.toLowerCase().includes('pass') ||
      el.getAttribute('name')?.toLowerCase().includes('card') || false;

    // Detect potential PII fields in DOM tree for immediate masking
    if (isSensitiveInput || inputType === 'email' || inputType === 'tel') {
      piiBoxes.push({
        x: Math.round(rect.left * window.devicePixelRatio),
        y: Math.round(rect.top * window.devicePixelRatio),
        width: Math.round(rect.width * window.devicePixelRatio),
        height: Math.round(rect.height * window.devicePixelRatio),
        type: isPassword ? 'PASSWORD' : 'PII_INPUT'
      });
    }

    // Extract text safely without exposing input values
    let safeText = '';
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      safeText = `[Input: ${inputType || 'text'}]`;
    } else {
      safeText = (el.textContent || '').trim().substring(0, 60);
    }

    nodeCounter++;
    elements.push({
      id: `elem_${nodeCounter}`,
      tag: el.tagName.toLowerCase(),
      type: inputType || undefined,
      selector: getUniqueSelector(el),
      text: safeText,
      bounds: {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      isInteractive: true,
      isSensitive: isSensitiveInput
    });
  });

  return {
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1
    },
    url: window.location.href,
    title: document.title,
    elements,
    piiBoundingBoxes: piiBoxes
  };
}

// Visual indicator outline when agent interacts with element
function highlightElement(el: HTMLElement) {
  const origOutline = el.style.outline;
  const origTransition = el.style.transition;
  el.style.transition = 'outline 0.15s ease-in-out';
  el.style.outline = '3px solid #dc2626';
  setTimeout(() => {
    el.style.outline = origOutline;
    el.style.transition = origTransition;
  }, 1000);
}

type SupportedDOMAction = 'click' | 'type' | 'scroll' | 'none';

interface DOMAction {
  action: SupportedDOMAction;
  selector?: string;
  coordinates?: [number, number];
  text?: string;
}

function isSupportedDOMAction(value: unknown): value is SupportedDOMAction {
  return value === 'click' || value === 'type' || value === 'scroll' || value === 'none';
}

function parseDOMAction(value: unknown): DOMAction | null {
  if (typeof value !== 'object' || value === null) return null;

  const actionValue = Reflect.get(value, 'action');
  if (!isSupportedDOMAction(actionValue)) return null;

  const selectorValue = Reflect.get(value, 'selector');
  if (selectorValue !== undefined && typeof selectorValue !== 'string') return null;

  const textValue = Reflect.get(value, 'text');
  if (textValue !== undefined && typeof textValue !== 'string') return null;

  const coordinatesValue = Reflect.get(value, 'coordinates');
  let coordinates: [number, number] | undefined;
  if (coordinatesValue !== undefined) {
    if (
      !Array.isArray(coordinatesValue) ||
      coordinatesValue.length !== 2 ||
      typeof coordinatesValue[0] !== 'number' ||
      !Number.isFinite(coordinatesValue[0]) ||
      typeof coordinatesValue[1] !== 'number' ||
      !Number.isFinite(coordinatesValue[1])
    ) {
      return null;
    }
    coordinates = [coordinatesValue[0], coordinatesValue[1]];
  }

  return {
    action: actionValue,
    selector: selectorValue,
    coordinates,
    text: textValue
  };
}

// Action executor in active page DOM
export function executeDOMAction(payload: unknown) {
  const action = parseDOMAction(payload);
  if (!action) {
    return { success: false, error: 'Invalid or unsupported action payload' };
  }

  if (action.action === 'none') {
    return { success: true, action: 'none' };
  }

  if (action.action === 'scroll') {
    window.scrollBy({ top: 350, behavior: 'smooth' });
    return { success: true, action: 'scroll' };
  }

  let targetEl: HTMLElement | null = null;

  if (action.selector) {
    try {
      targetEl = document.querySelector<HTMLElement>(action.selector);
    } catch {
      return { success: false, error: 'Invalid target selector', selector: action.selector };
    }
  }

  if (!targetEl && action.coordinates) {
    const [x, y] = action.coordinates;
    const coordinateTarget = document.elementFromPoint(x, y);
    if (coordinateTarget instanceof HTMLElement) targetEl = coordinateTarget;
  }

  // Fallback heuristic: if selector was button or submit
  if (!targetEl && action.selector?.includes('submit')) {
    targetEl = document.querySelector<HTMLElement>('button[type="submit"], input[type="submit"], #submit-btn, button');
  }

  if (!targetEl) {
    console.warn('[MakarDhwaj] Target element not found:', action);
    return { success: false, error: 'Element not found', selector: action.selector };
  }

  const exactSelector = getUniqueSelector(targetEl);

  try {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetEl.focus();
    highlightElement(targetEl);

    if (action.action === 'click') {
      if (
        (targetEl instanceof HTMLButtonElement || targetEl instanceof HTMLInputElement) &&
        targetEl.disabled
      ) {
        return { success: false, error: 'Target element is disabled', selector: exactSelector };
      }

      // HTMLElement.click() dispatches one click and preserves the element's native
      // default behavior, including form submission in Firefox/Zen and Chromium.
      targetEl.click();
    } else if (action.action === 'type') {
      if (!(targetEl instanceof HTMLInputElement || targetEl instanceof HTMLTextAreaElement)) {
        return { success: false, error: 'Type action requires an input or textarea', selector: exactSelector };
      }
      if (action.text === undefined) {
        return { success: false, error: 'Type action requires text', selector: exactSelector };
      }

      targetEl.value = action.text;
      targetEl.dispatchEvent(new Event('input', { bubbles: true }));
      targetEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const rect = targetEl.getBoundingClientRect();
    return { 
      success: true, 
      selector: exactSelector,
      tagName: targetEl.tagName,
      text: targetEl.textContent?.trim().substring(0, 30),
      bounds: { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) }
    };
  } catch (err: any) {
    return { success: false, error: err.toString(), selector: action.selector };
  }
}

// Global Chrome Extension Message Listener
if (typeof window !== 'undefined' && typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'EXTRACT_DOM') {
      const state = extractDOMState();
      sendResponse(state);
    } else if (request.action === 'EXECUTE_ACTION') {
      const result = executeDOMAction(request.payload);
      sendResponse(result);
    }
    return true;
  });
}
