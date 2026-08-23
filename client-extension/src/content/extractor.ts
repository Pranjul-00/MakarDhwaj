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

// Visual indicator overlay when agent interacts with element
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

// Action executor in active page DOM
export function executeDOMAction(action: { type: string; selector?: string; coordinates?: [number, number]; text?: string }) {
  let targetEl: HTMLElement | null = null;

  if (action.selector) {
    try {
      targetEl = document.querySelector(action.selector) as HTMLElement;
    } catch (e) {}
  }

  if (!targetEl && action.coordinates) {
    const [x, y] = action.coordinates;
    targetEl = document.elementFromPoint(x, y) as HTMLElement;
  }

  // Fallback heuristic: if selector was button or submit
  if (!targetEl && action.selector?.includes('submit')) {
    targetEl = document.querySelector('button[type="submit"], input[type="submit"], #submit-btn, button') as HTMLElement;
  }

  if (!targetEl) {
    console.warn('[MakarDhwaj] Could not find target element for action:', action);
    return { success: false, error: 'Element not found', selector: action.selector, coordinates: action.coordinates };
  }

  try {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetEl.focus();
    highlightElement(targetEl);

    if (action.type === 'click') {
      // 1. Dispatch full pointer and mouse event cascade
      const pointerDown = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window });
      const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
      const pointerUp = new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window });
      const mouseUp = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
      
      targetEl.dispatchEvent(pointerDown);
      targetEl.dispatchEvent(mouseDown);
      targetEl.dispatchEvent(pointerUp);
      targetEl.dispatchEvent(mouseUp);
      targetEl.click();

      // 2. If it's a form submit button or inside a form, ensure form submits
      const parentForm = targetEl.closest('form');
      if (parentForm) {
        if (typeof parentForm.requestSubmit === 'function') {
          parentForm.requestSubmit(targetEl);
        } else {
          parentForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      }
    } else if (action.type === 'type' && action.text) {
      if ('value' in targetEl) {
        (targetEl as HTMLInputElement).value = action.text;
      }
      targetEl.dispatchEvent(new Event('input', { bubbles: true }));
      targetEl.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (action.type === 'scroll') {
      window.scrollBy({ top: 350, behavior: 'smooth' });
    }

    const rect = targetEl.getBoundingClientRect();
    return { 
      success: true, 
      selector: getUniqueSelector(targetEl),
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
