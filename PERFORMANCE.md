# Preview performance

## Changes

- Start a bounded scroll handshake 100ms after creating a requested iframe, instead of waiting for its complete load event. Probe every 250ms initially, then back off to once a second (36 attempts maximum per cycle). Stop when the existing v1 helper acknowledges. Load/navigation rotates the token and retries, including when a slow page or late helper arrives after the initial cycle. Clearing previews cancels timers and removes load listeners.
- Relay valid scroll positions immediately. Only update toolbar/status DOM when connection, path agreement, mode or toggle state changes. The helper's existing animation-frame handling remains unchanged; no new frame of relay latency is introduced.
- In single-device mode, create only the requested iframe. All devices creates all three eagerly. Keep previously loaded frames when switching views; clear them all on a new URL or Reload so stale hidden pages cannot return.
- Preload the viewer's two JavaScript module dependencies in parallel with its entry module. This does not preload target websites or make speculative requests to user-entered URLs.

No extension reinstall or site-helper changes are required. Message source/origin/token checks, embedding restrictions, URL validation, and extension permissions remain unchanged.

## Controlled browser comparison — October 7, 2026

Measured before and after in headless Chrome with identical fixture pages and the existing v1 site helper. Each viewer JavaScript module was delayed by 150ms; each preview contained a noncritical image delayed by four seconds. These are controlled regression measurements, not promises about real websites or internet connections.

| Measurement | Before | After |
| --- | ---: | ---: |
| Viewer startup with simulated module latency | 362ms | 187ms |
| Three-device scroll connection after Preview | 4,346ms | 215ms |
| Toolbar/status DOM mutations during 20 scroll updates | 60 | 0 |
| Target documents loaded at mobile single-device startup | 3 | 1 |

All three old previews had completed loading before connecting. All three new previews connected while their documents were still interactive and the delayed images were pending. Scroll positions converged within 0.5 percentage points. Switching to All devices loaded the remaining two pages; switching back and forth made no additional document requests. Changing URL while focused discarded the old hidden pages.

Automated tests cover early handshakes, bounded retries, token rotation/stale-message rejection, origin/source/path/range validation, sync off, individual views, timer/listener cleanup, and 200 relayed scroll messages without toolbar updates.

## Limits and sources

Target pages still perform their own downloads, JavaScript, layout and rendering at three independent viewport sizes. Device Web cannot optimize another website's images, server response or third-party scripts from a cross-origin frame. Loading all three pages eagerly is intentional when all three were requested; deferring visible panes would make the comparison slower.

- [MDN: load waits for dependent resources](https://developer.mozilla.org/en-US/docs/Web/API/Window/load_event)
- [Chrome: preload module dependencies to avoid discovery waterfalls](https://web.dev/articles/modulepreload)
- [Chrome: avoid unnecessary layout work](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing)
- [Chrome: defer unneeded iframe loads](https://web.dev/learn/performance/lazy-load-images-and-iframe-elements)
