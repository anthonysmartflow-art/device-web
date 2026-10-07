import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const script = readFileSync(new URL('./scroll-bridge.js', import.meta.url), 'utf8');
const helper = readFileSync(new URL('../public/device-web-sync.js', import.meta.url), 'utf8');
const VIEWER = 'https://device-web-five.vercel.app';

function frame({ topLevel = false, nested = false, ancestor = VIEWER, existing = false } = {}) {
  const listeners = new Map();
  const posts = [];
  const scrolled = [];
  const queued = new Map();
  let nextId = 0;
  const parent = { postMessage: (message, origin) => posts.push({ message, origin }) };
  const context = vm.createContext({
    parent,
    top: nested ? {} : parent,
    location: { ancestorOrigins: [ancestor], protocol: 'https:', origin: 'https://site.test', pathname: '/', search: '' },
    document: { scrollingElement: { scrollHeight: 3000 } },
    innerHeight: 1000, scrollY: 0, scrollX: 0,
    __deviceWebScrollBridge: existing,
    addEventListener: (type, callback) => {
      const callbacks = listeners.get(type) || [];
      callbacks.push(callback);
      listeners.set(type, callbacks);
    },
    requestAnimationFrame: callback => { queued.set(++nextId, callback); return nextId; },
    cancelAnimationFrame: id => queued.delete(id),
    scrollTo: options => { scrolled.push(options); context.scrollY = options.top; },
  });
  context.window = context;
  if (topLevel) { context.parent = context; context.top = context; }
  const run = source => vm.runInContext(source, context);
  const emit = (type, event = {}) => { for (const callback of listeners.get(type) || []) callback(event); };
  const tick = () => { const batch = [...queued.values()]; queued.clear(); for (const callback of batch) callback(); };
  const message = (data, overrides = {}) => emit('message', {
    source: context.parent, origin: VIEWER,
    data: { channel: 'device-web-scroll-v1', token: 'connection-token', ...data }, ...overrides,
  });
  return { context, posts, scrolled, listeners, run, emit, tick, message };
}

test('is inert on top-level tabs, unrelated frames, nested frames, and an existing bridge', () => {
  for (const options of [{ topLevel: true }, { ancestor: 'https://other.test' }, { nested: true }, { existing: true }]) {
    const f = frame(options);
    f.run(script);
    assert.equal(f.listeners.size, 0);
    assert.equal(f.context.__deviceWebScrollExtension, undefined);
  }
});

test('handshake rejects wrong origin, source, channel, and empty tokens', () => {
  const f = frame();
  f.run(script);
  f.message({ type: 'connect' }, { origin: 'https://other.test' });
  f.message({ type: 'connect' }, { source: {} });
  f.message({ type: 'connect', channel: 'wrong' });
  f.message({ type: 'connect', token: '' });
  assert.equal(f.posts.length, 0);
  f.message({ type: 'connect' });
  assert.equal(f.posts.length, 1);
  assert.equal(f.posts[0].message.type, 'ready');
  assert.equal(f.posts[0].origin, VIEWER);
});

test('reports relative scrolling and applies authenticated commands without echoing them', () => {
  const f = frame();
  f.run(script);
  f.message({ type: 'connect' });
  f.context.scrollY = 500;
  f.emit('scroll'); f.tick();
  assert.equal(f.posts.at(-1).message.progress, 0.25);
  const count = f.posts.length;
  f.message({ type: 'scroll-to', path: '/', progress: 0.75 });
  assert.equal(f.scrolled.at(-1).top, 1500);
  f.emit('scroll'); f.tick(); f.tick();
  assert.equal(f.posts.length, count);
  f.emit('wheel');
  f.context.scrollY = 1000;
  f.emit('scroll'); f.tick();
  assert.equal(f.posts.at(-1).message.progress, 0.5);
});

test('rejects stale token, different path and invalid scroll progress', () => {
  const f = frame();
  f.run(script);
  f.message({ type: 'connect' });
  for (const payload of [
    { token: 'stale' }, { path: '/other' }, { progress: -1 }, { progress: 2 }, { progress: NaN }, { progress: '0.5' },
  ]) f.message({ type: 'scroll-to', path: '/', progress: 0.5, ...payload });
  assert.equal(f.scrolled.length, 0);
});

test('extension and existing website helper never attach duplicate listeners in either order', () => {
  for (const sources of [[script, helper], [helper, script]]) {
    const f = frame();
    for (const source of sources) f.run(source);
    assert.equal(f.listeners.get('scroll').length, 1);
    assert.equal(f.listeners.get('message').length, 1);
    f.message({ type: 'connect' });
    assert.equal(f.posts.length, 1);
  }
});
