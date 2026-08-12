import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PUPPETEER_ROOT =
  process.env.PUPPETEER_ROOT ||
  path.join(os.tmpdir(), 'puppeteer-test');
const CACHE_DIR =
  process.env.PUPPETEER_CACHE ||
  path.join(os.homedir(), '.cache', 'puppeteer');

const [url = 'http://localhost:3000', label = ''] = process.argv.slice(2);
const SHOT_DIR = path.join(__dirname, 'temporary screenshots');

if (!url.startsWith('http')) {
  console.error('Usage: node screenshot.mjs <http-url> [label]');
  process.exit(1);
}

fs.mkdirSync(SHOT_DIR, { recursive: true });

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

function nextIndex() {
  const files = fs.existsSync(SHOT_DIR)
    ? fs.readdirSync(SHOT_DIR).filter((f) => /^screenshot-\d+.*\.png$/.test(f))
    : [];
  let max = 0;
  for (const f of files) {
    const m = f.match(/^screenshot-(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

const index = nextIndex();
const suffix = label ? `-${label}` : '';
const outFile = path.join(SHOT_DIR, `screenshot-${index}${suffix}.png`);

const executablePath = findSystemBrowser();
const profileDir = path.join(
  CACHE_DIR,
  'profile-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
);

const browser = await puppeteer.launch({
  headless: true,
  executablePath: executablePath || undefined,
  userDataDir: profileDir,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.screenshot({ path: outFile });
  console.log(`Saved ${outFile}`);
} finally {
  await browser.close();
  fs.rmSync(profileDir, { recursive: true, force: true });
}
