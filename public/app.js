import { normalizeUrl } from './url.js';
import { ScrollSync } from './scroll-sync.js';
const specs = [
  { id: 'phone', name: 'iPhone', width: 390, height: 844, outerWidth: 422, outerHeight: 928 },
  { id: 'tablet', name: 'iPad', width: 834, height: 1194, outerWidth: 906, outerHeight: 1266 },
  { id: 'laptop', name: 'MacBook', width: 1440, height: 900, outerWidth: 1580, outerHeight: 1020 },
];
const devices = document.querySelector('#devices');
const input = document.querySelector('#url');
const error = document.querySelector('#url-error');
const status = document.querySelector('#preview-status');
const reload = document.querySelector('#reload');
const openSite = document.querySelector('#open-site');
let activeUrl = '';
let isExample = false;
// When the viewer itself is embedded, stop recursion before creating more frames.
const embedded = window.self !== window.top;
if (embedded) {
  document.querySelector('main').innerHTML = '<p class="recursive-message">Open Device Web in its own tab to preview a website.</p>';
} else {
  const syncButton = document.querySelector('#sync-scroll');
  const syncStatus = document.querySelector('#sync-status');
  const syncSetup = document.querySelector('#sync-setup');
  const sync = new ScrollSync({
    isAllDevices: () => devices.dataset.view === 'all',
    onChange: ({ enabled, total, ready, samePage }) => {
      syncButton.setAttribute('aria-pressed', String(enabled && ready >= 2));
      syncButton.disabled = ready < 2;
      syncButton.title = ready >= 2 ? 'Link scrolling across connected devices' : 'Install the browser helper or connect this site to enable scroll sync';
      syncSetup.hidden = !total || ready === total;
      if (!total) syncStatus.textContent = 'Live pages · Linked scrolling available';
      else if (!enabled) syncStatus.textContent = 'Scroll sync off';
      else if (devices.dataset.view !== 'all') syncStatus.textContent = 'Scroll sync applies in All devices';
      else if (ready === total && samePage) syncStatus.textContent = 'Scroll linked across all devices';
      else if (ready === total) syncStatus.textContent = 'Scroll linked for devices on the same page';
      else syncStatus.textContent = ready ? `Scroll helper connected: ${ready} of ${total}` : 'Enable the browser helper to link scrolling';
    },
  });
  syncButton.addEventListener('click', () => sync.toggle());
  for (const spec of specs) {
    const figure = document.createElement('figure');
    figure.className = `device device-${spec.id}`;
    figure.dataset.device = spec.id;
    figure.innerHTML = `
      <div class="device-stage" style="aspect-ratio:${spec.outerWidth}/${spec.outerHeight}">
        <div class="hardware ${spec.id}" style="width:${spec.outerWidth}px;height:${spec.outerHeight}px">
          <div class="device-body">
            ${spec.id === 'phone' ? '<div class="status-bar" aria-hidden="true"><span>9:41</span><div class="island"></div><span class="phone-indicators">▮▮▮ <span class="battery"></span></span></div>' : '<div class="camera" aria-hidden="true"></div>'}
            <div class="screen" style="width:${spec.width}px;height:${spec.height}px">
              <div class="empty-screen"><div class="empty-icon" aria-hidden="true">↗</div><strong>Your website here</strong><span>Enter a URL to get started.</span></div>
            </div>
            ${spec.id === 'phone' ? '<div class="home-bar" aria-hidden="true"></div>' : ''}
            ${spec.id === 'laptop' ? '<div class="laptop-chin" aria-hidden="true">MacBook Air</div>' : ''}
          </div>
          ${spec.id === 'laptop' ? '<div class="laptop-base" aria-hidden="true"><div class="laptop-groove"></div></div>' : ''}
        </div>
      </div>
      <figcaption><strong>${spec.name}</strong><span>${spec.width} × ${spec.height}</span></figcaption>`;
    devices.append(figure);
    const stage = figure.querySelector('.device-stage');
    const hardware = figure.querySelector('.hardware');
    new ResizeObserver(([entry]) => {
      hardware.style.transform = `scale(${entry.contentRect.width / spec.outerWidth})`;
    }).observe(stage);
  }

  function setView(view) {
    devices.dataset.view = view;
    sync.notify();
    document.querySelectorAll('[data-view]').forEach(button => {
      if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.view === view));
    });
  }
  document.querySelectorAll('button[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  if (window.matchMedia('(max-width: 699px)').matches) setView('phone');

  function showUrl(url, example = false) {
    sync.clear();
    activeUrl = url;
    isExample = example;
    error.textContent = '';
    input.removeAttribute('aria-invalid');
    input.value = example ? '' : url;
    reload.disabled = false;
    openSite.href = url;
    openSite.hidden = false;
    status.textContent = example ? 'Example website' : `Previewing ${new URL(url).hostname}`;
    for (const spec of specs) {
      const screen = devices.querySelector(`[data-device="${spec.id}"] .screen`);
      const frame = document.createElement('iframe');
      frame.title = `${spec.name} website preview — ${spec.width} by ${spec.height}`;
      frame.width = spec.width;
      frame.height = spec.height;
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals');
      frame.referrerPolicy = 'no-referrer';
      sync.add(frame, url);
      frame.src = url;
      screen.replaceChildren(frame);
    }
    sync.notify();
    // Remember only a convenience value. Reloading the app never opens a saved site automatically.
    try { if (!example) localStorage.setItem('device-web:last-url', url); } catch { /* Storage is optional. */ }
  }

  document.querySelector('#url-form').addEventListener('submit', event => {
    event.preventDefault();
    try { showUrl(normalizeUrl(input.value, location.href)); }
    catch (e) { error.textContent = e.message; input.setAttribute('aria-invalid', 'true'); input.focus(); }
  });
  input.addEventListener('input', () => { error.textContent = ''; input.removeAttribute('aria-invalid'); });
  document.querySelector('#demo').addEventListener('click', () => showUrl(new URL('/example.html', location.href).href, true));
  reload.addEventListener('click', () => { if (activeUrl) showUrl(activeUrl, isExample); });
  try { input.value = localStorage.getItem('device-web:last-url') || ''; } catch { /* Storage is optional. */ }
}
