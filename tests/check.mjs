#!/usr/bin/env node
// Data-invariant + golden-value checks for the rate data embedded in index.html.
// No dependencies: node tests/check.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`  ok  ${name}`); }
  else { failures++; console.error(`FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

// ---- extract embedded arrays ----
const fleetM = html.match(/const FLEET_MACHINES = (\[.*?\]);/s);
const portM = html.match(/const PORTABLE_EQUIPMENT = (\[.*?\]);/s);
check('FLEET_MACHINES present', !!fleetM);
check('PORTABLE_EQUIPMENT present', !!portM);
const fleet = JSON.parse(fleetM[1].replaceAll('<\\/', '</'));
const portable = JSON.parse(portM[1].replaceAll('<\\/', '</'));

// ---- sizes ----
check('518 fleet units', fleet.length === 518, `got ${fleet.length}`);
check('41 portable items (36 Excel + 5 catalogue extras)', portable.length === 41, `got ${portable.length}`);

// ---- per-unit invariants ----
let badTier = [], badRound = [], badKm = [], badLabel = 0;
for (const m of fleet) {
  for (const g of ['h', 'dy']) {
    const r = m.r[g];
    if (!(r.fw >= r.w && r.w >= r.d && r.d > 0)) badTier.push(`${m.ec || m.reg} ${g}: ${JSON.stringify(r)}`);
    // wet tier rounds to Rs.50 unless clamped to the fully-wet or dry bound
    if (r.w % 50 !== 0 && r.w !== r.fw && r.w !== r.d) badRound.push(`${m.ec || m.reg} ${g}.w=${r.w}`);
  }
  if (m.r.km) {
    const k = m.r.km;
    if (!(k.fw >= k.w && k.w >= k.d && k.d > 0)) badKm.push(`${m.ec || m.reg} km: ${JSON.stringify(k)}`);
    if (k.w % 5 !== 0 && k.w !== k.fw) badKm.push(`${m.ec || m.reg} km.w=${k.w} not %5`);
  }
  if (!m.label || !m.label.trim()) badLabel++;
  // op may be 0 (e.g. Motor Bicycles are self-ridden — no operator supplied)
  if (!(m.fuel > 0 && m.op >= 0)) badTier.push(`${m.ec || m.reg} fuel/op: ${m.fuel}/${m.op}`);
}
check('tier ordering fw ≥ w ≥ d > 0 (hourly & daily)', badTier.length === 0, badTier.slice(0, 3).join('; '));
check('wet tier rounded to Rs.50 (or clamped)', badRound.length === 0, badRound.slice(0, 3).join('; '));
check('per-km tiers ordered & rounded to Rs.5', badKm.length === 0, badKm.slice(0, 3).join('; '));
check('all labels non-empty', badLabel === 0, `${badLabel} empty`);

const kmUnits = fleet.filter(m => m.r.km);
check('exactly 210 per-km units', kmUnits.length === 210, `got ${kmUnits.length}`);
check('km flag matches km rates', fleet.every(m => !!m.km === !!m.r.km));

const est = fleet.filter(m => m.est === 1);
check('44 engineering-fallback units flagged est:1', est.length === 44, `got ${est.length}`);

// ---- golden values (LB-22 Backhoe: dry 2000 + op 650×1.2 = 2780 → 2800; daily 7600 + 650×4×1.2 = 10720 → 10700) ----
const lb22 = fleet.find(m => m.ec === 'LB-22');
check('golden LB-22 exists', !!lb22);
check('golden LB-22 hourly {4150, 2800, 2000}',
  lb22.r.h.fw === 4150 && lb22.r.h.w === 2800 && lb22.r.h.d === 2000, JSON.stringify(lb22.r.h));
check('golden LB-22 daily {15800, 10700, 7600}',
  lb22.r.dy.fw === 15800 && lb22.r.dy.w === 10700 && lb22.r.dy.d === 7600, JSON.stringify(lb22.r.dy));
check('golden LB-22 fuel/op {2101, 650}', lb22.fuel === 2101 && lb22.op === 650, `${lb22.fuel}/${lb22.op}`);
check('golden LB-22 label preserved',
  lb22.label === 'LB-22 · ZB-2586 · Backhoe Loader · BOB CAT B760 (2021)', lb22.label);

// per-km golden: BD-05 pkw 285 / pkd 115, op share of gap rounded to 5, within [d, fw]
const bd05 = fleet.find(m => m.ec === 'BD-05');
check('golden BD-05 per-km tiers {285, w, 115}',
  bd05 && bd05.r.km && bd05.r.km.fw === 285 && bd05.r.km.d === 115 &&
  bd05.r.km.w >= 115 && bd05.r.km.w <= 285 && bd05.r.km.w % 5 === 0,
  bd05 ? JSON.stringify(bd05.r.km) : 'missing');

// ---- portable invariants ----
let badPort = portable.filter(p => !(p.dw >= p.dd && p.dd > 0 && p.label));
check('portable dw ≥ dd > 0 with labels', badPort.length === 0, JSON.stringify(badPort[0] || ''));

// catalogue extras: Light Plant + Concrete Mixer present with wet/dry day rates
const lightPlants = portable.filter(p => p.cat === 'Light Plant');
const mixers = portable.filter(p => p.cat === 'Concrete Mixer');
check('2 Light Plant items', lightPlants.length === 2, `got ${lightPlants.length}`);
check('3 Concrete Mixer items', mixers.length === 3, `got ${mixers.length}`);
check('golden Concrete Mixer 10/7 drum {4500, 3000}',
  mixers.some(p => p.dw === 4500 && p.dd === 3000));

// ---- safety: no script-breaking sequences inside the generated data ----
const dataBlock = html.match(/==FLEET-DATA:BEGIN==[\s\S]*?==FLEET-DATA:END==/)[0];
check('no raw </script in data block', !dataBlock.includes('</script'));

// ---- the functions the UI relies on exist exactly once ----
for (const fn of ['getRateFor', 'applyAutoRate', 'setRateBasis', 'renderRateMatrix',
                  'updateMatrixActive', 'selectRateCell', 'onRateEdited', 'basisWording']) {
  const n = (html.match(new RegExp(`function ${fn}\\(`, 'g')) || []).length;
  check(`function ${fn} defined once`, n === 1, `found ${n}`);
}
check('legacy setPortableBasis removed', !html.includes('setPortableBasis'));

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
