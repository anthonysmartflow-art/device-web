# Device Web Scroll Sync

Install this once in Chrome or Edge. Then websites previewed in [Device Web](https://device-web-five.vercel.app) can scroll together without installing a helper on every website.

## Install

1. Download and unzip the extension. Keep its folder somewhere permanent.
2. Open `chrome://extensions` in Chrome, or `edge://extensions` in Edge.
3. Turn on **Developer mode**, select **Load unpacked**, and choose the folder containing `manifest.json`.
4. Open or refresh Device Web **in that same browser**, paste your website URL, and select **Preview**. Leave **Sync scroll** on and use **All devices**.

The caption will say **Scroll linked across all devices** after all three screens connect. Scrolling any device then moves the others to the same percentage down their pages. Responsive pages have different heights, so section positions can differ.

This is a local unpacked extension, not a Chrome Web Store listing. If you move its folder, load it again. After replacing extension files, click **Reload** on its card in the extensions page, then refresh Device Web.

## Permissions and privacy

The browser requests access to HTTPS websites because your Vercel sites can use any custom domain. The script immediately exits on normal browser tabs and unrelated frames. It activates only in a direct iframe of `https://device-web-five.vercel.app`, when that viewer is itself the top-level page.

The bridge has no network requests, storage, background worker, analytics, cookie access, or extension API access. It exchanges only a random connection token, page path/query (to keep different pages separate), and relative scroll position with that viewer. Do not put secrets into website query strings. It accepts scroll commands only from the viewer's parent window after validating its origin and connection token.

The script shares the page's JavaScript environment so it can use the same startup guard as the optional site helper. This prevents two bridges from relaying duplicate scroll events. Website scripts can interfere with this environment; the extension exposes no privileged browser APIs to them.

## Limits

- Works in the browser where it is installed; it does not install into Safari, mobile browsers, or the Codex in-app browser.
- Sites still need to allow embedding. This extension does not remove security headers, bypass Vercel sign-in, or change cookies.
- Only HTTPS pages and the production Device Web domain are supported. For redirects, paste the site's final URL.
- Sync applies to document scrolling in **All devices**. Independently scrolling menus, nested panels, and pages reached by different links remain independent.
- Keep the browser's site access enabled for the domains you preview. Site script security policies or another extension can also interfere.
- Existing site helpers can stay installed; only one bridge starts.

## Developer validation

Run `node --test extension/bridge.test.mjs` from the repository root. Browser acceptance check: install the extension, open production Device Web, preview an HTTPS website without the site helper, and confirm all three connections. Scroll the MacBook down, then the iPhone back up. Confirm both peers move, **Sync scroll** off stops propagation, single-device views do not propagate, and reload reconnects. Open the target website directly and confirm `window.__deviceWebScrollExtension` is unset. Confirm an unrelated site's iframe also remains inactive. Finally, repeat with the example page (which already includes the site helper) to check duplicate prevention.

References: [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [manifest content scripts](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts), [install an unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).
