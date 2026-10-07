import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl } from '../public/url.js';
const own = 'https://device-web.vercel.app/';
test('accepts deployment domains, custom domains, paths, queries and hashes', () => {
  assert.equal(normalizeUrl(' project.vercel.app/about?q=hello#team ', own), 'https://project.vercel.app/about?q=hello#team');
  assert.equal(normalizeUrl('https://example.org', own), 'https://example.org/');
});
test('rejects unsafe or malformed URLs and credentials', () => {
  for (const input of ['', 'hello', 'a b.com', 'javascript:alert(1)', 'data:text/html,hello', 'file:///tmp/a', 'https://u:p@example.com', 'https://']) assert.throws(() => normalizeUrl(input, own));
});
test('rejects mixed content and recursive viewer URLs', () => {
  for (const input of ['http://example.com', own, own + 'index.html?x=1']) assert.throws(() => normalizeUrl(input, own));
  assert.equal(normalizeUrl(own + 'example.html', own), own + 'example.html');
});
test('permits explicit HTTP URLs in local development', () => {
  assert.equal(normalizeUrl('http://localhost:4000', 'http://localhost:4173'), 'http://localhost:4000/');
});
