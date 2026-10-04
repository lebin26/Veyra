/**
 * js/utils/focusTrap.js
 * Universal Accessibility Focus Trap and Keyboard Navigation Manager
 * Strictly zero external dependencies, 100% Native Web APIs.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'area[href]:not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'iframe:not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
  '[contentEditable=true]:not([tabindex="-1"])'
].join(',');

/**
 * Traps keyboard focus within an overlay or dialog container.
 * @param {HTMLElement} container The dialog, modal, or drawer backdrop/panel element.
 * @param {Object} options Configuration options
 * @param {HTMLElement} [options.returnFocusTo] Element to restore focus to when closed. Defaults to document.activeElement at invocation.
 * @param {Function} [options.onEscape] Callback when Escape key is pressed.
 * @param {string|HTMLElement} [options.initialFocus] Specific element or selector to focus initially.
 * @returns {Function} Teardown/release function to call when the modal closes.
 */
export function trapFocus(container, options = {}) {
  if (!container) return () => {};

  const returnFocusTo = options.returnFocusTo || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const onEscape = options.onEscape || null;
  const initialFocus = options.initialFocus || null;

  // Ensure accessible dialog semantics
  if (!container.getAttribute('role')) {
    container.setAttribute('role', 'dialog');
  }
  if (!container.getAttribute('aria-modal')) {
    container.setAttribute('aria-modal', 'true');
  }

  function getFocusableElements() {
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(el => {
      // Must be visible in the DOM
      return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) &&
             window.getComputedStyle(el).visibility !== 'hidden' &&
             window.getComputedStyle(el).display !== 'none';
    });
  }

  // Set initial focus smoothly
  requestAnimationFrame(() => {
    let target = null;
    if (typeof initialFocus === 'string') {
      target = container.querySelector(initialFocus);
    } else if (initialFocus instanceof HTMLElement) {
      target = initialFocus;
    }

    if (!target) {
      const focusables = getFocusableElements();
      // Prefer the first editable input/select/textarea so user can start typing immediately
      const firstInput = focusables.find(el => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName));
      target = firstInput || focusables[0] || container;
    }

    if (target && typeof target.focus === 'function') {
      target.focus();
    }
  });

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      if (typeof onEscape === 'function') {
        e.preventDefault();
        e.stopPropagation();
        onEscape();
      }
      return;
    }

    if (e.key !== 'Tab') return;

    const focusables = getFocusableElements();
    if (focusables.length === 0) {
      e.preventDefault();
      container.focus();
      return;
    }

    const firstEl = focusables[0];
    const lastEl = focusables[focusables.length - 1];

    if (e.shiftKey) {
      // Shift + Tab: reverse wrap
      if (document.activeElement === firstEl || !container.contains(document.activeElement)) {
        e.preventDefault();
        lastEl.focus();
      }
    } else {
      // Tab: forward wrap
      if (document.activeElement === lastEl || !container.contains(document.activeElement)) {
        e.preventDefault();
        firstEl.focus();
      }
    }
  }

  container.addEventListener('keydown', handleKeyDown);

  const windowEscapeHandler = (e) => {
    if (e.key === 'Escape' && typeof onEscape === 'function') {
      if (document.body.contains(container)) {
        e.preventDefault();
        e.stopPropagation();
        onEscape();
      }
    }
  };
  window.addEventListener('keydown', windowEscapeHandler);

  let released = false;
  return function releaseFocus() {
    if (released) return;
    released = true;
    container.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keydown', windowEscapeHandler);

    if (returnFocusTo && typeof returnFocusTo.focus === 'function') {
      requestAnimationFrame(() => {
        try {
          if (document.body.contains(returnFocusTo)) {
            returnFocusTo.focus();
          }
        } catch (_) {}
      });
    }
  };
}
