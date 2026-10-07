import assert from 'node:assert/strict';
import test from 'node:test';
import { ScrollSync } from '../public/scroll-sync.js';

function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const previous = globalThis.window;
  globalThis.window = { addEventListener() {} };
  t.after(() => { if (previous) globalThis.window = previous; else delete globalThis.window; });
  const changes = [];
  let all = true;
  const sync = new ScrollSync({ onChange: state => changes.push(state), isAllDevices: () => all });
  t.after(() => sync.clear());
  function frame() {
    const listeners = new Map();
    const posts = [];
    const element = {
      contentWindow: { postMessage: (data, origin) => posts.push({ data, origin }) },
      addEventListener: (type, fn) => listeners.set(type, fn),
      removeEventListener: type => listeners.delete(type),
    };
    sync.add(element, 'https://preview.test/');
    const send = (data, overrides = {}) => sync.receive({
      source: element.contentWindow, origin: 'https://preview.test',
      data: { channel: 'device-web-scroll-v1', token: sync.frames.get(element)?.token, path: '/', ...data },
      ...overrides,
    });
    return { element, posts, listeners, send, load: () => listeners.get('load')?.() };
  }
  return { sync, changes, frame, setAll: value => { all = value; sync.notify(); } };
}

test('connects before load, stops probing after ready, and rotates tokens on navigation', t => {
  const { sync, frame } = setup(t);
  const f = frame();
  assert.equal(f.posts.length, 0);
  t.mock.timers.tick(100);
  assert.equal(f.posts[0].data.type, 'connect');
  assert.equal(f.posts[0].origin, 'https://preview.test');
  const token = f.posts[0].data.token;
  f.send({ type: 'ready' });
  t.mock.timers.tick(2000);
  assert.equal(f.posts.length, 1);
  f.load();
  assert.notEqual(sync.frames.get(f.element).token, token);
  f.send({ type: 'ready', token });
  assert.equal(sync.frames.get(f.element).ready, false);
  f.send({ type: 'ready' });
  assert.equal(sync.frames.get(f.element).ready, true);
});

test('relays a scroll burst immediately without any toolbar updates', t => {
  const { frame, changes } = setup(t);
  const frames = [frame(), frame(), frame()];
  frames.forEach(f => f.send({ type: 'ready' }));
  const count = changes.length;
  for (let i = 0; i < 200; i++) frames[0].send({ type: 'scroll', progress: i / 200 });
  assert.equal(changes.length, count);
  assert.equal(frames[1].posts.length, 200);
  assert.equal(frames[2].posts.at(-1).data.progress, .995);
  frames[0].send({ type: 'scroll', path: '/different', progress: .5 });
  assert.equal(changes.at(-1).samePage, false);
  assert.equal(frames[1].posts.length, 200);
});

test('retains origin, source, token, path and range checks on the faster path', t => {
  const { frame, sync } = setup(t);
  const a = frame(), b = frame();
  a.send({ type: 'ready' }, { origin: 'https://wrong.test' });
  a.send({ type: 'ready' }, { source: {} });
  a.send({ type: 'ready', token: 'wrong' });
  assert.equal(sync.frames.get(a.element).ready, false);
  a.send({ type: 'ready' }); b.send({ type: 'ready' });
  for (const progress of [-1, 2, NaN, '0.5']) a.send({ type: 'scroll', progress });
  a.send({ type: 'scroll', progress: .5, token: 'stale' });
  a.send({ type: 'scroll', progress: .5, path: '/other' });
  assert.equal(b.posts.length, 0);
});

test('sync off and focused views suppress relaying and status changes still render', t => {
  const { sync, frame, setAll, changes } = setup(t);
  const a = frame(), b = frame(); a.send({ type: 'ready' }); b.send({ type: 'ready' });
  sync.toggle(); a.send({ type: 'scroll', progress: .5 });
  assert.equal(changes.at(-1).enabled, false);
  sync.toggle(); setAll(false); a.send({ type: 'scroll', progress: .5 });
  assert.equal(changes.at(-1).allDevices, false);
  assert.equal(b.posts.length, 0);
  setAll(true); a.send({ type: 'scroll', progress: .5 });
  assert.equal(b.posts.length, 1);
});

test('missing helpers have bounded retries; removed frames cannot restart them', t => {
  const { sync, frame } = setup(t);
  const f = frame();
  for (let i = 0; i < 100; i++) t.mock.timers.tick(1000);
  assert.equal(f.posts.length, 36);
  sync.clear();
  f.load(); t.mock.timers.tick(2000);
  assert.equal(f.posts.length, 36);
  assert.equal(f.listeners.size, 0);
});
