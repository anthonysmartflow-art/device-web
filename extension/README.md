# Device Web Scroll Sync — version 1.1.0

Links scrolling, same-site page links, matching menus, tabs and accordions in [Device Web](https://device-web-five.vercel.app).

## Install or update

1. Download and unzip the helper. Keep the folder somewhere permanent on your computer.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge. Turn on **Developer mode**.
3. For a first install, choose **Load unpacked** and select the folder containing `manifest.json`.
4. For an update, replace the files inside your existing helper folder, then click **Reload** on its extension card. Verify version **1.1.0**.
5. Refresh Device Web in the same browser/profile. Select **All devices**, and leave **Sync scroll** and **Sync clicks** on.

Chrome loads this unpacked extension from that folder. Moving or deleting it breaks the installation. This is not a Chrome Web Store listing.

## What syncs

- Document scroll position, as a percentage of each page's scroll range.
- Normal same-origin page links, including page sections and client-side routes.
- Matching menus/disclosures with `aria-expanded`, ARIA tabs and native `details` accordions.
- Escape-closing disclosures and keyboard selection in ARIA tablists.

A mobile menu stays a mobile menu; a hidden control on desktop is skipped. Controls match by stable IDs, `aria-controls`, an optional `data-device-web-id`, or a unique accessible label. Ambiguous matches are skipped. Custom controls without these semantics may need site changes. Add `data-device-web-sync="off"` to an element/ancestor to exclude it.

Form fields, submissions, ordinary action buttons, external/new-tab links and marked downloads do not sync. Common sign-out/payment/delete URLs are also excluded, but the helper cannot infer all custom application side effects. Browser Back/Forward, hover, nested scrolling panels, canvas and shadow-root widgets are not mirrored.

## Permissions and privacy

Permissions are unchanged from version 1.0. The browser requests access to HTTPS pages because Vercel sites can use any custom domain. The script exits on normal tabs, unrelated frames and nested frames. It activates only in direct preview frames of the top-level `https://device-web-five.vercel.app` page.

The bridge has no network requests, storage, background worker, analytics, cookie reads or extension API access. It exchanges a connection token, page path/query, scroll position, same-site link destinations, and control identifiers/short labels with the viewer. It does not collect form values. Avoid secrets in page URLs.

Commands require the exact parent window, viewer origin and connection token. Only genuine user input initiates interaction messages; synthetic replicated clicks do not echo. Disabled interaction sync and focused device views also disable interaction capture in the bridge.

It shares the page's JavaScript environment with the optional site helper to prevent duplicate bridges. Website scripts can interfere with this environment. It exposes no privileged browser APIs. The broad HTTPS match is still a permission: only load helper files you trust.

## Limits and checks

Sites must permit embedding. This helper does not remove security headers or bypass login. Chrome/Edge desktop only, in the profile where installed. Paste the final URL if a site redirects across domains. Existing website helpers can stay installed; the first bridge to start owns the connection.

Run `npm test` and `npm run build`. `tests/browser-interactions.mjs` tests a controlled fixture plus actual FVF menus/navigation in a temporary extension browser profile. The repository README has the command and covered behavior.
