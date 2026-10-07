// Run with Playwright available and CHROMIUM_PATH pointing to an extension-capable Chromium.
// TEST_LIVE=1 exercises the deployed viewer. No target website is modified.
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const viewer = 'https://device-web-five.vercel.app';
const profile = await mkdtemp(join(tmpdir(), 'device-web-interactions-'));
const context = await chromium.launchPersistentContext(profile, {
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
  args: process.env.BRIDGE_MODE === 'site' ? ['--headless=new'] : ['--headless=new', `--disable-extensions-except=${root}/extension`, `--load-extension=${root}/extension`],
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors=[];
page.on('pageerror', error => errors.push(error.message));
const frames=()=>page.frames().filter(f=>f.parentFrame()===page.mainFrame());
const until=async fn=>{for(let n=0;n<100;n++){if(await fn())return;await page.waitForTimeout(100)}throw new Error('Timed out waiting for expected synchronized state')};
const values=fn=>Promise.all(frames().map(f=>f.evaluate(fn)));
// Chromium 128's automation bounding boxes omit CSS scaling in OOPIFs.
// Compute the actual displayed position and send a real trusted mouse click.
async function click(locator) {
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  const handle=await locator.elementHandle();
  const frame=await handle.ownerFrame();
  const frameElement=await frame.frameElement();
  const outer=await frameElement.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}});
  const inner=await locator.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:innerWidth,height:innerHeight}});
  await page.mouse.click(outer.x+inner.x*outer.width/inner.width,outer.y+inner.y*outer.height/inner.height);
}

const load=async url=>{await page.getByRole('textbox').fill(url);await page.getByRole('button',{name:'Preview',exact:true}).click();await page.getByText('Scrolling, links and controls linked across all devices',{exact:true}).waitFor()};
try {
  if(!process.env.TEST_LIVE) await page.route(viewer+'/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const file=path==='/'?'index.html':path.slice(1);
    try{const body=await readFile(join(root,'public',file));await route.fulfill({body,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html'})}
    catch{await route.abort()}
  });
  const fixture=await readFile(join(root,'tests/fixtures/interactions.html'),'utf8') + (process.env.BRIDGE_MODE === 'site' ? `<script src="${viewer}/device-web-sync.js"></script>` : '');
  await page.route('https://sync-fixture.test/**',route=>route.fulfill({body:fixture,contentType:'text/html'}));
  await page.goto(viewer);
  if(process.env.TEST_LIVE)for(const file of ['app.js','scroll-sync.js','index.html','device-web-sync.js']){
    const response=await page.request.get(viewer+'/'+file);assert.equal(await response.text(),await readFile(join(root,'public',file),'utf8'));
  }
  await load('https://sync-fixture.test/');
  await click(frames()[1].getByRole('button',{name:'Open menu',exact:true}));
  await until(async()=>JSON.stringify(await values(()=>document.querySelector('#menu-toggle').getAttribute('aria-expanded')))==='["true","true","false"]');
  await frames()[1].getByRole('button',{name:'Close menu',exact:true}).press('Escape');
  await until(async()=>(await values(()=>document.querySelector('#menu-toggle').getAttribute('aria-expanded'))).every(v=>v==='false'));
  await click(frames()[2].getByRole('tab',{name:'Specifications'}));
  await until(async()=>(await values(()=>document.querySelector('#specs').getAttribute('aria-selected'))).every(v=>v==='true'));
  await frames()[0].getByRole('tab',{name:'Specifications'}).press('ArrowRight');
  await until(async()=>(await values(()=>document.querySelector('#overview').getAttribute('aria-selected'))).every(v=>v==='true'));
  await click(frames()[0].locator('summary'));
  await until(async()=>(await values(()=>document.querySelector('#faq').open)).every(Boolean));
  console.log('PASS: responsive menus, Escape, tabs, keyboard tab selection and accordions synchronize.');
  await click(frames()[0].locator('.ambiguous').first());
  await page.waitForTimeout(150);
  assert.deepEqual(await values(()=>document.querySelector('.ambiguous').getAttribute('aria-expanded')),['true','false','false']);
  await frames()[0].getByRole('textbox',{name:'Name'}).fill('Private test value');
  await click(frames()[0].locator('#form-toggle'));
  await click(frames()[0].locator('#submit'));
  await click(frames()[0].locator('#purchase'));
  await page.waitForTimeout(150);
  assert.deepEqual(await values(()=>document.querySelector('input').value),['Private test value','','']);
  assert.deepEqual(await values(()=>document.body.dataset.submits||'0'),['1','0','0']);
  assert.deepEqual(await values(()=>document.body.dataset.purchases||'0'),['1','0','0']);
  assert.deepEqual(await values(()=>document.querySelector('#form-toggle').getAttribute('aria-expanded')),['true','false','false']);
  console.log('PASS: ambiguous controls, forms, entered values and ordinary action buttons stay local.');
  await page.getByRole('button',{name:'Sync clicks',exact:true}).click();
  await click(frames()[1].getByRole('button',{name:'Open menu',exact:true}));
  await page.waitForTimeout(150);
  assert.deepEqual(await values(()=>document.querySelector('#menu-toggle').getAttribute('aria-expanded')),['false','true','false']);
  await page.getByRole('button',{name:'Sync clicks',exact:true}).click();
  await click(frames()[1].getByRole('button',{name:'Close menu',exact:true}));
  await page.waitForTimeout(150);
  assert.deepEqual(await values(()=>document.querySelector('#menu-toggle').getAttribute('aria-expanded')),['false','false','false']);
  await page.getByRole('button',{name:'MacBook',exact:true}).click();
  await click(frames()[2].getByRole('tab',{name:'Specifications'}));
  await page.waitForTimeout(150);
  assert.deepEqual(await values(()=>document.querySelector('#specs').getAttribute('aria-selected')),['false','false','true']);
  await page.getByRole('button',{name:'All devices',exact:true}).click();
  await click(frames()[2].getByRole('link',{name:'Second page',exact:true}));
  await until(async()=>frames().every(f=>f.url()==='https://sync-fixture.test/second'));
  await page.getByText('Scrolling, links and controls linked across all devices',{exact:true}).waitFor();
  await click(frames()[0].getByRole('button',{name:'Open menu',exact:true}));
  await click(frames()[0].getByRole('link',{name:'SPA page',exact:true}));
  await until(async()=>frames().every(f=>f.url()==='https://sync-fixture.test/spa'));
  await page.getByText('Scrolling, links and controls linked across all devices',{exact:true}).waitFor();
  await click(frames()[2].getByRole('link',{name:'Bottom section',exact:true}));
  await until(async()=>frames().every(f=>f.url().endsWith('/spa#bottom')));
  await page.waitForTimeout(300);
  await frames()[2].evaluate(()=>scrollTo({top:.4*(document.scrollingElement.scrollHeight-innerHeight),behavior:'instant'}));
  await until(async()=>(await values(()=>scrollY/(document.scrollingElement.scrollHeight-innerHeight))).every(v=>Math.abs(v-.4)<.005));
  console.log('PASS: toggle, single-device isolation, full and SPA navigation, anchors, scroll sync after navigation.');
  for(const width of [1440,1024,768,390,320]){
    await page.setViewportSize({width,height:1000});
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No overflow at '+width);
  }
  await page.setViewportSize({width:1440,height:1000});
  if(process.env.BRIDGE_MODE !== 'site') {
  // User's real Next.js site: phone/tablet drawer and desktop page navigation.
  await load('https://friends-of-vineyard-forests.vercel.app/');
  await page.waitForTimeout(1200);
  await click(frames()[1].getByRole('button',{name:'Open menu',exact:true}));
  await frames()[0].getByRole('button',{name:'Close menu',exact:true}).waitFor();
  await frames()[1].getByRole('button',{name:'Close menu',exact:true}).waitFor();
  assert.equal(await frames()[2].getByRole('button',{name:'Close menu',exact:true}).count(),0);
  await page.screenshot({path:join(root,'../../outputs/device-web-synced-menus.png'),fullPage:true});
  await click(frames()[1].getByRole('button',{name:'Close menu',exact:true}));
  await frames()[0].getByRole('button',{name:'Open menu',exact:true}).waitFor();
  await click(frames()[2].getByRole('link',{name:'About FVF',exact:true}).first());
  await until(async()=>frames().every(f=>new URL(f.url()).pathname==='/about'));
  await page.getByText('Scrolling, links and controls linked across all devices',{exact:true}).waitFor();
  await page.waitForTimeout(750);
  await page.screenshot({path:join(root,'../../outputs/device-web-synced-navigation.png'),fullPage:true});
  console.log('PASS: actual FVF mobile menus and Next.js page links synchronize across devices.');
  await page.setViewportSize({width:390,height:900});
  await page.getByRole('button',{name:'iPhone',exact:true}).click();
  await page.waitForTimeout(200);
  await page.screenshot({path:join(root,'../../outputs/device-web-synced-mobile.png'),fullPage:true});
  await page.goto('https://friends-of-vineyard-forests.vercel.app/');
  assert.equal(await page.evaluate(()=>window.__deviceWebScrollExtension),undefined);
  assert.equal(await page.evaluate(()=>window.__deviceWebScrollBridge),undefined);
  console.log('PASS: ordinary top-level browsing unaffected.');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: no browser errors.');
} finally {await context.close();await rm(profile,{recursive:true,force:true})}
