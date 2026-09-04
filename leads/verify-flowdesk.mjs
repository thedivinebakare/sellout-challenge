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
      statusStrip: text(document.getElementById('status-strip')),
      favicon: (document.querySelector('link[rel="icon"]') || {}).href || '',
    };
  });

  assert('gate hidden (seed unlock)', dom.gateHidden);
  assert('app visible', dom.appShown);
  assert('lead cards rendered', dom.cards > 0, 'cards=' + dom.cards);
  assert('pipeline strip has 6 cells', dom.pipelineCells === 6, 'cells=' + dom.pipelineCells);
  assert('stats bar has 5 cells', dom.statsCells === 5, 'cells=' + dom.statsCells);
  assert('status strip rendered', dom.statusStrip.length > 0, JSON.stringify(dom.statusStrip.slice(0, 80)));
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