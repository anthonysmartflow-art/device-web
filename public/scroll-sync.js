const CHANNEL = 'device-web-scroll-v1';

export class ScrollSync {
  constructor({ onChange, isAllDevices }) {
    this.frames = new Map();
    this.enabled = true;
    this.onChange = onChange;
    this.isAllDevices = isAllDevices;
    window.addEventListener('message', event => this.receive(event));
  }

  clear() {
    for (const record of this.frames.values()) clearInterval(record.retry);
    this.frames.clear();
    this.notify();
  }

  add(frame, url) {
    const record = {
      frame, origin: new URL(url).origin, token: crypto.randomUUID(),
      ready: false, path: '', retry: null,
    };
    this.frames.set(frame, record);
    const connect = () => frame.contentWindow?.postMessage({ channel: CHANNEL, type: 'connect', token: record.token }, record.origin);
    frame.addEventListener('load', () => {
      if (!this.frames.has(frame)) return;
      clearInterval(record.retry);
      record.ready = false;
      record.path = '';
      record.token = crypto.randomUUID();
      this.notify();
      connect();
      let attempts = 0;
      record.retry = setInterval(() => {
        if (record.ready || ++attempts > 15) clearInterval(record.retry);
        else connect();
      }, 1000);
    });
  }

  receive(event) {
    const record = [...this.frames.values()].find(item => item.frame.contentWindow === event.source);
    const data = event.data;
    if (!record || event.origin !== record.origin || !data || data.channel !== CHANNEL || data.token !== record.token) return;
    if (typeof data.path !== 'string' || data.path.length > 10000) return;
    if (data.type === 'ready') {
      record.ready = true;
      record.path = data.path;
      clearInterval(record.retry);
      this.notify();
      return;
    }
    if (data.type !== 'scroll' || !record.ready || !this.enabled || !this.isAllDevices()) return;
    if (!Number.isFinite(data.progress) || data.progress < 0 || data.progress > 1) return;
    record.path = data.path;
    for (const target of this.frames.values()) {
      if (target === record || !target.ready || target.path !== data.path) continue;
      target.frame.contentWindow?.postMessage({ channel: CHANNEL, type: 'scroll-to', token: target.token, path: data.path, progress: data.progress }, target.origin);
    }
    this.notify();
  }

  toggle() {
    this.enabled = !this.enabled;
    this.notify();
  }

  notify() {
    const records = [...this.frames.values()];
    const ready = records.filter(record => record.ready);
    this.onChange({ enabled: this.enabled, total: records.length, ready: ready.length, samePage: ready.length > 0 && ready.every(record => record.path === ready[0].path) });
  }
}
