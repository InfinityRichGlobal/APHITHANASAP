const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.env.ASSET_TEST_SOURCE || path.join(__dirname, '..');
const backend = fs.readFileSync(path.join(root, 'รหัส.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function fn(source, name) {
  const start = source.search(new RegExp('^function ' + name + '\\(', 'm'));
  assert(start >= 0, 'Missing function ' + name);
  const end = source.indexOf('\n}', start);
  return source.slice(start, end + 2);
}
function row(id, status, principal, name = 'แปลงทดสอบ ' + id) {
  const r = Array(54).fill('');
  r[0] = id; r[1] = name; r[2] = status; r[15] = principal;
  r[12] = new Date(2025, 8, 16); r[13] = new Date(2027, 8, 16);
  r[18] = 14000; r[19] = 168000; r[21] = 'นายทุนทดสอบ';
  r[26] = 60000; r[33] = 720000;
  return r;
}
function fixture(rows) {
  const data = [Array(54).fill('header'), ...rows];
  let reads = 0;
  const sent = [], telegram = [];
  const c = vm.createContext({
    Date, console, LINE: { sheetData: 'DATABASE', webUrl: 'https://example.test/' },
    THAI_MONTHS_FULL: ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'],
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName(name) {
      assert.equal(name, 'DATABASE');
      // Deliberately expose no write API: these reports must only read the sheet.
      return { getDataRange: () => ({ getValues() { reads++; return data.map(r => r.slice()); } }) };
    } }) },
    pushFlex: (...args) => sent.push(args),
    sendMonthlyTelegramSummary: (...args) => telegram.push(args),
    getUserType: () => 'admin', currentUserClass: 'admin',
    showDashboardCards: (type, active, all) => { c.webActive = active; c.webAll = all; }
  });
  for (const name of ['COL', 'STYLE']) {
    const start = backend.indexOf('const ' + name + ' = {');
    vm.runInContext(backend.slice(start, backend.indexOf('\n};', start) + 3), c);
  }
  for (const name of ['readAssets','toCE','daysLeft','baht','fmtDate','ageText','ageMonthsDays','monthsForInterest',
    'parseMonthsFromAgeText','formatPaymentAmount','paymentItemBox','fmtUpdateDate','miniRow','txt','bubble','textMsg','plotBubble',
    'plotAdvanceBubble','expireMonthCarousel','overviewFlex','getMonthlyFlex','monthlySummary',
    'makeMonthlyOverviewBubble','buildMonthlyCarousel','buildMonthlyFlexCard','makeCategoryPlotBubble','alertItemBox']) {
    vm.runInContext(fn(backend, name), c);
  }
  for (const name of ['sumOutstandingPrincipal_', 'readPortfolioData_']) {
    if (backend.includes('function ' + name + '(')) vm.runInContext(fn(backend, name), c);
  }
  vm.runInContext(fn(html, 'updateStatistics'), c);
  c.updateStatistics(rows);
  return { c, data, sent, telegram, reads: () => reads };
}
function texts(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return (tree.type === 'text' ? [tree] : []).concat(Object.values(tree).flatMap(texts));
}
function values(tree) { return texts(tree).map(t => t.text); }
function pair(tree, label) {
  if (!tree || typeof tree !== 'object') return null;
  if (tree.type === 'box' && tree.contents?.[0]?.text === label) return tree.contents[1];
  for (const value of Object.values(tree)) { const found = pair(value, label); if (found) return found; }
  return null;
}
const statuses = ['ดำเนินการอยู่', 'ดำเนินการอยู่ (ต่อดอก)', 'อยู่ระหว่างผ่อนผัน', 'ยึดทรัพย์', 'ไถ่ถอนแล้ว'];

test('LINE overview and both monthly paths use the same principal as the web dashboard', () => {
  const rows = statuses.map((s, i) => row(i + 1, s, [20000000,15500000,2000000,700000,9000000][i]));
  const { c, data, sent, telegram, reads } = fixture(rows);
  const before = JSON.stringify(data);
  assert.equal(c.webActive[15], 38200000);
  assert.equal(c.webAll[15], 47200000);
  assert.equal(pair(c.overviewFlex(), '💰 เงินต้นรวม').text, '38,200,000 ฿');
  assert(values(c.getMonthlyFlex()).includes('38,200,000 ฿'));
  c.monthlySummary(); // All message senders are test doubles; nothing leaves this process.
  assert(values(sent[0][1]).includes('38,200,000 ฿'));
  assert.equal(telegram[0][1], c.webActive[15]);
  assert.equal(reads(), 3, 'one sheet read per report');
  assert.equal(JSON.stringify(data), before, 'existing rows remain byte-for-byte identical');
  assert.equal(pair(c.overviewFlex(), '📈 ดอกนายทุน/เดือน').text, '120,000 ฿', 'interest eligibility stays unchanged');
});

test('principal follows web row-ID and redemption rules even with incomplete or orphan rows', () => {
  const rows = [row(1, 'อยู่ระหว่างผ่อนผัน', 250000.75), row(2, '', '123456.50', ''),
    row(3, 'ไถ่ถอนแล้ว', 900000), row('', 'ดำเนินการอยู่', 888888), Array(54).fill('')];
  const { c } = fixture(rows);
  assert.equal(c.webActive[15], 373457.25);
  assert.equal(c.readPortfolioData_().principal, c.webActive[15]);
  assert.equal(pair(c.overviewFlex(), '💰 เงินต้นรวม').text, c.baht(c.webActive[15]) + ' ฿');
});

test('empty and fully redeemed portfolios report zero outstanding principal', () => {
  for (const rows of [[], [row(1, 'ไถ่ถอนแล้ว', 700000)]]) {
    const { c } = fixture(rows);
    assert.equal(pair(c.overviewFlex(), '💰 เงินต้นรวม').text, '0 ฿');
    assert(values(c.getMonthlyFlex()).includes('0 ฿'));
  }
});

test('monthly due and attention lists retain their original eligibility', () => {
  const rows = statuses.map((s, i) => row(i + 1, s, 100000));
  for (const r of rows) r[13] = new Date();
  const { c, telegram } = fixture(rows);
  c.monthlySummary();
  assert.deepEqual(Array.from(telegram[0][4], a => a.status), statuses.slice(0, 2));
  assert.deepEqual(Array.from(telegram[0][5], g => g.a.status), [statuses[2]]);
  assert.equal(telegram[0][2], 120000);
  assert.equal(telegram[0][3], 1440000);
});

test('maturity summary and small asset cards retain full amounts, ages and countdowns', () => {
  const rows = [row(1, statuses[0], 4500000), row(2, statuses[1], 10200000)];
  const { c } = fixture(rows);
  const messages = c.expireMonthCarousel(8, 2027);
  assert.equal(pair(messages[0], 'เงินต้นรวม').text, '14,700,000 ฿');
  assert.equal(pair(messages[0], 'ดอกนายทุน/ปีรวม').text, '1,440,000 ฿');
  const card = c.plotBubble(c.readAssets()[0], '#EF6C00');
  assert.equal(pair(card, 'เงินต้น').text, '4,500,000 ฿');
  assert.equal(pair(card, 'ดอกนายทุน/ปี').text, '720,000 ฿');
  for (const label of ['เงินต้น', 'ดอกนายทุน/ปี', 'อายุสัญญา', 'ครบกำหนด']) {
    assert.equal(pair(card, label).wrap, true, label);
    assert(!pair(card, label).maxLines, label + ' must not be line-clamped');
  }
  for (const text of texts(messages)) {
    assert.equal(text.wrap, true, text.text);
    assert(!text.maxLines, text.text);
  }
});

test('detail card renders the complete status and preserves financial and payment details', () => {
  const r = row(1, statuses[1], 700000);
  r[26] = 9333; r[33] = 112000; r[35] = 28000;
  r[42] = '140000';
  const { c } = fixture([r]);
  const card = c.plotAdvanceBubble(c.readAssets()[0]);
  const status = pair(card, 'สถานะ');
  assert.equal(status.text, statuses[1]);
  assert.equal(status.wrap, true);
  assert(!status.maxLines);
  assert.equal(pair(card, 'เงินต้น').text, '700,000 ฿');
  assert.equal(pair(card, 'นายทุนได้/ปี').text, '112,000 ฿');
  assert(values(card).includes('28,000 ฿'));
  assert(values(card).some(t => t.includes('140,000')));
});

test('key/value layout gives long values at least half the available width and permits full wrapping', () => {
  const { c } = fixture([]);
  for (const [label, value] of [['เงินต้น', '999,999,999 ฿'], ['อายุสัญญา','12 ปี 11 เดือน 29 วัน'],
    ['สถานะ', statuses[1]], ['ดอกนายทุน/ปีรวม', '2,352,000 ฿']]) {
    const box = c.miniRow(label, value);
    assert(box.contents[1].flex >= box.contents[0].flex);
    for (const t of box.contents) { assert.equal(t.wrap, true); assert(!t.maxLines); }
    assert.equal(box.height, undefined);
    assert.equal(box.maxHeight, undefined);
    assert.equal(box.contents[1].text, value);
  }
});
