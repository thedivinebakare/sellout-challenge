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
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const DASH_URL = BASE + '/leads/leads-dashboard.html';

const require = createRequire(import.meta.url);
const puppeteer = require(path.join(PUPPETEER_ROOT, 'node_modules', 'puppeteer'));

const SYSTEM_BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];

function findSystemBrowser() {
  return SYSTEM_BROWSERS.find((p) => fs.existsSync(p)) || null;
}

const results = [];
function assert(name, cond, detail = '') {
  results.push({ name, pass: !!cond, detail: String(detail) });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (msg) => console.log('[step] ' + msg);

// Deterministic expected ordering (leadScore desc, stable; reflects filteredLeads)
function loadLeads() {
  const src = fs.readFileSync(path.join(ROOT, 'leads', 'data', 'leads-data.js'), 'utf8');
  const start = src.indexOf('[');
  const end = src.lastIndexOf(']');
  const data = eval(src.slice(start, end + 1));
  return data.sort((a, b) => b.leadScore - a.leadScore);
}
const SORTED = loadLeads();
const TOTAL = SORTED.length;
const TIER1 = SORTED.filter((l) => l.tier === 'Tier 1').length;

// -------------------------------------------------------------------------
// Gate test on a separate, locked page
// -------------------------------------------------------------------------
const gProfile = path.join(os.tmpdir(), 'puppeteer-g-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
fs.mkdirSync(gProfile, { recursive: true });
const gBrowser = await puppeteer.launch({
  headless: true,
  executablePath: findSystemBrowser() || undefined,
  userDataDir: gProfile,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--disable-extensions'],
});

try {
  const gPage = await gBrowser.newPage();
  await gPage.setViewport({ width: 1280, height: 800 });
  await gPage.setRequestInterception(true);
  gPage.on('request', (req) => {
    if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(req.url())) req.abort();
    else req.continue();
  });
  await gPage.goto(DASH_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await gPage.waitForSelector('#gate-pass', { timeout: 60000 });

  const gateLocked = await gPage.evaluate(() => {
    const gate = document.getElementById('gate');
    const app = document.getElementById('app');
    return {
      gateShown: !gate.classList.contains('hidden') && gate.classList.contains('flex'),
      appHidden: app.classList.contains('hidden'),
    };
  });
  assert('access gate locks session on first load', gateLocked.gateShown && gateLocked.appHidden, JSON.stringify(gateLocked));

  await gPage.type('#gate-pass', 'definitely-wrong-code');
  await gPage.keyboard.press('Enter');
  await gPage.waitForFunction(() => !document.getElementById('gate-error').classList.contains('hidden'), { timeout: 10000 });
  const gateErr = await gPage.evaluate(() => document.getElementById('gate-error').textContent.trim());
  assert('wrong access code shows inline error', /Incorrect access code/.test(gateErr), gateErr);

  await gPage.evaluate(() => sessionStorage.setItem('soc_cmd_unlocked', '1'));
  await gPage.goto(DASH_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await gPage.waitForSelector('#leads-table tr', { timeout: 60000 });
  const gateOpen = await gPage.evaluate(() => ({
    gateHidden: document.getElementById('gate').classList.contains('hidden'),
    appVisible: !document.getElementById('app').classList.contains('hidden'),
  }));
  assert('unlocked session persists gate into app', gateOpen.gateHidden && gateOpen.appVisible, JSON.stringify(gateOpen));
} finally {
  await gBrowser.close();
  try { fs.rmSync(gProfile, { recursive: true, force: true }); } catch (e) {}
}

// -------------------------------------------------------------------------
// Full Light Edition suite
// -------------------------------------------------------------------------
step('gate passed; starting full suite')
const profileDir = path.join(os.tmpdir(), 'puppeteer-v-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
fs.mkdirSync(profileDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  executablePath: findSystemBrowser() || undefined,
  userDataDir: profileDir,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--disable-extensions'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

  await page.evaluateOnNewDocument(() => {
    try { sessionStorage.setItem('soc_cmd_unlocked', '1'); } catch (e) {}
    window.open = (u) => { window.__flowdeskLastOpened = u; return null; };
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
  await page.waitForSelector('#leads-table tr', { timeout: 60000 });
  await sleep(250);

  // 1. App shell & light theme
  const shell = await page.evaluate(() => {
    const { getComputedStyle: cs } = window;
    const navIds = [...document.querySelectorAll('#sidebar [data-nav]')].map((b) => b.dataset.nav);
    return {
      title: document.title,
      bodyBg: cs(document.body).backgroundColor,
      bodyFont: cs(document.body).fontFamily,
      kpiCards: document.querySelectorAll('#kpi-bar [data-kpi]').length,
      kpiRev: document.getElementById('kpi-rev-value').textContent,
      kpiSeats: document.getElementById('kpi-seats-value').textContent,
      kpiQueue: document.getElementById('kpi-queue-value').textContent,
      revGoal: document.getElementById('kpi-rev-goal').textContent,
      navIds,
      funnelHref: document.querySelector('#sidebar a[data-nav="funnel"]')?.getAttribute('href') || '',
      funnelTarget: document.querySelector('#sidebar a[data-nav="funnel"]')?.getAttribute('target') || '',
      tableVisible: !document.getElementById('leads-table-wrap').classList.contains('hidden'),
      gridHidden: document.getElementById('leads-grid').classList.contains('hidden'),
      rows: document.querySelectorAll('#leads-table tr').length,
      hasTable: !!document.getElementById('leads-table'),
      loadMore: document.getElementById('load-more-count').textContent,
      tableBtnActive: document.querySelector('[data-view="table"]').classList.contains('bg-royal'),
    };
  });
  assert('title references FlowDesk', /FlowDesk/i.test(shell.title), shell.title);
  assert('pearl light canvas applied', shell.bodyBg === 'rgb(248, 250, 252)', shell.bodyBg);
  assert('body uses Inter for UI text', /Inter/i.test(shell.bodyFont), shell.bodyFont);
  assert('executive bar has exactly 3 KPI cards', shell.kpiCards === 3, 'kpiCards=' + shell.kpiCards);
  assert('KPI revenue starts at zero naira', /₦0/.test(shell.kpiRev), shell.kpiRev);
  assert('KPI seats start empty of 50', shell.kpiSeats === '0', shell.kpiSeats);
  assert('KPI action queue counts priority leads', parseInt(shell.kpiQueue, 10) === TIER1, 'queue=' + shell.kpiQueue + ' tier1=' + TIER1);
  assert('revenue goal references 500k', /500,000/.test(shell.revGoal), shell.revGoal);
  assert('sidebar has overview/leads/zen/objections/funnel nav', ['overview', 'leads', 'zen', 'objections', 'funnel'].every((i) => shell.navIds.includes(i)), shell.navIds.join(','));
  assert('funnel nav opens / in new tab', shell.funnelHref === '/' && shell.funnelTarget === '_blank', shell.funnelHref);
  assert('table is the default view', shell.tableVisible && shell.gridHidden, '');
  assert('default table renders 48 of ' + TOTAL + ' leads', shell.rows === 48, 'rows=' + shell.rows);
  assert('load-more exposes the remainder', shell.loadMore === `+${TOTAL - 48} of ${TOTAL}`, shell.loadMore);
  assert('table view toggle is active', shell.tableBtnActive, '');

  // 2. Unified filter bar
  step('section 1: shell ok')
  const tabs = await page.evaluate(() => [...document.querySelectorAll('[data-status-tab]')].map((b) => b.dataset.statusTab));
  assert('four status tabs rendered', tabs.join(',') === 'all,new,contacted,enrolled', tabs.join(','));

  await page.click('[data-status-tab="enrolled"]');
  await sleep(150);
  const enrolledEmpty = await page.evaluate(() => ({
    resultCount: document.getElementById('result-count').textContent,
    emptyVisible: !document.getElementById('empty-state').classList.contains('hidden'),
  }));
  assert('enrolled tab is empty with empty-state', enrolledEmpty.resultCount === '0 leads' && enrolledEmpty.emptyVisible, JSON.stringify(enrolledEmpty));
  await page.click('[data-status-tab="all"]');
  await sleep(150);

  await page.click('#hi-priority');
  await sleep(150);
  const hp = await page.evaluate(() => ({
    pressed: document.getElementById('hi-priority').getAttribute('aria-pressed'),
    activeClass: document.getElementById('hi-priority').classList.contains('active'),
    resultCount: document.getElementById('result-count').textContent,
  }));
  assert('high priority filter narrows to Tier 1', hp.pressed === 'true' && hp.activeClass && hp.resultCount === TIER1 + ' leads', JSON.stringify(hp));
  await page.click('#hi-priority');
  await sleep(150);

  await page.type('#search-input', 'Eniola Eletu');
  await sleep(200);
  const search1 = await page.evaluate(() => ({
    resultCount: document.getElementById('result-count').textContent,
    firstPhone: document.querySelector('#leads-table tr')?.getAttribute('data-phone') || '',
  }));
  assert('search narrows to one matching lead', search1.resultCount === '1 lead', search1.resultCount);
  assert('search result is the expected lead', search1.firstPhone === SORTED.find((l) => l.name === 'Eniola Eletu').phone, search1.firstPhone);
  await page.$eval('#search-input', (el) => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(150);
  const cleared = await page.evaluate(() => document.getElementById('result-count').textContent);
  assert('clearing search restores full list', cleared === TOTAL + ' leads', cleared);

  await page.click('[data-status-tab="new"]');
  await sleep(150);
  const newCount = await page.evaluate(() => document.getElementById('result-count').textContent);
  assert('new tab lists every untouched lead', newCount === TOTAL + ' leads', newCount);
  await page.click('[data-status-tab="all"]');
  await sleep(150);

  // 3. View switching table -> cards -> table
  step('section 2: filters ok')
  await page.click('[data-view="cards"]');
  await sleep(200);
  const cardsView = await page.evaluate(() => ({
    gridVisible: !document.getElementById('leads-grid').classList.contains('hidden'),
    tableHidden: document.getElementById('leads-table-wrap').classList.contains('hidden'),
    cards: document.querySelectorAll('#leads-grid [data-card]').length,
  }));
  assert('cards view renders 48 profile cards', cardsView.gridVisible && cardsView.tableHidden && cardsView.cards === 48, JSON.stringify(cardsView));

  await page.click('[data-view="table"]');
  await sleep(200);
  const backToTable = await page.evaluate(() => ({
    gridHidden: document.getElementById('leads-grid').classList.contains('hidden'),
    tableVisible: !document.getElementById('leads-table-wrap').classList.contains('hidden'),
  }));
  assert('table view restored from cards', backToTable.gridHidden && backToTable.tableVisible, JSON.stringify(backToTable));

  // 4. Status advancement + persistence
  step('section 3: views ok')
  const firstPhone = await page.evaluate(() => document.querySelector('#leads-table tr').getAttribute('data-phone'));
  assert('first row participates in the data set', SORTED.some((l) => l.phone === firstPhone), firstPhone);
  await page.evaluate(() => {
    document.querySelector('#leads-table tr [data-health-advance]').click();
  });
  await sleep(200);
  const adv = await page.evaluate((phone) => {
    const row = document.querySelector(`#leads-table tr[data-phone="${phone}"]`);
    const stored = JSON.parse(localStorage.getItem('soc_progress_v1') || '{}');
    return {
      label: row?.querySelector('.status-label')?.textContent.trim() || '',
      storedStatus: stored[phone]?.status || '',
    };
  }, firstPhone);
  assert('status chip advances New -> Contacted', adv.label === 'Contacted', adv.label);
  assert('status persists under soc_progress_v1', adv.storedStatus === 'Contacted', adv.storedStatus);

  // 5. Slide-over dossier
  step('section 4: status ok')
  await page.evaluate(() => {
    document.querySelector('#leads-table tr').click();
  });
  await sleep(300);
  const dossier = await page.evaluate(({ phone, expectedName }) => {
    const content = document.getElementById('modal-content');
    const paylink = content.querySelector('[data-dossier-paylink]');
    const msgLen = content.textContent.length;
    return {
      isOpen: document.getElementById('dossier-panel').classList.contains('open'),
      nameShown: content.textContent.includes(expectedName),
      payHref: paylink?.getAttribute('href') || '',
      payText: paylink?.textContent.trim() || '',
      pitches: content.querySelectorAll('[data-pitch]').length,
      objections: content.querySelectorAll('[data-objection]').length,
      msgLen,
    };
  }, { phone: firstPhone, expectedName: SORTED.find((l) => l.phone === firstPhone).name });
  assert('dossier drawer slides open', dossier.isOpen, '');
  assert('dossier names the selected lead', dossier.nameShown, '');
  assert('dossier has exactly 4 pitch options', dossier.pitches === 4, 'pitches=' + dossier.pitches);
  assert('dossier has exactly 5 objection reframes', dossier.objections === 5, 'obj=' + dossier.objections);
  assert('dossier shows tokenized pitch body', dossier.msgLen > 60, 'len=' + dossier.msgLen);
  assert('dossier stamps personal checkout ref link', /\/step-2\.html\?ref=SOC-\d{5}/.test(dossier.payHref) && /SOC-\d{5}/.test(dossier.payText), dossier.payHref);

  await page.evaluate(() => document.querySelector('#modal-content [data-pitch="urgent"]').click());
  await sleep(150);
  const urgentMsg = await page.evaluate(() => document.getElementById('modal-content').textContent);
  assert('urgent pitch tokenizes scarcity + reference', /seats \u2014 .* left|seats.*left/.test(urgentMsg) && /SELLOUT25/.test(urgentMsg), 'len=' + urgentMsg.length);

  await page.evaluate(() => document.querySelector('#modal-content [data-pitch="objection"]').click());
  await sleep(150);
  const objectionMsg = await page.evaluate(() => document.getElementById('modal-content').textContent);
  assert('objection pitch reframes the lead worry', /real talk/.test(objectionMsg), 'len=' + objectionMsg.length);

  await page.type('#note-input', 'Interested in VIP hotseat on Day 2');
  await page.click('#modal-content [data-note]');
  await sleep(150);
  const noteCheck = await page.evaluate((phone) => {
    const stored = JSON.parse(localStorage.getItem('soc_progress_v1') || '{}');
    const rec = stored[phone] || {};
    const notes = Array.isArray(rec.notes) ? rec.notes : [];
    return {
      shownInAudit: (document.getElementById('note-list').textContent || '').includes('Interested in VIP hotseat'),
      persisted: notes.some((n) => n.text === 'Interested in VIP hotseat on Day 2'),
    };
  }, firstPhone);
  assert('note appears in audit timeline', noteCheck.shownInAudit, '');
  assert('note persists to progress store', noteCheck.persisted, '');

  await page.select('#dossier-status', 'Enrolled');
  await sleep(200);
  const kpi = await page.evaluate(() => ({
    rev: document.getElementById('kpi-rev-value').textContent,
    seats: document.getElementById('kpi-seats-value').textContent,
    fill: document.getElementById('kpi-seats-fill').style.width,
  }));
  assert('enrolling via dossier lifts revenue to 10k', kpi.rev === '₦10,000', kpi.rev);
  assert('enrolling via dossier fills one seat of 50', kpi.seats === '1', kpi.seats);

  await page.keyboard.press('Escape');
  await sleep(250);
  const dossierClosed = await page.evaluate(() => !document.getElementById('dossier-panel').classList.contains('open'));
  assert('escape closes the dossier drawer', dossierClosed, '');

  // 6. Actions popover
  step('section 5: dossier ok')
  await page.evaluate(() => document.getElementById('actions-toggle').click());
  await sleep(250);
  const actions = await page.evaluate(() => ({
    open: document.getElementById('actions-popover').classList.contains('open'),
    expanded: document.getElementById('actions-toggle').getAttribute('aria-expanded'),
    items: document.querySelectorAll('#actions-popover [role="menuitem"]').length,
  }));
  assert('actions popover opens export/import/csv', actions.open && actions.expanded === 'true' && actions.items === 3, JSON.stringify(actions));
  await page.evaluate(() => document.getElementById('actions-backdrop').click());
  await sleep(200);
  const actionsClosed = await page.evaluate(() => !document.getElementById('actions-popover').classList.contains('open'));
  assert('actions popover closes on backdrop', actionsClosed, '');

  // 7. Sidebar: objections -> closing arsenal
  step('section 6: actions ok')
  await page.click('#sidebar [data-nav="objections"]');
  await sleep(250);
  const arsenal = await page.evaluate(() => ({
    open: document.getElementById('arsenal-panel').classList.contains('open'),
    hasBankMessage: (document.getElementById('arsenal-content').textContent || '').includes('Copy payment message'),
    items: document.querySelectorAll('#arsenal-content .arsenal-item').length,
  }));
  assert('objections nav opens closing arsenal', arsenal.open && arsenal.hasBankMessage, JSON.stringify(arsenal));
  assert('arsenal ships payment + niche + objection reframes', arsenal.items >= 12, 'items=' + arsenal.items);
  await page.evaluate(() => document.getElementById('arsenal-backdrop').click());
  await sleep(200);

  // 8. Zen speed-run: keyboard W/E/S + digits
  step('section 7: arsenal ok')
  await page.evaluate(() => { document.getElementById('zen-trigger').click(); });
  step('zen: trigger clicked')
  await sleep(300);
  const zen1 = await page.evaluate((nameExpected) => ({
    open: document.getElementById('zen-overlay').classList.contains('open'),
    pos: document.getElementById('zen-pos').textContent,
    name: document.getElementById('zen-name').textContent,
    angleButtons: document.querySelectorAll('#zen-angles [data-zen-angle]').length,
    msgLen: document.getElementById('zen-msg').textContent.length,
    chipVisible: !document.getElementById('zen-chip').classList.contains('hidden'),
  }), SORTED[0].name);
  assert('zen opens a focused speed-run overlay', zen1.open && zen1.pos === '1 / ' + TOTAL, zen1.pos);
  assert('zen leads with the top-scored lead', zen1.name === SORTED[0].name, zen1.name + ' vs ' + SORTED[0].name);
  assert('zen loads the 4 dispatch angles', zen1.angleButtons === 4, 'angles=' + zen1.angleButtons);
  assert('zen surfaces a scripted message', zen1.msgLen > 30, 'len=' + zen1.msgLen);

  await page.keyboard.press('2');
  step('zen: digit 2 sent')
  await sleep(100);
  const digitAngle = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('#zen-angles [data-zen-angle]')];
    return { pressed: btns[1].getAttribute('aria-pressed'), active: btns[1].classList.contains('active') };
  });
  assert('digit hotkey 2 switches dispatch angle', digitAngle.pressed === 'true' && digitAngle.active, JSON.stringify(digitAngle));

  await page.keyboard.press('ArrowRight');
  step('zen: arrow sent')
  await sleep(150);
  const zen2 = await page.evaluate((nameExpected) => ({
    pos: document.getElementById('zen-pos').textContent,
    name: document.getElementById('zen-name').textContent,
  }), SORTED[1].name);
  assert('arrow key advances the queue', zen2.pos === '2 / ' + TOTAL && zen2.name === SORTED[1].name, zen2.pos);

  await page.keyboard.press('e');
  step('zen: e sent')
  await sleep(200);
  const zenE = await page.evaluate(() => ({
    pos: document.getElementById('zen-pos').textContent,
    rev: document.getElementById('kpi-rev-value').textContent,
    seats: document.getElementById('kpi-seats-value').textContent,
  }));
  assert('E key enrolls and advances', zenE.pos === '3 / ' + TOTAL, zenE.pos);
  assert('E key enrollment lifts revenue to 20k', zenE.rev === '₦20,000', zenE.rev);
  assert('E key enrollment fills second seat', zenE.seats === '2', zenE.seats);

  await page.keyboard.press('1');
  step('zen: digit 1 sent')
  await sleep(100);
  await page.keyboard.press('w');
  step('zen: w sent')
  await sleep(200);
  const zenW = await page.evaluate((phone) => {
    const stored = JSON.parse(localStorage.getItem('soc_progress_v1') || '{}');
    return {
      pos: document.getElementById('zen-pos').textContent,
      status: (stored[phone] || {}).status || '',
      openedUrl: window.__flowdeskLastOpened || '',
    };
  }, SORTED[2].phone);
  assert('W key marks current lead as sent', zenW.pos === '4 / ' + TOTAL && zenW.status === 'Contacted', JSON.stringify(zenW));
  assert('W key opens the wa.me link for that lead', /^https:\/\/wa\.me\/\d+\?text=/.test(zenW.openedUrl), zenW.openedUrl.slice(0, 60));

  await page.keyboard.press('Escape');
  step('zen: escape sent (stop)')
  await sleep(250);
  const zenStopped = await page.evaluate(() => ({
    closed: !document.getElementById('zen-overlay').classList.contains('open'),
    trigger: document.getElementById('zen-trigger').textContent,
  }));
  assert('escape ends the zen run', zenStopped.closed && /Zen Run/.test(zenStopped.trigger), zenStopped.trigger);

  // 9. Mobile 375px layout
  step('section 8: zen ok')
  await page.setViewport({ width: 375, height: 740, deviceScaleFactor: 1 });
  step('mobile: viewport set')
  await sleep(200);
  const mobile = await page.evaluate(() => {
    const sidebar = getComputedStyle(document.getElementById('sidebar')).display;
    const tbody = document.getElementById('leads-table');
    document.querySelectorAll('#mobile-nav [data-nav="leads"]');
    return {
      sidebarHidden: sidebar === 'none',
      mobileNav: [...document.querySelectorAll('#mobile-nav [data-nav]')].map((b) => b.dataset.nav),
      noHScroll: document.documentElement.scrollWidth <= 375,
      rows: tbody.querySelectorAll('tr').length,
    };
  });
  assert('sidebar collapses on mobile', mobile.sidebarHidden, '');
  assert('mobile nav mirrors the app nav', ['overview', 'leads', 'zen', 'objections', 'funnel'].every((i) => mobile.mobileNav.includes(i)), mobile.mobileNav.join(','));
  assert('no horizontal overflow at 375px', mobile.noHScroll, 'scrollW=' + mobile.noHScroll);
  assert('table still renders on mobile', mobile.rows === 48, 'rows=' + mobile.rows);

  const mobilePhone = await page.evaluate(() => document.querySelector('#leads-table tr').getAttribute('data-phone'));
  step('mobile: row clicked for dossier')
  await page.evaluate(() => { document.querySelector('#leads-table tr').click(); });
  step('mobile: dossier opened')
  await sleep(300);
  const mobileDossier = await page.evaluate(() => {
    const panel = document.getElementById('dossier-panel');
    return { open: panel.classList.contains('open'), width: Math.round(panel.getBoundingClientRect().width) };
  });
  assert('dossier drawer fits the 375px screen', mobileDossier.open && mobileDossier.width <= 375, 'w=' + mobileDossier.width);
  await page.keyboard.press('Escape');
  step('mobile: dossier closed')
  await sleep(200);

  await page.evaluate(() => { document.getElementById('zen-trigger').click(); });
  step('mobile: zen opened')
  await sleep(250);
  const mobileZen = await page.evaluate(() => {
    const card = document.getElementById('zen-card');
    return { open: document.getElementById('zen-overlay').classList.contains('open'), width: Math.round(card.getBoundingClientRect().width) };
  });
  assert('zen card fits the 375px screen', mobileZen.open && mobileZen.width <= 375, 'w=' + mobileZen.width);
  await page.keyboard.press('Escape');
  await sleep(150);

  // 10. Funnel non-regression
  step('section 9: mobile ok')
  for (const p of ['/', '/step-2.html', '/step-3.html', '/leads/leads-dashboard.html']) {
    let st = -1;
    try {
      const r = await fetch(BASE + p);
      st = r.status;
    } catch (e) {}
    assert('funnel route reachable ' + p, st === 200, 'status=' + st);
  }

  assert('no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
}

let failed = 0;
step('section 10: routes ok — results:')
for (const r of results) {
  console.log(`  [${r.pass ? 'PASS' : 'FAIL'}] ${r.name}${r.detail ? ' - ' + r.detail : ''}`);
  if (!r.pass) failed++;
}
console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);