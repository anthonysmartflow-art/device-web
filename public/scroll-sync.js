const CHANNEL = 'device-web-scroll-v1';

export class ScrollSync {
  constructor({ onChange, isAllDevices }) {
    this.frames = new Map();
    this.enabled = true;
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
      ready: false, path: '', retry: null, onLoad: null,
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
      clearTimeout(record.retry);
      this.notify();
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

  notify() {
    const records = [...this.frames.values()];
    const ready = records.filter(record => record.ready);
    const state = { enabled: this.enabled, total: records.length, ready: ready.length, samePage: ready.length > 0 && ready.every(record => record.path === ready[0].path), allDevices: this.isAllDevices() };
    if (this.lastStatus && Object.keys(state).every(key => state[key] === this.lastStatus[key])) return;
    this.lastStatus = state;
    this.onChange(state);
  }
}
