/* Device Web scroll bridge v1. Inert outside an authorized viewer iframe. */
(() => {
  if (window.parent === window || window.__deviceWebScrollBridge) return;
  window.__deviceWebScrollBridge = true;
  const CHANNEL = 'device-web-scroll-v1';
  const configured = document.currentScript?.dataset.viewerOrigin;
  const allowedOrigins = new Set(['https://device-web-five.vercel.app', location.origin]);
  if (configured) {
    try { allowedOrigins.add(new URL(configured).origin); } catch { /* Invalid config is ignored. */ }
  }
  let connection = null;
  let suppressed = false;
  let releaseFrame = 0;
  let pendingFrame = 0;
  let lastPath = location.pathname + location.search;
  const path = () => location.pathname + location.search;
  const range = () => Math.max(0, (document.scrollingElement?.scrollHeight || 0) - innerHeight);
  const send = (type, data = {}) => {
    if (connection) parent.postMessage({ channel: CHANNEL, token: connection.token, type, path: path(), ...data }, connection.origin);
  };
  function release() {
    suppressed = false;
    cancelAnimationFrame(releaseFrame);
  }
  function report() {
    pendingFrame = 0;
    if (!connection || suppressed) return;
    if (path() !== lastPath) {
      lastPath = path();
      send('ready');
    }
    const max = range();
    if (max > 0) send('scroll', { progress: Math.max(0, Math.min(1, scrollY / max)) });
  }
  addEventListener('scroll', () => {
    if (!suppressed && !pendingFrame) pendingFrame = requestAnimationFrame(report);
  }, { passive: true });
  // A real input immediately takes control, even if a remote scroll just arrived.
  for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
    addEventListener(event, release, { passive: true, capture: true });
  }
  addEventListener('message', event => {
    const data = event.data;
    if (event.source !== parent || !allowedOrigins.has(event.origin) || !data || data.channel !== CHANNEL) return;
    if (data.type === 'connect' && typeof data.token === 'string' && data.token.length <= 100) {
      connection = { origin: event.origin, token: data.token };
      lastPath = path();
      send('ready');
      return;
    }
    if (!connection || event.origin !== connection.origin || data.token !== connection.token) return;
    if (data.type !== 'scroll-to' || data.path !== path() || !Number.isFinite(data.progress) || data.progress < 0 || data.progress > 1) return;
    suppressed = true;
    cancelAnimationFrame(pendingFrame);
    pendingFrame = 0;
    cancelAnimationFrame(releaseFrame);
    // Instant scroll avoids smooth-scroll feedback loops; user input remains natural.
    window.scrollTo({ top: data.progress * range(), left: scrollX, behavior: 'instant' });
    releaseFrame = requestAnimationFrame(() => {
      releaseFrame = requestAnimationFrame(release);
    });
  });
  // No URL, content, cookies, or form data is transmitted. No network requests.
})();
