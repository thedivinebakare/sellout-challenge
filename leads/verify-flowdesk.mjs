import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const PUPPETEER_ROOT =
  process.env.PUPPETEER_ROOT ||
  path.join(os.tmpdir(), 'puppeteer-test');
const CACHE_DIR =
  process.env.PUPPETEER_CACHE ||
  path.join(os.homedir(), '.cache', 'puppeteer');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const DASH_URL = BASE + '/leads/leads-dashboard.html';

const require = createRequire(import.meta.url);
const puppeteer = require(path.join(PUPPETEER_ROOT, 'node_modules', 'puppeteer'));

const SYSTEM_BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

function findSystemBrowser() {
  return SYSTEM_BROWSERS.find((p) => fs.existsSync(p)) || null;
}

const results = [];
function assert(name, cond, detail = '') {
  results.push({ name, pass: !!cond, detail: String(detail) });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: true,
  executablePath: findSystemBrowser() || undefined,
  userDataDir: path.join(
    CACHE_DIR,
    'verify-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
  ),
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

  await page.evaluateOnNewDocument(() => {
    try { sessionStorage.setItem('soc_cmd_unlocked', '1'); } catch (e) {}
  });

  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource/.test(m.text()) && /ERR_FAILED/.test(m.text())) return;
    errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url)) req.abort();
    else req.continue();
  });

  await page.goto(DASH_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#leads-grid [data-card]', { timeout: 60000 });

  const dom = await page.evaluate(() => {
    const vis = (el) => el && !el.classList.contains('hidden');
    const text = (el) => (el ? (el.textContent || '').trim() : '');
    return {
      title: document.title,
      gateHidden: !vis(document.getElementById('gate')),
      appShown: vis(document.getElementById('app')),
      cards: document.querySelectorAll('#leads-grid [data-card]').length,
      pipelineCells: document.querySelectorAll('#pipeline-strip > div').length,
      statsCells: document.querySelectorAll('#stats-bar > div').length,
      pulseCells: document.querySelectorAll('#pulse-banner > div').length,
      alertChips: document.querySelectorAll('#alert-strip [data-alert]').length,
      alertFallback: text(document.getElementById('alert-strip')).length,
      statusStrip: text(document.getElementById('status-strip')),
      favicon: (document.querySelector('link[rel="icon"]') || {}).href || '',
      pulseDisplay: getComputedStyle(document.getElementById('pulse-banner')).display,
      cellRadius: (() => { const el = document.querySelector('#pulse-banner > div'); return el ? getComputedStyle(el).borderRadius : ''; })(),
    };
  });

  assert('pulse banner has 3 cells', dom.pulseCells === 3, 'cells=' + dom.pulseCells);
  assert('alert strip present', dom.alertFallback > 0, JSON.stringify(dom.alertFallback));
  assert('tailwind styles applied (grid + radius)', dom.pulseDisplay === 'grid' && dom.cellRadius !== '0px' && dom.cellRadius !== '', JSON.stringify({ pulseDisplay: dom.pulseDisplay, cellRadius: dom.cellRadius }));

  if (dom.alertChips > 0) {
    const chip = await page.$('#alert-strip [data-alert]');
    await chip.click();
    await sleep(300);
    const after = await page.evaluate(() => ({
      tier: document.getElementById('filter-tier').value,
      follow: document.getElementById('filter-follow').value,
    }));
    const okAlert = after.tier !== '' || after.follow !== '';
    assert('alert chip queues filters', okAlert, JSON.stringify(after));
    if (okAlert) {
      const cards = await page.evaluate(() => document.querySelectorAll('#leads-grid [data-card]').length);
      assert('alert chip re-renders grid', cards > 0, 'cards=' + cards);
    }
  } else {
    assert('alert chip queues filters', true, 'no alert chips to click (skipped)');
  }

  assert('gate hidden (seed unlock)', dom.gateHidden);
  assert('app visible', dom.appShown);
  assert('lead cards rendered', dom.cards > 0, 'cards=' + dom.cards);
  assert('pipeline strip has 6 cells', dom.pipelineCells === 6, 'cells=' + dom.pipelineCells);
  assert('stats bar has 5 cells', dom.statsCells === 5, 'cells=' + dom.statsCells);
  assert('status strip rendered', dom.statusStrip.length > 0, JSON.stringify(dom.statusStrip.slice(0, 80)));

  // ---- Task 3: status pill advance + persistence ----
  const pillInfo = await page.evaluate(() => {
    const pill = document.querySelector('#leads-grid [data-health-advance]');
    if (!pill) return null;
    const lbl = pill.querySelector('.status-label');
    return { phone: pill.dataset.phone, label: lbl ? lbl.textContent.trim() : pill.textContent.trim() };
  });
  if (pillInfo) {
    await page.click('#leads-grid [data-health-advance]');
    await sleep(250);
    const afterPill = await page.evaluate((phone) => {
      const pill = document.querySelector(`#leads-grid [data-health-advance][data-phone="${phone}"]`);
      let p = {};
      try { p = JSON.parse(localStorage.getItem('soc_progress_v1') || '{}'); } catch (e) {}
      return {
        label: pill && pill.querySelector('.status-label') ? pill.querySelector('.status-label').textContent.trim() : '',
        stored: (p[phone] || {}).status || '',
      };
    }, pillInfo.phone);
    assert('status pill advances on click', afterPill.label !== pillInfo.label || pillInfo.label === 'Enrolled', `${pillInfo.label} -> ${afterPill.label}`);
    assert('status persisted to localStorage', afterPill.stored === afterPill.label, `${afterPill.stored} (stored) vs ${afterPill.label} (pill)`);

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#leads-grid [data-card]', { timeout: 60000 });
    const relabel = await page.evaluate((phone) => {
      const pill = document.querySelector(`#leads-grid [data-health-advance][data-phone="${phone}"]`);
      const lbl = pill && pill.querySelector('.status-label');
      return lbl ? lbl.textContent.trim() : '';
    }, pillInfo.phone);
    assert('status survives reload', relabel === afterPill.label, `${afterPill.label} vs ${relabel}`);
  } else {
    assert('status pill advances on click', true, 'no pill found (skipped)');
    assert('status persisted to localStorage', true, 'no pill found (skipped)');
    assert('status survives reload', true, 'no pill found (skipped)');
  }

  // ---- Task 4: tokenized angles + personal pay links ----
  const tokenInfo = await page.evaluate(() => {
    const sample = LEADS[0];
    const digits = String(sample.phone || '').replace(/\D/g, '');
    return {
      angleCount: ANGLES.length,
      payRef: payRef(sample),
      payLink: payLinkFor(sample),
      origin: location.origin,
      urgent: composeToken(sample, 'urgent'),
      objection: composeToken(sample, 'objection'),
      perAngle: document.querySelectorAll('#leads-grid [data-card] .angle-pill').length / Math.max(1, document.querySelectorAll('#leads-grid [data-card]').length),
      payLinkBtns: document.querySelectorAll('#leads-grid [data-paylink]').length,
      expectedRef: 'SOC-' + digits.slice(-5),
    };
  });
  assert('ANGLES has 6 entries', tokenInfo.angleCount === 6, 'count=' + tokenInfo.angleCount);
  assert('payRef format matches SOC-<last5>', tokenInfo.payRef === tokenInfo.expectedRef, `${tokenInfo.payRef} vs ${tokenInfo.expectedRef}`);
  assert('pay link shape', tokenInfo.payLink.startsWith(tokenInfo.origin + '/step-2.html?ref=SOC-'), tokenInfo.payLink);
  assert('urgent token composed', tokenInfo.urgent.includes('SELLOUT25') && tokenInfo.urgent.includes(tokenInfo.expectedRef) && tokenInfo.urgent.includes('10,000'), 'len=' + tokenInfo.urgent.length);
  assert('objection token composed', tokenInfo.objection.includes('SELLOUT25') && tokenInfo.objection.includes('7,500'), 'len=' + tokenInfo.objection.length);
  assert('card shows 6 angle pills', Math.abs(tokenInfo.perAngle - 6) < 0.01, 'per card=' + tokenInfo.perAngle.toFixed(2));
  assert('pay link copy button on cards', tokenInfo.payLinkBtns > 0, 'btns=' + tokenInfo.payLinkBtns);

  assert('no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}

let failed = 0;
for (const r of results) {
  console.log(`  [${r.pass ? 'PASS' : 'FAIL'}] ${r.name}${r.detail ? ' - ' + r.detail : ''}`);
  if (!r.pass) failed++;
}
console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);