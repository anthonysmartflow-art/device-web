export function normalizeUrl(value, ownUrl) {
  const input = value.trim();
  if (!input) throw new Error('Enter a website URL to preview.');
  if (/\s/.test(input)) throw new Error('Remove spaces from the website URL.');
  if (/^[a-z][a-z\d+.-]*:/i.test(input) && !/^https?:\/\//i.test(input)) {
    throw new Error('Use an https:// or http:// website URL.');
  }
  let url;
  try { url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`); }
  catch { throw new Error('Enter a valid website URL, such as your-site.vercel.app.'); }
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || (!url.hostname.includes('.') && url.hostname !== 'localhost' && !url.hostname.includes(':'))) {
    throw new Error('Enter a complete website address, such as your-site.vercel.app.');
  }
  if (url.username || url.password) throw new Error('Use a URL without a username or password.');
  if (ownUrl) {
    const own = new URL(ownUrl);
    if (own.protocol === 'https:' && url.protocol !== 'https:') throw new Error('Use the HTTPS version of this website.');
    if (url.origin === own.origin && ['/', '/index.html'].includes(url.pathname)) throw new Error('Enter the website you want to test, rather than this viewer.');
  }
  return url.href;
}
