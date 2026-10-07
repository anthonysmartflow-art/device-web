# Device Web design

## Brief and evidence
A personal tool for previewing the user's own Vercel websites. One action: enter a URL and inspect its responsive layout in three live screens with linked document scrolling. User-supplied device-web-tester.mp4 is the approved visual reference: pale background, centered heading, black/silver iPhone, iPad and MacBook silhouettes, device labels below. No reference website copy or imagery is reused.

## Visual system
- Canvas #f5f7fa, surface #ffffff, ink #202936, muted #647184, edge #dce1e7, action #253c50.
- Display: system rounded sans where available; body: system sans; dimension captions: system monospace. No external font requests.
- Compact title and URL bar above a large, open device stage. Devices sit on a shared baseline with independent proportional scaling, matching the reference's composition.
- Signature: carefully drawn hardware frames around actual browser content. Metallic gradients belong only to the hardware; no ornamental page gradients.
- Keep every device fully visible. Scale the whole device with its native internal viewport; never shrink the embedded viewport to its on-page display width.
- Device sizes: iPhone 390×844, iPad 834×1194, MacBook browser 1440×900 CSS pixels. Generic labels intentionally avoid claiming one exact current device model. These are layout previews, not OS/browser emulation.

## Behavior and accessibility
Submit URL explicitly; do not automatically open stored URLs. HTTPS default, reject credentials and unsafe schemes. With the opt-in site helper, scrolling any device synchronizes the relative scroll position of devices on the same page in All devices view. Navigation remains independent. Unsupported sites must show that a connection is needed; never claim sync is active without a handshake. Sandbox prevents the embedded page taking over the parent window. Do not claim iframe load proves the site is visible: browsers obscure cross-origin load failures.
All-device view on desktop, individual device views available everywhere; start on iPhone for narrow screens. Stack All view on narrow screens. Controls have visible focus, text labels, 44px targets and live validation. Honor reduced motion. No automatic scrolling or animated scenery.

## Scope and exclusions
No sign-in, database, screenshots service, proxy, device OS emulation, analytics or background URL capture. Do not bypass target site security or Vercel authentication. Guidance for blocked content lives in a compact disclosure.
No decorative numbered sections, third-party component kit, cropped artwork, fake success states or invented testimonials. Rejected convention: a product marketing landing page; this is a working utility.

## Validation
Check URL submission, iframe layout widths, linked scrolling in both directions, sync off, focused views, navigation separation, missing-helper state, reload, invalid URLs, protected/blocked pages, and 1440/1024/768/390/320 widths. Review screenshots before publication.
