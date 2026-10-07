/* Device Web extension bridge v1. No network, storage, or extension API access. */
(() => {
  const VIEWER = 'https://device-web-five.vercel.app';
  // Run only in direct preview frames of the authorized, top-level viewer.
  // Do not register listeners, expose a bridge, or inspect other pages.
  if (window.parent === window || window.parent !== window.top ||
      location.ancestorOrigins?.[0] !== VIEWER || location.protocol !== 'https:' ||
      window.__deviceWebScrollBridge) return;

  // MAIN world deliberately shares this marker with the optional site helper.
  // Whichever starts first owns the bridge; a second copy is inert.
  window.__deviceWebScrollBridge = true;
  window.__deviceWebScrollExtension = true;
  const CHANNEL = 'device-web-scroll-v1';
  let connection = null;
  let suppressed = false;
  let releaseFrame = 0;
  let pendingFrame = 0;
  let lastPath = location.pathname + location.search;
  const path = () => location.pathname + location.search;
  const range = () => Math.max(0, (document.scrollingElement?.scrollHeight || 0) - innerHeight);
  const send = (type, data = {}) => {
    if (connection) parent.postMessage({ channel: CHANNEL, token: connection.token, type, path: path(), ...data }, VIEWER);
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
  for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
    addEventListener(event, release, { passive: true, capture: true });
  }
  addEventListener('message', event => {
    const data = event.data;
    if (event.source !== parent || event.origin !== VIEWER || !data || data.channel !== CHANNEL) return;
    if (data.type === 'connect' && typeof data.token === 'string' && data.token.length > 0 && data.token.length <= 100) {
      connection = { token: data.token };
      lastPath = path();
      send('ready');
      return;
    }
    if (!connection || data.token !== connection.token) return;
    if (data.type !== 'scroll-to' || data.path !== path() || !Number.isFinite(data.progress) || data.progress < 0 || data.progress > 1) return;
    suppressed = true;
    cancelAnimationFrame(pendingFrame);
    pendingFrame = 0;
    cancelAnimationFrame(releaseFrame);
    window.scrollTo({ top: data.progress * range(), left: scrollX, behavior: 'instant' });
    releaseFrame = requestAnimationFrame(() => {
      releaseFrame = requestAnimationFrame(release);
    });
  });
})();
