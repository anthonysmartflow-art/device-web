/* Device Web site bridge v1.1. Inert outside an authorized viewer iframe. */
(() => {
  if (window.parent === window || window.__deviceWebScrollBridge) return;
  window.__deviceWebScrollBridge = true;
  const configured = document.currentScript?.dataset.viewerOrigin;
  const allowedOrigins = new Set(['https://device-web-five.vercel.app', location.origin]);
  if (configured) {
    try { allowedOrigins.add(new URL(configured).origin); } catch { /* Invalid config is ignored. */ }
  }
  // Shared bridge runtime: keep identical to extension/scroll-bridge.js.
  const CHANNEL = 'device-web-scroll-v1';
  const CAPABILITIES = ['interactions-v1'];
  const CONTROLS = 'button, [role="button"], [role="tab"], summary, a[aria-expanded]';
  let connection = null;
  let interactionsEnabled = false;
  let sequence = 0;
  let suppressed = false;
  let releaseFrame = 0;
  let pendingFrame = 0;
  let lastPath = location.pathname + location.search;
  const path = () => location.pathname + location.search;
  const range = () => Math.max(0, (document.scrollingElement?.scrollHeight || 0) - innerHeight);
  const send = (type, data = {}) => {
    if (connection) parent.postMessage({ channel: CHANNEL, token: connection.token, type, path: path(), ...data }, connection.origin);
  };
  const ready = () => { lastPath = path(); send('ready', { capabilities: CAPABILITIES }); };
  const routeChanged = () => { if (connection && path() !== lastPath) ready(); };
  function release() {
    suppressed = false;
    cancelAnimationFrame(releaseFrame);
  }
  function suppressScroll() {
    suppressed = true;
    cancelAnimationFrame(pendingFrame);
    pendingFrame = 0;
    cancelAnimationFrame(releaseFrame);
    releaseFrame = requestAnimationFrame(() => { releaseFrame = requestAnimationFrame(release); });
  }
  function report() {
    pendingFrame = 0;
    if (!connection || suppressed) return;
    routeChanged();
    const max = range();
    if (max > 0) send('scroll', { progress: Math.max(0, Math.min(1, scrollY / max)) });
  }
  addEventListener('scroll', () => {
    if (!suppressed && !pendingFrame) pendingFrame = requestAnimationFrame(report);
  }, { passive: true });
  for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
    addEventListener(event, release, { passive: true, capture: true });
  }
  window.navigation?.addEventListener('currententrychange', routeChanged);
  addEventListener('popstate', routeChanged);
  addEventListener('hashchange', routeChanged);

  const text = value => (value || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  const label = element => text(element.getAttribute('aria-label') ||
    element.getAttribute('aria-labelledby')?.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ') || element.textContent);
  const visible = element => !!element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
  const excluded = element => !!element.closest('form, [contenteditable]:not([contenteditable="false"]), [data-device-web-sync="off"], [inert]') ||
    element.disabled || element.getAttribute('aria-disabled') === 'true' || !!element.form;
  function kind(element) {
    if (!element || excluded(element)) return '';
    if (element.tagName === 'SUMMARY' && element.parentElement?.tagName === 'DETAILS') return 'details';
    if (element.getAttribute('role') === 'tab' && /^(true|false)$/.test(element.getAttribute('aria-selected'))) return 'tab';
    if (/^(true|false)$/.test(element.getAttribute('aria-expanded'))) return 'disclosure';
    return '';
  }
  function state(element, type) {
    if (type === 'details') return element.parentElement.open;
    return element.getAttribute(type === 'tab' ? 'aria-selected' : 'aria-expanded') === 'true';
  }
  function describe(element, type) {
    const group = element.closest('[role="tablist"]');
    return {
      kind: type, key: text(element.getAttribute('data-device-web-id')), id: text(element.id),
      controls: text(element.getAttribute('aria-controls')), label: label(element),
      group: group ? text(group.getAttribute('aria-label') || group.id) : '',
    };
  }
  function matchControl(target) {
    if (!target || !['tab', 'disclosure', 'details'].includes(target.kind)) return null;
    for (const field of ['key', 'id', 'controls', 'label', 'group']) {
      if (typeof target[field] !== 'string' || target[field].length > 160) return null;
    }
    const candidates = [...document.querySelectorAll(CONTROLS)]
      .filter(element => kind(element) === target.kind && visible(element))
      .map(element => ({ element, description: describe(element, target.kind) }));
    // Prefer stable identities over text or DOM position. Never guess between
    // multiple matching controls, or click a control hidden at this breakpoint.
    for (const field of ['key', 'id', 'controls', 'label']) {
      if (!target[field]) continue;
      const matches = candidates.filter(({ description }) => description[field] === target[field] &&
        (field !== 'label' || !target.group || description.group === target.group));
      if (matches.length === 1) return matches[0].element;
      if (matches.length > 1) return null;
    }
    return null;
  }
  function safeUrl(value) {
    if (typeof value !== 'string' || value.length > 10000) return null;
    try {
      const url = new URL(value, location.href);
      if (url.origin !== location.origin || !/^https?:$/.test(url.protocol) || url.username || url.password) return null;
      // Recognizable account/payment actions and file downloads stay local.
      if (/(?:^|[\/\W_])(logout|log-out|signout|sign-out|delete|remove|checkout|purchase|unsubscribe)(?:$|[\/\W_])/i.test(decodeURIComponent(url.pathname + url.search))) return null;
      return url;
    } catch { return null; }
  }
  function linkUrl(element) {
    if (!element || excluded(element) || element.hasAttribute('download') ||
        (element.target && element.target !== '_self')) return null;
    return safeUrl(element.href);
  }
  function sendControl(element, target, before, sourcePath, token) {
    // React and native <details> have finished processing the initiating event.
    requestAnimationFrame(() => {
      if (!connection || connection.token !== token || !interactionsEnabled || path() !== sourcePath || !element.isConnected) return;
      const after = state(element, target.kind);
      if (before !== after) send('interaction', { id: ++sequence, action: { type: 'control', target, state: after } });
    });
  }
  addEventListener('click', event => {
    if (!connection || !interactionsEnabled || !event.isTrusted || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const element = event.target?.closest?.(CONTROLS);
    const type = kind(element);
    if (type) {
      sendControl(element, describe(element, type), state(element, type), path(), connection.token);
      return;
    }
    const link = event.target?.closest?.('a[href]');
    const url = linkUrl(link);
    if (!url) return;
    // Report the destination, not pointer coordinates: navigation is shared
    // even when the phone and desktop have completely different menus.
    send('interaction', { id: ++sequence, action: { type: 'navigate', url: url.href } });
  }, { capture: true });
  addEventListener('keydown', event => {
    if (!connection || !interactionsEnabled || !event.isTrusted) return;
    if (event.key === 'Escape') {
      for (const element of document.querySelectorAll(CONTROLS)) {
        const type = kind(element);
        if (type === 'disclosure' && state(element, type) && visible(element)) {
          sendControl(element, describe(element, type), true, path(), connection.token);
        }
      }
    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      const group = event.target?.closest?.('[role="tablist"]');
      for (const element of group?.querySelectorAll('[role="tab"]') || []) {
        if (kind(element) === 'tab') sendControl(element, describe(element, 'tab'), state(element, 'tab'), path(), connection.token);
      }
    }
  }, { capture: true });

  addEventListener('message', event => {
    const data = event.data;
    if (event.source !== parent || !allowedOrigins.has(event.origin) || !data || data.channel !== CHANNEL) return;
    if (data.type === 'connect' && typeof data.token === 'string' && data.token.length > 0 && data.token.length <= 100) {
      if (connection?.token !== data.token) { interactionsEnabled = false; sequence = 0; }
      connection = { origin: event.origin, token: data.token };
      ready();
      return;
    }
    if (!connection || event.origin !== connection.origin || data.token !== connection.token) return;
    if (data.type === 'configure-interactions' && typeof data.enabled === 'boolean') {
      interactionsEnabled = data.enabled;
      return;
    }
    if (data.type === 'apply-interaction') {
      if (!interactionsEnabled || data.path !== path() || !data.action) return;
      const action = data.action;
      if (action.type === 'control' && typeof action.state === 'boolean') {
        const element = matchControl(action.target);
        // Inactive tabs are cleared by selecting their peer, never by toggling.
        if (!element || (action.target.kind === 'tab' && !action.state) || state(element, action.target.kind) === action.state) return;
        suppressScroll();
        element.click(); // Untrusted synthetic clicks are never broadcast again.
      } else if (action.type === 'navigate') {
        const url = safeUrl(action.url);
        if (!url || url.href === location.href) return;
        suppressScroll();
        const links = [...document.querySelectorAll('a[href]')].filter(element => visible(element) && linkUrl(element)?.href === url.href);
        if (links.length) links[0].click(); // Preserve client-side routing where available.
        else location.assign(url.href); // A destination may be inside a closed mobile menu.
      }
      return;
    }
    if (data.type !== 'scroll-to' || data.path !== path() || !Number.isFinite(data.progress) || data.progress < 0 || data.progress > 1) return;
    suppressScroll();
    window.scrollTo({ top: data.progress * range(), left: scrollX, behavior: 'instant' });
  });
})();
