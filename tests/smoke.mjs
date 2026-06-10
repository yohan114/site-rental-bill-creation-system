#!/usr/bin/env node
// End-to-end smoke test of the rate-basis tick system + rate matrix.
// Needs playwright + a chromium build, e.g.:
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers NODE_PATH=$(npm root -g) node tests/smoke.mjs
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not available'); process.exit(0); }

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(join(root, 'index.html')).href;
const LB22 = 'LB-22 · ZB-2586 · Backhoe Loader · BOB CAT B760 (2021)';
const GEN25 = 'Generator · 20–25 kVA (diesel, 3-ph)';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok  ${name}`);
  else { failures++; console.error(`FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('pageerror', e => { failures++; console.error('FAIL  page JS error —', e.message); });
await page.goto(url, { waitUntil: 'domcontentloaded' });

// --- open the rental calculator ---
await page.click('button[title*="Tick Fully Wet"]');
await page.waitForSelector('#rentalCalcModal', { state: 'visible' });

// --- pick a fleet machine: matrix appears, hourly fully-wet auto-applied ---
await page.fill('#calcMachinePick', LB22);
await page.waitForSelector('#rateMatrixWrap', { state: 'visible' });
check('matrix visible after machine pick', true);
check('hourly rate auto-filled 4150', await page.inputValue('#calcHourlyRate') === '4150',
  await page.inputValue('#calcHourlyRate'));
check('9 matrix slots (3 priced hourly + 3 daily + 3 per-km dashes)',
  await page.locator('#rateMatrixWrap button.rm-cell').count() === 6 &&
  await page.locator('#rateMatrixWrap .rm-cell.unavail').count() === 3);
check('active cell = fully wet × hourly',
  await page.locator('.rm-cell.active[data-b="fw"][data-m="hourly"]').count() === 1);

// --- tap the WET × PER-DAY cell: one tap sets basis + mode + rate ---
await page.click('.rm-cell[data-b="w"][data-m="perday"]');
check('day rate auto-filled 10700', await page.inputValue('#calcDayRate') === '10700',
  await page.inputValue('#calcDayRate'));
check('Per-Day mode active', await page.locator('#modeDayBtn.active').count() === 1);
check('WET basis ticked', await page.locator('#basisWBtn.active').count() === 1);
check('basis pill says Wet', (await page.textContent('#rateBasisPill')).trim() === 'Wet');

// --- manual override flags CUSTOM, re-tap restores list rate ---
await page.fill('#calcDayRate', '12000');
check('CUSTOM badge on manual edit',
  (await page.textContent('.rm-cell.active[data-b="w"][data-m="perday"]')).includes('CUSTOM'));
await page.click('.rm-cell[data-b="w"][data-m="perday"]');
check('re-tap restores list rate', await page.inputValue('#calcDayRate') === '10700',
  await page.inputValue('#calcDayRate'));

// --- basis tick buttons re-price instantly ---
await page.click('#basisDBtn');
check('DRY tick → 7600/day', await page.inputValue('#calcDayRate') === '7600',
  await page.inputValue('#calcDayRate'));
await page.click('#basisFwBtn');
check('FULLY WET tick → 15800/day', await page.inputValue('#calcDayRate') === '15800',
  await page.inputValue('#calcDayRate'));

// --- portable equipment: 2-tier, middle tier disabled ---
await page.fill('#calcPortablePick', GEN25);
check('portable: WET row only 2 tiers shown',
  await page.locator('#rateMatrixWrap .rm-rowlabel').count() === 2);
check('portable: middle basis disabled', await page.locator('#basisWBtn[disabled]').count() === 1);
check('portable day rate 12000 (wet)', await page.inputValue('#calcDayRate') === '12000',
  await page.inputValue('#calcDayRate'));

// --- back to fleet, WET hourly under minimum → invoice rows with basis wording ---
await page.evaluate(() => { items.length = 0; renderItems(); calc(); });  // drop seeded demo rows
await page.fill('#calcMachinePick', LB22);
await page.click('.rm-cell[data-b="w"][data-m="hourly"]');
await page.fill('#calcActualHours', '105');
await page.screenshot({ path: '/tmp/smoke_modal.png' });
await page.click('button:has-text("Add to Document")');
const banners = await page.textContent('#itemsBody');
const descs = await page.$$eval('#itemsBody input.cell.left', els => els.map(e => e.value).join('\n'));
check('section banner has machine tag', banners.includes('Backhoe Loader — BOB CAT B760'));
check('row carries basis wording', descs.includes('Hourly, WET — operator incl., fuel by customer'));
check('minimum-guarantee row present', descs.includes('Minimum Guaranteed (120.00 Hrs)'));
const grand = await page.textContent('#grandTotal');
check('grand total computed (120 × 2800 → +SSCL +VAT = 406,392)', grand.includes('406,392.00'), grand);
await page.screenshot({ path: '/tmp/smoke_page.png', fullPage: true });

await browser.close();
console.log(failures === 0 ? '\nSMOKE TEST PASSED' : `\n${failures} SMOKE CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
