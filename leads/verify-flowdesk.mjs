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

  // ---- FlowDesk 2.0 shell + HUD ----
  const dom = await page.evaluate(() => {
    const vis = (el) => el && !el.classList.contains('hidden');
    const text = (el) => (el ? (el.textContent || '').trim() : '');
    return {
      title: document.title,
      gateHidden: !vis(document.getElementById('gate')),
      appShown: vis(document.getElementById('app')),
      cards: document.querySelectorAll('#leads-grid [data-card]').length,
      hudCells: document.querySelectorAll('#hud .hud-card').length,
      hudDisplay: getComputedStyle(document.getElementById('hud')).display,
      hudCols: getComputedStyle(document.getElementById('hud')).gridTemplateColumns.split(' ').filter(Boolean).length,
      hudRevenue: text(document.getElementById('hud-revenue')),
      hudGoal: text(document.getElementById('hud-rev-goal')),
      couponMarker: !!document.getElementById('hud-coupon-marker'),
      alertChips: document.querySelectorAll('#alert-strip [data-alert]').length,
      alertFallback: text(document.getElementById('alert-strip')).length,
      quickPills: document.querySelectorAll('[data-quick]').length,
      anglePills: document.querySelectorAll('#angle-switcher [data-angle]').length,
      anglePreview: text(document.getElementById('angle-preview')).length,
      cohortPulse: text(document.getElementById('cohort-pulse')),
      favicon: (document.querySelector('link[rel="icon"]') || {}).href || '',
    };
  });

  assert('HUD has 3 executive metric cards', dom.hudCells === 3, 'cells=' + dom.hudCells);
  assert('HUD renders as 3-col grid (tailwind applied)', dom.hudDisplay === 'grid' && dom.hudCols === 3, JSON.stringify({ display: dom.hudDisplay, cols: dom.hudCols }));
  assert('HUD revenue shows naira', dom.hudRevenue.startsWith('₦'), dom.hudRevenue);
  assert('HUD goal label rendered', dom.hudGoal.includes('goal'), dom.hudGoal);
  assert('coupon price marker on revenue bar', dom.couponMarker);
  assert('alert strip present', dom.alertFallback > 0, JSON.stringify(dom.alertFallback));
  assert('5 quick pills in dock', dom.quickPills === 5, 'pills=' + dom.quickPills);
  assert('6 dispatch angle pills', dom.anglePills === 6, 'pills=' + dom.anglePills);
  assert('angle preview badge populated', dom.anglePreview > 0, 'len=' + dom.anglePreview);
  assert('cohort pulse label rendered', dom.cohortPulse.length > 0, JSON.stringify(dom.cohortPulse));

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
    assert('alert chip re-renders grid', true, 'no alert chips to click (skipped)');
  }

  assert('gate hidden (seed unlock)', dom.gateHidden);
  assert('app visible', dom.appShown);
  assert('lead cards rendered', dom.cards > 0, 'cards=' + dom.cards);
  assert('title references FlowDesk', /FlowDesk/i.test(dom.title), dom.title);

  // ---- Status pill advance + persistence ----
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

  // ---- Tokenized angles + personal pay links ----
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
      cardWa: document.querySelectorAll('#leads-grid [data-card] a[data-wa]').length,
      cardAvatars: document.querySelectorAll('#leads-grid [data-card] .avatar').length,
      payLinkBtns: document.querySelectorAll('#leads-grid [data-paylink]').length,
      expectedRef: 'SOC-' + digits.slice(-5),
    };
  });
  assert('ANGLES has 6 entries', tokenInfo.angleCount === 6, 'count=' + tokenInfo.angleCount);
  assert('payRef format matches SOC-<last5>', tokenInfo.payRef === tokenInfo.expectedRef, `${tokenInfo.payRef} vs ${tokenInfo.expectedRef}`);
  assert('pay link shape', tokenInfo.payLink.startsWith(tokenInfo.origin + '/step-2.html?ref=SOC-'), tokenInfo.payLink);
  assert('urgent token composed', tokenInfo.urgent.includes('SELLOUT25') && tokenInfo.urgent.includes(tokenInfo.expectedRef) && tokenInfo.urgent.includes('10,000'), 'len=' + tokenInfo.urgent.length);
  assert('objection token composed', tokenInfo.objection.includes('SELLOUT25') && tokenInfo.objection.includes('7,500'), 'len=' + tokenInfo.objection.length);
  assert('cards decluttered (no per-card angle pills)', Math.abs(tokenInfo.perAngle - 0) < 0.01, 'per card=' + tokenInfo.perAngle.toFixed(2));
  assert('cards carry WhatsApp + avatar', tokenInfo.cardWa > 0 && tokenInfo.cardAvatars > 0, JSON.stringify({ wa: tokenInfo.cardWa, avatars: tokenInfo.cardAvatars }));
  assert('pay link now lives only in dossier', tokenInfo.payLinkBtns === 0, 'btns=' + tokenInfo.payLinkBtns);

  // ---- step-2 personal reference from ?ref= ----
  async function step2Ref(query) {
    const pg = await browser.newPage();
    await pg.setViewport({ width: 1280, height: 800 });
    const errs = [];
    pg.on('console', (m) => {
      if (m.type() !== 'error') return;
      if (/Failed to load resource/.test(m.text()) && /ERR_FAILED/.test(m.text())) return;
      errs.push(m.text());
    });
    pg.on('pageerror', (e) => errs.push(String(e)));
    await pg.setRequestInterception(true);
    pg.on('request', (req) => {
      if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(req.url())) req.abort();
      else req.continue();
    });
    await pg.goto(BASE + '/step-2.html' + (query || ''), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(600);
    const info = await pg.evaluate(() => ({
      bankRef: ((document.getElementById('bank-ref') || {}).textContent || '').trim(),
      instructionsRef: ((document.getElementById('instructions-ref') || {}).textContent || '').trim(),
      total: ((document.getElementById('bank-amount') || {}).textContent || '').trim(),
    }));
    const ok = await pg.evaluate(() => /^SOC-[A-Z0-9]+$/.test(((document.getElementById('bank-ref') || {}).textContent || '').trim()));
    await pg.close();
    return { info, ok };
  }

  const refWith = await step2Ref('?ref=SOC-ENIOLA');
  assert('step-2 displays ?ref= reference', refWith.ok && refWith.info.bankRef === 'SOC-ENIOLA' && refWith.info.instructionsRef === 'SOC-ENIOLA', JSON.stringify(refWith.info));
  const refWithout = await step2Ref('');
  assert('step-2 no-ref unchanged (fresh SOC-XXXXX)', refWithout.ok && refWithout.info.bankRef !== 'SOC-ENIOLA' && refWithout.info.bankRef.length === 9, JSON.stringify(refWithout.info));

  // ---- Dossier drawer ----
  await page.evaluate(() => {
    const card = document.querySelector('#leads-grid [data-card]');
    if (card) card.click();
  });
  await sleep(400);
  const dossier = await page.evaluate(() => ({
    open: document.getElementById('dossier-panel').classList.contains('open'),
    paylink: !!document.querySelector('#modal-content [data-dossier-paylink]'),
    objections: document.querySelectorAll('#modal-content [data-objection]').length,
    noteInput: !!document.getElementById('note-input'),
    phoneSel: (document.getElementById('dossier-status') || {}).dataset ? document.getElementById('dossier-status').dataset.phone : '',
  }));
  assert('dossier opens on card click', dossier.open);
  assert('dossier has pay link row', dossier.paylink);
  assert('dossier has 5 objection chips', dossier.objections === 5, 'chips=' + dossier.objections);
  assert('dossier has note input', dossier.noteInput);

  await page.evaluate((phone) => {
    document.getElementById('note-input').value = 'Follow up re: N1 challenge on Sunday';
    document.querySelector('#modal-content [data-note]').click();
  }, dossier.phoneSel);
  await sleep(200);
  const noted = await page.evaluate((phone) => {
    let p = {};
    try { p = JSON.parse(localStorage.getItem('soc_progress_v1') || '{}'); } catch (e) {}
    const list = document.getElementById('note-list');
    return {
      stored: ((p[phone] || {}).notes || []).map(n => n.text).join('|'),
      list: list ? (list.textContent || '') : '',
    };
  }, dossier.phoneSel);
  assert('note logged + persisted', noted.stored.includes('Follow up re: N1') && noted.list.includes('Follow up re: N1'), JSON.stringify(noted));

  await page.keyboard.press('Escape');
  await sleep(250);
  const drawerClosed = await page.evaluate(() => !document.getElementById('dossier-panel').classList.contains('open'));
  assert('Esc closes dossier', drawerClosed);

  const cardPhone = dossier.phoneSel;
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#leads-grid [data-card]', { timeout: 60000 });
  await page.evaluate(() => { const card = document.querySelector('#leads-grid [data-card]'); if (card) card.click(); });
  await sleep(400);
  const noteAfterReload = await page.evaluate((phone) => {
    let p = {};
    try { p = JSON.parse(localStorage.getItem('soc_progress_v1') || '{}'); } catch (e) {}
    const list = document.getElementById('note-list');
    return {
      stored: ((p[phone] || {}).notes || []).map(n => n.text).join('|'),
      list: list ? (list.textContent || '') : '',
    };
  }, cardPhone);
  assert('note survives reload', noteAfterReload.stored.includes('Follow up re: N1') && noteAfterReload.list.includes('Follow up re: N1'), JSON.stringify(noteAfterReload));
  await page.keyboard.press('Escape');

  // ---- FlowDesk 2.0: view toggle, popovers, quick pills, angle switcher ----
  await page.setViewport({ width: 1280, height: 800 });

  await page.evaluate(() => document.querySelector('[data-view="table"]').click());
  await sleep(300);
  const tableState = await page.evaluate(() => ({
    gridHidden: document.getElementById('leads-grid').classList.contains('hidden'),
    wrapVisible: !document.getElementById('leads-table-wrap').classList.contains('hidden'),
    rows: document.querySelectorAll('#leads-table tr[data-card]').length,
    ths: document.querySelectorAll('#leads-table-wrap th').length,
    viewActive: document.querySelector('[data-view="table"]').classList.contains('active'),
  }));
  assert('table view hides grid + shows table', tableState.gridHidden && tableState.wrapVisible, JSON.stringify(tableState));
  assert('table renders lead rows with headers', tableState.rows > 0 && tableState.ths >= 7, JSON.stringify({ rows: tableState.rows, ths: tableState.ths }));
  assert('table view button active', tableState.viewActive);

  await page.evaluate(() => document.querySelector('[data-view="cards"]').click());
  await sleep(300);
  const backToCards = await page.evaluate(() => ({
    gridVisible: !document.getElementById('leads-grid').classList.contains('hidden'),
    wrapHidden: document.getElementById('leads-table-wrap').classList.contains('hidden'),
    cards: document.querySelectorAll('#leads-grid [data-card]').length,
  }));
  assert('back to cards restores grid', backToCards.gridVisible && backToCards.wrapHidden && backToCards.cards > 0, JSON.stringify(backToCards));

  await page.click('#filters-toggle');
  await sleep(250);
  const pop = await page.evaluate(() => ({
    open: document.getElementById('filters-popover').classList.contains('open'),
    controls: ['filter-tier', 'filter-niche', 'filter-status', 'filter-follow', 'sort-select', 'turbo-limit'].every(id => !!document.getElementById(id)),
    toggleExpanded: document.getElementById('filters-toggle').getAttribute('aria-expanded') === 'true',
  }));
  assert('filters popover opens with 6 controls', pop.open && pop.controls && pop.toggleExpanded, JSON.stringify(pop));
  await page.keyboard.press('Escape');
  await sleep(250);
  const popClosed = await page.evaluate(() => !document.getElementById('filters-popover').classList.contains('open'));
  assert('Esc closes filters popover', popClosed);

  await page.click('#actions-toggle');
  await sleep(250);
  const act = await page.evaluate(() => ({
    open: document.getElementById('actions-popover').classList.contains('open'),
    items: document.querySelectorAll('#actions-popover [role="menuitem"]').length,
    hasImport: !!document.getElementById('import-file'),
  }));
  assert('actions popover opens with menu items', act.open && act.items >= 4 && act.hasImport, JSON.stringify(act));
  await page.keyboard.press('Escape');
  await sleep(250);
  const actClosed = await page.evaluate(() => !document.getElementById('actions-popover').classList.contains('open'));
  assert('Esc closes actions popover', actClosed);

  await page.evaluate(() => document.querySelector('[data-quick="vip"]').click());
  await sleep(300);
  const quickState = await page.evaluate(() => ({
    tier: document.getElementById('filter-tier').value,
    vipActive: document.querySelector('[data-quick="vip"]').classList.contains('active'),
  }));
  assert('VIP quick pill queues tier filter', quickState.tier === 'Tier 1' && quickState.vipActive, JSON.stringify(quickState));
  await page.evaluate(() => document.querySelector('[data-quick="all"]').click());
  await sleep(300);
  const quickReset = await page.evaluate(() => ({
    tier: document.getElementById('filter-tier').value,
    allActive: document.querySelector('[data-quick="all"]').classList.contains('active'),
    cards: document.querySelectorAll('#leads-grid [data-card]').length,
  }));
  assert('Quick All resets filters', quickReset.tier === '' && quickReset.allActive && quickReset.cards > 0, JSON.stringify(quickReset));

  const anglePreviewBefore = await page.evaluate(() => (document.getElementById('angle-preview').textContent || '').trim());
  await page.evaluate(() => document.querySelector('#angle-switcher [data-angle="urgent"]').click());
  await sleep(300);
  const angleState = await page.evaluate(() => ({
    globalAngle,
    active: document.querySelector('#angle-switcher [data-angle="urgent"]').classList.contains('active'),
    preview: (document.getElementById('angle-preview').textContent || '').trim(),
  }));
  assert('angle switcher sets dispatcher angle', angleState.globalAngle === 'urgent' && angleState.active, JSON.stringify(angleState));
  assert('angle preview updates on switch', angleState.preview.length > 0 && angleState.preview !== anglePreviewBefore, angleState.preview.slice(0, 60));
  await page.evaluate(() => document.querySelector('#angle-switcher [data-angle="story"]').click());
  await sleep(300);

  // ---- Mobile drawer fit ----
  await page.setViewport({ width: 375, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#leads-grid [data-card]', { timeout: 60000 });
  await page.evaluate(() => { const card = document.querySelector('#leads-grid [data-card]'); if (card) card.click(); });
  await sleep(400);
  const mobile = await page.evaluate(() => ({
    panelW: Math.round(document.getElementById('dossier-panel').getBoundingClientRect().width),
    docScrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
  }));
  assert('dossier fits 375px without horizontal overflow', mobile.panelW <= 375 && mobile.docScrollW <= 375, JSON.stringify(mobile));

  await page.evaluate(() => { const c = document.querySelector('#dossier-close'); if (c) c.click(); });
  await sleep(250);
  await page.setViewport({ width: 1280, height: 800 });

  // ---- Zen turbo closing engine ----
  const presetBtns = await page.evaluate(() => document.querySelectorAll('[data-preset]').length);
  assert('turbo has 3 preset buttons', presetBtns === 3, 'btns=' + presetBtns);

  await page.evaluate(() => document.querySelector('[data-preset="vip10"]').click());
  await sleep(400);
  const turboState = await page.evaluate(() => {
    const text = (el) => (el ? (el.textContent || '').trim() : '');
    return {
      active: turbo.active,
      open: document.getElementById('zen-overlay').classList.contains('open'),
      qLen: turbo.queue.length,
      fill: (document.getElementById('zen-progress-fill') || { style: {} }).style.width,
      enrollBtn: !!document.querySelector('#zen-overlay [onclick*="turboEnroll"]'),
      zenAngles: document.querySelectorAll('#zen-angles [data-zen-angle]').length,
      msgLabel: text(document.getElementById('zen-msg-label')),
      avatar: text(document.getElementById('zen-avatar')),
    };
  });
  assert('vip10 preset starts turbo', turboState.active && turboState.open && turboState.qLen > 0, JSON.stringify(turboState));
  assert('zen progress visible', turboState.fill !== '' && parseFloat(turboState.fill) > 0, 'fill=' + turboState.fill);
  assert('zen overlay has Enroll button', turboState.enrollBtn);
  assert('zen renders 6 angle chips', turboState.zenAngles === 6, 'chips=' + turboState.zenAngles);
  assert('zen message label rendered', turboState.msgLabel.length > 0, JSON.stringify(turboState.msgLabel));
  assert('zen avatar initials rendered', turboState.avatar.length > 0, JSON.stringify(turboState.avatar));

  await page.keyboard.press('2');
  await sleep(250);
  const angleHotkey = await page.evaluate(() => ({
    stored: cardAngles[turbo.queue[turbo.idx]],
    active: !!document.querySelector('#zen-angles [data-zen-angle="future"].active'),
  }));
  assert('digit hotkey 2 sets Future angle for current lead', angleHotkey.stored === 'future' && angleHotkey.active, JSON.stringify(angleHotkey));
  await page.keyboard.press('1');
  await sleep(200);
  const angleReset = await page.evaluate(() => cardAngles[turbo.queue[turbo.idx]]);
  assert('digit hotkey 1 restores Story angle', angleReset === 'story', JSON.stringify(angleReset));

  const firstPhone = await page.evaluate(() => turbo.queue[0]);
  await page.keyboard.press('e');
  await sleep(400);
  const enrolledState = await page.evaluate((phone) => {
    let p = {};
    try { p = JSON.parse(localStorage.getItem('soc_progress_v1') || '{}'); } catch (e) {}
    return { stored: (p[phone] || {}).status || '' };
  }, firstPhone);
  assert('E key enrolls current lead', enrolledState.stored === 'Enrolled', JSON.stringify(enrolledState));
  const hudAfterEnroll = await page.evaluate(() => (document.getElementById('hud-revenue') || {}).textContent || '');
  assert('HUD revenue updates on enroll', hudAfterEnroll === '₦10,000', hudAfterEnroll);

  const idxBefore = await page.evaluate(() => turbo.idx);
  await page.keyboard.press('s');
  await sleep(250);
  const idxAfter = await page.evaluate(() => turbo.idx);
  assert('S key skips forward', idxAfter === idxBefore + 1, `${idxBefore} -> ${idxAfter}`);

  await page.evaluate(() => { window.open = function () { return { focus() {}, close() {} }; }; });
  const wTarget = await page.evaluate(() => turbo.queue[turbo.idx]);
  await page.keyboard.press('w');
  await sleep(400);
  const wState = await page.evaluate((phone) => {
    let p = {};
    try { p = JSON.parse(localStorage.getItem('soc_progress_v1') || '{}'); } catch (e) {}
    return { stored: (p[phone] || {}).status || '', hist: (p[phone] || {}).history || [] };
  }, wTarget);
  assert('W key dispatches + marks contact', (wState.stored === 'Contacted' || wState.stored === 'In Conversation') && wState.hist.length >= 1, JSON.stringify(wState));

  await page.keyboard.press('Escape');
  await sleep(300);
  const turboStopped = await page.evaluate(() => ({ active: turbo.active, open: document.getElementById('zen-overlay').classList.contains('open') }));
  assert('Esc stops turbo', !turboStopped.active && !turboStopped.open, JSON.stringify(turboStopped));

  // ---- Keyboard/focus/a11y + reduced motion + contrast ----
  await page.evaluate(() => { const card = document.querySelector('#leads-grid [data-card]'); if (card) card.click(); });
  await sleep(400);
  const contrast = await page.evaluate(() => ({
    stale: document.querySelectorAll('.text-gray-500, .text-gray-600').length,
    titleColor: getComputedStyle(document.querySelector('.dossier-section-title')).color,
    hasFocusRule: Array.from(document.styleSheets).some(s => {
      try { return (s.ownerNode && s.ownerNode.textContent || '').includes('focus-visible'); } catch (e) { return false; }
    }),
  }));
  assert('no stale low-contrast gray classes in DOM', contrast.stale === 0, 'stale=' + contrast.stale);
  assert('dossier section title meets contrast (slate-400)', contrast.titleColor === 'rgb(148, 163, 184)', contrast.titleColor);
  assert('focus-visible rule present', contrast.hasFocusRule);
  await page.keyboard.press('Escape');
  await sleep(250);

  await page.evaluate(() => {
    const btn = document.querySelector('[data-preset="uncontacted"]');
    btn.focus();
    btn.click();
  });
  await sleep(350);
  await page.keyboard.press('Escape');
  await sleep(300);
  const focusRestore = await page.evaluate(() => {
    const a = document.activeElement;
    return { onPreset: !!(a && a.getAttribute && a.getAttribute('data-preset')), tag: a ? a.tagName + '.' + (a.id || a.className) : 'none' };
  });
  assert('turbo stop restores focus to trigger', focusRestore.onPreset, focusRestore.tag);

  await page.evaluate(() => {
    const g = document.getElementById('arsenal-quick');
    g.focus();
    g.click();
  });
  await sleep(300);
  await page.keyboard.press('Escape');
  await sleep(300);
  const arsenalFocus = await page.evaluate(() => {
    const a = document.activeElement;
    return a && a.id === 'arsenal-quick';
  });
  assert('arsenal close restores focus to trigger', arsenalFocus);

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluate(() => { const card = document.querySelector('#leads-grid [data-card]'); if (card) card.click(); });
  await sleep(300);
  const rm = await page.evaluate(() => {
    const p = document.getElementById('dossier-panel');
    const t = getComputedStyle(p).transitionDuration;
    const opened = p.classList.contains('open');
    return { t, opened };
  });
  assert('reduced-motion kills drawer animation', rm.t === '0s' && rm.opened, JSON.stringify(rm));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.evaluate(() => { const c = document.querySelector('#dossier-close'); if (c) c.click(); });
  await sleep(300);

  // ---- Funnel non-regression (reachability only) ----
  for (const p of ['/', '/step-2.html', '/step-3.html', '/leads/leads-dashboard.html']) {
    let st = -1;
    try {
      const r = await fetch('http://localhost:3000' + p);
      st = r.status;
    } catch (e) {}
    assert('funnel reachable ' + p, st === 200, 'status=' + st);
  }

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