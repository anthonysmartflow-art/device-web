const CHANNEL = 'device-web-scroll-v1';

export class ScrollSync {
  constructor({ onChange, isAllDevices }) {
    this.frames = new Map();
    this.enabled = true;
    this.interactionsEnabled = true;
    this.onChange = onChange;
    this.isAllDevices = isAllDevices;
    this.lastStatus = null;
    window.addEventListener('message', event => this.receive(event));
  }

  clear() {
    for (const record of this.frames.values()) {
      clearTimeout(record.retry);
      record.frame.removeEventListener('load', record.onLoad);
    }
    this.frames.clear();
    this.notify();
  }

  add(frame, url) {
    const record = {
      frame, origin: new URL(url).origin, token: crypto.randomUUID(),
      ready: false, interactions: false, lastInteraction: 0, pendingNavigation: null,
      path: '', retry: null, onLoad: null,
    };
    this.frames.set(frame, record);
    const connect = () => frame.contentWindow?.postMessage({ channel: CHANNEL, type: 'connect', token: record.token }, record.origin);
    // Existing v1 helpers can answer before images, fonts and third-party embeds
    // finish loading. Probe locally; do not make additional network requests.
    let attempts = 0;
    const probe = () => {
      if (!this.frames.has(frame) || record.ready || attempts >= 36) return;
      connect();
      attempts++;
      record.retry = setTimeout(probe, attempts < 8 ? 250 : 1000);
    };
    record.onLoad = () => {
      if (!this.frames.has(frame)) return;
      clearTimeout(record.retry);
      record.ready = false;
      record.interactions = false;
      record.lastInteraction = 0;
      record.path = '';
      record.token = crypto.randomUUID();
      this.notify();
      attempts = 0;
      probe();
    };
    frame.addEventListener('load', record.onLoad);
    // Let the caller attach the iframe and start its navigation first.
    record.retry = setTimeout(probe, 100);
  }

  receive(event) {
    const record = [...this.frames.values()].find(item => item.frame.contentWindow === event.source);
    const data = event.data;
    if (!record || event.origin !== record.origin || !data || data.channel !== CHANNEL || data.token !== record.token) return;
    if (typeof data.path !== 'string' || data.path.length > 10000) return;
    if (data.type === 'ready') {
      record.ready = true;
      record.path = data.path;
      record.interactions = Array.isArray(data.capabilities) && data.capabilities.includes('interactions-v1');
      clearTimeout(record.retry);
      this.configureInteractions(record);
      if (record.interactions && record.pendingNavigation && this.interactionsEnabled && this.isAllDevices()) {
        this.applyInteraction(record, record.pendingNavigation);
      }
      record.pendingNavigation = null;
      this.notify();
      return;
    }
    if (data.type === 'interaction') {
      if (!record.ready || !record.interactions || !this.interactionsEnabled || !this.isAllDevices() || data.path !== record.path ||
          !Number.isSafeInteger(data.id) || data.id <= record.lastInteraction) return;
      const action = this.validAction(data.action, record.origin);
      if (!action) return;
      record.lastInteraction = data.id;
      for (const target of this.frames.values()) {
        if (target === record || target.origin !== record.origin) continue;
        if (!target.ready && action.type === 'navigate') { target.pendingNavigation = action; continue; }
        if (!target.ready || !target.interactions || (action.type === 'control' && target.path !== data.path)) continue;
        this.applyInteraction(target, action);
      }
      return;
    }
    if (data.type !== 'scroll' || !record.ready || !this.enabled || !this.isAllDevices()) return;
    if (!Number.isFinite(data.progress) || data.progress < 0 || data.progress > 1) return;
    const pathChanged = record.path !== data.path;
    record.path = data.path;
    for (const target of this.frames.values()) {
      if (target === record || !target.ready || target.path !== data.path) continue;
      target.frame.contentWindow?.postMessage({ channel: CHANNEL, type: 'scroll-to', token: target.token, path: data.path, progress: data.progress }, target.origin);
    }
    // Scroll position does not change the toolbar. Keep DOM writes completely
    // out of the normal scroll relay rather than delaying the relay itself.
    if (pathChanged) this.notify();
  }

  toggle() {
    this.enabled = !this.enabled;
    this.notify();
  }

  toggleInteractions() {
    this.interactionsEnabled = !this.interactionsEnabled;
    this.notify();
  }

  configureInteractions(record) {
    if (!record.interactions || !record.ready) return;
    record.frame.contentWindow?.postMessage({ channel: CHANNEL, type: 'configure-interactions', token: record.token,
      enabled: this.interactionsEnabled && this.isAllDevices() }, record.origin);
  }

  applyInteraction(record, action) {
    record.frame.contentWindow?.postMessage({ channel: CHANNEL, type: 'apply-interaction', token: record.token, path: record.path, action }, record.origin);
  }

  validAction(action, origin) {
    if (!action || typeof action !== 'object') return null;
    if (action.type === 'navigate' && typeof action.url === 'string' && action.url.length <= 10000) {
      try {
        const url = new URL(action.url);
        if (url.origin === origin && /^https?:$/.test(url.protocol) && !url.username && !url.password) return { type: 'navigate', url: url.href };
      } catch { /* Invalid navigation is ignored. */ }
      return null;
    }
    if (action.type !== 'control' || typeof action.state !== 'boolean' || !action.target ||
        !['tab', 'disclosure', 'details'].includes(action.target.kind)) return null;
    const target = { kind: action.target.kind };
    for (const key of ['key', 'id', 'controls', 'label', 'group']) {
      if (typeof action.target[key] !== 'string' || action.target[key].length > 160) return null;
      target[key] = action.target[key];
    }
    if (![target.key, target.id, target.controls, target.label].some(Boolean)) return null;
    return { type: 'control', target, state: action.state };
  }

  notify() {
    const records = [...this.frames.values()];
    const ready = records.filter(record => record.ready);
    const state = { enabled: this.enabled, interactionsEnabled: this.interactionsEnabled, interactionReady: ready.filter(record => record.interactions).length,
      total: records.length, ready: ready.length, samePage: ready.length > 0 && ready.every(record => record.path === ready[0].path), allDevices: this.isAllDevices() };
    if (this.lastStatus && Object.keys(state).every(key => state[key] === this.lastStatus[key])) return;
    if (!this.lastStatus || state.allDevices !== this.lastStatus.allDevices || state.interactionsEnabled !== this.lastStatus.interactionsEnabled) {
      for (const record of records) {
        this.configureInteractions(record);
        if (!state.allDevices || !state.interactionsEnabled) record.pendingNavigation = null;
      }
    }
    this.lastStatus = state;
    this.onChange(state);
  }
}
