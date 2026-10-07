# Device Web

A small website previewer: enter a URL and inspect the live page inside iPhone, iPad and MacBook frames. Built for websites you own, including Vercel deployments.

## Use

Paste an HTTPS website URL and select **Preview**. Each screen scrolls and navigates independently. Use the device buttons for a larger single-device view, **Reload** to reset all three screens to the submitted URL, or **Open site** to open the original URL in a new tab. **Try an example website** loads the included fictional Fieldwork sample.

Desktop starts with all three devices. Narrow screens start with the iPhone; every view is available. The last submitted URL is remembered in this browser, but is never loaded automatically on return.

| Preview | CSS viewport |
| --- | --- |
| iPhone | 390 × 844 |
| iPad | 834 × 1194 |
| MacBook | 1440 × 900 |

Frames are original CSS artwork. The previews render in your current browser, not in real iOS, Safari, or device hardware. Viewports remain at the dimensions above while the surrounding device is scaled to fit your window. Device names are generic: browser controls, display settings and actual model sizes vary.

## Run locally

Requires Node.js 22 or later. No runtime or build dependencies.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4173. Build with `npm run build`, run URL validation tests with `npm test`, and serve the build with `npm start`. Set `PORT` to choose a different local port.

## Deploy on Vercel

Import `anthonysmartflow-art/device-web`. Framework: Other. Build command: `npm run build`. Output directory: `dist`. The tracked `vercel.json` declares these settings. No environment variables, database or account system are required. Connect the GitHub repository to publish subsequent main-branch changes automatically.

## If a website does not appear

Embedding must be permitted by the **website being previewed**. Vercel hosting alone does not grant permission. This app does not bypass security settings or proxy your pages.

- Open the target URL in a new tab first. For a protected deployment, sign in there or use a public production URL. Authentication inside an iframe may still fail because of third-party cookie restrictions.
- A restrictive `X-Frame-Options` header or CSP `frame-ancestors` policy can prevent embedding. For sites you own, add the viewer's actual origin to your existing `frame-ancestors` allowlist and reconcile any conflicting `X-Frame-Options` policy. Keep all other security directives. Allow only the necessary viewer domain, not every website.
- HTTPS viewers cannot embed HTTP websites. Use the target's HTTPS address.
- Some websites intentionally navigate outside frames or depend on device/browser detection rather than responsive CSS. This basic viewer is a layout check, not full device emulation.

Browsers deliberately hide cross-origin iframe errors. A frame load event cannot prove content rendered, so the app does not display a misleading "loaded successfully" badge. Use **Screen not loading?** for troubleshooting. Links and scrolling are independent, not synchronized.

URLs go directly from your browser to the website. There is no URL-fetching backend, analytics, screenshot service or server-side URL storage. The app saves the last URL in localStorage on your device; avoid including secrets in URLs. Iframes allow scripts, forms and user-opened tabs while preventing top-level navigation of the viewer.

## Project structure

- `public/`: shipped HTML, CSS, JavaScript, icon and example page.
- `scripts/`: dependency-free build and local server.
- `tests/`: URL normalization and validation tests.
- `DESIGN.md`: approved visual direction and constraints.
