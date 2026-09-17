const FOLDER_ROOT = '1RyocRNx4r_qlXKLxxo_O10wDtvx0hmih';
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

// ============================================================
// 🛡️ TELEGRAM NOTIFICATION ENGINE (AphithanaSap Guard)
// ============================================================
const TELEGRAM_DEFAULT_CONFIG = {
  token: '8911920669:AAGKAGrKm11XG7iY_Isisyimszr11ZL3k78',
  chatId: '-5218514481'
};

function getTelegramConfig() {
  var token = TELEGRAM_DEFAULT_CONFIG.token;
  var chatId = TELEGRAM_DEFAULT_CONFIG.chatId;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('LINE');
    if (sheet) {
      var rows = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 2).getValues();
      rows.forEach(function(r) {
        var key = String(r[0]).trim();
        var val = String(r[1]).trim();
        if (key === 'telegramToken' && val) token = val;
        if (key === 'telegramChatId' && val) chatId = val;
      });
    }
  } catch (e) {}
  return { token: token, chatId: chatId };
}

function sendTelegram(htmlText) {
  try {
    var cfg = getTelegramConfig();
    if (!cfg.token || !cfg.chatId) return;
    
    var url = 'https://api.telegram.org/bot' + cfg.token + '/sendMessage';
    var payload = {
      chat_id: cfg.chatId,
      text: htmlText,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
    
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (err) {
    console.error('Telegram send error (silent):', err);
  }
}

function getThaiDateTimeStr() {
  return new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) + ' น.';
}

function formatNumTh(n) {
  var num = parseFloat(n);
  if (isNaN(num)) return n || '0';
  return num.toLocaleString('th-TH');
}

// ============================================================
// 🤖 TELEGRAM BOT WEBHOOK & INTERACTIVE MENU ENGINE
// ============================================================
const TELEGRAM_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwVUGfW4hz9lIy5X_xkbwKBLkWfQay22ijogScTjuXhavZNUdgFwREcqnlOcYD4k7-M/exec';

function registerTelegramWebhook() {
  var cfg = getTelegramConfig();
  var url = 'https://api.telegram.org/bot' + cfg.token + '/setWebhook?url=' + encodeURIComponent(TELEGRAM_WEB_APP_URL);
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  Logger.log('Telegram setWebhook response: ' + res.getContentText());
  return res.getContentText();
}

function handleTelegramWebhook(e) {
  try {
    var contents = (e && e.postData && e.postData.contents) || '';
    if (!contents) return ContentService.createTextOutput('NO_CONTENT');
    var body = JSON.parse(contents);

    // 1. กรณีผู้ใช้กดปุ่ม Inline Keyboard (Callback Query)
    if (body.callback_query) {
      handleTelegramCallback(body.callback_query);
      return HtmlService.createHtmlOutput('<h1>200 OK</h1>');
    }

    // 2. กรณีผู้ใช้พิมพ์ข้อความ (Message)
    if (body.message && body.message.text) {
      handleTelegramMessage(body.message);
      return HtmlService.createHtmlOutput('<h1>200 OK</h1>');
    }

  } catch (err) {
    console.error('handleTelegramWebhook error:', err);
  }
  return HtmlService.createHtmlOutput('<h1>200 OK</h1>');
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function parseDateSmart(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    var y = val.getFullYear();
    return new Date(y > 2500 ? y - 543 : y, val.getMonth(), val.getDate());
  }
  var str = String(val).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    var p = str.split('-');
    var yr = parseInt(p[0], 10);
    if (yr > 2500) yr -= 543;
    return new Date(yr, parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    var parts = str.split('/');
    var year = parseInt(parts[2], 10);
    if (year > 2500) year -= 543;
    return new Date(year, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
  }
  var parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    var y2 = parsed.getFullYear();
    return new Date(y2 > 2500 ? y2 - 543 : y2, parsed.getMonth(), parsed.getDate());
  }
  return null;
}

function formatDateTh(d) {
  if (!d) return '-';
  var dateObj = (d instanceof Date) ? d : parseDateSmart(d);
  if (!dateObj || isNaN(dateObj.getTime())) return '-';
  var m = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return dateObj.getDate() + ' ' + m[dateObj.getMonth()] + ' ' + (dateObj.getFullYear() + 543).toString().slice(-2);
}

function getDaysLeft(d) {
  var dateObj = (d instanceof Date) ? d : parseDateSmart(d);
  if (!dateObj) return null;
  var today = new Date(); today.setHours(0,0,0,0);
  var target = new Date(dateObj); target.setHours(0,0,0,0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function getStatusEmoji(status) {
  if (!status) return '⚪';
  if (status.indexOf('ต่อดอก') !== -1) return '🔵';
  if (status.indexOf('ดำเนินการอยู่') !== -1) return '🟢';
  if (status.indexOf('ผ่อนผัน') !== -1) return '🟠';
  if (status.indexOf('ไถ่ถอน') !== -1) return '⚪';
  if (status.indexOf('ยึด') !== -1 || status.indexOf('หลุด') !== -1) return '🔴';
  return '📁';
}

function readAssetsDetailed() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LINE.sheetData || 'DATABASE');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var assetName = r[1] ? String(r[1]).trim() : '';
    var status = r[2] ? String(r[2]).trim() : '';
    if (!assetName || !status) continue;

    var start = parseDateSmart(r[12]);
    var end = parseDateSmart(r[13]);
    var principal = Number(r[15]) || 0;
    var investorMonth = Number(r[26]) || 0;
    var investorYear = Number(r[33]) || 0;
    var interestMonth = Number(r[18]) || 0;
    var redemptionAmount = Number(r[14]) || 0;

    out.push({
      row: i + 1,
      rowNumber: r[0] || (i + 1),
      name: assetName,
      status: status,
      assetType: r[4] ? String(r[4]).trim() : 'ไม่ระบุประเภท',
      location: r[5] ? String(r[5]).trim() : 'ไม่ระบุทำเล',
      deedType: r[6] ? String(r[6]).trim() : '',
      landSize: r[7] ? String(r[7]).trim() : '',
      ownerName: r[8] ? String(r[8]).trim() : 'ไม่ระบุเจ้าของ',
      ownerPhone: r[9] ? String(r[9]).trim() : '',
      ownerJob: r[10] ? String(r[10]).trim() : '',
      tradingType: r[11] ? String(r[11]).trim() : 'ขายฝาก',
      start: start,
      end: end,
      redemptionAmount: redemptionAmount,
      principal: principal,
      interestRate: r[16] || 0,
      interestMonth: interestMonth,
      investor: r[21] ? String(r[21]).trim() : 'ไม่ระบุนายทุน',
      investorPhone: r[22] ? String(r[22]).trim() : '',
      investorMonth: investorMonth,
      investorYear: investorYear,
      prepaid: Number(r[35]) || 0
    });
  }
  return out;
}

function formatDetailedPlotCard(a, idx) {
  var prefix = (idx !== undefined && idx !== null) ? '🏷️ <b>[' + (idx + 1) + '] ' + escapeHtml(a.name) + '</b>' : '🏷️ <b>' + escapeHtml(a.name) + '</b>';
  var statusBadge = getStatusEmoji(a.status) + ' <b>' + escapeHtml(a.status) + '</b>';

  var timeBadge = '';
  if (a.end) {
    var left = getDaysLeft(a.end);
    if (left !== null) {
      if (left < 0) {
        timeBadge = '⚠️ <b>เกินกำหนดมาแล้ว: ' + Math.abs(left) + ' วัน</b>';
      } else if (left === 0) {
        timeBadge = '🚨 <b>ครบกำหนดสัญญา "วันนี้"</b>';
      } else {
        timeBadge = '⏳ <b>เหลือเวลาสัญญาอีก: ' + left + ' วัน</b>';
      }
    } else {
      timeBadge = '⏳ ไม่ระบุวันครบกำหนด';
    }
  } else {
    timeBadge = '⏳ ไม่ระบุวันครบกำหนด';
  }

  var invStr = escapeHtml(a.investor);
  if (a.investorPhone) invStr += ' (📞 ' + escapeHtml(a.investorPhone) + ')';

  var locParts = [];
  if (a.location && a.location !== 'ไม่ระบุทำเล') locParts.push(a.location);
  if (a.landSize) locParts.push(a.landSize);
  if (a.assetType && a.assetType !== 'ไม่ระบุประเภท') locParts.push(a.assetType);
  var locText = locParts.length > 0 ? locParts.join(' | ') : 'ไม่ระบุทำเล';

  var card = prefix + '\n' +
             '   • 📌 <b>สถานะ:</b> ' + statusBadge + '\n' +
             '   • 🤝 <b>นายทุน:</b> ' + invStr + '\n' +
             '   • 📍 <b>ทำเล/ทรัพย์:</b> ' + escapeHtml(locText) + '\n' +
             '   • 📝 <b>นิติกรรม:</b> ' + escapeHtml(a.tradingType) + '\n' +
             '   • 💰 <b>เงินต้น:</b> ' + baht(a.principal) + ' บาท\n' +
             '   • 💵 <b>ดอกนายทุน:</b> ' + baht(a.investorMonth) + ' บ./เดือน\n' +
             '   • 📅 <b>ระยะเวลาสัญญา:</b> ' + formatDateTh(a.start) + ' ถึง ' + formatDateTh(a.end) + '\n' +
             '   • ' + timeBadge;
  return card;
}

function handleTelegramMessage(msg) {
  var text = String(msg.text || '').trim();
  var chatId = msg.chat && msg.chat.id;
  if (!chatId) return;

  var lower = text.toLowerCase();
  var cmd = lower.split('@')[0].trim();

  // 1. เมนูหลัก
  if (cmd === '/menu' || cmd === '/start' || cmd === '#menu' || cmd === 'เมนู') {
    sendTelegramMenu(chatId);
    return;
  }

  // 2. ดูรายสถานะ
  if (cmd === '/status' || cmd === '#status' || cmd === 'สถานะ' || cmd === 'ดูรายสถานะ') {
    sendStatusMenu(chatId);
    return;
  }

  // 3. ดูรายนายทุน
  if (cmd === '/investor' || cmd === '/investors' || cmd === '#investor' || cmd === 'นายทุน' || cmd === 'ดูรายนายทุน') {
    sendInvestorsReport(chatId);
    return;
  }

  // 4. ดูรายเดือน
  if (cmd === '/month' || cmd === '/monthly' || cmd === '#month' || cmd === 'เดือนนี้' || cmd === 'รายเดือน' || cmd === 'ดูรายเดือน') {
    sendThisMonthReport(chatId);
    return;
  }

  // 5. คำสั่งลัดอื่น ๆ
  if (cmd === '/overdue' || cmd === '#overdue' || cmd === 'ค้างคา' || cmd === 'เกินกำหนด') {
    sendOverdueReport(chatId);
    return;
  }
  if (cmd === '/neardue' || cmd === '#neardue' || cmd === 'ใกล้ครบ' || cmd === 'ใกล้หมด') {
    sendNearDueReport(chatId);
    return;
  }
  if (cmd === '/grace' || cmd === '#grace' || cmd === 'ผ่อนผัน') {
    sendGraceReport(chatId);
    return;
  }
  if (cmd === '/portfolio' || cmd === '#portfolio' || cmd === 'พอร์ต' || cmd === 'สรุปพอร์ต') {
    sendPortfolioReport(chatId);
    return;
  }
  if (cmd === '/test' || cmd === 'ทดสอบ') {
    sendTestReport(chatId);
    return;
  }
}

function handleTelegramCallback(cb) {
  var cbId = cb.id;
  var chatId = cb.message && cb.message.chat && cb.message.chat.id;
  var data = cb.data;
  if (!chatId) return;

  answerTelegramCallback(cbId, 'กำลังประมวลผลข้อมูล...');

  if (data === 'cmd_menu') {
    sendTelegramMenu(chatId);
  } else if (data === 'menu_status') {
    sendStatusMenu(chatId);
  } else if (data === 'view_st_active') {
    sendStatusPlots(chatId, 'ดำเนินการอยู่');
  } else if (data === 'view_st_ext') {
    sendStatusPlots(chatId, 'ดำเนินการอยู่ (ต่อดอก)');
  } else if (data === 'view_st_grace') {
    sendStatusPlots(chatId, 'อยู่ระหว่างผ่อนผัน');
  } else if (data === 'view_st_redeemed') {
    sendStatusPlots(chatId, 'ไถ่ถอนแล้ว');
  } else if (data === 'view_st_all_active') {
    sendStatusPlots(chatId, 'active_all');
  } else if (data === 'menu_investors') {
    sendInvestorsReport(chatId);
  } else if (data === 'cmd_this_month') {
    sendThisMonthReport(chatId);
  } else if (data === 'cmd_overdue') {
    sendOverdueReport(chatId);
  } else if (data === 'cmd_neardue') {
    sendNearDueReport(chatId);
  } else if (data === 'cmd_grace') {
    sendGraceReport(chatId);
  } else if (data === 'cmd_portfolio') {
    sendPortfolioReport(chatId);
  } else if (data === 'cmd_test') {
    sendTestReport(chatId);
  }
}

function sendTelegramMenu(chatId) {
  var text = '🤖 <b>[APHITHANASAP BOT - เมนูสั่งการ]</b>\n' +
             '═══════════════════════\n' +
             'ระบบบริหารจัดการทรัพย์สินการลงทุน อสังหาริมทรัพย์\n' +
             'กรุณาเลือกเมนูที่ต้องการตรวจสอบด้านล่างนี้ได้เลยครับ 👇';
  var keyboard = {
    inline_keyboard: [
      [
        { text: '📌 ดูรายสถานะแปลง', callback_data: 'menu_status' },
        { text: '🤝 ดูรายนายทุน', callback_data: 'menu_investors' }
      ],
      [
        { text: '🗓️ ดูรายเดือน (ครบกำหนดเดือนนี้)', callback_data: 'cmd_this_month' },
        { text: '🔴 สัญญาเกินกำหนด / ค้างคา', callback_data: 'cmd_overdue' }
      ],
      [
        { text: '⏰ สัญญาใกล้ครบ (60 วัน)', callback_data: 'cmd_neardue' },
        { text: '📊 สรุปภาพรวมพอร์ต', callback_data: 'cmd_portfolio' }
      ],
      [
        { text: '🔔 ทดสอบระบบแจ้งเตือน', callback_data: 'cmd_test' }
      ],
      [
        { text: '🌐 เข้าสู่ระบบจัดการทรัพย์สิน', url: (LINE.webUrl || 'https://infinityrichglobal.github.io/APHITHANASAP/') }
      ]
    ]
  };
  sendTelegramWithKeyboard(chatId, text, keyboard);
}

function sendStatusMenu(chatId) {
  try {
    var assets = readAssetsDetailed();
    var stats = {};
    var allActiveCount = 0;
    var allActiveMoney = 0;

    assets.forEach(function(a) {
      var st = a.status;
      if (!stats[st]) stats[st] = { count: 0, principal: 0, invMonth: 0 };
      stats[st].count++;
      stats[st].principal += a.principal;
      stats[st].invMonth += a.investorMonth;

      if (st === 'ดำเนินการอยู่' || st === 'ดำเนินการอยู่ (ต่อดอก)' || st === 'อยู่ระหว่างผ่อนผัน') {
        allActiveCount++;
        allActiveMoney += a.principal;
      }
    });

    var stActive = stats['ดำเนินการอยู่'] || { count: 0, principal: 0 };
    var stExt = stats['ดำเนินการอยู่ (ต่อดอก)'] || { count: 0, principal: 0 };
    var stGrace = stats['อยู่ระหว่างผ่อนผัน'] || { count: 0, principal: 0 };
    var stRedeemed = stats['ไถ่ถอนแล้ว'] || { count: 0, principal: 0 };
    var stSeized = (stats['ยึดทรัพย์'] || { count: 0, principal: 0 }).count + (stats['หลุดเป็นกรรมสิทธิ์'] || { count: 0, principal: 0 }).count;

    var text = '📌 <b>[สรุปพอร์ตแยกตามสถานะแปลง]</b>\n' +
               '═══════════════════════\n' +
               '📊 <b>ภาพรวมแปลงทั้งหมด:</b> ' + assets.length + ' แปลง\n' +
               '💼 <b>แปลงที่กำลังดำเนินการ:</b> ' + allActiveCount + ' แปลง (' + baht(allActiveMoney) + ' บ.)\n\n' +
               '🟢 <b>ดำเนินการอยู่:</b> ' + stActive.count + ' แปลง\n' +
               '   └ ยอดเงินต้น: <b>' + baht(stActive.principal) + '</b> บาท\n\n' +
               '🔵 <b>ดำเนินการอยู่ (ต่อดอก):</b> ' + stExt.count + ' แปลง\n' +
               '   └ ยอดเงินต้น: <b>' + baht(stExt.principal) + '</b> บาท\n\n' +
               '🟠 <b>อยู่ระหว่างผ่อนผัน:</b> ' + stGrace.count + ' แปลง\n' +
               '   └ ยอดเงินต้น: <b>' + baht(stGrace.principal) + '</b> บาท\n\n' +
               '⚪ <b>ไถ่ถอนแล้ว:</b> ' + stRedeemed.count + ' แปลง\n' +
               '   └ ยอดเงินต้น: <b>' + baht(stRedeemed.principal) + '</b> บาท\n\n' +
               (stSeized > 0 ? '🔴 <b>ยึดทรัพย์ / หลุดกรรมสิทธิ์:</b> ' + stSeized + ' แปลง\n\n' : '') +
               '👇 <b>กดปุ่มด้านล่างเพื่อดูรายชื่อและรายละเอียดแต่ละแปลง:</b>';

    var keyboard = {
      inline_keyboard: [
        [
          { text: '🟢 ดำเนินการ (' + stActive.count + ')', callback_data: 'view_st_active' },
          { text: '🔵 ต่อดอก (' + stExt.count + ')', callback_data: 'view_st_ext' }
        ],
        [
          { text: '🟠 ผ่อนผัน (' + stGrace.count + ')', callback_data: 'view_st_grace' },
          { text: '⚪ ไถ่ถอนแล้ว (' + stRedeemed.count + ')', callback_data: 'view_st_redeemed' }
        ],
        [
          { text: '📋 ดูแปลงเปิดอยู่ทั้งหมด (' + allActiveCount + ' แปลง)', callback_data: 'view_st_all_active' }
        ],
        [
          { text: '🔙 กลับเมนูหลัก', callback_data: 'cmd_menu' }
        ]
      ]
    };

    sendTelegramWithKeyboard(chatId, text, keyboard);
  } catch (e) {
    sendTelegramToChat(chatId, '⚠️ เกิดข้อผิดพลาดในการดึงข้อมูลสถานะ: ' + e.toString());
  }
}

function sendStatusPlots(chatId, filterType) {
  try {
    var assets = readAssetsDetailed();
    var filtered = [];
    var title = '';
    var icon = '';

    if (filterType === 'ดำเนินการอยู่') {
      title = 'สถานะ: ดำเนินการอยู่';
      icon = '🟢';
      filtered = assets.filter(function(a) { return a.status === 'ดำเนินการอยู่'; });
    } else if (filterType === 'ดำเนินการอยู่ (ต่อดอก)') {
      title = 'สถานะ: ดำเนินการอยู่ (ต่อดอก)';
      icon = '🔵';
      filtered = assets.filter(function(a) { return a.status === 'ดำเนินการอยู่ (ต่อดอก)'; });
    } else if (filterType === 'อยู่ระหว่างผ่อนผัน') {
      title = 'สถานะ: อยู่ระหว่างผ่อนผัน';
      icon = '🟠';
      filtered = assets.filter(function(a) { return a.status === 'อยู่ระหว่างผ่อนผัน'; });
    } else if (filterType === 'ไถ่ถอนแล้ว') {
      title = 'สถานะ: ไถ่ถอนแล้ว';
      icon = '⚪';
      filtered = assets.filter(function(a) { return a.status === 'ไถ่ถอนแล้ว'; });
    } else if (filterType === 'active_all') {
      title = 'แปลงเปิดอยู่ทั้งหมด (ดำเนินการ / ต่อดอก / ผ่อนผัน)';
      icon = '📋';
      filtered = assets.filter(function(a) {
        return a.status === 'ดำเนินการอยู่' || a.status === 'ดำเนินการอยู่ (ต่อดอก)' || a.status === 'อยู่ระหว่างผ่อนผัน';
      });
    }

    if (filtered.length === 0) {
      var emptyText = icon + ' <b>[' + title + ']</b>\n\n' +
                      '✅ ไม่พบรายการแปลงในสถานะนี้ครับ';
      var kb = { inline_keyboard: [[ { text: '🔙 กลับเมนูสถานะ', callback_data: 'menu_status' } ]] };
      sendTelegramWithKeyboard(chatId, emptyText, kb);
      return;
    }

    var totalP = filtered.reduce(function(sum, a) { return sum + a.principal; }, 0);
    var totalM = filtered.reduce(function(sum, a) { return sum + a.investorMonth; }, 0);

    var head = icon + ' <b>[' + title + ']</b>\n' +
               '═══════════════════════\n' +
               '📊 <b>จำนวนทั้งหมด:</b> ' + filtered.length + ' แปลง\n' +
               '💰 <b>ยอดเงินต้นรวม:</b> ' + baht(totalP) + ' บาท\n' +
               '💵 <b>ผลตอบแทนรวม:</b> ' + baht(totalM) + ' บาท/เดือน\n' +
               '───────────────────────\n\n';

    var cards = [];
    filtered.forEach(function(a, idx) {
      cards.push(formatDetailedPlotCard(a, idx));
    });

    var fullText = head + cards.join('\n\n───────────────────────\n\n');
    var navKb = {
      inline_keyboard: [
        [
          { text: '📌 เลือกดูสถานะอื่น', callback_data: 'menu_status' },
          { text: '🔙 กลับเมนูหลัก', callback_data: 'cmd_menu' }
        ]
      ]
    };

    sendLongTelegramMessage(chatId, fullText, navKb);
  } catch (e) {
    sendTelegramToChat(chatId, '⚠️ เกิดข้อผิดพลาดในการแสดงแปลง: ' + e.toString());
  }
}

function sendInvestorsReport(chatId) {
  try {
    var assets = readAssetsDetailed();
    var invMap = {};
    var totalActivePrincipal = 0;
    var totalActiveMonthly = 0;
    var totalPlots = 0;

    assets.forEach(function(a) {
      var isActive = (a.status === 'ดำเนินการอยู่' || a.status === 'ดำเนินการอยู่ (ต่อดอก)' || a.status === 'อยู่ระหว่างผ่อนผัน');
      if (!isActive) return;

      var invName = a.investor || '(ไม่ระบุนายทุน)';
      if (!invMap[invName]) {
        invMap[invName] = {
          name: invName,
          phone: a.investorPhone || '',
          principal: 0,
          invMonth: 0,
          invYear: 0,
          plots: []
        };
      }
      if (!invMap[invName].phone && a.investorPhone) {
        invMap[invName].phone = a.investorPhone;
      }
      invMap[invName].principal += a.principal;
      invMap[invName].invMonth += a.investorMonth;
      invMap[invName].invYear += a.investorYear;
      invMap[invName].plots.push(a);

      totalActivePrincipal += a.principal;
      totalActiveMonthly += a.investorMonth;
      totalPlots++;
    });

    var invKeys = Object.keys(invMap);
    if (invKeys.length === 0) {
      var noInv = '🤝 <b>[รายงานพอร์ตการลงทุน - จำแนกตามรายนายทุน]</b>\n\n' +
                  '✅ ขณะนี้ไม่มีแปลงที่กำลังดำเนินการอยู่ครับ';
      var kb = { inline_keyboard: [[ { text: '🔙 กลับเมนูหลัก', callback_data: 'cmd_menu' } ]] };
      sendTelegramWithKeyboard(chatId, noInv, kb);
      return;
    }

    invKeys.sort(function(x, y) {
      return invMap[y].principal - invMap[x].principal;
    });

    var head = '🤝 <b>[รายงานพอร์ตการลงทุน - จำแนกตามรายนายทุน]</b>\n' +
               '═══════════════════════\n' +
               '💼 <b>นายทุนทั้งหมด:</b> ' + invKeys.length + ' ท่าน\n' +
               '📁 <b>ทรัพย์ที่ดูแลรวม:</b> ' + totalPlots + ' แปลง\n' +
               '💰 <b>ยอดเงินลงทุนรวม:</b> ' + baht(totalActivePrincipal) + ' บาท\n' +
               '💵 <b>ผลตอบแทนรวม:</b> ' + baht(totalActiveMonthly) + ' บาท/เดือน\n' +
               '───────────────────────\n\n';

    var invSections = [];
    invKeys.forEach(function(k, idx) {
      var inv = invMap[k];
      var invPhoneStr = inv.phone ? ' (📞 ' + escapeHtml(inv.phone) + ')' : '';

      var section = '👤 <b>' + (idx + 1) + '. นายทุน: ' + escapeHtml(inv.name) + '</b>' + invPhoneStr + '\n' +
                    '   💼 <b>จำนวนทรัพย์:</b> ' + inv.plots.length + ' แปลง\n' +
                    '   💰 <b>เงินลงทุนรวม:</b> <b>' + baht(inv.principal) + '</b> บาท\n' +
                    '   💵 <b>ผลตอบแทน:</b> ' + baht(inv.invMonth) + ' บ./เดือน\n\n' +
                    '   📋 <b>รายชื่อแปลงที่ถือครอง:</b>\n';

      inv.plots.forEach(function(p, pIdx) {
        var stEmoji = getStatusEmoji(p.status);
        var left = getDaysLeft(p.end);
        var timeStr = '';
        if (left !== null) {
          timeStr = left < 0 ? ('⚠️ เกิน ' + Math.abs(left) + ' วัน') : ('เหลือ ' + left + ' วัน');
        } else {
          timeStr = 'ไม่ระบุวันสิ้นสุด';
        }

        section += '   ' + (pIdx + 1) + ') <b>' + escapeHtml(p.name) + '</b> ' + stEmoji + '\n' +
                   '      • 💰 เงินต้น: ' + baht(p.principal) + ' บ. (ดอก: ' + baht(p.investorMonth) + ' บ./ด.)\n' +
                   '      • 📍 ทำเล: ' + escapeHtml(p.location || 'ไม่ระบุ') + '\n' +
                   '      • 📅 สัญญา: ' + formatDateTh(p.start) + ' ถึง ' + formatDateTh(p.end) + ' (' + timeStr + ')\n';
      });

      invSections.push(section);
    });

    var fullText = head + invSections.join('\n───────────────────────\n\n');
    var navKb = {
      inline_keyboard: [
        [
          { text: '📌 ดูตามสถานะแปลง', callback_data: 'menu_status' },
          { text: '🔙 กลับเมนูหลัก', callback_data: 'cmd_menu' }
        ]
      ]
    };

    sendLongTelegramMessage(chatId, fullText, navKb);
  } catch (e) {
    sendTelegramToChat(chatId, '⚠️ เกิดข้อผิดพลาดในการดึงข้อมูลรายนายทุน: ' + e.toString());
  }
}

function sendThisMonthReport(chatId) {
  try {
    var assets = readAssetsDetailed();
    var now = new Date();
    var curMonth = now.getMonth();
    var curYear = now.getFullYear();
    var monthName = now.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

    var dueList = [];
    assets.forEach(function(a) {
      if (a.status === 'ดำเนินการอยู่' || a.status === 'ดำเนินการอยู่ (ต่อดอก)' || a.status === 'อยู่ระหว่างผ่อนผัน') {
        if (!a.end) return;
        var dEnd = new Date(a.end);
        if (dEnd.getMonth() === curMonth && dEnd.getFullYear() === curYear) {
          dueList.push(a);
        }
      }
    });

    dueList.sort(function(x, y) {
      return (new Date(x.end)).getTime() - (new Date(y.end)).getTime();
    });

    if (dueList.length === 0) {
      var noMsg = '🗓️ <b>[สัญญาครบกำหนด - ประจำเดือน ' + monthName + ']</b>\n\n' +
                  '✅ ยอดเยี่ยมมากครับ! ในเดือนนี้ไม่มีสัญญาที่ครบกำหนดชำระหรือสิ้นสุดสัญญา';
      var kb = { inline_keyboard: [[ { text: '🔙 กลับเมนูหลัก', callback_data: 'cmd_menu' } ]] };
      sendTelegramWithKeyboard(chatId, noMsg, kb);
      return;
    }

    var totalP = dueList.reduce(function(sum, a) { return sum + a.principal; }, 0);
    var totalM = dueList.reduce(function(sum, a) { return sum + a.investorMonth; }, 0);

    var head = '🗓️ <b>[สัญญาครบกำหนด - ประจำเดือน ' + monthName + ']</b>\n' +
               '═══════════════════════\n' +
               '📊 <b>พบสัญญาครบกำหนดในเดือนนี้:</b> ' + dueList.length + ' แปลง\n' +
               '💰 <b>ยอดเงินต้นรวม:</b> ' + baht(totalP) + ' บาท\n' +
               '💵 <b>ยอดดอกเบี้ยรวม:</b> ' + baht(totalM) + ' บาท/เดือน\n' +
               '───────────────────────\n\n';

    var cards = [];
    dueList.forEach(function(a, idx) {
      cards.push(formatDetailedPlotCard(a, idx));
    });

    var fullText = head + cards.join('\n\n───────────────────────\n\n');
    var navKb = {
      inline_keyboard: [
        [
          { text: '🔴 ดูสัญญาเกินกำหนด', callback_data: 'cmd_overdue' },
          { text: '🔙 กลับเมนูหลัก', callback_data: 'cmd_menu' }
        ]
      ]
    };

    sendLongTelegramMessage(chatId, fullText, navKb);
  } catch (e) {
    sendTelegramToChat(chatId, '⚠️ เกิดข้อผิดพลาดในการดึงข้อมูลประจำเดือน: ' + e.toString());
  }
}

function sendOverdueReport(chatId) {
  try {
    var assets = readAssetsDetailed();
    var overdue = [];
    assets.forEach(function(a) {
      if (a.status === 'ดำเนินการอยู่' || a.status === 'ดำเนินการอยู่ (ต่อดอก)' || a.status === 'อยู่ระหว่างผ่อนผัน') {
        if (!a.end) return;
        var left = getDaysLeft(a.end);
        if (left !== null && left < 0) {
          overdue.push({ a: a, days: Math.abs(left) });
        }
      }
    });

    if (overdue.length === 0) {
      var noMsg = '🔴 <b>[รายการสัญญาที่เกินกำหนด / ค้างคา]</b>\n\n' +
                  '✅ ยอดเยี่ยมมากครับ! ตอนนี้ไม่มีสัญญาที่เกินกำหนดหรือค้างคาเลยครับ';
      var kb = { inline_keyboard: [[ { text: '🔙 กลับเมนูหลัก', callback_data: 'cmd_menu' } ]] };
      sendTelegramWithKeyboard(chatId, noMsg, kb);
      return;
    }

    overdue.sort(function(x, y) { return y.days - x.days; });

    var totalP = overdue.reduce(function(sum, item) { return sum + item.a.principal; }, 0);
    var totalM = overdue.reduce(function(sum, item) { return sum + item.a.investorMonth; }, 0);

    var head = '🔴 <b>[รายการสัญญาที่เกินกำหนด / ค้างคา]</b>\n' +
               '═══════════════════════\n' +
               '⚠️ <b>พบสัญญาเกินกำหนด:</b> ' + overdue.length + ' แปลง\n' +
               '💰 <b>ยอดเงินต้นรวม:</b> ' + baht(totalP) + ' บาท\n' +
               '💵 <b>ดอกนายทุนรวม:</b> ' + baht(totalM) + ' บาท/เดือน\n' +
               '───────────────────────\n\n';

    var cards = [];
    overdue.forEach(function(o, idx) {
      cards.push(formatDetailedPlotCard(o.a, idx));
    });

    var fullText = head + cards.join('\n\n───────────────────────\n\n');
    var navKb = {
      inline_keyboard: [
        [
          { text: '📌 ดูรายสถานะ', callback_data: 'menu_status' },
          { text: '🔙 กลับเมนูหลัก', callback_data: 'cmd_menu' }
        ]
      ]
    };

    sendLongTelegramMessage(chatId, fullText, navKb);
  } catch (e) {
    sendTelegramToChat(chatId, '⚠️ เกิดข้อผิดพลาดในการดึงข้อมูลสัญญาเกินกำหนด: ' + e.toString());
  }
}

function sendNearDueReport(chatId) {
  try {
    var assets = readAssetsDetailed();
    var nearDue = [];
    assets.forEach(function(a) {
      if (a.status === 'ดำเนินการอยู่' || a.status === 'ดำเนินการอยู่ (ต่อดอก)' || a.status === 'อยู่ระหว่างผ่อนผัน') {
        if (!a.end) return;
        var left = getDaysLeft(a.end);
        if (left !== null && left >= 0 && left <= 60) {
          nearDue.push({ a: a, days: left });
        }
      }
    });

    if (nearDue.length === 0) {
      var noMsg = '⏰ <b>[สัญญาใกล้ครบกำหนด (ภายใน 60 วัน)]</b>\n\n' +
                  '✅ ไม่มีสัญญาที่จะครบกำหนดภายใน 60 วันนี้ครับ';
      var kb = { inline_keyboard: [[ { text: '🔙 กลับเมนูหลัก', callback_data: 'cmd_menu' } ]] };
      sendTelegramWithKeyboard(chatId, noMsg, kb);
      return;
    }

    nearDue.sort(function(x, y) { return x.days - y.days; });

    var totalP = nearDue.reduce(function(sum, item) { return sum + item.a.principal; }, 0);
    var totalM = nearDue.reduce(function(sum, item) { return sum + item.a.investorMonth; }, 0);

    var head = '⏰ <b>[สัญญาใกล้ครบกำหนด (ภายใน 60 วัน)]</b>\n' +
               '═══════════════════════\n' +
               '🔔 <b>พบสัญญาใกล้ครบกำหนด:</b> ' + nearDue.length + ' แปลง\n' +
               '💰 <b>ยอดเงินต้นรวม:</b> ' + baht(totalP) + ' บาท\n' +
               '💵 <b>ดอกนายทุนรวม:</b> ' + baht(totalM) + ' บาท/เดือน\n' +
               '───────────────────────\n\n';

    var cards = [];
    nearDue.forEach(function(n, idx) {
      cards.push(formatDetailedPlotCard(n.a, idx));
    });

    var fullText = head + cards.join('\n\n───────────────────────\n\n');
    var navKb = {
      inline_keyboard: [
        [
          { text: '🗓️ ดูสัญญาครบกำหนดเดือนนี้', callback_data: 'cmd_this_month' },
          { text: '🔙 กลับเมนูหลัก', callback_data: 'cmd_menu' }
        ]
      ]
    };

    sendLongTelegramMessage(chatId, fullText, navKb);
  } catch (e) {
    sendTelegramToChat(chatId, '⚠️ เกิดข้อผิดพลาดในการดึงข้อมูลสัญญาใกล้ครบกำหนด: ' + e.toString());
  }
}

function sendGraceReport(chatId) {
  try {
    var assets = readAssetsDetailed();
    var grace = assets.filter(function(a) { return a.status === 'อยู่ระหว่างผ่อนผัน'; });

    if (grace.length === 0) {
      var noMsg = '🟠 <b>[รายการแปลงที่อยู่ระหว่างผ่อนผัน]</b>\n\n' +
                  '✅ ไม่มีแปลงที่อยู่ระหว่างผ่อนผันในขณะนี้ครับ';
      var kb = { inline_keyboard: [[ { text: '🔙 กลับเมนูหลัก', callback_data: 'cmd_menu' } ]] };
      sendTelegramWithKeyboard(chatId, noMsg, kb);
      return;
    }

    var totalP = grace.reduce(function(sum, a) { return sum + a.principal; }, 0);
    var totalM = grace.reduce(function(sum, a) { return sum + a.investorMonth; }, 0);

    var head = '🟠 <b>[รายการแปลงที่อยู่ระหว่างผ่อนผัน]</b>\n' +
               '═══════════════════════\n' +
               '⚠️ <b>พบแปลงอยู่ระหว่างผ่อนผัน:</b> ' + grace.length + ' แปลง\n' +
               '💰 <b>ยอดเงินต้นรวม:</b> ' + baht(totalP) + ' บาท\n' +
               '💵 <b>ดอกนายทุนรวม:</b> ' + baht(totalM) + ' บาท/เดือน\n' +
               '───────────────────────\n\n';

    var cards = [];
    grace.forEach(function(g, idx) {
      cards.push(formatDetailedPlotCard(g, idx));
    });

    var fullText = head + cards.join('\n\n───────────────────────\n\n');
    var navKb = {
      inline_keyboard: [
        [
          { text: '📌 ดูรายสถานะ', callback_data: 'menu_status' },
          { text: '🔙 กลับเมนูหลัก', callback_data: 'cmd_menu' }
        ]
      ]
    };

    sendLongTelegramMessage(chatId, fullText, navKb);
  } catch (e) {
    sendTelegramToChat(chatId, '⚠️ เกิดข้อผิดพลาดในการดึงข้อมูลแปลงผ่อนผัน: ' + e.toString());
  }
}

function sendPortfolioReport(chatId) {
  try {
    var assets = readAssetsDetailed();
    var count = {}, principal = 0, invMonth = 0, invYear = 0;
    var dueInMonth = [];
    var now = new Date();
    var curMonth = now.getMonth();
    var curYear = now.getFullYear();

    assets.forEach(function(a) {
      count[a.status] = (count[a.status] || 0) + 1;
      if (a.status === 'ดำเนินการอยู่' || a.status === 'ดำเนินการอยู่ (ต่อดอก)' || a.status === 'อยู่ระหว่างผ่อนผัน') {
        principal += a.principal;
        invMonth += a.investorMonth;
        invYear += a.investorYear;

        if (a.end) {
          var dEnd = new Date(a.end);
          if (dEnd.getMonth() === curMonth && dEnd.getFullYear() === curYear) {
            dueInMonth.push(a);
          }
        }
      }
    });

    var monthStr = now.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    var resp = '📊 <b>[สรุปพอร์ตการลงทุนแบบ Real-time]</b>\n' +
               '═══════════════════════\n' +
               '🗓️ <b>ประจำเดือน:</b> ' + monthStr + '\n\n' +
               '📌 <b>สถานะทรัพย์สินทั้งหมด:</b>\n' +
               '• 🟢 ดำเนินการอยู่: ' + (count['ดำเนินการอยู่'] || 0) + ' แปลง\n' +
               '• 🔵 ดำเนินการอยู่ (ต่อดอก): ' + (count['ดำเนินการอยู่ (ต่อดอก)'] || 0) + ' แปลง\n' +
               '• 🟠 อยู่ระหว่างผ่อนผัน: ' + (count['อยู่ระหว่างผ่อนผัน'] || 0) + ' แปลง\n' +
               '• ⚪ ไถ่ถอนแล้ว: ' + (count['ไถ่ถอนแล้ว'] || 0) + ' แปลง\n' +
               '• 🔴 หลุดเป็นกรรมสิทธิ์/ยึดทรัพย์: ' + ((count['หลุดเป็นกรรมสิทธิ์'] || 0) + (count['ยึดทรัพย์'] || 0)) + ' แปลง\n\n' +
               '💰 <b>สรุปยอดการเงินพอร์ตที่กำลังดำเนินการ:</b>\n' +
               '• เงินต้นรวม: <b>' + baht(principal) + '</b> บาท\n' +
               '• ผลตอบแทนนายทุน/เดือน: <b>' + baht(invMonth) + '</b> บาท\n' +
               '• ผลตอบแทนนายทุน/ปี: <b>' + baht(invYear) + '</b> บาท\n';

    if (dueInMonth.length > 0) {
      resp += '\n⏰ <b>แปลงที่ครบกำหนดในเดือนนี้ (' + dueInMonth.length + ' แปลง):</b>\n';
      dueInMonth.forEach(function(d, idx) {
        var invStr = d.investor ? (' (นายทุน: ' + d.investor + ')') : '';
        var dateStr = 'สัญญา: ' + formatDateTh(d.start) + ' ถึง ' + formatDateTh(d.end);
        resp += (idx + 1) + '. <b>' + escapeHtml(d.name) + '</b>' + escapeHtml(invStr) + '\n' +
                '   └ ' + dateStr + ' | เงินต้น: ' + baht(d.principal) + ' บ.\n';
      });
    }

    var navKb = {
      inline_keyboard: [
        [
          { text: '📌 ดูรายสถานะ', callback_data: 'menu_status' },
          { text: '🤝 ดูรายนายทุน', callback_data: 'menu_investors' }
        ],
        [
          { text: '🗓️ ดูรายเดือนนี้', callback_data: 'cmd_this_month' },
          { text: '🔙 กลับเมนูหลัก', callback_data: 'cmd_menu' }
        ]
      ]
    };

    sendLongTelegramMessage(chatId, resp, navKb);
  } catch (e) {
    sendTelegramToChat(chatId, '⚠️ เกิดข้อผิดพลาดในการดึงข้อมูลภาพรวมพอร์ต: ' + e.toString());
  }
}

function sendTestReport(chatId) {
  var testMsg = '🔔 <b>[ทดสอบระบบแจ้งเตือน APHITHANASAP]</b>\n' +
                '═══════════════════════\n' +
                '✅ ระบบเชื่อมต่อ Telegram Webhook และ API ทำงานปกติ 100%\n' +
                '🕒 <b>เวลาทดสอบ:</b> ' + getThaiDateTimeStr() + '\n\n' +
                '🛡️ <b>ระบบความปลอดภัยและฟีเจอร์ที่เปิดใช้งาน:</b>\n' +
                '• 📌 เมนูดูรายสถานะแปลงแบบ Interactive\n' +
                '• 🤝 เมนูดูรายนายทุน ยอดเงิน จำนวน และรายชื่อแปลง\n' +
                '• 🗓️ เมนูดูสัญญาครบกำหนดประจำเดือน\n' +
                '• 🔴 ตรวจสอบสัญญาเกินกำหนด / ค้างคา\n' +
                '• ⏰ ตรวจสอบสัญญาใกล้ครบกำหนด 60 วัน\n' +
                '• 🔐 ตรวจจับการล็อกอินแอดมิน (สำเร็จ/ล้มเหลว)\n' +
                '• 📝 เปรียบเทียบข้อมูลก่อน-หลังแก้ไข (Diff Tracking)\n' +
                '• 💾 สำรองข้อมูลแปลงก่อนถูกลบทันที (Backup Snapshot)\n' +
                '• 💰 แจ้งเตือนการเงิน (บันทึกรับชำระ/ลบยอดชำระ)\n' +
                '• 📅 สรุปอัตโนมัติ ทุกวันจันทร์ (08:00 น.) และ ทุกต้นเดือน (09:00 น.)';

  var navKb = {
    inline_keyboard: [
      [
        { text: '🔙 กลับเมนูหลัก', callback_data: 'cmd_menu' }
      ]
    ]
  };
  sendTelegramWithKeyboard(chatId, testMsg, navKb);
}

function sendLongTelegramMessage(chatId, htmlText, keyboardObj) {
  var MAX_LEN = 3800;
  if (!htmlText || htmlText.length <= MAX_LEN) {
    if (keyboardObj) {
      sendTelegramWithKeyboard(chatId, htmlText, keyboardObj);
    } else {
      sendTelegramToChat(chatId, htmlText);
    }
    return;
  }

  var sep = '\n\n───────────────────────\n\n';
  var pieces;
  if (htmlText.indexOf(sep) !== -1) {
    pieces = htmlText.split(sep);
  } else {
    pieces = htmlText.split('\n\n');
  }

  var chunks = [];
  var cur = '';

  for (var i = 0; i < pieces.length; i++) {
    var piece = pieces[i];
    var candidate = cur ? (cur + sep + piece) : piece;
    if (candidate.length > MAX_LEN) {
      if (cur) chunks.push(cur);
      cur = piece;
    } else {
      cur = candidate;
    }
  }
  if (cur) chunks.push(cur);

  for (var j = 0; j < chunks.length; j++) {
    var isLast = (j === chunks.length - 1);
    if (isLast && keyboardObj) {
      sendTelegramWithKeyboard(chatId, chunks[j], keyboardObj);
    } else {
      sendTelegramToChat(chatId, chunks[j]);
    }
    Utilities.sleep(350);
  }
}

function sendTelegramToChat(chatId, htmlText) {
  try {
    var cfg = getTelegramConfig();
    if (!cfg.token) return;
    var url = 'https://api.telegram.org/bot' + cfg.token + '/sendMessage';
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        chat_id: chatId,
        text: htmlText,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }),
      muteHttpExceptions: true
    });
  } catch (e) {
    console.error('sendTelegramToChat error:', e);
  }
}

function sendTelegramWithKeyboard(chatId, htmlText, keyboardObj) {
  try {
    var cfg = getTelegramConfig();
    if (!cfg.token) return;
    var url = 'https://api.telegram.org/bot' + cfg.token + '/sendMessage';
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        chat_id: chatId,
        text: htmlText,
        parse_mode: 'HTML',
        reply_markup: keyboardObj,
        disable_web_page_preview: true
      }),
      muteHttpExceptions: true
    });
  } catch (e) {
    console.error('sendTelegramWithKeyboard error:', e);
  }
}

function answerTelegramCallback(cbId, text) {
  try {
    var cfg = getTelegramConfig();
    if (!cfg.token) return;
    var url = 'https://api.telegram.org/bot' + cfg.token + '/answerCallbackQuery';
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        callback_query_id: cbId,
        text: text || ''
      }),
      muteHttpExceptions: true
    });
  } catch (e) {
    console.error('answerTelegramCallback error:', e);
  }
}



function doGet() {
  const sessionData = PropertiesService.getScriptProperties().getProperty('currentUser');
  
  if (!sessionData) {
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setTitle('ระบบจัดการทรัพย์สินลงทุน');
  }
  
  try {
    const user = JSON.parse(sessionData);
    const lastLogin = new Date(user.lastLogin);
    const now = new Date();
    const minutesDiff = (now - lastLogin) / (1000 * 60);
    
    if (minutesDiff >= 60) {
      PropertiesService.getScriptProperties().deleteProperty('currentUser');
      return HtmlService.createTemplateFromFile('index')
        .evaluate()
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setTitle('ระบบจัดการทรัพย์สินลงทุน');
    }
  } catch (e) {
    PropertiesService.getScriptProperties().deleteProperty('currentUser');
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setTitle('ระบบจัดการทรัพย์สินลงทุน');
  }
  
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setTitle('ระบบจัดการทรัพย์สินลงทุน');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================================
// doPost — ประตูรับคำสั่งจาก Frontend (GitHub Pages) ผ่าน fetch()
// รับ { fn: 'ชื่อฟังก์ชัน', args: [...] } แล้วเรียกฟังก์ชันนั้น
// คืน { result: <ค่าที่ฟังก์ชันคืน> } หรือ { __error: 'ข้อความ' }
// ============================================================
// ============================================================
// doPost ROUTER — แยกว่า request มาจากเว็บ GitHub หรือ LINE webhook
// ============================================================
function doPost(e) {
  var contents = (e && e.postData && e.postData.contents) || '';
  // LINE webhook จะมี "events" อยู่ใน payload เสมอ
  if (contents.indexOf('"events"') > -1) {
    return handleLineWebhook(e);
  }
  // Telegram webhook จะมี "update_id" อยู่ใน payload เสมอ
  if (contents.indexOf('"update_id"') > -1) {
    return handleTelegramWebhook(e);
  }
  // ไม่งั้น = fetch จากเว็บ GitHub (ระบบเดิม)
  return handleWebApp(e);
}

// ===== ระบบเว็บเดิม (เปลี่ยนชื่อจาก doPost) =====
function handleWebApp(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var fn = body.fn;
    var args = body.args || [];

    // whitelist ฟังก์ชันที่อนุญาตให้เรียกจากภายนอก (กันเรียกมั่ว)
    var ALLOWED = {
      authenticateUser: authenticateUser,
      checkSession: checkSession,
      logout: logout,
      getInitialAppData: getInitialAppData,
      loadTableWithSession: loadTableWithSession,
      safeLoadTable: safeLoadTable,
      getDropdownOptions: getDropdownOptions,
      getInvestorList: getInvestorList,
      getBrokerList: getBrokerList,
      fetchInvestorPhone: fetchInvestorPhone,
      fetchBrokerPhone: fetchBrokerPhone,
      reserveNextRowAndFolders: reserveNextRowAndFolders,
      deleteIncompleteData: deleteIncompleteData,
      saveFullFormData: saveFullFormData,
      updateExistingRowData: updateExistingRowData,
      getRowDataForEdit: getRowDataForEdit,
      getFolderFiles: getFolderFiles,
      uploadFilesByCategory: uploadFilesByCategory,
      uploadFilesToSpecificFolder: uploadFilesToSpecificFolder,
      deleteFile: deleteFile,
      getPaymentHistory: getPaymentHistory,
      savePaymentData: savePaymentData,
      deletePaymentRecord: deletePaymentRecord,
      deleteRowCompletely: deleteRowCompletely,
      getMemberData: getMemberData,
      saveMemberData: saveMemberData,
      deleteMemberData: deleteMemberData,
      getAllUsersForSimulator: getAllUsersForSimulator,
      simulateUserSession: simulateUserSession,
      restoreAdminSession: restoreAdminSession,
      getDictionary: getDictionary
    };

    if (!ALLOWED[fn]) {
      return _jsonOut({ __error: 'ฟังก์ชันไม่ได้รับอนุญาต: ' + fn });
    }

    var result = ALLOWED[fn].apply(null, args);
    return _jsonOut({ result: result });

  } catch (err) {
    return _jsonOut({ __error: err.toString() });
  }
}

function _jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function authenticateUser(username, password) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let userSheet = ss.getSheetByName('USERS');
        
        if (!userSheet) {
            userSheet = createUserSheet(ss);
        }

        const userData = userSheet.getDataRange().getValues();

        for (let i = 1; i < userData.length; i++) {
            const storedUsername = String(userData[i][0]).trim();
            const storedPassword = String(userData[i][6]).trim();
            const inputUsername = String(username).trim();
            const inputPassword = String(password).trim();
            
            if (storedUsername.toLowerCase() === inputUsername.toLowerCase() && 
                storedPassword === inputPassword) {
                
                
                const timestamp = Date.now();
                const sessionKey = 'session_' + userData[i][0].replace(/[^a-zA-Z0-9]/g, '_') + '_' + timestamp;
                
                const sessionData = {
                    sessionKey: sessionKey,
                    email: userData[i][0],
                    username: userData[i][1],
                    class: userData[i][2],
                    linkedBroker: userData[i][3],
                    linkedInvestor: userData[i][4],
                    status: userData[i][5],
                    lastLogin: new Date().toISOString(),
                    loginTime: timestamp,
                    userAgent: Session.getTemporaryActiveUserKey() || 'unknown'
                };
                
                PropertiesService.getScriptProperties().setProperty(sessionKey, JSON.stringify(sessionData));
                PropertiesService.getScriptProperties().setProperty('currentUser', JSON.stringify(sessionData));
                
                cleanupOldSessions(userData[i][0]);
                logUserActivity(userData[i][0], userData[i][1], userData[i][2], 'LOGIN', 'เข้าสู่ระบบสำเร็จ');
                
                sendTelegram(
                    '🔑 <b>[APHITHANASAP - เข้าสู่ระบบสำเร็จ]</b>\n' +
                    '👤 <b>ผู้ใช้งาน:</b> ' + (userData[i][1] || userData[i][0]) + ' (' + userData[i][0] + ')\n' +
                    '🛡 <b>สิทธิ์:</b> ' + userData[i][2] + '\n' +
                    '🕒 <b>เวลา:</b> ' + getThaiDateTimeStr() + '\n' +
                    '✅ <b>สถานะ:</b> เข้าสู่ระบบเรียบร้อย'
                );
                
                return JSON.stringify({
                    status: 'success',
                    message: 'เข้าสู่ระบบสำเร็จ',
                    userClass: userData[i][2],
                    username: userData[i][1],
                    sessionKey: sessionKey,
                    timeout: getTimeoutMinutes(userData[i][2])
                });
            }
        }

        logUserActivity(username, 'Unknown', 'guest', 'LOGIN_FAILED', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');

        sendTelegram(
            '🚨 <b>[APHITHANASAP - แจ้งเตือนความปลอดภัย!]</b>\n' +
            '⚠️ <b>สถานะ:</b> มีคนพยายามเข้าสู่ระบบแต่รหัสผ่านไม่ถูกต้อง\n' +
            '👤 <b>Username ที่ระบุ:</b> ' + username + '\n' +
            '🕒 <b>เวลา:</b> ' + getThaiDateTimeStr()
        );

        return JSON.stringify({
            status: 'error',
            message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
        });
    } catch (error) {
        console.error('authenticateUser error:', error);
        return JSON.stringify({
            status: 'error',
            message: 'เกิดข้อผิดพลาด: ' + error.toString()
        });
    }
}

function cleanupOldSessions(userEmail) {
    try {
        
        const properties = PropertiesService.getScriptProperties().getProperties();
        const userSessionPrefix = 'session_' + userEmail.replace(/[^a-zA-Z0-9]/g, '_');
        let deletedCount = 0;
        
        Object.keys(properties).forEach(key => {
            if (key.startsWith(userSessionPrefix)) {
                const sessionData = JSON.parse(properties[key]);
                const sessionAge = Date.now() - sessionData.loginTime;
                
                if (sessionAge > 5 * 60 * 1000) {
                    PropertiesService.getScriptProperties().deleteProperty(key);
                    deletedCount++;
                }
            }
        });
        
    } catch (error) {
        console.error('Error cleanup sessions:', error);
    }
}

function getTimeoutMinutes(userClass) {
    
    switch (userClass) {
        case 'admin':
            return 480;
        case 'super_user':
        case 'super_user1':
        case 'super_user2':
        case 'super_user3':
            return 120;
        case 'user':
        case 'user1':
        case 'user2':
        case 'user3':
            return 60;
        default:
            return 60;
    }
}

function checkSession(sessionKey) {
    try {
        
        if (!sessionKey) {
            return JSON.stringify({
                status: 'expired',
                message: 'ไม่พบ Session Key'
            });
        }

        const sessionData = PropertiesService.getScriptProperties().getProperty(sessionKey);
        
        if (sessionData) {
            const user = JSON.parse(sessionData);
            
            const timeoutMinutes = getTimeoutMinutes(user.class);
            const lastLogin = new Date(user.lastLogin);
            const now = new Date();
            const minutesDiff = (now - lastLogin) / (1000 * 60);
            
            
            if (minutesDiff < timeoutMinutes) {
                user.lastLogin = new Date().toISOString();
                PropertiesService.getScriptProperties().setProperty(sessionKey, JSON.stringify(user));
                
                if (user.class === 'admin' && !user.isSimulation) {
                    PropertiesService.getScriptProperties().setProperty('currentUser', JSON.stringify(user));
                }
                
                return JSON.stringify({
                    status: 'valid',
                    user: user,
                    remainingMinutes: Math.floor(timeoutMinutes - minutesDiff)
                });
            } else {
                logUserActivity(user.email, user.username, user.class, 'TIMEOUT', 'Session หมดอายุ');
                
                PropertiesService.getScriptProperties().deleteProperty(sessionKey);
            }
        }

        return JSON.stringify({
            status: 'expired',
            message: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่'
        });
    } catch (error) {
        console.error('checkSession error:', error);
        return JSON.stringify({
            status: 'error',
            message: 'เกิดข้อผิดพลาด: ' + error.toString()
        });
    }
}

function logUserActivity(email, username, userClass, action, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = ss.getSheetByName('LOG');
if (!logSheet) {
  logSheet = ss.insertSheet('LOG');
  const headers = [
    'วันเวลา', 'Email', 'Username', 'Class', 'Action', 
    'รายละเอียด', 'IP/Device', 'Session_Key'
  ];
  logSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  const headerRange = logSheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4CAF50');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
}

const now = new Date();
const thaiDateTime = now.toLocaleString('th-TH', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit', 
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

const logData = [
  thaiDateTime,
  email || 'N/A',
  username || 'N/A',
  userClass || 'guest',
  action,
  details || '',
  Session.getTemporaryActiveUserKey() || 'unknown',
  'session_' + (email ? email.replace(/[^a-zA-Z0-9]/g, '_') : 'unknown') + '_' + Date.now()
];

logSheet.appendRow(logData);

const lastRow = logSheet.getLastRow();
const actionCell = logSheet.getRange(lastRow, 5);

switch (action) {
  case 'LOGIN':
    actionCell.setBackground('#E8F5E8');
    break;
  case 'LOGOUT':
    actionCell.setBackground('#FFF3E0');
    break;
  case 'TIMEOUT':
    actionCell.setBackground('#FFEBEE');
    break;
  case 'LOGIN_FAILED':
    actionCell.setBackground('#FFCDD2');
    break;
}

} catch (error) {
console.error('Error logging activity:', error);
}
}

function logout(sessionKey) {
    try {
        
        if (!sessionKey) {
            return JSON.stringify({
                status: 'error',
                message: 'ไม่พบ Session Key'
            });
        }

        const sessionData = PropertiesService.getScriptProperties().getProperty(sessionKey);
        let loggedOutUser = null;
        
        if (sessionData) {
            loggedOutUser = JSON.parse(sessionData);
            
            logUserActivity(
                loggedOutUser.email, 
                loggedOutUser.username, 
                loggedOutUser.class, 
                'LOGOUT', 
                'ออกจากระบบโดยผู้ใช้'
            );
            
            sendTelegram(
                '🚪 <b>[APHITHANASAP - ออกจากระบบ]</b>\n' +
                '👤 <b>ผู้ใช้งาน:</b> ' + (loggedOutUser.username || loggedOutUser.email) + ' (' + loggedOutUser.email + ')\n' +
                '🕒 <b>เวลา:</b> ' + getThaiDateTimeStr()
            );
            
            PropertiesService.getScriptProperties().deleteProperty(sessionKey);
            PropertiesService.getScriptProperties().deleteProperty('currentUser');
        }

        return JSON.stringify({
            status: 'success',
            message: 'ออกจากระบบสำเร็จ'
        });
    } catch (error) {
        console.error('logout error:', error);
        return JSON.stringify({
            status: 'error',
            message: 'เกิดข้อผิดพลาด: ' + error.toString()
        });
    }
}

function getCurrentUser(sessionKey) {
    try {
        let sessionData = null;
        let user = null;
        
        // ถ้ามี sessionKey ให้หาจาก sessionKey ก่อนเป็นอันดับแรก
        if (sessionKey) {
            const userFromKey = getCurrentUserWithSessionKey(sessionKey);
            if (userFromKey) {
                return userFromKey;
            }
            sessionData = PropertiesService.getScriptProperties().getProperty(sessionKey);
            if (sessionData) {
                user = JSON.parse(sessionData);
                const lastLogin = new Date(user.lastLogin);
                const now = new Date();
                const minutesDiff = (now - lastLogin) / (1000 * 60);
                const timeoutMinutes = getTimeoutMinutes(user.class || 'user1');

                if (minutesDiff < timeoutMinutes) {
                    user.lastLogin = new Date().toISOString();
                    PropertiesService.getScriptProperties().setProperty(sessionKey, JSON.stringify(user));
                    return user;
                } else {
                    PropertiesService.getScriptProperties().deleteProperty(sessionKey);
                }
            }
        }
        
        // Fallback: ตรวจสอบ currentUser จาก ScriptProperties
        sessionData = PropertiesService.getScriptProperties().getProperty('currentUser');
        if (sessionData) {
            user = JSON.parse(sessionData);
            
            const lastLogin = new Date(user.lastLogin);
            const now = new Date();
            const minutesDiff = (now - lastLogin) / (1000 * 60);
            const timeoutMinutes = getTimeoutMinutes(user.class || 'user1');

            if (minutesDiff < timeoutMinutes) {
                user.lastLogin = new Date().toISOString();
                PropertiesService.getScriptProperties().setProperty('currentUser', JSON.stringify(user));
                return user;
            } else {
                PropertiesService.getScriptProperties().deleteProperty('currentUser');
            }
        }
        
        return null;
    } catch (error) {
        console.error('getCurrentUser error:', error);
        return null;
    }
}

function createUserSheet(ss) {
  const userSheet = ss.insertSheet('USERS');
  const headers = ['email', 'username', 'class', 'linkedBroker', 'linkedInvestor', 'status', 'password'];
  userSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  const sampleUsers = [
    [Session.getActiveUser().getEmail(), 'Admin', 'admin', '', '', 'active', 'admin123'],
    ['broker1@example.com', 'นายหน้าเอ', 'super_user1', 'นายสุชาติ นายหน้า', '', 'active', 'broker123'],
    ['broker2@example.com', 'นายหน้าบี', 'super_user2', 'นางสาวมานี นายหน้า', '', 'active', 'broker456'],
    ['investor1@example.com', 'นายทุนเอ', 'user1', '', 'นายสมชาย นายทุน', 'active', 'investor123'],
    ['investor2@example.com', 'นายทุนบี', 'user2', '', 'นางสาวสุดา นายทุน', 'active', 'investor456']
  ];
  
  userSheet.getRange(2, 1, sampleUsers.length, sampleUsers[0].length).setValues(sampleUsers);
  
  return userSheet;
}

function loadTable() {
  return executeWithRetry(() => {
    try {
      const currentUser = getCurrentUser();
      
      if (!currentUser) {
        return JSON.stringify({
          status: 'error',
          message: 'SESSION_EXPIRED'
        });
      }
      
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('DATABASE');
      
      if (!sheet) {
        throw new Error('ไม่พบ Sheet ชื่อ DATABASE');
      }
      
      Utilities.sleep(100);
      
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();

      Utilities.sleep(200);

      const rawColumn29 = sheet.getRange(2, 30, sheet.getLastRow() - 1, 1).getDisplayValues();

      if (values.length > 1) {
        for (let i = 1; i < values.length; i++) {
          if (rawColumn29[i - 1]) {
            values[i][29] = rawColumn29[i - 1][0];
          }
        }
      }
      
      if (values.length === 0) {
        return JSON.stringify({
          status: 'success',
          data: [],
          headers: [],
          userClass: currentUser.class
        });
      }
      
      const [headers, ...allData] = values;
      let filteredData = filterDataByPermission(allData, currentUser);
      
      return JSON.stringify({
        status: 'success',
        data: filteredData,
        headers: headers,
        userClass: currentUser.class,
        totalRows: filteredData.length
      });
      
    } catch (error) {
      console.error('loadTable error:', error);
      throw error;
    }
  }, 3, 1000);
}

function executeWithRetry(func, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return func();
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      
      if (error.toString().includes('concurrent requests') || 
          error.toString().includes('rate limit') ||
          error.toString().includes('quota')) {
        
        if (i < maxRetries - 1) {
          const waitTime = delay * Math.pow(2, i);
          Utilities.sleep(waitTime);
          continue;
        }
      }
      throw error;
    }
  }
}

function safeLoadTable() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    return loadTable();
  } catch (error) {
    return JSON.stringify({
      status: 'error',
      message: 'ระบบกำลังใช้งานหนัก กรุณารอสักครู่แล้วลองใหม่'
    });
  } finally {
    lock.releaseLock();
  }
}

function filterDataByPermission(data, user) {
  if (user.class === 'admin') {
    return data;
  }
  
  return data.filter(row => {
    if (user.class.startsWith('super_user')) {
      return row[27] === user.linkedBroker;
    } else if (user.class.startsWith('user')) {
      return row[21] === user.linkedInvestor;
    }
    return false;
  });
}

function getNextRowNumber() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const databaseSheet = ss.getSheetByName('DATABASE');
    
    if (!databaseSheet) {
      return 1;
    }
    
    const lastRow = databaseSheet.getLastRow();
    
    if (lastRow <= 1) {
      return 1;
    }
    
    const column_A = databaseSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    
    const existingNumbers = [];
    
    for (let i = 0; i < column_A.length; i++) {
      const value = column_A[i][0];
      if (value && value !== '' && value !== null) {
        const num = parseInt(value);
        if (!isNaN(num)) {
          existingNumbers.push(num);
        }
      }
    }
    
    if (existingNumbers.length === 0) {
      return 1;
    }
    
    const maxNumber = Math.max(...existingNumbers);
    return maxNumber + 1;
    
  } catch (error) {
    throw new Error('เกิดข้อผิดพลาดในการหาแถวถัดไป: ' + error.toString());
  }
}

function reserveNextRowAndFolders(assetName) {
  try {
    const currentUser = getCurrentUser();
    if (currentUser.class !== 'admin') {
      throw new Error('คุณไม่มีสิทธิ์ในการเพิ่มข้อมูลใหม่');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let databaseSheet = ss.getSheetByName('DATABASE');
    let clientSheet = ss.getSheetByName('CLIENT');
    
    if (!databaseSheet) {
      databaseSheet = ss.insertSheet('DATABASE');
      createDatabaseHeaders(databaseSheet);
    }
    
    if (!clientSheet) {
      clientSheet = ss.insertSheet('CLIENT');
      const clientHeaders = ['ลำดับ', 'Main_Folder_ID', 'วันที่สร้างโฟลเดอร์', 'สถานะโฟลเดอร์', 'จำนวนไฟล์รวม', 'ขนาดไฟล์รวม'];
      clientSheet.getRange(1, 1, 1, clientHeaders.length).setValues([clientHeaders]);
    }
    
    const nextNumber = getNextRowNumber();
    const paddedNumber = String(nextNumber).padStart(2, '0');
    
    const rootFolder = DriveApp.getFolderById(FOLDER_ROOT);
    const mainFolderName = `${paddedNumber}.${assetName}`;
    const mainFolder = rootFolder.createFolder(mainFolderName);
    const mainFolderId = mainFolder.getId();
    
    const subfolders = [
      `${paddedNumber}.รูปถ่ายโฉนด`,
      `${paddedNumber}.รูปถ่ายสถานที่จริง`,
      `${paddedNumber}.หลักฐานการซื้อขาย`,
      `${paddedNumber}.VDO`
    ];
    
    const subfolderIds = [];
    subfolders.forEach(folderName => {
      const subfolder = mainFolder.createFolder(folderName);
      subfolderIds.push(subfolder.getId());
    });
    
    const databaseRow = findRowByNumber(paddedNumber);
    let actualRow;
    
    if (databaseRow === -1) {
      actualRow = databaseSheet.getLastRow() + 1;
    } else {
      actualRow = databaseRow;
    }
    
    databaseSheet.getRange(actualRow, 1).setValue(paddedNumber);
    databaseSheet.getRange(actualRow, 2).setValue(assetName);
    databaseSheet.getRange(actualRow, 41).setValue(new Date().toLocaleString('th-TH'));
    databaseSheet.getRange(actualRow, 42).setValue(new Date().toLocaleString('th-TH'));
    
    databaseSheet.getRange(actualRow, 37).setValue(subfolderIds[0]);
    databaseSheet.getRange(actualRow, 38).setValue(subfolderIds[1]);
    databaseSheet.getRange(actualRow, 39).setValue(subfolderIds[2]);
    databaseSheet.getRange(actualRow, 40).setValue(subfolderIds[3]);
    
    const clientRow = actualRow;
    clientSheet.getRange(clientRow, 1).setValue(paddedNumber);
    clientSheet.getRange(clientRow, 2).setValue(mainFolderId);
    clientSheet.getRange(clientRow, 3).setValue(new Date());
    clientSheet.getRange(clientRow, 4).setValue('สร้างแล้ว');
    
    return JSON.stringify({
      status: 'success',
      rowNumber: paddedNumber,
      assetName: assetName,
      mainFolderId: mainFolderId,
      subfolderIds: subfolderIds,
      databaseRow: actualRow
    });
    
  } catch (error) {
    return JSON.stringify({
      status: 'error',
      message: error.toString()
    });
  }
}

function deleteIncompleteData(rowNumber, mainFolderId) {
  try {
    const currentUser = getCurrentUser();
    if (currentUser.class !== 'admin') {
      throw new Error('คุณไม่มีสิทธิ์ในการลบข้อมูล');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const databaseSheet = ss.getSheetByName('DATABASE');
    const clientSheet = ss.getSheetByName('CLIENT');
    
    const databaseRow = findRowByNumber(rowNumber);
    if (databaseRow !== -1) {
      databaseSheet.deleteRow(databaseRow);
    }
    
    if (clientSheet) {
      const clientData = clientSheet.getDataRange().getValues();
      for (let i = 1; i < clientData.length; i++) {
        if (clientData[i][0] == rowNumber) {
          const clientRow = i + 1;
          clientSheet.deleteRow(clientRow);
          break;
        }
      }
    }
    
    if (mainFolderId) {
      try {
        const folder = DriveApp.getFolderById(mainFolderId);
        folder.setTrashed(true);
      } catch (folderError) {
      }
    }
    
    return JSON.stringify({
      status: 'success',
      message: 'ลบข้อมูลที่ไม่สมบูรณ์เรียบร้อย'
    });
    
  } catch (error) {
    return JSON.stringify({
      status: 'error',
      message: error.toString()
    });
  }
}

function createDatabaseHeaders(sheet) {
  const headers = [
    'ลำดับ', 'ชื่อทรัพย์สิน', 'สถานะ', 'อายุสัญญา', 'ประเภททรัพย์สิน', 'Location_URL', 'ประเภทโฉนด', 'ขนาดที่ดิน', 
    'ชื่อเจ้าของทรัพย์สิน', 'เบอร์ติดต่อเจ้าของ', 'อาชีพเจ้าของ', 'รูปแบบการซื้อขาย', 
    'วันที่เริ่มสัญญา', 'วันที่สิ้นสุดสัญญา', 'จำนวนเงินไถ่ถอนในสัญญา', 'เงินต้น', 'ดอกเบี้ย%ต่อเดือน', 'จำนวนเดือน',
    'ดอกเบี้ยต่อเดือน', 'ดอกเบี้ยต่อปี', 'ดอกเบี้ย%ต่อปี', 'ชื่อนายทุน', 'เบอร์นายทุน', 'รูปแบบผลตอบแทนนายทุน',
    '%ผลตอบแทนนายทุน', 'ผลตอบแทนต่อปีนายทุน', 'ผลตอบแทนต่อเดือนนายทุน', 'ชื่อนายหน้า', 'เบอร์นายหน้า',
    '%ปากถุง', 'นายหน้าได้ปากถุง', 'เราได้ปากถุง', 'ส่วนต่างดอกเบี้ย', 'นายทุนได้ดอกเบี้ยตลอดสัญญา', 'รวมนายทุนได้คืน', 'หักดอกเบี้ยล่วงหน้า',
    'Folder_ID_โฉนด', 'Folder_ID_สถานที่', 'Folder_ID_หลักฐาน', 'Folder_ID_VDO', 'วันที่สร้าง', 'สถานะอัปเดต',
    'ชำระดอกเบี้ย ครั้งที่ 1', 'ชำระดอกเบี้ย ครั้งที่ 2', 'ชำระดอกเบี้ย ครั้งที่ 3', 'ชำระดอกเบี้ย ครั้งที่ 4', 
    'ชำระดอกเบี้ย ครั้งที่ 5', 'ชำระดอกเบี้ย ครั้งที่ 6', 'ชำระดอกเบี้ย ครั้งที่ 7', 'ชำระดอกเบี้ย ครั้งที่ 8',
    'ชำระดอกเบี้ย ครั้งที่ 9', 'ชำระดอกเบี้ย ครั้งที่ 10', 'ชำระดอกเบี้ย ครั้งที่ 11', 'ชำระดอกเบี้ย ครั้งที่ 12'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function saveFullFormData(data) {
    try {
        
        const sessionKey = data.sessionKey || getCurrentSessionKey();
        
        if (!sessionKey) {
            return JSON.stringify({
                status: 'error',
                message: 'SESSION_EXPIRED'
            });
        }
        
        const currentUser = getCurrentUserWithSessionKey(sessionKey);
        
        if (!currentUser) {
            return JSON.stringify({
                status: 'error',
                message: 'SESSION_EXPIRED'
            });
        }
        
        
        if (currentUser.class !== 'admin') {
            return JSON.stringify({
                status: 'error',
                message: 'คุณไม่มีสิทธิ์ในการแก้ไขข้อมูล (เฉพาะ Admin เท่านั้น)'
            });
        }
        
        
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName('DATABASE');
        
        if (!sheet) {
            throw new Error('ไม่พบ Sheet ชื่อ DATABASE');
        }
        
        const rowNumber = data.rowNumber;
        const row = findRowByNumber(rowNumber);
        
        if (row === -1) {
            throw new Error('ไม่พบแถวที่ต้องการบันทึกข้อมูล: ' + rowNumber);
        }
        
        
        const formData = data.formData;
        
        
        if (formData.category1) {
            const cat1 = formData.category1;
            sheet.getRange(row, 2).setValue(cat1.assetName || '');
            sheet.getRange(row, 3).setValue(cat1.status || '');
            sheet.getRange(row, 5).setValue(cat1.assetType || '');
            sheet.getRange(row, 6).setValue(cat1.location || '');
            sheet.getRange(row, 7).setValue(cat1.deedType || '');
            sheet.getRange(row, 8).setValue(cat1.landSize || '');
            sheet.getRange(row, 9).setValue(cat1.ownerName || '');
            sheet.getRange(row, 10).setValue(cat1.ownerPhone || '');
            sheet.getRange(row, 11).setValue(cat1.ownerJob || '');
            
        }
        
        if (formData.category2) {
            const cat2 = formData.category2;
            sheet.getRange(row, 12).setValue(cat2.tradingType || '');
            
            if (cat2.contractStartDate) {
                const startDate = convertInputDateToThai(cat2.contractStartDate);
                sheet.getRange(row, 13).setValue(startDate);
            } else {
                sheet.getRange(row, 13).setValue('');
            }

            if (cat2.contractEndDate) {
                const endDate = convertInputDateToThai(cat2.contractEndDate);
                sheet.getRange(row, 14).setValue(endDate);
            } else {
                sheet.getRange(row, 14).setValue('');
            }
            
            sheet.getRange(row, 15).setValue(parseFloat(cat2.redemptionAmount) || 0);
            sheet.getRange(row, 16).setValue(parseFloat(cat2.principal) || 0);
            sheet.getRange(row, 17).setValue(parseFloat(cat2.interestRate) || 0);
            sheet.getRange(row, 18).setValue(parseInt(cat2.months) || 0);
            sheet.getRange(row, 36).setValue(parseFloat(cat2.advanceInterestDeduction) || 0);
            sheet.getRange(row, 33).setValue(parseFloat(cat2.interestDifference) || 0);
            
            const principal = parseFloat(cat2.principal) || 0;
            const monthlyRate = parseFloat(cat2.interestRate) || 0;
            const months = parseInt(cat2.months) || 0;
            
            const monthlyInterest = principal * monthlyRate / 100;
            const yearlyRate = monthlyRate * months;
            const yearlyInterest = principal * yearlyRate / 100;
            
            sheet.getRange(row, 19).setValue(monthlyInterest);
            sheet.getRange(row, 20).setValue(yearlyInterest);
            sheet.getRange(row, 21).setValue(yearlyRate);
            
        }
        
        if (formData.category3) {
            const cat3 = formData.category3;
            sheet.getRange(row, 22).setValue(cat3.investorName || '');
            sheet.getRange(row, 23).setValue(cat3.investorPhone || '');
            sheet.getRange(row, 24).setValue(cat3.returnType || '');
            sheet.getRange(row, 25).setValue(parseFloat(cat3.returnRate) || 0);
            sheet.getRange(row, 26).setValue(parseFloat(cat3.yearlyReturn) || 0);
            sheet.getRange(row, 27).setValue(parseFloat(cat3.monthlyReturn) || 0);
            
        }
        
        if (formData.category4) {
            const cat4 = formData.category4;
            sheet.getRange(row, 28).setValue(cat4.brokerName || '');
            sheet.getRange(row, 29).setValue(cat4.brokerPhone || '');
            sheet.getRange(row, 30).setValue(cat4.commissionRate || '');
            sheet.getRange(row, 31).setValue(parseFloat(cat4.brokerCommission) || 0);
            sheet.getRange(row, 32).setValue(parseFloat(cat4.ourCommission) || 0);
            
        }
        
        const principal = parseFloat(formData.category2?.principal) || 0;
        const yearlyReturn = parseFloat(formData.category3?.yearlyReturn) || 0;
        
        const totalInvestorReturn = yearlyReturn;
        const totalInvestorPayback = principal + totalInvestorReturn;
        
        sheet.getRange(row, 34).setValue(totalInvestorReturn);
        sheet.getRange(row, 35).setValue(totalInvestorPayback);
        
        
        const currentTime = new Date().toLocaleString('th-TH', {
            timeZone: 'Asia/Bangkok'
        });
        
        sheet.getRange(row, 42).setValue(currentTime);
        
        const existingCreateDate = sheet.getRange(row, 41).getValue();
        if (!existingCreateDate) {
            sheet.getRange(row, 41).setValue(currentTime);
        }
        
        
        logUserActivity(
            currentUser.email,
            currentUser.username,
            currentUser.class,
            'SAVE_FORM_DATA',
            'บันทึกข้อมูลทรัพย์สิน: ' + rowNumber + '.' + (formData.category1?.assetName || 'ไม่ระบุ')
        );
        
        var cat1New = formData.category1 || {};
        var cat2New = formData.category2 || {};
        var cat3New = formData.category3 || {};
        sendTelegram(
            '➕ <b>[APHITHANASAP - เพิ่มทรัพย์สินใหม่]</b>\n' +
            '📍 <b>แปลงที่ ' + rowNumber + ':</b> ' + (cat1New.assetName || 'ไม่ระบุชื่อ') + '\n' +
            '👤 <b>ผู้บันทึก:</b> ' + (currentUser.username || currentUser.email) + ' (' + currentUser.class + ')\n' +
            '🏷 <b>ประเภท:</b> ' + (cat1New.assetType || '-') + ' | <b>นิติกรรม:</b> ' + (cat2New.tradingType || '-') + '\n' +
            '💰 <b>ทุนรับซื้อ (เงินต้น):</b> ' + formatNumTh(cat2New.principal) + ' บาท\n' +
            '🤝 <b>นายทุน:</b> ' + (cat3New.investorName || '-') + '\n' +
            '🕒 <b>เวลา:</b> ' + getThaiDateTimeStr()
        );
        
        return JSON.stringify({
            status: 'success',
            message: 'บันทึกข้อมูลสำเร็จ',
            rowNumber: rowNumber,
            timestamp: currentTime
        });
        
    } catch (error) {
        console.error('❌ saveFullFormData error:', error);
        
        try {
            const errorUser = getCurrentUserWithSessionKey(data.sessionKey || getCurrentSessionKey());
            if (errorUser) {
                logUserActivity(
                    errorUser.email,
                    errorUser.username,
                    errorUser.class,
                    'SAVE_FORM_ERROR',
                    'เกิดข้อผิดพลาดในการบันทึก: ' + error.toString()
                );
            }
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }
        
        return JSON.stringify({
            status: 'error',
            message: error.toString(),
            errorType: 'SAVE_FORM_ERROR'
        });
    }
}

function getCurrentSessionKey() {
    try {
        const currentUserData = PropertiesService.getScriptProperties().getProperty('currentUser');
        if (currentUserData) {
            const user = JSON.parse(currentUserData);
            if (user.sessionKey) {
                return user.sessionKey;
            }
        }
        
        const allProperties = PropertiesService.getScriptProperties().getProperties();
        const sessionKeys = Object.keys(allProperties).filter(key => key.startsWith('session_'));
        
        if (sessionKeys.length > 0) {
            const latestSession = sessionKeys.sort().pop();
            return latestSession;
        }
        
        return null;
        
    } catch (error) {
        console.error('Error getting current session key:', error);
        return null;
    }
}

function getDropdownOptions(sheetName, columnName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      if (sheetName === 'DETAIL') {
        sheet = createDetailSheet(ss);
      } else {
        return JSON.stringify([]);
      }
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const columnIndex = headers.indexOf(columnName);
    
    if (columnIndex === -1) {
      return JSON.stringify([]);
    }
    
    const data = sheet.getRange(2, columnIndex + 1, sheet.getLastRow() - 1, 1).getValues();
    const options = data.map(row => row[0]).filter(value => value !== '');
    
    return JSON.stringify([...new Set(options)]);
    
  } catch (error) {
    return JSON.stringify([]);
  }
}

function createDetailSheet(ss) {
  const detailSheet = ss.insertSheet('DETAIL');
  const headers = ['สถานะ', 'ประเภททรัพย์สิน', 'ประเภทโฉนด', 'รูปแบบการซื้อขาย', 'วิธีการชำระดอกเบี้ย'];
  detailSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  const statusData = ['ดำเนินการอยู่', 'ไถ่ถอนแล้ว', 'ยึดทรัพย์', 'อยู่ระหว่างผ่อนผัน'];
  const assetTypeData = ['ที่ดิน', 'บ้าน', 'คอนโด', 'อาคารพาณิชย์', 'ทาวน์เฮาส์', 'โกดัง'];
  const deedTypeData = ['โฉนดที่ดิน', 'นส.3', 'นส.3ก', 'นส.2', 'สค.1'];
  const tradingTypeData = ['ซื้อขายตรง', 'เช่าซื้อ', 'เช่าระยะยาว', 'สัญญาแบ่งปัน', 'ไถ่ถอน'];
  const paymentMethodData = ['โอน', 'เงินสด', 'เช็ค', 'บิทคอยน์', 'อื่นๆ'];
  
  const maxRows = Math.max(statusData.length, assetTypeData.length, deedTypeData.length, tradingTypeData.length, paymentMethodData.length);
  
  for (let i = 0; i < maxRows; i++) {
    if (statusData[i]) detailSheet.getRange(i + 2, 1).setValue(statusData[i]);
    if (assetTypeData[i]) detailSheet.getRange(i + 2, 2).setValue(assetTypeData[i]);
    if (deedTypeData[i]) detailSheet.getRange(i + 2, 3).setValue(deedTypeData[i]);
    if (tradingTypeData[i]) detailSheet.getRange(i + 2, 4).setValue(tradingTypeData[i]);
    if (paymentMethodData[i]) detailSheet.getRange(i + 2, 5).setValue(paymentMethodData[i]);
  }
  
  return detailSheet;
}

function getBrokerList() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let brokerSheet = ss.getSheetByName('BROKERS');
    
    if (!brokerSheet) {
      brokerSheet = ss.insertSheet('BROKERS');
      const headers = ['ชื่อนายหน้า', 'เบอร์ติดต่อ', 'อีเมล', 'ที่อยู่', 'หมายเหตุ', 'สถานะ'];
      brokerSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      const sampleData = [
        ['นายสุชาติ นายหน้า', '081-111-2222', 'suchart@broker.com', 'กรุงเทพฯ', 'นายหน้าหลัก', 'ใช้งาน'],
        ['นางสาวมานี นายหน้า', '089-333-4444', 'manee@broker.com', 'ชลบุรี', 'นายหน้ารอง', 'ใช้งาน'],
        ['นายประดิษฐ์ นายหน้า', '062-555-6666', 'pradit@broker.com', 'ระยอง', 'นายหน้าพิเศษ', 'ใช้งาน']
      ];
      brokerSheet.getRange(2, 1, sampleData.length, sampleData[0].length).setValues(sampleData);
    }
    
    const data = brokerSheet.getDataRange().getValues();
    const brokers = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][5] === 'ใช้งาน') {
        brokers.push({
          name: data[i][0],
          phone: data[i][1] || '',
          email: data[i][2] || ''
        });
      }
    }
    
    return JSON.stringify(brokers);
    
  } catch (error) {
    return JSON.stringify([]);
  }
}

function getInvestorList() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let investorSheet = ss.getSheetByName('INVESTORS');
    
    if (!investorSheet) {
      investorSheet = ss.insertSheet('INVESTORS');
      const headers = ['ชื่อนายทุน', 'เบอร์ติดต่อ', 'อีเมล', 'ที่อยู่', 'หมายเหตุ', 'สถานะ'];
      investorSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      const sampleData = [
        ['นายสมชาย นายทุน', '081-777-8888', 'somchai@investor.com', 'กรุงเทพฯ', 'นายทุนหลัก', 'ใช้งาน'],
        ['นางสาวสุดา นายทุน', '089-999-0000', 'suda@investor.com', 'ชลบุรี', 'นายทุนรอง', 'ใช้งาน'],
        ['นายวิชัย นายทุน', '062-111-2222', 'wichai@investor.com', 'ระยอง', 'นายทุนพิเศษ', 'ใช้งาน']
      ];
      investorSheet.getRange(2, 1, sampleData.length, sampleData[0].length).setValues(sampleData);
    }
    
    const data = investorSheet.getDataRange().getValues();
    const investors = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][5] === 'ใช้งาน') {
        investors.push({
          name: data[i][0],
          phone: data[i][1] || '',
          email: data[i][2] || ''
        });
      }
    }
    
    return JSON.stringify(investors);
    
  } catch (error) {
    return JSON.stringify([]);
  }
}

// ============================================================
// ✅ OPTIMIZED: รวม Request ทั้งหมดตอนเปิดหน้าเว็บในคำสั่งเดียว
// ลดการยิงแยกรอบจาก 8 requests เหลือเพียง 1 request เดียว
// ============================================================
function getInitialAppData(sessionKey) {
  try {
    const currentUser = getCurrentUserWithSessionKey(sessionKey);
    if (!currentUser) {
      return JSON.stringify({
        status: 'error',
        message: 'SESSION_EXPIRED'
      });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. อ่านข้อมูล DATABASE
    const dbSheet = ss.getSheetByName('DATABASE');
    if (!dbSheet) {
      throw new Error('ไม่พบ Sheet ชื่อ DATABASE');
    }

    const values = dbSheet.getDataRange().getValues();
    const lastRow = dbSheet.getLastRow();

    if (lastRow > 1) {
      const rawColumn29 = dbSheet.getRange(2, 30, lastRow - 1, 1).getDisplayValues();
      for (let i = 1; i < values.length; i++) {
        if (rawColumn29[i - 1]) {
          values[i][29] = rawColumn29[i - 1][0];
        }
      }
    }

    let headers = [];
    let filteredData = [];
    if (values.length > 0) {
      headers = values[0];
      const allData = values.slice(1);
      filteredData = filterDataByPermission(allData, currentUser);
    }

    // 2. อ่านตัวเลือก Dropdown จาก DETAIL (อ่านรอบเดียวครบทุกคอลัมน์)
    let detailSheet = ss.getSheetByName('DETAIL');
    if (!detailSheet) {
      detailSheet = createDetailSheet(ss);
    }
    const detailValues = detailSheet.getDataRange().getValues();
    const dropdowns = {};
    if (detailValues.length > 1) {
      const detailHeaders = detailValues[0];
      for (let c = 0; c < detailHeaders.length; c++) {
        const colName = String(detailHeaders[c]).trim();
        if (!colName) continue;
        const colList = [];
        for (let r = 1; r < detailValues.length; r++) {
          const val = detailValues[r][c];
          if (val !== '' && val !== null && val !== undefined) {
            colList.push(String(val).trim());
          }
        }
        dropdowns[colName] = [...new Set(colList)];
      }
    }

    // 3. อ่านรายชื่อนายทุน (INVESTORS)
    const investors = [];
    let invSheet = ss.getSheetByName('INVESTORS');
    if (invSheet) {
      const invValues = invSheet.getDataRange().getValues();
      for (let i = 1; i < invValues.length; i++) {
        if (invValues[i][0] && invValues[i][5] === 'ใช้งาน') {
          investors.push({
            name: invValues[i][0],
            phone: invValues[i][1] || '',
            email: invValues[i][2] || ''
          });
        }
      }
    }

    // 4. อ่านรายชื่อนายหน้า (BROKERS)
    const brokers = [];
    let brkSheet = ss.getSheetByName('BROKERS');
    if (brkSheet) {
      const brkValues = brkSheet.getDataRange().getValues();
      for (let i = 1; i < brkValues.length; i++) {
        if (brkValues[i][0] && brkValues[i][5] === 'ใช้งาน') {
          brokers.push({
            name: brkValues[i][0],
            phone: brkValues[i][1] || '',
            email: brkValues[i][2] || ''
          });
        }
      }
    }

    return JSON.stringify({
      status: 'success',
      table: {
        headers: headers,
        data: filteredData,
        userClass: currentUser.class,
        totalRows: filteredData.length
      },
      dropdowns: dropdowns,
      investors: investors,
      brokers: brokers,
      user: {
        username: currentUser.username,
        class: currentUser.class,
        isSimulation: !!currentUser.isSimulation,
        adminBackup: currentUser.adminBackup || null
      }
    });

  } catch (error) {
    console.error('getInitialAppData error:', error);
    return JSON.stringify({
      status: 'error',
      message: error.toString()
    });
  }
}

function fetchBrokerPhone(brokerName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const brokerSheet = ss.getSheetByName('BROKERS');
    
    if (!brokerSheet) {
      return '';
    }
    
    const data = brokerSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === brokerName) {
        return data[i][1];
      }
    }
    
    return '';
    
  } catch (error) {
    console.error('Error fetching broker phone:', error);
    return '';
  }
}

function fetchInvestorPhone(investorName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const investorSheet = ss.getSheetByName('INVESTORS');
    
    if (!investorSheet) {
      return '';
    }
    
    const data = investorSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === investorName) {
        return data[i][1];
      }
    }
    
    return '';
    
  } catch (error) {
    console.error('Error fetching investor phone:', error);
    return '';
  }
}

function findRowByNumber(rowNumber) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DATABASE');
    
    const column_A = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    
    for (let i = 0; i < column_A.length; i++) {
      if (column_A[i][0] == rowNumber) {
        return i + 2;
      }
    }
    
    return -1;
    
  } catch (error) {
    return -1;
  }
}

function uploadMultipleFiles(fileData, rowNumber, category) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const databaseSheet = ss.getSheetByName('DATABASE');
    
    const databaseRow = findRowByNumber(rowNumber);
    if (databaseRow === -1) {
      throw new Error('ไม่พบข้อมูลในฐานข้อมูล');
    }
    
    const rowData = databaseSheet.getRange(databaseRow, 1, 1, databaseSheet.getLastColumn()).getValues()[0];
    
    const folderMapping = {
      deed: rowData[36],
      location: rowData[37],
      transaction: rowData[38],
      vdo: rowData[39]
    };
    
    const folderId = folderMapping[category];
    if (!folderId) {
      throw new Error('ไม่พบโฟลเดอร์สำหรับหมวดนี้');
    }
    
    const folder = DriveApp.getFolderById(folderId);
    const uploadedFiles = [];
    
    for (let i = 0; i < fileData.length; i++) {
      const file = fileData[i];
      
      const base64Data = file.data.split(',')[1];
      const bytes = Utilities.base64Decode(base64Data);
      const blob = Utilities.newBlob(bytes, file.mimeType, file.name);
      
      const driveFile = folder.createFile(blob);
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      uploadedFiles.push({
        id: driveFile.getId(),
        name: driveFile.getName(),
        url: `https://drive.google.com/file/d/${driveFile.getId()}/view`,
        downloadUrl: `https://drive.google.com/uc?id=${driveFile.getId()}`,
        size: driveFile.getSize()
      });
    }
    
    return JSON.stringify({
      status: 'success',
      message: 'อัพโหลดไฟล์สำเร็จ',
      uploadedFiles: uploadedFiles,
      totalFiles: uploadedFiles.length
    });
    
  } catch (error) {
    return JSON.stringify({
      status: 'error',
      message: error.toString()
    });
  }
}

function getFolderFiles(folderId) {
    try {
        
        if (!folderId) {
            return JSON.stringify({
                status: 'error',
                message: 'Folder ID is required'
            });
        }
        
        let folder;
        try {
            folder = DriveApp.getFolderById(folderId);
        } catch (e) {
            console.error('Folder not found:', e);
            return JSON.stringify({
                status: 'error',
                message: 'ไม่พบโฟลเดอร์ที่ระบุ'
            });
        }
        
        const folderName = folder.getName();
        const files = folder.getFiles();
        const fileList = [];
        
        while (files.hasNext()) {
            const file = files.next();
            
            try {
                const fileId = file.getId();
                const mimeType = file.getBlob().getContentType();
                
                const fileInfo = {
                    id: fileId,
                    name: file.getName(),
                    size: file.getSize(),
                    mimeType: mimeType,
                    downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`
                };
                
                if (mimeType.startsWith('image/')) {
                    fileInfo.thumbnailUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
                    fileInfo.viewUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
                }
                
                if (mimeType.startsWith('video/')) {
                    fileInfo.thumbnailUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
                    fileInfo.videoUrl = `https://drive.google.com/file/d/${fileId}/preview`;
                }
                
                fileList.push(fileInfo);
                
            } catch (fileError) {
                console.error('Error processing file:', fileError);
                continue;
            }
        }
        
        return JSON.stringify({
            status: 'success',
            folderName: folderName,
            totalFiles: fileList.length,
            files: fileList
        });
        
    } catch (error) {
        console.error('getFolderFiles error:', error);
        return JSON.stringify({
            status: 'error',
            message: 'เกิดข้อผิดพลาด: ' + error.toString()
        });
    }
}

function deleteFile(fileId) {
  try {
    const currentUser = getCurrentUser();
    if (currentUser.class !== 'admin') {
      throw new Error('คุณไม่มีสิทธิ์ในการลบไฟล์');
    }
    
    const file = DriveApp.getFileById(fileId);
    const fileName = file.getName();
    file.setTrashed(true);
    
    sendTelegram(
      '📁 <b>[APHITHANASAP - ลบไฟล์ใน Google Drive]</b>\n' +
      '👤 <b>ผู้ลบ:</b> ' + (currentUser.username || currentUser.email) + ' (' + currentUser.class + ')\n' +
      '📄 <b>ชื่อไฟล์:</b> ' + fileName + '\n' +
      '🕒 <b>เวลา:</b> ' + getThaiDateTimeStr()
    );
    
    return JSON.stringify({
      status: 'success',
      message: 'ลบไฟล์สำเร็จ'
    });
    
  } catch (error) {
    return JSON.stringify({
      status: 'error',
      message: error.toString()
    });
  }
}

function getPaymentHistory(rowNumber) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DATABASE');
    
    const row = findRowByNumber(rowNumber);
    if (row === -1) {
      throw new Error('ไม่พบข้อมูล');
    }
    
    const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const principal = parseFloat(rowData[15]) || 0;
    const totalPayback = parseFloat(rowData[34]) || 0;
    
    const payments = [];
    let totalPaid = 0;
    let nextRound = 1;
    
for (let i = 43; i <= 54; i++) {
      const paymentData = rowData[i - 1];
      if (paymentData && paymentData.trim() !== '') {
        const parts = paymentData.split(' | ');
        if (parts.length === 3) {
          const amount = parseFloat(parts[1].replace(/[^\d.]/g, '')) || 0;
          payments.push({
            round: i - 42,
            date: parts[0],
            amount: amount,
            method: parts[2],
            formatted: paymentData
          });
          totalPaid += amount;
          nextRound = (i - 42) + 1;
        }
      } else {
        nextRound = i - 42;
        break;
      }
    }
    
    return JSON.stringify({
      status: 'success',
      principal: principal,
      totalPayback: totalPayback,
      payments: payments,
      totalPaid: totalPaid,
      remaining: totalPayback - totalPaid,
      nextRound: nextRound > 12 ? 12 : nextRound
    });
    
  } catch (error) {
    return JSON.stringify({
      status: 'error',
      message: error.toString()
    });
  }
}

function savePaymentData(rowNumber, paymentRound, paymentData) {
  try {
    const currentUser = getCurrentUser();
    if (currentUser.class !== 'admin') {
      throw new Error('คุณไม่มีสิทธิ์ในการแก้ไขข้อมูล');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DATABASE');
    
    const row = findRowByNumber(rowNumber);
    if (row === -1) {
      throw new Error('ไม่พบข้อมูล');
    }
    
    const columnIndex = 42 + parseInt(paymentRound);
    const formattedData = `${paymentData.date} | ${paymentData.amount} บาท | ${paymentData.method}`;
    
    sheet.getRange(row, columnIndex).setValue(formattedData);

    sheet.getRange(row, 42).setValue(new Date().toLocaleString('th-TH'));
    
    sendTelegram(
      '💵 <b>[APHITHANASAP - บันทึกการรับชำระดอกเบี้ย]</b>\n' +
      '👤 <b>ผู้บันทึก:</b> ' + (currentUser.username || currentUser.email) + ' (' + currentUser.class + ')\n' +
      '📍 <b>แปลงที่ ' + rowNumber + ':</b> ชำระงวดที่ ' + paymentRound + '\n' +
      '💰 <b>ยอดเงิน:</b> ' + formatNumTh(paymentData.amount) + ' บาท\n' +
      '📅 <b>วันที่รับชำระ:</b> ' + paymentData.date + ' (' + (paymentData.method || 'เงินโอน') + ')\n' +
      '🕒 <b>เวลาบันทึก:</b> ' + getThaiDateTimeStr()
    );
    
    return JSON.stringify({
      status: 'success',
      message: 'บันทึกข้อมูลการชำระสำเร็จ'
    });
    
  } catch (error) {
    return JSON.stringify({
      status: 'error',
      message: error.toString()
    });
  }
}

/**
 * ลบข้อมูลแถวทั้งหมดและจัดการ dependencies
 */
function deleteRowCompletely(rowNumber) {
  try {
    const currentUser = getCurrentUser();
    if (currentUser.class !== 'admin') {
      throw new Error('คุณไม่มีสิทธิ์ในการลบข้อมูล');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const databaseSheet = ss.getSheetByName('DATABASE');
    const clientSheet = ss.getSheetByName('CLIENT');
    
    if (!databaseSheet) {
      throw new Error('ไม่พบ DATABASE sheet');
    }
    
    const targetRow = findRowByNumber(rowNumber);
    if (targetRow === -1) {
      throw new Error('ไม่พบข้อมูลที่ต้องการลบ');
    }
    
    const rowData = databaseSheet.getRange(targetRow, 1, 1, databaseSheet.getLastColumn()).getValues()[0];
    const assetName = rowData[1];
    
    const folderIds = [
      rowData[36],
      rowData[37],
      rowData[38],
      rowData[39]
    ];
    
    let mainFolderId = null;
    if (clientSheet) {
      const clientData = clientSheet.getDataRange().getValues();
      for (let i = 1; i < clientData.length; i++) {
        if (clientData[i][0] == rowNumber) {
          mainFolderId = clientData[i][1];
          break;
        }
      }
    }
    
    sendTelegram(
      '🚨 <b>[APHITHANASAP - ตรวจพบการลบข้อมูลแปลง!]</b>\n' +
      '👤 <b>ผู้ลบ:</b> ' + (currentUser.username || currentUser.email) + ' (' + currentUser.class + ')\n' +
      '🗑 <b>แปลงที่ถูกลบ:</b> แปลงที่ ' + rowNumber + '\n' +
      '🕒 <b>เวลา:</b> ' + getThaiDateTimeStr() + '\n\n' +
      '📦 <b>ข้อมูลสำรองก่อนถูกลบ:</b>\n' +
      '• <b>ชื่อทรัพย์:</b> ' + (rowData[1] || '-') + ' (' + (rowData[4] || '-') + ')\n' +
      '• <b>สถานะ:</b> ' + (rowData[2] || '-') + ' | <b>นิติกรรม:</b> ' + (rowData[11] || '-') + '\n' +
      '• <b>ที่ตั้ง:</b> ' + (rowData[5] || '-') + ' | <b>เนื้อที่:</b> ' + (rowData[7] || '-') + '\n' +
      '• <b>เจ้าของ:</b> ' + (rowData[8] || '-') + ' (โทร: ' + (rowData[9] || '-') + ')\n' +
      '• <b>เงินต้น:</b> ' + formatNumTh(rowData[15]) + ' บาท | <b>ไถ่ถอน:</b> ' + formatNumTh(rowData[14]) + ' บาท\n' +
      '• <b>ดอกเบี้ย:</b> ' + (rowData[16] || '0') + '%/เดือน\n' +
      '• <b>สัญญา:</b> ' + (rowData[12] || '-') + ' ถึง ' + (rowData[13] || '-') + '\n' +
      '• <b>นายทุน:</b> ' + (rowData[21] || '-') + ' | <b>นายหน้า:</b> ' + (rowData[27] || '-')
    );

    const deletedFolders = deleteFoldersAndFiles(mainFolderId, folderIds);
    
    databaseSheet.deleteRow(targetRow);
    
    if (clientSheet) {
      deleteClientRow(clientSheet, rowNumber);
    }
    
    updateRowNumbers(databaseSheet, clientSheet);
    
    return JSON.stringify({
      status: 'success',
      message: 'ลบข้อมูลสำเร็จ',
      deletedData: {
        rowNumber: rowNumber,
        assetName: assetName,
        deletedFolders: deletedFolders.length,
        updatedRows: true
      }
    });
    
  } catch (error) {
    console.error('Delete error:', error);
    return JSON.stringify({
      status: 'error',
      message: error.toString()
    });
  }
}

/**
 * ลบโฟลเดอร์และไฟล์ใน Google Drive
 */
function deleteFoldersAndFiles(mainFolderId, subfolderIds) {
  const deletedFolders = [];
  
  try {
    subfolderIds.forEach((folderId, index) => {
      if (folderId) {
        try {
          const folder = DriveApp.getFolderById(folderId);
          folder.setTrashed(true);
          deletedFolders.push(`Subfolder ${index + 1}: ${folder.getName()}`);
        } catch (e) {
        }
      }
    });
    
    if (mainFolderId) {
      try {
        const mainFolder = DriveApp.getFolderById(mainFolderId);
        const folderName = mainFolder.getName();
        mainFolder.setTrashed(true);
        deletedFolders.push(`Main folder: ${folderName}`);
      } catch (e) {
      }
    }
    
  } catch (error) {
    console.error('Error deleting folders:', error);
  }
  
  return deletedFolders;
}

/**
 * ลบแถวใน CLIENT sheet
 */
function deleteClientRow(clientSheet, rowNumber) {
  try {
    const clientData = clientSheet.getDataRange().getValues();
    
    for (let i = 1; i < clientData.length; i++) {
      if (clientData[i][0] == rowNumber) {
        clientSheet.deleteRow(i + 1);
        break;
      }
    }
  } catch (error) {
    console.error('Error deleting CLIENT row:', error);
  }
}

/**
 * อัปเดต row numbers ให้ต่อเนื่องหลังจากลบ
 */
function updateRowNumbers(databaseSheet, clientSheet) {
  try {
    updateDatabaseRowNumbers(databaseSheet);
    
    if (clientSheet) {
      updateClientRowNumbers(clientSheet);
    }
    
    
  } catch (error) {
    console.error('Error updating row numbers:', error);
  }
}

/**
 * อัปเดต row numbers ใน DATABASE sheet
 */
function updateDatabaseRowNumbers(databaseSheet) {
  const lastRow = databaseSheet.getLastRow();
  
  if (lastRow <= 1) return;
  
  const data = databaseSheet.getRange(2, 1, lastRow - 1, databaseSheet.getLastColumn()).getValues();
  
  for (let i = 0; i < data.length; i++) {
    const newRowNumber = String(i + 1).padStart(2, '0');
    
    if (data[i][0] !== newRowNumber) {
      databaseSheet.getRange(i + 2, 1).setValue(newRowNumber);
      
      const assetName = data[i][1];
      if (assetName) {
        try {
          updateFolderNames(newRowNumber, assetName, data[i]);
        } catch (e) {
        }
      }
    }
  }
}

/**
 * อัปเดต row numbers ใน CLIENT sheet
 */
function updateClientRowNumbers(clientSheet) {
  const lastRow = clientSheet.getLastRow();
  
  if (lastRow <= 1) return;
  
  const data = clientSheet.getRange(2, 1, lastRow - 1, clientSheet.getLastColumn()).getValues();
  
  for (let i = 0; i < data.length; i++) {
    const newRowNumber = String(i + 1).padStart(2, '0');
    
    if (data[i][0] !== newRowNumber) {
      clientSheet.getRange(i + 2, 1).setValue(newRowNumber);
    }
  }
}

/**
 * อัปเดตชื่อโฟลเดอร์ให้ตรงกับ row number ใหม่
 */
function updateFolderNames(newRowNumber, assetName, rowData) {
  const folderIds = [
    rowData[36],
    rowData[37],
    rowData[38],
    rowData[39]
  ];
  
  const folderSuffixes = [
    `.รูปถ่ายโฉนด`,
    `.รูปถ่ายสถานที่จริง`,
    `.หลักฐานการซื้อขาย`,
    `.VDO`
  ];
  
  folderIds.forEach((folderId, index) => {
    if (folderId) {
      try {
        const folder = DriveApp.getFolderById(folderId);
        const newName = `${newRowNumber}${folderSuffixes[index]}`;
        folder.setName(newName);
      } catch (e) {
      }
    }
  });
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const clientSheet = ss.getSheetByName('CLIENT');
    
    if (clientSheet) {
      const clientData = clientSheet.getDataRange().getValues();
      
      for (let i = 1; i < clientData.length; i++) {
        if (clientData[i][0] == newRowNumber) {
          const mainFolderId = clientData[i][1];
          if (mainFolderId) {
            const mainFolder = DriveApp.getFolderById(mainFolderId);
            mainFolder.setName(`${newRowNumber}.${assetName}`);
          }
          break;
        }
      }
    }
  } catch (e) {
  }
}

/**
 * บันทึกข้อมูลสมาชิกใหม่
 */
function saveMemberData(memberData) {
  try {
    const currentUser = getCurrentUser();
    if (currentUser.class !== 'admin') {
      throw new Error('คุณไม่มีสิทธิ์ในการเพิ่มสมาชิก');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const results = {
      memberSheet: null,
      userSheet: null
    };
    
    if (memberData.type === 'BROKERS') {
      results.memberSheet = saveToBrokersSheet(ss, memberData);
    } else if (memberData.type === 'INVESTORS') {
      results.memberSheet = saveToInvestorsSheet(ss, memberData);
    }
    
    if (memberData.createLogin) {
      results.userSheet = saveToUsersSheet(ss, memberData);
    }
    
    return JSON.stringify({
      status: 'success',
      message: 'เพิ่มสมาชิกเรียบร้อย',
      results: results
    });
    
  } catch (error) {
    console.error('saveMemberData error:', error);
    return JSON.stringify({
      status: 'error',
      message: error.toString()
    });
  }
}

/**
 * บันทึกข้อมูลลง BROKERS sheet
 */
function saveToBrokersSheet(ss, memberData) {
  let brokerSheet = ss.getSheetByName('BROKERS');
  
  if (!brokerSheet) {
    brokerSheet = ss.insertSheet('BROKERS');
    const headers = ['ชื่อนายหน้า', 'เบอร์ติดต่อ', 'อีเมล', 'ที่อยู่', 'หมายเหตุ', 'สถานะ'];
    brokerSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  
  const newRow = [
    memberData.name,
    memberData.phone,
    memberData.email,
    memberData.address,
    memberData.notes,
    memberData.status
  ];
  
  brokerSheet.appendRow(newRow);
  
  return {
    sheet: 'BROKERS',
    row: brokerSheet.getLastRow(),
    data: newRow
  };
}

/**
 * บันทึกข้อมูลลง INVESTORS sheet
 */
function saveToInvestorsSheet(ss, memberData) {
  let investorSheet = ss.getSheetByName('INVESTORS');
  
  if (!investorSheet) {
    investorSheet = ss.insertSheet('INVESTORS');
    const headers = ['ชื่อนายทุน', 'เบอร์ติดต่อ', 'อีเมล', 'ที่อยู่', 'หมายเหตุ', 'สถานะ'];
    investorSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  
  const newRow = [
    memberData.name,
    memberData.phone,
    memberData.email,
    memberData.address,
    memberData.notes,
    memberData.status
  ];
  
  investorSheet.appendRow(newRow);
  
  return {
    sheet: 'INVESTORS',
    row: investorSheet.getLastRow(),
    data: newRow
  };
}

/**
 * บันทึกข้อมูลลง USERS sheet
 */
function saveToUsersSheet(ss, memberData) {
  let userSheet = ss.getSheetByName('USERS');
  
  if (!userSheet) {
    userSheet = createUserSheet(ss);
  }
  
  let linkedBroker = '';
  let linkedInvestor = '';
  
  if (memberData.type === 'BROKERS') {
    linkedBroker = memberData.username;
  } else if (memberData.type === 'INVESTORS') {
    linkedInvestor = memberData.username;
  }
  
  const newRow = [
    memberData.email,
    memberData.username,
    memberData.class,
    linkedBroker,
    linkedInvestor,
    memberData.status,
    memberData.password
  ];
  
  userSheet.appendRow(newRow);
  
  return {
    sheet: 'USERS',
    row: userSheet.getLastRow(),
    data: newRow,
    loginInfo: {
      email: memberData.email,
      username: memberData.username,
      password: memberData.password,
      class: memberData.class
    }
  };
}

/**
 * ดึงข้อมูลสมาชิกตามประเภท
 */
function getMemberData(sheetType) {
  try {
    const currentUser = getCurrentUser();
    if (currentUser.class !== 'admin') {
      throw new Error('คุณไม่มีสิทธิ์ในการดูข้อมูลสมาชิก');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let result = {};
    
    switch (sheetType) {
      case 'BROKERS':
        result = getBrokersData(ss);
        break;
      case 'INVESTORS':
        result = getInvestorsData(ss);
        break;
      case 'USERS':
        result = getUsersData(ss);
        break;
      default:
        throw new Error('ประเภทข้อมูลไม่ถูกต้อง');
    }
    
    return JSON.stringify({
      status: 'success',
      ...result
    });
    
  } catch (error) {
    console.error('getMemberData error:', error);
    return JSON.stringify({
      status: 'error',
      message: error.toString()
    });
  }
}

/**
 * ดึงข้อมูลนายหน้า
 */
function getBrokersData(ss) {
  const brokerSheet = ss.getSheetByName('BROKERS');
  const userSheet = ss.getSheetByName('USERS');
  
  if (!brokerSheet) {
    return { brokers: [] };
  }
  
  const data = brokerSheet.getDataRange().getValues();
  const userData = userSheet ? userSheet.getDataRange().getValues() : [];
  
  const userMap = {};
  const nameMap = {};
  const emailMap = {};
  if (userData.length > 1) {
    for (let i = 1; i < userData.length; i++) {
      const email = userData[i][0] !== undefined ? String(userData[i][0]).trim() : '';
      const username = userData[i][1] !== undefined ? String(userData[i][1]).trim() : '';
      const uClass = userData[i][2];
      const linkedBroker = userData[i][3] !== undefined ? String(userData[i][3]).trim() : '';
      const status = userData[i][5];
      const password = userData[i][6] !== undefined ? String(userData[i][6]).trim() : '';
      
      const uObj = {
        email: email,
        username: username,
        class: uClass,
        status: status,
        password: password
      };
      
      if (linkedBroker) {
        userMap[linkedBroker] = uObj;
        userMap[linkedBroker.toLowerCase()] = uObj;
      }
      if (username) {
        nameMap[username] = uObj;
        nameMap[username.toLowerCase()] = uObj;
      }
      if (email) {
        emailMap[email.toLowerCase()] = uObj;
      }
    }
  }
  
  const brokers = [];
  if (data.length > 1) {
    for (let i = 1; i < data.length; i++) {
      const brokerName = data[i][0] !== undefined ? String(data[i][0]).trim() : '';
      const brokerEmail = data[i][2] !== undefined ? String(data[i][2]).trim() : '';
      
      const loginInfo = userMap[brokerName] || 
                        userMap[brokerName.toLowerCase()] || 
                        nameMap[brokerName] || 
                        nameMap[brokerName.toLowerCase()] || 
                        (brokerEmail ? emailMap[brokerEmail.toLowerCase()] : null) || 
                        null;
      const hasLogin = !!loginInfo;
      
      brokers.push({
        index: i - 1,
        name: brokerName,
        phone: data[i][1] || '',
        email: brokerEmail,
        address: data[i][3] || '',
        notes: data[i][4] || '',
        status: data[i][5] || 'ใช้งาน',
        hasLogin: hasLogin,
        loginInfo: loginInfo
      });
    }
  }
  
  return { brokers: brokers };
}

/**
 * ดึงข้อมูลนายทุน
 */
function getInvestorsData(ss) {
  const investorSheet = ss.getSheetByName('INVESTORS');
  const userSheet = ss.getSheetByName('USERS');
  
  if (!investorSheet) {
    return { investors: [] };
  }
  
  const data = investorSheet.getDataRange().getValues();
  const userData = userSheet ? userSheet.getDataRange().getValues() : [];
  
  const userMap = {};
  const nameMap = {};
  const emailMap = {};
  if (userData.length > 1) {
    for (let i = 1; i < userData.length; i++) {
      const email = userData[i][0] !== undefined ? String(userData[i][0]).trim() : '';
      const username = userData[i][1] !== undefined ? String(userData[i][1]).trim() : '';
      const uClass = userData[i][2];
      const linkedInvestor = userData[i][4] !== undefined ? String(userData[i][4]).trim() : '';
      const status = userData[i][5];
      const password = userData[i][6] !== undefined ? String(userData[i][6]).trim() : '';
      
      const uObj = {
        email: email,
        username: username,
        class: uClass,
        status: status,
        password: password
      };
      
      if (linkedInvestor) {
        userMap[linkedInvestor] = uObj;
        userMap[linkedInvestor.toLowerCase()] = uObj;
      }
      if (username) {
        nameMap[username] = uObj;
        nameMap[username.toLowerCase()] = uObj;
      }
      if (email) {
        emailMap[email.toLowerCase()] = uObj;
      }
    }
  }
  
  const investors = [];
  if (data.length > 1) {
    for (let i = 1; i < data.length; i++) {
      const investorName = data[i][0] !== undefined ? String(data[i][0]).trim() : '';
      const investorEmail = data[i][2] !== undefined ? String(data[i][2]).trim() : '';
      
      const loginInfo = userMap[investorName] || 
                        userMap[investorName.toLowerCase()] || 
                        nameMap[investorName] || 
                        nameMap[investorName.toLowerCase()] || 
                        (investorEmail ? emailMap[investorEmail.toLowerCase()] : null) || 
                        null;
      const hasLogin = !!loginInfo;
      
      investors.push({
        index: i - 1,
        name: investorName,
        phone: data[i][1] || '',
        email: investorEmail,
        address: data[i][3] || '',
        notes: data[i][4] || '',
        status: data[i][5] || 'ใช้งาน',
        hasLogin: hasLogin,
        loginInfo: loginInfo
      });
    }
  }
  
  return { investors: investors };
}

/**
 * ดึงข้อมูลผู้ใช้
 */
function getUsersData(ss) {
  const userSheet = ss.getSheetByName('USERS');
  
  if (!userSheet) {
    return { users: [] };
  }
  
  const data = userSheet.getDataRange().getValues();
  const users = [];
  
  if (data.length > 1) {
    for (let i = 1; i < data.length; i++) {
      const linkedInfo = data[i][3] || data[i][4] || 'ไม่มี';
      
      users.push({
        index: i - 1,
        email: data[i][0] !== undefined ? String(data[i][0]).trim() : '',
        username: data[i][1] !== undefined ? String(data[i][1]).trim() : '',
        class: data[i][2] !== undefined ? String(data[i][2]).trim() : '',
        linkedBroker: data[i][3] || '',
        linkedInvestor: data[i][4] || '',
        linkedInfo: linkedInfo,
        status: data[i][5] || 'active',
        password: data[i][6] !== undefined ? String(data[i][6]).trim() : ''
      });
    }
  }
  
  return { users: users };
}

/**
 * ลบสมาชิก
 */
function deleteMemberData(sheetType, memberIndex) {
  try {
    const currentUser = getCurrentUser();
    if (currentUser.class !== 'admin') {
      throw new Error('คุณไม่มีสิทธิ์ในการลบสมาชิก');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let result = {};
    
    if (sheetType === 'BROKERS') {
      result = deleteBroker(ss, memberIndex);
    } else if (sheetType === 'INVESTORS') {
      result = deleteInvestor(ss, memberIndex);
    } else if (sheetType === 'USERS') {
      result = deleteUser(ss, memberIndex);
    }
    
    sendTelegram(
      '👥 <b>[APHITHANASAP - ลบข้อมูลสมาชิก/ผู้ใช้]</b>\n' +
      '👤 <b>ผู้ลบ:</b> ' + (currentUser.username || currentUser.email) + ' (' + currentUser.class + ')\n' +
      '📋 <b>หมวดหมู่:</b> ' + sheetType + ' (ลำดับที่ ' + (memberIndex + 1) + ')\n' +
      '🕒 <b>เวลา:</b> ' + getThaiDateTimeStr()
    );
    
    return JSON.stringify({
      status: 'success',
      message: 'ลบสมาชิกเรียบร้อย',
      result: result
    });
    
  } catch (error) {
    console.error('deleteMemberData error:', error);
    return JSON.stringify({
      status: 'error',
      message: error.toString()
    });
  }
}

/**
 * ลบนายหน้า (รวมทั้งข้อมูลใน USERS)
 */
function deleteBroker(ss, memberIndex) {
  const brokerSheet = ss.getSheetByName('BROKERS');
  const userSheet = ss.getSheetByName('USERS');
  
  if (!brokerSheet) {
    throw new Error('ไม่พบ BROKERS sheet');
  }
  
  const rowToDelete = memberIndex + 2;
  const brokerData = brokerSheet.getRange(rowToDelete, 1, 1, brokerSheet.getLastColumn()).getValues()[0];
  const brokerName = brokerData[0];
  
  brokerSheet.deleteRow(rowToDelete);
  
  if (userSheet) {
    const userData = userSheet.getDataRange().getValues();
    for (let i = 1; i < userData.length; i++) {
      if (userData[i][3] === brokerName) {
        userSheet.deleteRow(i + 1);
        break;
      }
    }
  }
  
  return {
    deletedFrom: ['BROKERS', 'USERS'],
    brokerName: brokerName
  };
}

/**
 * ลบนายทุน (รวมทั้งข้อมูลใน USERS)
 */
function deleteInvestor(ss, memberIndex) {
  const investorSheet = ss.getSheetByName('INVESTORS');
  const userSheet = ss.getSheetByName('USERS');
  
  if (!investorSheet) {
    throw new Error('ไม่พบ INVESTORS sheet');
  }
  
  const rowToDelete = memberIndex + 2;
  const investorData = investorSheet.getRange(rowToDelete, 1, 1, investorSheet.getLastColumn()).getValues()[0];
  const investorName = investorData[0];
  
  investorSheet.deleteRow(rowToDelete);
  
  if (userSheet) {
    const userData = userSheet.getDataRange().getValues();
    for (let i = 1; i < userData.length; i++) {
      if (userData[i][4] === investorName) {
        userSheet.deleteRow(i + 1);
        break;
      }
    }
  }
  
  return {
    deletedFrom: ['INVESTORS', 'USERS'],
    investorName: investorName
  };
}

/**
 * ลบผู้ใช้
 */
function deleteUser(ss, memberIndex) {
  const userSheet = ss.getSheetByName('USERS');
  
  if (!userSheet) {
    throw new Error('ไม่พบ USERS sheet');
  }
  
  const rowToDelete = memberIndex + 2;
  const userData = userSheet.getRange(rowToDelete, 1, 1, userSheet.getLastColumn()).getValues()[0];
  
  userSheet.deleteRow(rowToDelete);
  
  return {
    deletedFrom: ['USERS'],
    userEmail: userData[0],
    username: userData[1]
  };
}

function uploadFilesToSpecificFolder(fileData, folderId) {
  try {
    const currentUser = getCurrentUser();
    if (currentUser.class !== 'admin') {
      throw new Error('คุณไม่มีสิทธิ์ในการอัพโหลดไฟล์');
    }
    
    if (!folderId) {
      throw new Error('ไม่พบ Folder ID');
    }
    
    let folder;
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (e) {
      throw new Error('ไม่พบโฟลเดอร์ที่ระบุ');
    }
    
    const uploadedFiles = [];
    
    for (let i = 0; i < fileData.length; i++) {
      const file = fileData[i];
      
      try {
        // ตรวจสอบไฟล์ซ้ำในโฟลเดอร์เพื่อป้องกันการอัปโหลดเบิ้ล
        const existingFiles = folder.getFilesByName(file.name);
        if (existingFiles.hasNext()) {
          const existingFile = existingFiles.next();
          uploadedFiles.push({
            id: existingFile.getId(),
            name: existingFile.getName(),
            size: existingFile.getSize(),
            mimeType: file.mimeType,
            downloadUrl: `https://drive.google.com/uc?export=download&id=${existingFile.getId()}`,
            viewUrl: `https://lh3.googleusercontent.com/d/${existingFile.getId()}`
          });
          continue;
        }

        const base64Data = file.data.split(',')[1];
        const bytes = Utilities.base64Decode(base64Data);
        const blob = Utilities.newBlob(bytes, file.mimeType, file.name);
        
        const driveFile = folder.createFile(blob);
        
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        
        uploadedFiles.push({
          id: driveFile.getId(),
          name: driveFile.getName(),
          size: driveFile.getSize(),
          mimeType: file.mimeType,
          downloadUrl: `https://drive.google.com/uc?export=download&id=${driveFile.getId()}`,
          viewUrl: `https://lh3.googleusercontent.com/d/${driveFile.getId()}`
        });
        
      } catch (fileError) {
        console.error(`Error uploading file ${file.name}:`, fileError);
        continue;
      }
    }
    
    if (uploadedFiles.length === 0) {
      throw new Error('ไม่สามารถอัพโหลดไฟล์ใดๆ ได้');
    }
    
    return JSON.stringify({
      status: 'success',
      message: 'อัพโหลดไฟล์สำเร็จ',
      uploadedFiles: uploadedFiles,
      totalFiles: uploadedFiles.length,
      folderName: folder.getName()
    });
    
  } catch (error) {
    console.error('uploadFilesToSpecificFolder error:', error);
    return JSON.stringify({
      status: 'error',
      message: error.toString()
    });
  }
}

/**
 * ดึงรายชื่อ User ทั้งหมดสำหรับระบบจำลอง Login
 */
function getAllUsersForSimulator(sessionKey) {
  try {
    const currentUser = (sessionKey ? getCurrentUserWithSessionKey(sessionKey) : null) || getCurrentUser(sessionKey) || getCurrentUser();
    if (!currentUser || currentUser.class !== 'admin') {
      throw new Error('คุณไม่มีสิทธิ์ในการใช้ฟีเจอร์นี้');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const userSheet = ss.getSheetByName('USERS');
    
    if (!userSheet) {
      throw new Error('ไม่พบ USERS sheet');
    }
    
    const data = userSheet.getDataRange().getValues();
    const users = [];
    
    if (data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        const userClass = data[i][2];
        const status = data[i][5];
        
        if (userClass === 'admin' || status !== 'active' && status !== 'ใช้งาน') {
          continue;
        }
        
        users.push({
          email: data[i][0],
          username: data[i][1],
          class: userClass,
          linkedBroker: data[i][3],
          linkedInvestor: data[i][4],
          status: status
        });
      }
    }
    
    users.sort(function(a, b) {
      if (a.class !== b.class) {
        if (a.class.startsWith('super_user') && b.class.startsWith('user')) {
          return -1;
        }
        if (a.class.startsWith('user') && b.class.startsWith('super_user')) {
          return 1;
        }
        return a.class.localeCompare(b.class);
      }
      return a.username.localeCompare(b.username);
    });
    
    return JSON.stringify({
      status: 'success',
      users: users,
      totalUsers: users.length
    });
    
  } catch (error) {
    console.error('getAllUsersForSimulator error:', error);
    return JSON.stringify({
      status: 'error',
      message: error.toString()
    });
  }
}

/**
 * จำลอง User Session สำหรับ Admin
 */
function simulateUserSession(userData, sessionKey) {
    try {
        const currentUser = (sessionKey ? getCurrentUserWithSessionKey(sessionKey) : null) || getCurrentUser(sessionKey) || getCurrentUser();
        if (!currentUser || currentUser.class !== 'admin') {
            throw new Error('คุณไม่มีสิทธิ์ในการใช้ฟีเจอร์นี้');
        }
        
        const adminBackup = {
            originalAdmin: currentUser,
            timestamp: new Date().toISOString()
        };
        
        const adminSimulationKey = 'admin_simulation_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const simulatedSession = {
            email: userData.email,
            username: userData.username,
            class: userData.class,
            linkedBroker: userData.linkedBroker || '',
            linkedInvestor: userData.linkedInvestor || '',
            status: userData.status,
            lastLogin: new Date().toISOString(),
            isSimulation: true,
            adminBackup: adminBackup,
            sessionKey: adminSimulationKey
        };
        
        PropertiesService.getScriptProperties().setProperty(adminSimulationKey, JSON.stringify(simulatedSession));
        
        sendTelegram(
            '🎭 <b>[APHITHANASAP - ใช้งานโหมดจำลองสิทธิ์]</b>\n' +
            '👤 <b>แอดมิน:</b> ' + (currentUser.username || currentUser.email) + ' (' + currentUser.class + ')\n' +
            '🎯 <b>จำลองเป็น:</b> ' + userData.username + ' (' + userData.class + ')\n' +
            '🕒 <b>เวลา:</b> ' + getThaiDateTimeStr()
        );
        
        let tableData = null;
        try {
            const ss = SpreadsheetApp.getActiveSpreadsheet();
            const sheet = ss.getSheetByName('DATABASE');
            if (sheet) {
                const values = sheet.getDataRange().getValues();
                const lastRow = sheet.getLastRow();
                if (lastRow > 1) {
                    const rawColumn29 = sheet.getRange(2, 30, lastRow - 1, 1).getDisplayValues();
                    for (let i = 1; i < values.length; i++) {
                        if (rawColumn29[i - 1]) values[i][29] = rawColumn29[i - 1][0];
                    }
                }
                if (values.length > 0) {
                    const [headers, ...allData] = values;
                    tableData = {
                        headers: headers,
                        data: filterDataByPermission(allData, simulatedSession),
                        userClass: simulatedSession.class,
                        totalRows: allData.length
                    };
                }
            }
        } catch (tableErr) {
            console.warn('simulateUserSession table load warning:', tableErr);
        }

        return JSON.stringify({
            status: 'success',
            message: 'เข้าสู่โหมดจำลองสำเร็จ',
            sessionKey: adminSimulationKey,
            simulatedUser: {
                username: userData.username,
                class: userData.class
            },
            table: tableData
        });
        
    } catch (error) {
        console.error('simulateUserSession error:', error);
        return JSON.stringify({
            status: 'error',
            message: error.toString()
        });
    }
}

/**
 * คืนค่า Admin Session
 */

function restoreAdminSession(adminSimulationKey, fallbackAdminUsername) {
    try {
        let adminSession = null;
        let sessionData = null;
        
        if (adminSimulationKey) {
            sessionData = PropertiesService.getScriptProperties().getProperty(adminSimulationKey);
        }
        
        if (sessionData) {
            try {
                const currentSession = JSON.parse(sessionData);
                if (currentSession.adminBackup && currentSession.adminBackup.originalAdmin) {
                    adminSession = currentSession.adminBackup.originalAdmin;
                }
            } catch(e) {}
        }
        
        // Fallback 1: ตรวจสอบ currentUser จาก ScriptProperties
        if (!adminSession) {
            const fallbackAdmin = PropertiesService.getScriptProperties().getProperty('currentUser');
            if (fallbackAdmin) {
                try {
                    const parsed = JSON.parse(fallbackAdmin);
                    if (parsed && parsed.class === 'admin') {
                        adminSession = parsed;
                    }
                } catch(e) {}
            }
        }
        
        // Fallback 2: ใช้ชื่อแอดมินประจำเครื่องที่ส่งมา (รองรับแอดมินหลายคนอย่างอิสระ)
        if (!adminSession) {
            adminSession = {
                username: fallbackAdminUsername || 'Admin',
                class: 'admin',
                email: fallbackAdminUsername || 'admin'
            };
        }
        
        const newAdminSessionKey = 'admin_session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        adminSession.lastLogin = new Date().toISOString();
        adminSession.isSimulation = false;
        adminSession.sessionKey = newAdminSessionKey;
        
        PropertiesService.getScriptProperties().setProperty(newAdminSessionKey, JSON.stringify(adminSession));
        PropertiesService.getScriptProperties().setProperty('currentUser', JSON.stringify(adminSession));
        
        if (adminSimulationKey) {
            try { PropertiesService.getScriptProperties().deleteProperty(adminSimulationKey); } catch(e) {}
        }
        
        let tableData = null;
        try {
            const ss = SpreadsheetApp.getActiveSpreadsheet();
            const sheet = ss.getSheetByName('DATABASE');
            if (sheet) {
                const values = sheet.getDataRange().getValues();
                const lastRow = sheet.getLastRow();
                if (lastRow > 1) {
                    const rawColumn29 = sheet.getRange(2, 30, lastRow - 1, 1).getDisplayValues();
                    for (let i = 1; i < values.length; i++) {
                        if (rawColumn29[i - 1]) values[i][29] = rawColumn29[i - 1][0];
                    }
                }
                if (values.length > 0) {
                    const [headers, ...allData] = values;
                    tableData = {
                        headers: headers,
                        data: filterDataByPermission(allData, adminSession),
                        userClass: adminSession.class,
                        totalRows: allData.length
                    };
                }
            }
        } catch (tableErr) {
            console.warn('restoreAdminSession table load warning:', tableErr);
        }

        return JSON.stringify({
            status: 'success',
            message: 'กลับสู่โหมด Admin สำเร็จ',
            sessionKey: newAdminSessionKey,
            adminUser: {
                username: adminSession.username || 'SuperiCez',
                class: 'admin'
            },
            table: tableData
        });
        
    } catch (error) {
        console.error('restoreAdminSession error:', error);
        return JSON.stringify({
            status: 'error',
            message: error.toString()
        });
    }
}

/**
 * ตรวจสอบสถานะการจำลอง
 */
function checkSimulationStatus() {
  try {
    const sessionData = PropertiesService.getScriptProperties().getProperty('currentUser');
    
    if (!sessionData) {
      return JSON.stringify({
        status: 'success',
        isSimulating: false
      });
    }
    
    const currentSession = JSON.parse(sessionData);
    
    return JSON.stringify({
      status: 'success',
      isSimulating: currentSession.isSimulation || false,
      currentUser: currentSession.username,
      userClass: currentSession.class,
      canRestore: !!(currentSession.isSimulation && currentSession.adminBackup)
    });
    
  } catch (error) {
    console.error('checkSimulationStatus error:', error);
    return JSON.stringify({
      status: 'error',
      message: error.toString()
    });
  }
}

function uploadFilesByCategory(fileData, rowNumber, category) {
  try {
    
    let actualRowNumber = parseInt(rowNumber);
    
    const sheetRowNumber = actualRowNumber + 1;
    
    
    if (isNaN(actualRowNumber) || actualRowNumber < 1) {
      throw new Error('Invalid row number: ' + rowNumber);
    }
    
    const uploadedFiles = [];
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DATABASE');
    const lastRow = sheet.getLastRow();
    
    
    if (sheetRowNumber > lastRow) {
      throw new Error('Row number ' + sheetRowNumber + ' exceeds sheet range (max: ' + lastRow + ')');
    }
    
    const rowData = sheet.getRange(sheetRowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    
    const folderColumns = {
      'deed': 37,
      'location': 38,
      'transaction': 39,
      'vdo': 40
    };
    
    let targetFolderId = null;
    
    if (folderColumns[category]) {
      const columnIndex = folderColumns[category] - 1;
      targetFolderId = rowData[columnIndex];
      
    }
    
    if (!targetFolderId) {
      throw new Error('ไม่พบ Folder ID สำหรับ ' + category + ' ที่แถว ' + actualRowNumber + ' (' + rowData[1] + ')');
    }
    
    let targetFolder;
    try {
      targetFolder = DriveApp.getFolderById(targetFolderId);
    } catch (folderError) {
      throw new Error('ไม่สามารถเข้าถึงโฟลเดอร์ ' + category + ' ของ ' + rowData[1]);
    }
    
    fileData.forEach(function(file, index) {
      try {
        // ตรวจสอบไฟล์ซ้ำในโฟลเดอร์เพื่อป้องกันการอัปโหลดเบิ้ล
        const existingFiles = targetFolder.getFilesByName(file.name);
        if (existingFiles.hasNext()) {
          const existingFile = existingFiles.next();
          uploadedFiles.push({
            id: existingFile.getId(),
            name: existingFile.getName(),
            url: existingFile.getUrl(),
            viewUrl: 'https://drive.google.com/file/d/' + existingFile.getId() + '/view',
            directUrl: 'https://lh3.googleusercontent.com/d/' + existingFile.getId(),
            folderId: targetFolderId
          });
          return;
        }

        const blob = Utilities.newBlob(
          Utilities.base64Decode(file.data.split(',')[1]),
          file.mimeType,
          file.name
        );
        
        const driveFile = targetFolder.createFile(blob);
        
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        
        uploadedFiles.push({
          id: driveFile.getId(),
          name: driveFile.getName(),
          url: driveFile.getUrl(),
          viewUrl: 'https://drive.google.com/file/d/' + driveFile.getId() + '/view',
          directUrl: 'https://lh3.googleusercontent.com/d/' + driveFile.getId(),
          folderId: targetFolderId
        });
        
      } catch (fileError) {
        console.error('❌ FILE UPLOAD ERROR:', fileError.toString());
      }
    });
    
    
    return JSON.stringify({
      status: 'success',
      category: category,
      uploadedFiles: uploadedFiles,
      targetFolder: targetFolderId,
      folderName: targetFolder.getName(),
      targetDataRow: actualRowNumber,
      targetSheetRow: sheetRowNumber,
      assetName: rowData[1],
      assetId: rowData[0],
      message: 'อัพโหลด ' + uploadedFiles.length + ' ไฟล์ไปยัง ' + rowData[1] + ' (' + category + ') สำเร็จ'
    });
    
  } catch (error) {
    console.error('=== ❌ UPLOAD FAILED ===');
    console.error('❌ Error:', error.toString());
    
    return JSON.stringify({
      status: 'error',
      message: error.toString()
    });
  }
}

/**
 * แก้ไขฟังก์ชัน getRowDataForEdit() - ข้ามอายุสัญญาและแก้ไข %ปากถุง
 */
function getRowDataForEdit(rowNumber) {
  try {
    
    const currentUser = getCurrentUser();
    if (currentUser.class !== 'admin') {
      throw new Error('คุณไม่มีสิทธิ์ในการแก้ไขข้อมูล');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DATABASE');
    
    const row = findRowByNumber(rowNumber);
    if (row === -1) {
      throw new Error('ไม่พบข้อมูลแถวที่ ' + rowNumber);
    }
    
    const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const formData = {
      rowNumber: rowData[0],
      assetName: rowData[1] || '',
      status: rowData[2] || '',
      assetType: rowData[4] || '',
      location: rowData[5] || '',
      deedType: rowData[6] || '',
      landSize: rowData[7] || '',
      ownerName: rowData[8] || '',
      ownerPhone: rowData[9] || '',
      ownerJob: rowData[10] || '',
      tradingType: rowData[11] || '',
      contractStartDate: rowData[12] || '',
      contractEndDate: rowData[13] || '',
      redemptionAmount: rowData[14] || '',
      principal: rowData[15] || '',
      interestRate: rowData[16] || '',
      months: rowData[17] || '',
      advanceInterestDeduction: rowData[35] || '',
      investorName: rowData[21] || '',
      investorPhone: rowData[22] || '',
      returnType: rowData[23] || '',
      returnRate: rowData[24] || '',
      brokerName: rowData[27] || '',
      brokerPhone: rowData[28] || '',
      commissionRate: formatCommissionRate(rowData[29])

    };
    
    const folderIds = {
      deedFolderId: rowData[36] || '',
      locationFolderId: rowData[37] || '',
      transactionFolderId: rowData[38] || '',
      vdoFolderId: rowData[39] || ''
    };
    
    const paymentHistory = getPaymentHistoryForRow(rowNumber);
    
    
    return JSON.stringify({
      status: 'success',
      rowData: formData,
      folderIds: folderIds,
      paymentHistory: paymentHistory
    });
    
  } catch (error) {
    console.error('Error in getRowDataForEdit:', error);
    return JSON.stringify({
      status: 'error',
      message: error.toString()
    });
  }
}

function formatCommissionRate(value) {
  if (value instanceof Date) {
    const day = value.getDate();
    const month = value.getMonth() + 1;
    return `${day}/${month}`;
  }
  return String(value).replace(/^'/, ''); // ลบ ' ถ้ามี
}

/**
 * ดึงประวัติการชำระสำหรับแถวที่กำหนด
 */
function getPaymentHistoryForRow(rowNumber) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DATABASE'); // ✅ ระบุชีตชัดเจน ไม่พึ่ง getActiveSheet()
    
    if (!sheet) {
      throw new Error('ไม่พบ Sheet ชื่อ DATABASE');
    }
    
    const data = sheet.getDataRange().getValues();
    
    const rowIndex = data.findIndex(row => row[0] == rowNumber);
    if (rowIndex === -1) return [];
    
    const rowData = data[rowIndex];
    const paymentHistory = [];
    
    for (let round = 1; round <= 12; round++) {
      const colIndex = 41 + round;
      const paymentData = rowData[colIndex];
      
      if (paymentData && paymentData.toString().trim() !== '') {
        const parts = paymentData.toString().split('|');
        if (parts.length >= 3) {
          paymentHistory.push({
            round: round,
            date: parts[0].trim(),
            amount: parseFloat(parts[1].trim()) || 0,
            method: parts[2].trim()
          });
        }
      }
    }
    
    return paymentHistory;
    
  } catch (error) {
    console.error('Error getting payment history:', error);
    return [];
  }
}

/**
 * อัพเดทข้อมูลแถวที่มีอยู่ (สำหรับโหมดแก้ไข)
 */
function updateExistingRowData(data) {
    try {
    const currentUser = getCurrentUser();
    if (currentUser.class !== 'admin') {
        throw new Error('คุณไม่มีสิทธิ์ในการแก้ไขข้อมูล');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DATABASE');
    
    if (!sheet) {
        throw new Error('ไม่พบ Sheet ชื่อ DATABASE');
    }
    
    const rowNumber = data.rowNumber;
    const row = findRowByNumber(rowNumber);
    
    if (row === -1) {
        throw new Error('ไม่พบแถวที่ต้องการอัพเดท');
    }
    
    const formData = data.formData;
    
    const oldRowValues = sheet.getRange(row, 1, 1, 40).getValues()[0];
    const diffs = [];

    function checkDiff(fieldName, oldVal, newVal, isMoney) {
      var sOld = String(oldVal != null ? oldVal : '').trim();
      var sNew = String(newVal != null ? newVal : '').trim();
      if (isMoney) {
        var nOld = parseFloat(sOld) || 0;
        var nNew = parseFloat(sNew) || 0;
        if (Math.abs(nOld - nNew) > 0.01) {
          diffs.push('• <b>' + fieldName + ':</b> ' + formatNumTh(nOld) + ' ➔ ' + formatNumTh(nNew) + ' บาท');
        }
      } else {
        if (sOld !== sNew) {
          diffs.push('• <b>' + fieldName + ':</b> ' + (sOld || '(ว่าง)') + ' ➔ ' + (sNew || '(ว่าง)'));
        }
      }
    }
    
    if (formData.category1) {
        const cat1 = formData.category1;
        checkDiff('ชื่อทรัพย์สิน', oldRowValues[1], cat1.assetName);
        checkDiff('สถานะ', oldRowValues[2], cat1.status);
        checkDiff('ประเภททรัพย์', oldRowValues[4], cat1.assetType);
        checkDiff('ที่ตั้ง', oldRowValues[5], cat1.location);
        checkDiff('เอกสารสิทธิ์', oldRowValues[6], cat1.deedType);
        checkDiff('เนื้อที่', oldRowValues[7], cat1.landSize);
        checkDiff('ชื่อเจ้าของ', oldRowValues[8], cat1.ownerName);
        checkDiff('เบอร์โทรเจ้าของ', oldRowValues[9], cat1.ownerPhone);
        checkDiff('อาชีพเจ้าของ', oldRowValues[10], cat1.ownerJob);

        sheet.getRange(row, 2).setValue(cat1.assetName || '');
        sheet.getRange(row, 3).setValue(cat1.status || '');
        sheet.getRange(row, 5).setValue(cat1.assetType || '');
        sheet.getRange(row, 6).setValue(cat1.location || '');
        sheet.getRange(row, 7).setValue(cat1.deedType || '');
        sheet.getRange(row, 8).setValue(cat1.landSize || '');
        sheet.getRange(row, 9).setValue(cat1.ownerName || '');
        sheet.getRange(row, 10).setValue(cat1.ownerPhone || '');
        sheet.getRange(row, 11).setValue(cat1.ownerJob || '');
    }
    
    if (formData.category2) {
        const cat2 = formData.category2;
        checkDiff('นิติกรรม', oldRowValues[11], cat2.tradingType);
        const thaiStartDate = cat2.contractStartDate ? convertInputDateToThai(cat2.contractStartDate) : '';
        const thaiEndDate = cat2.contractEndDate ? convertInputDateToThai(cat2.contractEndDate) : '';
        checkDiff('วันเริ่มสัญญา', oldRowValues[12], thaiStartDate);
        checkDiff('วันสิ้นสุดสัญญา', oldRowValues[13], thaiEndDate);
        checkDiff('วงเงินไถ่ถอน', oldRowValues[14], cat2.redemptionAmount, true);
        checkDiff('ทุนรับซื้อ (เงินต้น)', oldRowValues[15], cat2.principal, true);
        checkDiff('ดอกเบี้ยปากถุง/เดือน', oldRowValues[16], cat2.interestRate);
        checkDiff('ระยะเวลา (เดือน)', oldRowValues[17], cat2.months);
        checkDiff('หักดอกเบี้ยล่วงหน้า', oldRowValues[35], cat2.advanceInterestDeduction, true);

        sheet.getRange(row, 12).setValue(cat2.tradingType || '');

        if (cat2.contractStartDate) {
            sheet.getRange(row, 13).setValue(thaiStartDate);
        } else {
            sheet.getRange(row, 13).setValue('');
        }

        if (cat2.contractEndDate) {
            sheet.getRange(row, 14).setValue(thaiEndDate);
        } else {
            sheet.getRange(row, 14).setValue('');
        }
        
        sheet.getRange(row, 15).setValue(parseFloat(cat2.redemptionAmount) || 0);
        sheet.getRange(row, 16).setValue(parseFloat(cat2.principal) || 0);
        sheet.getRange(row, 17).setValue(parseFloat(cat2.interestRate) || 0);
        sheet.getRange(row, 18).setValue(parseInt(cat2.months) || 0);
        sheet.getRange(row, 36).setValue(parseFloat(cat2.advanceInterestDeduction) || 0);
        sheet.getRange(row, 33).setValue(parseFloat(cat2.interestDifference) || 0);
        
        const principal = parseFloat(cat2.principal) || 0;
        const monthlyRate = parseFloat(cat2.interestRate) || 0;
        const months = parseInt(cat2.months) || 0;
        
        const monthlyInterest = principal * monthlyRate / 100;
        const yearlyRate = monthlyRate * months;
        const yearlyInterest = principal * yearlyRate / 100;
        
        sheet.getRange(row, 19).setValue(monthlyInterest);
        sheet.getRange(row, 20).setValue(yearlyInterest);
        sheet.getRange(row, 21).setValue(yearlyRate);
    }
    
    if (formData.category3) {
        const cat3 = formData.category3;
        checkDiff('ชื่อนายทุน', oldRowValues[21], cat3.investorName);
        checkDiff('เบอร์โทรนายทุน', oldRowValues[22], cat3.investorPhone);
        checkDiff('รูปแบบผลตอบแทน', oldRowValues[23], cat3.returnType);
        checkDiff('อัตราผลตอบแทนนายทุน', oldRowValues[24], cat3.returnRate);

        sheet.getRange(row, 22).setValue(cat3.investorName || '');
        sheet.getRange(row, 23).setValue(cat3.investorPhone || '');
        sheet.getRange(row, 24).setValue(cat3.returnType || '');
        sheet.getRange(row, 25).setValue(parseFloat(cat3.returnRate) || 0);
        sheet.getRange(row, 26).setValue(parseFloat(cat3.yearlyReturn) || 0);
        sheet.getRange(row, 27).setValue(parseFloat(cat3.monthlyReturn) || 0);
    }
    
    if (formData.category4) {
        const cat4 = formData.category4;
        checkDiff('ชื่อนายหน้า', oldRowValues[27], cat4.brokerName);
        checkDiff('เบอร์โทรนายหน้า', oldRowValues[28], cat4.brokerPhone);
        checkDiff('ค่าคอมนายหน้า', oldRowValues[30], cat4.brokerCommission, true);
        checkDiff('ค่าคอมบริษัท', oldRowValues[31], cat4.ourCommission, true);

        sheet.getRange(row, 28).setValue(cat4.brokerName || '');
        sheet.getRange(row, 29).setValue(cat4.brokerPhone || '');
        
        if (cat4.commissionRate) {
            sheet.getRange(row, 30).setValue("'" + cat4.commissionRate);
        }
        
        sheet.getRange(row, 31).setValue(parseFloat(cat4.brokerCommission) || 0);
        sheet.getRange(row, 32).setValue(parseFloat(cat4.ourCommission) || 0);
    }
    
    const principal = parseFloat(formData.category2?.principal) || 0;
    const yearlyReturn = parseFloat(formData.category3?.yearlyReturn) || 0;
    
    const totalInvestorReturn = yearlyReturn;
    const totalInvestorPayback = principal + totalInvestorReturn;
    
    sheet.getRange(row, 34).setValue(totalInvestorReturn);
    sheet.getRange(row, 35).setValue(totalInvestorPayback);
    
    sheet.getRange(row, 42).setValue(new Date().toLocaleString('th-TH'));

    if (diffs.length > 0) {
        sendTelegram(
            '✏️ <b>[APHITHANASAP - มีการแก้ไขข้อมูลทรัพย์สิน]</b>\n' +
            '👤 <b>ผู้แก้ไข:</b> ' + (currentUser.username || currentUser.email) + ' (' + currentUser.class + ')\n' +
            '📍 <b>แปลงที่ ' + rowNumber + ':</b> ' + (oldRowValues[1] || (formData.category1 && formData.category1.assetName) || 'ไม่ระบุชื่อ') + '\n' +
            '🕒 <b>เวลา:</b> ' + getThaiDateTimeStr() + '\n\n' +
            '📋 <b>รายการที่เปลี่ยนแปลง (' + diffs.length + ' รายการ):</b>\n' +
            diffs.join('\n')
        );
    }
    
    return JSON.stringify({
        status: 'success',
        message: 'อัพเดทข้อมูลสำเร็จ',
        rowNumber: rowNumber
    });
    
} catch (error) {
    return JSON.stringify({
        status: 'error',
        message: error.toString()
    });
}
}

/**
 * ลบข้อมูลการชำระเงิน
 */
function deletePaymentRecord(rowNumber, paymentRound) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DATABASE'); // ✅ ระบุชีตชัดเจน ไม่พึ่ง getActiveSheet()
    
    if (!sheet) {
      return JSON.stringify({
        status: 'error',
        message: 'ไม่พบ Sheet ชื่อ DATABASE'
      });
    }
    
    const allData = sheet.getDataRange().getValues();
    
    const rowIndex = allData.findIndex(row => row[0] == rowNumber);
    
    if (rowIndex === -1) {
      return JSON.stringify({
        status: 'error',
        message: 'ไม่พบแถวที่ ' + rowNumber
      });
    }
    
    const actualRowNumber = rowIndex + 1;
    const paymentColumnIndex = 41 + parseInt(paymentRound);
    
    const cell = sheet.getRange(actualRowNumber, paymentColumnIndex + 1);
    const deletedPaymentData = cell.getValue();
    cell.setValue('');

    const currentUser = getCurrentUser();
    sendTelegram(
      '⚠️ <b>[APHITHANASAP - ลบประวัติการรับชำระดอกเบี้ย]</b>\n' +
      '👤 <b>ผู้ลบ:</b> ' + (currentUser.username || currentUser.email || 'Admin') + '\n' +
      '📍 <b>แปลงที่ ' + rowNumber + ':</b> งวดที่ ' + paymentRound + '\n' +
      '🗑 <b>ข้อมูลที่ถูกลบ:</b> ' + (deletedPaymentData || '-') + '\n' +
      '🕒 <b>เวลา:</b> ' + getThaiDateTimeStr()
    );
    
    const updatedPaymentHistory = getPaymentHistoryForRow(rowNumber);
    
    return JSON.stringify({
      status: 'success',
      message: 'ลบการชำระครั้งที่ ' + paymentRound + ' สำเร็จ',
      updatedPaymentHistory: updatedPaymentHistory
    });
    
  } catch (error) {
    console.error('Error in deletePaymentRecord:', error);
    return JSON.stringify({
      status: 'error',
      message: 'เกิดข้อผิดพลาดในการลบ: ' + error.toString()
    });
  }
}

function convertInputDateToThai(inputDate) {
    
    if (!inputDate) {
        return '';
    }
    
    try {
        if (inputDate.includes('/')) {
            const trimmedDate = inputDate.trim();
            const result = trimmedDate + ' 7:00:00';
            
            return result;
            
        } else if (inputDate.includes('-')) {
            const date = new Date(inputDate);
            
            if (isNaN(date.getTime())) {
                return '';
            }
            
            const day = date.getDate();
            const month = date.getMonth() + 1;
            let year = date.getFullYear();
            
            if (year < 2500) {
                year = year + 543;
            }
            
            const result = day + '/' + month + '/' + year + ' 7:00:00';
            return result;
        }
        
        return inputDate;
        
    } catch (error) {
        console.error('❌ Error converting input date:', error);
        return '';
    }
}

function loadTableWithSession(sessionKey) {
    try {
        
        const currentUser = getCurrentUserWithSessionKey(sessionKey);
        
        if (!currentUser) {
            return JSON.stringify({
                status: 'error',
                message: 'SESSION_EXPIRED'
            });
        }
        
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName('DATABASE');
        
        if (!sheet) {
            throw new Error('ไม่พบ Sheet ชื่อ DATABASE');
        }
        
        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();

        const rawColumn29 = sheet.getRange(2, 30, sheet.getLastRow() - 1, 1).getDisplayValues();

        if (values.length > 1) {
            for (let i = 1; i < values.length; i++) {
                if (rawColumn29[i - 1]) {
                    values[i][29] = rawColumn29[i - 1][0];
                }
            }
        }
        
        if (values.length === 0) {
            return JSON.stringify({
                status: 'success',
                data: [],
                headers: [],
                userClass: currentUser.class
            });
        }
        
        const [headers, ...allData] = values;
        
        let filteredData = filterDataByPermission(allData, currentUser);
        
        return JSON.stringify({
            status: 'success',
            data: filteredData,
            headers: headers,
            userClass: currentUser.class,
            totalRows: filteredData.length
        });
        
    } catch (error) {
        console.error('loadTableWithSession error:', error);
        return JSON.stringify({
            status: 'error',
            message: error.toString()
        });
    }
}

function getCurrentUserWithSessionKey(sessionKey) {
    try {
        
        if (!sessionKey) {
            return null;
        }
        
        if (sessionKey.startsWith('admin_simulation_')) {
            const sessionData = PropertiesService.getScriptProperties().getProperty(sessionKey);
            
            if (sessionData) {
                const user = JSON.parse(sessionData);
                
                const timeoutMinutes = getTimeoutMinutes(user.class || 'user1');
                const lastLogin = new Date(user.lastLogin);
                const now = new Date();
                const minutesDiff = (now - lastLogin) / (1000 * 60);
                
                console.log(' Simulation session check:', {
                    user: user.username,
                    simulatedClass: user.class,
                    minutesDiff: minutesDiff,
                    timeoutLimit: timeoutMinutes
                });
                
                if (minutesDiff < timeoutMinutes) {
                    user.lastLogin = new Date().toISOString();
                    PropertiesService.getScriptProperties().setProperty(sessionKey, JSON.stringify(user));
                    
                    return user;
                } else {
                    PropertiesService.getScriptProperties().deleteProperty(sessionKey);
                    return null;
                }
            }
        }
        
        const sessionData = PropertiesService.getScriptProperties().getProperty(sessionKey);
        
        if (!sessionData) {
            return null;
        }
        
        const user = JSON.parse(sessionData);
        
        const timeoutMinutes = getTimeoutMinutes(user.class || 'user1');
        const lastLogin = new Date(user.lastLogin);
        const now = new Date();
        const minutesDiff = (now - lastLogin) / (1000 * 60);
        
        if (minutesDiff < timeoutMinutes) {
            user.lastLogin = new Date().toISOString();
            PropertiesService.getScriptProperties().setProperty(sessionKey, JSON.stringify(user));
            
            return user;
        } else {
            PropertiesService.getScriptProperties().deleteProperty(sessionKey);
            return null;
        }
        
    } catch (error) {
        console.error('getCurrentUserWithSessionKey error:', error);
        return null;
    }
}

/** Sheet: DICTIONARY  |  Col A = THAI, Col B = ENG */
const DICT_SHEET_NAME = 'DICTIONARY';
const DICT_CACHE_SEC = 60;

function getDictionary() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('DICT_JSON');
  if (cached) { try { return JSON.parse(cached); } catch(e) {} }

  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(DICT_SHEET_NAME);
  if (!sh) return [];

  const values = sh.getDataRange().getValues();
  const out = [];
  for (let i=0;i<values.length;i++){
    const th = (values[i][0] ?? '').toString().trim();
    const en = (values[i][1] ?? '').toString().trim();
    if (!th || !en) continue;
    if (i===0 && th.toUpperCase()==='THAI' && en.toUpperCase()==='ENG') continue;
    out.push([th, en]);
  }
  cache.put('DICT_JSON', JSON.stringify(out), DICT_CACHE_SEC);
  return out;
}



////////////////////////////////////////////////////////////
// ===== ระบบ LINE OA (Webhook + Reply) =====
////////////////////////////////////////////////////////////

// ===== CONFIG =====
// ===== อ่าน config จากชีต 'LINE' (แก้ค่าในชีตได้เลย ไม่ต้องแตะโค้ด) =====
var _lineCache = null;
function getLineConfig() {
  if (_lineCache) return _lineCache;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('LINE');
  var cfg = {
    token: '', groupId: '', masterAdmin: '',
    sheetData: 'DATABASE', sheetAuth: 'UserAuth',
    webUrl: 'https://infinityrichglobal.github.io/APHITHANASAP/',
    alertDays: '60,30,15,5'
  };
  if (sheet) {
    var rows = sheet.getRange(2, 1, Math.max(sheet.getLastRow()-1, 1), 2).getValues();
    rows.forEach(function(r) {
      var key = String(r[0]).trim();
      var val = r[1];
      if (key && val !== '' && val != null) cfg[key] = val;
    });
  }
  _lineCache = cfg;
  return cfg;
}

// ตัวช่วยเรียกใช้สั้นๆ (คงชื่อ LINE.xxx เดิมไว้ ผ่าน getter)
var LINE = {
  get token()       { return getLineConfig().token; },
  get groupId()     { return getLineConfig().groupId; },
  get masterAdmin() { return getLineConfig().masterAdmin; },
  get sheetData()   { return getLineConfig().sheetData; },
  get sheetAuth()   { return getLineConfig().sheetAuth; },
  get webUrl()      { return getLineConfig().webUrl; },
  get alertDaysArr(){
    return String(getLineConfig().alertDays).split(',').map(function(x){ return parseInt(x.trim(),10); }).filter(function(x){ return !isNaN(x); });
  }
};

const COL = {
  name: 2, status: 3, ageStored: 4, startDate: 13, endDate: 14,
  principal: 16, interestMonth: 19, interestYear: 20,
  investor: 22, investorPhone: 23,
  investorMonth: 27,   // AA ค่าตอบแทนนายทุน/เดือน
  investorYear: 34,    // AH ค่าตอบแทนนายทุน/ปี
  prepaid: 36,         // AJ หักดอกเบี้ยล่วงหน้า (มัดจำ)
  imgDeed: 37,         // AK โฉนดที่ดิน (Drive Folder ID)
  imgPhoto: 38,        // AL ภาพถ่ายสถานที่จริง
  imgContract: 39,     // AM หลักฐานการสัญญา
  imgVideo: 40,        // AN วีดีโอสถานที่จริง
  lastUpdate: 42,      // AP สถานะอัปเดต (วันที่)
  payFirst: 43,        // AQ ชำระดอกครั้งที่ 1 (ถึง BB=54 ครั้งที่ 12)
  payLast: 54          // BB ชำระดอกครั้งที่ 12
};

const STYLE = {
  'ดำเนินการอยู่':          { color: '#2E7D32', emoji: '🟢' },
  'ดำเนินการอยู่ (ต่อดอก)': { color: '#1565C0', emoji: '🔵' },
  'อยู่ระหว่างผ่อนผัน':     { color: '#EF6C00', emoji: '🟠' },
  'ยึดทรัพย์':             { color: '#C62828', emoji: '🔴' },
  'ไถ่ถอนแล้ว':            { color: '#9E9E9E', emoji: '⚪' }
};

// ============================================================
// WEBHOOK ENTRY — LINE ยิงมาที่นี่
// ============================================================
function handleLineWebhook(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    (body.events || []).forEach(function(ev) {
      try {
        handleEvent(ev);
      } catch (evErr) {
        // กันตายเงียบ: ก่อนหน้านี้ error ในนี้จะถูกกลืนไปเฉยๆ ไม่ตอบอะไรกลับเลย
        Logger.log('handleEvent error: ' + evErr + '\n' + (evErr && evErr.stack));
        if (ev.replyToken) {
          try {
            reply(ev.replyToken, [textMsg('⚠️ เกิดข้อผิดพลาด: ' + evErr)]);
          } catch (replyErr) {
            Logger.log('reply after error also failed: ' + replyErr);
          }
        }
      }
    });
  } catch (err) {
    Logger.log('doPost error: ' + err);
  }
  return ContentService.createTextOutput('OK');
}

function handleEvent(ev) {
  var replyToken = ev.replyToken;
  if (!replyToken) return;

  var userId = ev.source && ev.source.userId;

  // ===== ข้อความพิมพ์ =====
  if (ev.type === 'message' && ev.message.type === 'text') {
    var text = (ev.message.text || '').trim();

    // #id — ใครก็ดู userId ตัวเองได้ (ไม่ต้องสิทธิ์)
    if (text === '#id') {
      reply(replyToken, [textMsg('🆔 userId ของคุณ:\n' + userId + '\n\nส่งให้แอดมินเพื่อขอสิทธิ์เข้าถึง')]);
      return;
    }

    // #manual — คู่มือ (ใครก็ดูได้ เป็นแค่วิธีใช้)
    if (text === '#manual') {
      reply(replyToken, [manualFlex()]);
      return;
    }

    // คีย์เวิร์ดที่เหลือ ต้องมีสิทธิ์
    var isAdmin = checkAdmin(userId);

    if (!isAdmin) {
      // ยังไม่อนุมัติ — เฉพาะคีย์เวิร์ดระบบ ถึงจะเตือน (ไม่รบกวนแชตปกติ)
      if (text.charAt(0) === '#') {
        var isNew = requestAccess(userId, '');  // บันทึกคำขอ (คืน true ถ้าเพิ่งขอครั้งแรก)
        reply(replyToken, [textMsg('🔒 คุณยังไม่ได้รับสิทธิ์เข้าถึงระบบ\n\nuserId: ' + userId + '\n\nระบบส่งคำขอให้แอดมินแล้ว รอการอนุมัติ')]);
        if (isNew) notifyMasterAdmin(userId);  // แจ้ง masterAdmin พร้อมปุ่ม
      }
      return;
    }

    // ===== แอดมินที่อนุมัติแล้ว =====
switch (text) {
    case '#admin':    reply(replyToken, [adminMenuFlex()]); break;
    case '#status':   reply(replyToken, [statusSummaryFlex()]); break;
    case '#plots':    reply(replyToken, allPlotsCarousel()); break;
    case '#investor': reply(replyToken, [investorListFlex()]); break;
    case '#due':      reply(replyToken, dueThisMonthFlex()); break;   // ← เดิม ไม่แตะ
    case '#expire':   reply(replyToken, [expireMonthSelectorFlex()]); break;  // ← เพิ่มใหม่
    case '#overview': reply(replyToken, [overviewFlex()]); break;
      default:
        // ค้นหาแปลงด้วยชื่อ (พิมพ์ชื่อแปลงตรงๆ)
        if (text.charAt(0) !== '#') {
          var found = searchPlot(text);
          if (found) reply(replyToken, [found]);
        }
    }
    return;
  }

  // ===== postback (กดปุ่มในการ์ด) =====
  if (ev.type === 'postback') {
    var raw = ev.postback.data || '';

    // ปุ่มอนุมัติ/ไม่อนุมัติ — เฉพาะ masterAdmin
    if (raw.indexOf('approve|') === 0 || raw.indexOf('reject|') === 0) {
      if (userId !== LINE.masterAdmin) { reply(replyToken, [textMsg('เฉพาะแอดมินหลักเท่านั้น')]); return; }
      var isApprove = raw.indexOf('approve|') === 0;
      var targetId = raw.substring(raw.indexOf('|') + 1);
      setUserStatus(targetId, isApprove ? 'อนุมัติ' : 'ระงับ');
      reply(replyToken, [textMsg(isApprove ? '✅ อนุมัติผู้ใช้แล้ว\n' + targetId : '⛔ ระงับผู้ใช้แล้ว\n' + targetId)]);
      // แจ้งผู้ใช้ที่ถูกอนุมัติ
      if (isApprove) {
        UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
          method:'post', contentType:'application/json',
          headers:{ 'Authorization':'Bearer ' + LINE.token },
          payload: JSON.stringify({ to: targetId, messages: [textMsg('🎉 คุณได้รับอนุมัติเข้าใช้ระบบแล้ว\nพิมพ์ #admin เพื่อเริ่มใช้งาน')] }),
          muteHttpExceptions: true
        });
      }
      return;
    }

    if (!checkAdmin(userId)) return;

    // ปุ่มแปลง: รูปแบบ "plot|ชื่อแปลง" (ไม่ encode กัน postback ยาวเกิน)
    if (raw.indexOf('plot|') === 0) {
      var plotName = raw.substring(5);
      var all = readAssets();
      // หาแบบตรงเป๊ะก่อน ไม่เจอลองแบบ trim (กันช่องว่างซ้อน)
      var one = all.filter(function(a){ return a.name === plotName; })[0];
      if (!one) {
        var key = plotName.replace(/\s+/g, ' ').trim();
        one = all.filter(function(a){ return String(a.name).replace(/\s+/g,' ').trim() === key; })[0];
      }
      if (one) {
        reply(replyToken, [plotAdvanceBubble(one)]);
      } else {
        reply(replyToken, [textMsg('ไม่พบข้อมูลแปลง: ' + plotName)]);
      }
      return;
    }

var data = parseQuery(raw);
if (data.action === 'investor') {
  reply(replyToken, investorDetailFlex(data.name));
} else if (data.action === 'status') {
  reply(replyToken, statusDetailCarousel(data.value));
} else if (data.action === 'risk') {
  reply(replyToken, riskCarousel());
} else if (data.action === 'expiremonth') {                     // ← เพิ่มใหม่
  reply(replyToken, expireMonthCarousel(parseInt(data.m, 10), parseInt(data.y, 10)));
}
    return;
  }
}

// ============================================================
// ระบบสิทธิ์
// ============================================================
function checkAdmin(userId) {
  if (!userId) return false;
  if (userId === LINE.masterAdmin) return true;
  var sheet = getOrCreateAuthSheet();
  var last = sheet.getLastRow();
  if (last < 2) return false;
  // คอลัมน์: A=userId, B=ชื่อ, C=สถานะ(อนุมัติ/รอ), D=วันที่
  var rows = sheet.getRange(2, 1, last-1, 3).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === userId && String(rows[i][2]).trim() === 'อนุมัติ') return true;
  }
  return false;
}

function getOrCreateAuthSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LINE.sheetAuth);
  if (!sheet) {
    sheet = ss.insertSheet(LINE.sheetAuth);
    sheet.appendRow(['userId', 'ชื่อ', 'สถานะ', 'วันที่ขอ']);
  }
  return sheet;
}

// บันทึกคนที่ขอสิทธิ์ (สถานะ "รอ") ถ้ายังไม่เคยขอ
function requestAccess(userId, name) {
  var sheet = getOrCreateAuthSheet();
  var last = sheet.getLastRow();
  if (last >= 2) {
    var ids = sheet.getRange(2, 1, last-1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === userId) return false; // เคยขอแล้ว
    }
  }
  sheet.appendRow([userId, name || '', 'รอ', new Date()]);
  return true;  // คนใหม่
}

// แจ้ง masterAdmin ว่ามีคนขอสิทธิ์ พร้อมปุ่มอนุมัติ/ไม่อนุมัติ
function notifyMasterAdmin(reqUserId) {
  var master = LINE.masterAdmin;
  if (!master) return;
  var card = {
    type:'flex', altText:'มีคนขอสิทธิ์เข้าระบบ',
    contents:{
      type:'bubble', size:'mega',
      body:{ type:'box', layout:'vertical', paddingAll:'lg', spacing:'none', contents:[
        txt('🔔 มีคนขอสิทธิ์เข้าระบบ', 'lg', '#1A1A1A', 'bold'),
        { type:'box', layout:'vertical', height:'3px', backgroundColor:'#1A237E', margin:'md', cornerRadius:'sm', contents:[] },
        { type:'box', layout:'vertical', margin:'md', spacing:'sm', contents:[
          miniRow('userId', reqUserId)
        ]},
        { type:'box', layout:'horizontal', margin:'lg', spacing:'sm', contents:[
          { type:'button', style:'primary', color:'#2E7D32', flex:1,
            action:{ type:'postback', label:'✅ อนุมัติ', data:'approve|' + reqUserId }},
          { type:'button', style:'primary', color:'#C62828', flex:1,
            action:{ type:'postback', label:'⛔ ไม่อนุมัติ', data:'reject|' + reqUserId }}
        ]}
      ]}
    }
  };
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method:'post', contentType:'application/json',
    headers:{ 'Authorization':'Bearer ' + LINE.token },
    payload: JSON.stringify({ to: master, messages: [card] }),
    muteHttpExceptions: true
  });
}

// เปลี่ยนสถานะผู้ใช้ (อนุมัติ/ระงับ) ในชีต UserAuth
function setUserStatus(userId, status) {
  var sheet = getOrCreateAuthSheet();
  var last = sheet.getLastRow();
  if (last < 2) return false;
  var rows = sheet.getRange(2, 1, last-1, 1).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === userId) {
      sheet.getRange(i+2, 3).setValue(status);  // คอลัมน์ C
      return true;
    }
  }
  return false;
}

// แอดมินหลักอนุมัติคนใหม่ (รันจาก editor หรือทำเป็นคีย์เวิร์ดเพิ่มได้)
// อนุมัติผู้ใช้ (เปลี่ยนสถานะเป็น "อนุมัติ" หรือเพิ่มใหม่ถ้ายังไม่มี)
function approveUser(userId, name) {
  var sheet = getOrCreateAuthSheet();
  var last = sheet.getLastRow();
  if (last >= 2) {
    var rows = sheet.getRange(2, 1, last-1, 1).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][0] === userId) {
        sheet.getRange(i+2, 3).setValue('อนุมัติ'); // คอลัมน์ C
        Logger.log('อนุมัติ ' + userId + ' แล้ว');
        return;
      }
    }
  }
  sheet.appendRow([userId, name || '', 'อนุมัติ', new Date()]);
  Logger.log('เพิ่ม+อนุมัติ ' + userId + ' แล้ว');
}

// ============================================================
// อ่านข้อมูล
// ============================================================
function toCE(d) {
  if (!(d instanceof Date) || isNaN(d)) return null;
  var y = d.getFullYear();
  return new Date(y > 2500 ? y - 543 : y, d.getMonth(), d.getDate());
}
function daysLeft(d) {
  if (!d) return null;
  var t = new Date(); t.setHours(0,0,0,0);
  var x = new Date(d); x.setHours(0,0,0,0);
  return Math.round((x - t) / 86400000);
}
function baht(n) { return Math.round(Number(n)||0).toLocaleString('th-TH'); }

function readAssets() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LINE.sheetData);
  var data = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[COL.name-1] || !r[COL.status-1]) continue;
    var start = toCE(r[COL.startDate-1]);
    var end = toCE(r[COL.endDate-1]);
    out.push({
      name: r[COL.name-1],
      status: r[COL.status-1],
      start: start,
      end: end,
      ageStored: r[COL.ageStored-1] ? String(r[COL.ageStored-1]).trim() : '', // อายุสัญญาที่บันทึกไว้ (คอลัมน์ D) — ใช้กับสถานะไถ่ถอนแล้ว ไม่ให้นับต่อถึงวันนี้
      ageDays: start ? Math.round((new Date().setHours(0,0,0,0) - new Date(start).setHours(0,0,0,0)) / 86400000) : null,
      principal: Number(r[COL.principal-1]) || 0,
      interest: Number(r[COL.interestMonth-1]) || 0,       // ดอกระบบ/เดือน (ไม่แสดงในการ์ดนายทุน)
      interestYear: Number(r[COL.interestYear-1]) || 0,    // ดอกระบบ/ปี
      invMonth: Number(r[COL.investorMonth-1]) || 0,       // ดอกนายทุน/เดือน (AA)
      invYear: Number(r[COL.investorYear-1]) || 0,         // ดอกนายทุน/ปี (AH)
      prepaid: Number(r[COL.prepaid-1]) || 0,              // มัดจำ/หักล่วงหน้า (AJ)
      imgDeed: r[COL.imgDeed-1] || '',                     // โฉนด (AK)
      imgPhoto: r[COL.imgPhoto-1] || '',                   // ภาพสถานที่ (AL)
      imgContract: r[COL.imgContract-1] || '',             // หลักฐานสัญญา (AM)
      imgVideo: r[COL.imgVideo-1] || '',                   // วิดีโอ (AN)
      lastUpdate: r[COL.lastUpdate-1] || '',               // สถานะอัปเดต (AP)
      payments: r.slice(COL.payFirst-1, COL.payLast),      // ชำระดอกครั้งที่ 1-12 (AQ-BB)
      investor: r[COL.investor-1] || '(ไม่ระบุ)',
      phone: r[COL.investorPhone-1] || ''
    });
  }
  return out;
}

// จัดรูปแบบวันที่ไทย (พ.ศ.) จาก Date (ค.ศ.)
function fmtDate(d) {
  if (!d) return '-';
  var m = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return d.getDate() + ' ' + m[d.getMonth()] + ' ' + (d.getFullYear() + 543).toString().slice(-2);
}
// นับเดือนสำหรับคิดดอก — เลยวันครบเดือนมาแม้วันเดียว = นับเดือนนั้นเต็ม (ปัดขึ้น)
function monthsForInterest(start) {
  if (!start) return 0;
  var now = new Date(); now.setHours(0,0,0,0);
  var s = new Date(start); s.setHours(0,0,0,0);
  if (now < s) return 0;
  var months = (now.getFullYear() - s.getFullYear()) * 12 + (now.getMonth() - s.getMonth());
  // ถ้าเลยวันครบเดือนมาแล้ว (วันนี้ >= วันเริ่ม) นับเดือนนั้นเต็ม → +1
  if (now.getDate() >= s.getDate()) months += 1;
  return Math.max(months, 0);
}

// อายุจริงเป็น "X เดือน Y วัน" (นับจากวันเริ่มถึงวันนี้)
function ageMonthsDays(start) {
  if (!start) return '-';
  var now = new Date(); now.setHours(0,0,0,0);
  var s = new Date(start); s.setHours(0,0,0,0);
  if (now < s) return 'ยังไม่เริ่ม';
  var months = (now.getFullYear() - s.getFullYear()) * 12 + (now.getMonth() - s.getMonth());
  var days;
  if (now.getDate() >= s.getDate()) {
    days = now.getDate() - s.getDate();
  } else {
    months -= 1;
    // วันของเดือนก่อนหน้า
    var prevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    days = prevMonth - s.getDate() + now.getDate();
  }
  var out = '';
  if (months >= 12) { out += Math.floor(months/12) + ' ปี '; months = months % 12; }
  if (months) out += months + ' เดือน ';
  out += days + ' วัน';
  return out.trim();
}

// ข้อความอายุสัญญา
function ageText(days) {
  if (days === null) return '-';
  if (days < 0) return 'ยังไม่เริ่ม';
  var y = Math.floor(days/365), mo = Math.floor((days%365)/30), d = (days%365)%30;
  var s = '';
  if (y) s += y+' ปี ';
  if (mo) s += mo+' เดือน ';
  if (d || !s) s += d+' วัน';
  return s.trim();
}

// แปลงข้อความอายุสัญญาที่บันทึกไว้ (เช่น "2 ปี 3 เดือน 15 วัน") กลับเป็นจำนวนเดือนสำหรับคิดดอก
// ใช้กับแปลง "ไถ่ถอนแล้ว" เพื่อหยุดนับเดือนคิดดอก ณ วันไถ่ถอนจริง ไม่ให้วิ่งต่อถึงวันนี้
// ปัดขึ้นถ้ามีเศษวันเหลือ ให้ตรรกะตรงกับ monthsForInterest()
function parseMonthsFromAgeText(txt) {
  if (!txt) return 0;
  var y = /(\d+)\s*ปี/.exec(txt);
  var mo = /(\d+)\s*เดือน/.exec(txt);
  var d = /(\d+)\s*วัน/.exec(txt);
  var months = (y ? parseInt(y[1], 10) * 12 : 0) + (mo ? parseInt(mo[1], 10) : 0);
  if (d && parseInt(d[1], 10) > 0) months += 1;
  return months;
}

// ============================================================
// FLEX: เมนูหลัก
// ============================================================
function adminMenuFlex() {
var rows = [
    menuButton('📊 ภาพรวมพอร์ต', '#overview', '#004D40'),
    menuButton('📋 เช็คสถานะ', '#status', '#2E7D32'),
    menuButton('🏘 เช็ครายแปลง', '#plots', '#00838F'),
    menuButton('👤 ดูรายนายทุน', '#investor', '#1565C0'),
    menuButton('⏰ ครบกำหนดเดือนนี้', '#due', '#EF6C00'),
    menuButton('📆 ครบกำหนด (เลือกเดือน)', '#expire', '#D84315'),   // ← เพิ่มใหม่
    menuButton('📖 คู่มือคีย์เวิร์ด', '#manual', '#757575')
];
  // ★ เพิ่ม: hint คำสั่ง #id และ #พิมพ์ชื่อแปลง (เดิมหายไปจากเมนูแอดมิน)
  rows.push({ type:'separator', margin:'md', color:'#EEEEEE' });
  rows.push(txt('💡 พิมพ์ #id — ดู userId ตัวเอง', 'xxs', '#9E9E9E'));
  rows.push(txt('💡 พิมพ์ชื่อแปลง — ค้นหาแปลงนั้นทันที', 'xxs', '#9E9E9E'));

  var card = {
    type:'bubble', size:'mega',
    hero:{
      type:'image',
      url:'https://lh3.googleusercontent.com/d/1O53qTa-S3SjaYlLtonfq2cKGLcEKG7Nu',
      aspectRatio:'1:1', size:'full', offsetTop:'10px'
    },
    body:{
      type:'box', layout:'vertical', paddingAll:'lg', spacing:'none',
      contents:[
        { type:'box', layout:'vertical', contents:[
          txt('Admin • Dashboard', 'sm', '#1A1A1A', 'bold', null, 'center')
        ]},
        { type:'box', layout:'vertical', margin:'md', spacing:'sm', contents: rows }
      ],
    }
  };
  return { type:'flex', altText:'เมนูแอดมิน', contents: card };
}

// ทุกแปลง ยกเว้นไถ่ถอน (แบ่งหน้าเผื่ออนาคตแปลงเยอะ)
function allPlotsCarousel() {
  try {
    var assets = readAssets();  // เอาทุกสถานะ รวมไถ่ถอนแล้วด้วย (คอลัมน์จริงทั้งหมด)
    if (!assets.length) return [textMsg('ไม่มีข้อมูลแปลง')];

    // เรียง: ต้องจับตาก่อน (เกิน/ผ่อนผัน) แล้วตามด้วยใกล้ครบ
    assets.sort(function(x, y){
      return (daysLeft(x.end) === null ? 99999 : daysLeft(x.end)) - (daysLeft(y.end) === null ? 99999 : daysLeft(y.end));
    });

    var PER = 10;  // ปุ่มต่อการ์ด

    // การ์ดใบแรก = สรุปภาพรวม
    var lead = {
      // ★ แก้: เดิม size:'kilo' ไม่ตรงกับ buttonCards ที่เป็น 'mega' → LINE ปฏิเสธทั้ง carousel แบบเงียบๆ (ตายเงียบ)
      type:'bubble', size:'mega',
      body:{ type:'box', layout:'vertical', paddingAll:'xl', spacing:'md', justifyContent:'center', contents:[
        txt('🏘 รายแปลงทั้งหมด', 'xxl', '#00838F', 'bold'),
        txt(assets.length + ' แปลง', '3xl', '#1A1A1A', 'bold'),
        txt('(ครบทุกสถานะ)', 'xs', '#BDBDBD'),
        txt('ปัดขวาเพื่อเลือกแปลง →', 'xs', '#9E9E9E')
      ]}
    };

    // การ์ดถัดไป = ปุ่มชื่อแปลง 10 ปุ่ม/ใบ (สีตามสถานะ อักษรขาว)
    var buttonCards = [];
    for (var i = 0; i < assets.length; i += PER) {
      var slice = assets.slice(i, i + PER);
      var btns = [txt('เลือกแปลง (' + (i+1) + '-' + Math.min(i+PER, assets.length) + ')', 'xs', '#9E9E9E')];
      slice.forEach(function(a){
        var color = (STYLE[a.status] || {}).color || '#00838F';
        var safeName = String(a.name || '(ไม่มีชื่อ)');
        // ★ แก้: จาก 20 ตัวอักษร → 40 ตัวอักษร (ค่าสูงสุดที่ LINE ยอมให้ label ปุ่มมี ก่อนจะโดน error)
        var lbl = safeName.length > 40 ? safeName.substring(0, 38) + '..' : safeName;
        // ป้องกัน postback data เกิน 300 ตัวอักษรที่ LINE จำกัด
        var pdata = ('plot|' + safeName).substring(0, 300);
        btns.push({
          type:'button', style:'primary', color: color, height:'sm', margin:'sm',
          action:{ type:'postback', label: lbl, data: pdata }
        });
      });
      buttonCards.push({
        type:'bubble', size:'mega',
        body:{ type:'box', layout:'vertical', paddingAll:'lg', spacing:'none', contents:[
          txt('🏘 รายแปลง', 'md', '#1A1A1A', 'bold'),
          { type:'box', layout:'vertical', height:'3px', backgroundColor:'#00838F', margin:'md', cornerRadius:'sm', contents:[] },
          { type:'box', layout:'vertical', margin:'md', spacing:'none', contents: btns }
        ]}
      });
    }

    // ประกอบ: สรุปนำ + การ์ดปุ่ม ทั้งหมดไว้ carousel เดียว
    var allBubbles = [lead].concat(buttonCards);

    // LINE จำกัด 12 bubble/carousel — ถ้าเกิน แตกเป็นหลาย carousel (message)
    var messages = [];
    for (var j = 0; j < allBubbles.length; j += 12) {
      messages.push({
        type:'flex',
        altText:'รายแปลงทั้งหมด (' + assets.length + ')',
        contents:{ type:'carousel', contents: allBubbles.slice(j, j + 12) }
      });
      if (messages.length >= 5) break;  // LINE ส่งได้สูงสุด 5 ข้อความ/reply
    }
    return messages;
  } catch (err) {
    // กันตายเงียบ: ถ้าพังให้ตอบข้อความ error กลับแทนที่จะไม่ตอบอะไรเลย
    Logger.log('allPlotsCarousel error: ' + err + '\n' + (err && err.stack));
    return [textMsg('⚠️ #plots มีปัญหา: ' + err)];
  }
}
// ปุ่มที่ส่งข้อความคีย์เวิร์ดกลับ (message action)
function menuButton(label, keyword, color) {
  return {
    type: 'button', style: 'primary', color: color, height: 'sm', margin: 'sm',
    action: { type: 'message', label: label, text: keyword }
  };
}

// ============================================================
// FLEX: ภาพรวมพอร์ต
// ============================================================
function overviewFlex() {
  var assets = readAssets();
  var count = {}, principal = 0, invMonth = 0, invYear = 0, risk = 0;
  assets.forEach(function(a) {
    count[a.status] = (count[a.status]||0) + 1;
    if (a.status === 'ดำเนินการอยู่' || a.status === 'ดำเนินการอยู่ (ต่อดอก)') {
      principal += a.principal;
      invMonth += a.invMonth;   // ดอกนายทุน
      invYear += a.invYear;
      var l = daysLeft(a.end);
      if (l !== null && l < 0) risk++;
    } else if (a.status === 'อยู่ระหว่างผ่อนผัน') risk++;
  });

  var rows = [];
  Object.keys(STYLE).forEach(function(s) {
    if (count[s]) rows.push(miniRow(STYLE[s].emoji + ' ' + s, count[s] + ' แปลง', STYLE[s].color));
  });
  rows.push({ type:'separator', margin:'md', color:'#EEEEEE' });
  rows.push(miniRow('💰 เงินต้นรวม', baht(principal) + ' ฿'));
  rows.push(miniRow('📈 ดอกนายทุน/เดือน', baht(invMonth) + ' ฿'));
  rows.push(miniRow('📅 ดอกนายทุน/ปี', baht(invYear) + ' ฿'));
  if (risk) rows.push(miniRow('⚠️ ต้องจับตา', risk + ' แปลง', '#C62828'));

  return bubble('📊 ภาพรวมพอร์ต', '#004D40', rows);
}

// ============================================================
// FLEX: เช็คสถานะทั้งหมด (กดดูรายละเอียดแต่ละสถานะ)
// ============================================================
function statusSummaryFlex() {
  var assets = readAssets();
  var count = {}, riskCount = 0;
  assets.forEach(function(a) {
    count[a.status] = (count[a.status]||0)+1;
    // ต้องจับตา: เกินกำหนด (ที่ยังถือครอง) หรือ ผ่อนผัน
    if (a.status === 'ดำเนินการอยู่' || a.status === 'ดำเนินการอยู่ (ต่อดอก)') {
      var l = daysLeft(a.end);
      if (l !== null && l < 0) riskCount++;
    } else if (a.status === 'อยู่ระหว่างผ่อนผัน') riskCount++;
  });

  var rows = [txt('เลือกสถานะเพื่อดูรายละเอียด', 'xs', '#9E9E9E')];

  // ปุ่มพิเศษ "ต้องจับตา" (ย้ายมาจากภาพรวม) — เด่นสุด อยู่บนสุด
  if (riskCount) {
    rows.push({
      type:'button', style:'primary', color:'#C62828', height:'sm', margin:'md',
      action:{ type:'postback', label:'⚠️ ต้องจับตา (' + riskCount + ')', data:'action=risk' }
    });
  }

  // ปุ่มแต่ละสถานะ สีตามสถานะ
  Object.keys(STYLE).forEach(function(s) {
    if (count[s]) {
      rows.push({
        type:'button', style:'primary', color: STYLE[s].color, height:'sm', margin:'sm',
        action:{ type:'postback', label: STYLE[s].emoji+' '+s+' ('+count[s]+')',
                 data:'action=status&value='+encodeURIComponent(s) }
      });
    }
  });
  return bubble('📋 เช็คสถานะปัจจุบัน', '#2E7D32', rows);
}

// carousel "ต้องจับตา" (เกินกำหนด + ผ่อนผัน)
function riskCarousel() {
  var assets = readAssets().filter(function(a) {
    if (a.status === 'อยู่ระหว่างผ่อนผัน') return true;
    if (a.status === 'ดำเนินการอยู่' || a.status === 'ดำเนินการอยู่ (ต่อดอก)') {
      var l = daysLeft(a.end);
      return l !== null && l < 0;
    }
    return false;
  });
  if (!assets.length) return [textMsg('✅ ไม่มีแปลงที่ต้องจับตาตอนนี้')];

  // เรียงเกินมากสุดก่อน
  assets.sort(function(x, y){ return (daysLeft(x.end)||0) - (daysLeft(y.end)||0); });

  var lead = {
    type:'bubble', size:'kilo',
    body:{ type:'box', layout:'vertical', paddingAll:'xl', spacing:'md', justifyContent:'center', backgroundColor:'#C62828', contents:[
      txt('⚠️ ต้องจับตา', 'lg', '#FFFFFF', 'bold'),
      txt(assets.length + ' แปลง', 'xxl', '#FFFFFF', 'bold'),
      txt('เกินกำหนด + ผ่อนผัน', 'xs', '#FFFFFF')
    ]}
  };
  var bubbles = [lead].concat(assets.map(function(a){ return plotBubble(a, '#C62828'); }));
  var messages = [];
  for (var j = 0; j < bubbles.length; j += 12) {
    messages.push({ type:'flex', altText:'ต้องจับตา (' + assets.length + ')',
      contents:{ type:'carousel', contents: bubbles.slice(j, j + 12) }});
    if (messages.length >= 5) break;
  }
  return messages;
}

// carousel รายละเอียดสถานะที่เลือก
// การ์ดดีเทลแอดวานซ์ (กดชื่อแปลง → เด้งตัวนี้)
function plotAdvanceBubble(a) {
  var accent = (STYLE[a.status] || {}).color || '#00838F';
  var isDone = (a.status === 'ไถ่ถอนแล้ว' || a.status === 'ยึดทรัพย์');
  var left = daysLeft(a.end);
  // ★ แก้บั๊ก: เดิม monthsInt คำนวณจาก monthsForInterest(a.start) เสมอ ทำให้แปลง "ไถ่ถอนแล้ว"
  // ยังนับเดือนคิดดอก/ยอดสะสมวิ่งต่อไปถึงวันนี้ ทั้งที่ "อายุสัญญา" ด้านบนถูกล็อกด้วย ageStored ไปแล้ว
  // ตอนนี้ถ้าไถ่ถอนแล้วและมีอายุที่บันทึกไว้ ให้แปลงกลับเป็นจำนวนเดือนแทน หยุดนับ ณ วันไถ่ถอนจริง
  var monthsInt = (a.status === 'ไถ่ถอนแล้ว' && a.ageStored)
    ? parseMonthsFromAgeText(a.ageStored)
    : monthsForInterest(a.start);   // เดือนคิดดอก (ปัดขึ้น)
  // อายุสัญญา: ถ้าไถ่ถอนแล้วและมีค่าบันทึกไว้ที่คอลัมน์ D ให้ใช้ค่านั้น (ตัดวันแล้ว ไม่นับต่อถึงวันนี้)
  var ageTxt = (a.status === 'ไถ่ถอนแล้ว' && a.ageStored) ? a.ageStored : ageMonthsDays(a.start);

  // ===== พาร์ท 1: ข้อมูลสัญญา + ดอกพื้นฐาน =====
  var p1 = [
    miniRow('สถานะ', a.status, accent),
    miniRow('เริ่มสัญญา', fmtDate(a.start)),
    miniRow('สิ้นสุด', fmtDate(a.end)),
    miniRow('อายุสัญญา', ageTxt)
  ];
  if (!isDone && left !== null) {
    var dueTxt = left < 0 ? 'เกินมา ' + Math.abs(left) + ' วัน' : (left === 0 ? 'ครบวันนี้' : 'เหลือ ' + left + ' วัน');
    p1.push(miniRow('ครบกำหนด', dueTxt, left < 0 ? '#D32F2F' : (left <= 30 ? '#F57C00' : '#00695C')));
  }
  p1.push({ type:'separator', margin:'sm', color:'#F0F0F0' });
  p1.push(miniRow('เงินต้น', baht(a.principal) + ' ฿'));
  p1.push(miniRow('นายทุนได้/เดือน', baht(a.invMonth) + ' ฿'));
  p1.push(miniRow('นายทุนได้/ปี', baht(a.invYear) + ' ฿'));
  p1.push(miniRow('เราได้/เดือน', baht(a.interest) + ' ฿'));
  p1.push(miniRow('เราได้/ปี', baht(a.interestYear) + ' ฿'));

  // ===== พาร์ท 2: สรุป ณ ปัจจุบัน =====
  var invAccrued = a.invMonth * monthsInt;
  var myAccrued = a.interest * monthsInt;
  var diffAccrued = myAccrued - invAccrued;

  var p2 = [
    { type:'box', layout:'horizontal', alignItems:'center', contents:[
      txt('💰 สรุป ณ ปัจจุบัน', 'sm', accent, 'bold', 6),
      txt('(อายุจริง ' + ageTxt + ')', 'xxs', '#333333', null, 6, 'end')
    ]},
    miniRow('คิดดอกแล้ว', monthsInt + ' เดือน', accent),
    miniRow('นายทุนได้สะสม', baht(invAccrued) + ' ฿'),
    miniRow('เราได้สะสม', baht(myAccrued) + ' ฿'),
    miniRow('💵 กำไรสะสม (ส่วนต่าง)', baht(diffAccrued) + ' ฿', '#1B5E20')
  ];

  // ===== พาร์ท 3: ประวัติชำระ (มัดจำอยู่ในนี้ ไม่นับรายครั้ง) =====
  var p3 = [];
  var payRows = [];
  (a.payments || []).forEach(function(p, idx) {
    if (p !== '' && p != null) payRows.push(miniRow('ครั้งที่ ' + (idx+1), String(p)));
  });
  if (a.prepaid > 0 || payRows.length) {
    p3.push(txt('📋 ประวัติชำระ' + (payRows.length ? ' (' + payRows.length + ' ครั้ง)' : ''), 'sm', '#455A64', 'bold'));
    if (a.prepaid > 0) p3.push(miniRow('หักดอกล่วงหน้า', baht(a.prepaid) + ' ฿', '#EF6C00'));
    payRows.forEach(function(r){ p3.push(r); });
  }

  // ===== 4 ปุ่มลิงก์เอกสาร แถวละ 2 ปุ่ม: [โฉนด|หลักฐาน] แล้ว [ภาพถ่าย|วิดีโอ] (ไม่ดึงรูป ประหยัดเวลา ไม่หมดโควตา) =====
  var docItems = [
    { id: a.imgDeed,     label: '📜 โฉนด' },
    { id: a.imgContract, label: '📄 หลักฐาน' },
    { id: a.imgPhoto,    label: '📷 ภาพถ่าย' },
    { id: a.imgVideo,    label: '🎬 วิดีโอ' }
  ].filter(function(d){ return d.id && String(d.id).trim().length > 5; });

  var docRows = [];
  for (var di = 0; di < docItems.length; di += 2) {
    var pair = docItems.slice(di, di + 2).map(function(d){
      return {
        type:'button', style:'secondary', height:'sm', flex:1,
        action:{ type:'uri', label: d.label, uri:'https://drive.google.com/drive/folders/' + String(d.id).trim() }
      };
    });
    docRows.push({ type:'box', layout:'horizontal', spacing:'sm', margin:'sm', contents: pair });
  }

  var body = [
    { type:'box', layout:'vertical', contents:[
      txt(a.name, 'md', '#1A1A1A', 'bold'),
      txt('👤 ' + a.investor, 'xs', '#999999', null, null, 'end')
    ]},
    { type:'box', layout:'vertical', height:'3px', backgroundColor: accent, margin:'md', cornerRadius:'sm', contents:[] },
    { type:'box', layout:'vertical', margin:'md', spacing:'sm', contents: p1 },
    { type:'separator', margin:'lg', color:'#E0E0E0' },
    { type:'box', layout:'vertical', margin:'lg', spacing:'sm', contents: p2 }
  ];
  if (p3.length) {
    body.push({ type:'separator', margin:'lg', color:'#E0E0E0' });
    body.push({ type:'box', layout:'vertical', margin:'lg', spacing:'sm', contents: p3 });
  }
  if (docRows.length) {
    body.push({ type:'box', layout:'vertical', margin:'lg', spacing:'none', contents:
      [txt('📎 เอกสารแนบ', 'sm', '#455A64', 'bold')].concat(docRows) });
  }

  // footer: อัปเดตล่าสุด (พื้นสี ฟอนต์ขาว)
  var footer = null;
  if (a.lastUpdate) {
    footer = { type:'box', layout:'vertical', backgroundColor: accent, paddingAll:'md', contents:[
      { type:'box', layout:'horizontal', contents:[
        txt('อัปเดตล่าสุด', 'xs', '#FFFFFF', null, 6),
        txt(fmtUpdateDate(a.lastUpdate), 'xs', '#FFFFFF', 'bold', 6, 'end')
      ]}
    ]};
  }

  var bubble = {
    type:'bubble', size:'mega',
    body:{ type:'box', layout:'vertical', paddingAll:'lg', spacing:'none', contents: body }
  };
  if (footer) bubble.footer = footer;

  return { type:'flex', altText: a.name + ' (ดีเทล)', contents: bubble };
}
// จัดรูปแบบวันที่อัปเดต (รับได้ทั้ง Date และ string)
function fmtUpdateDate(v) {
  if (v instanceof Date) return fmtDate(toCE(v));
  return String(v).split(' ')[0];  // ตัดเวลาออก เอาแค่วันที่
}

// การ์ดแปลงมาตรฐาน (มินิมอล) ใช้ใน carousel รายแปลง
function plotBubble(a, accent) {
  var isDone = (a.status === 'ไถ่ถอนแล้ว' || a.status === 'ยึดทรัพย์');
  var left = daysLeft(a.end);
  var rows = [];

  // แถววันที่ (เริ่ม → สิ้นสุด)
  rows.push(miniRow('เริ่มสัญญา', fmtDate(a.start)));
  rows.push(miniRow('สิ้นสุด', fmtDate(a.end)));
  // ไถ่ถอนแล้ว + มีค่าบันทึกไว้ที่คอลัมน์ D → ใช้ค่านั้น (ตัดวันแล้ว ไม่นับต่อถึงวันนี้)
  rows.push(miniRow('อายุสัญญา', (a.status === 'ไถ่ถอนแล้ว' && a.ageStored) ? a.ageStored : ageText(a.ageDays)));

  // ครบกำหนด — เฉพาะที่ยังไม่จบ (ไถ่ถอน/ยึดไม่ต้องโชว์)
  if (!isDone && left !== null) {
    var dueTxt = left < 0 ? 'เกินมา ' + Math.abs(left) + ' วัน' : (left === 0 ? 'ครบวันนี้' : 'เหลือ ' + left + ' วัน');
    rows.push(miniRow('ครบกำหนด', dueTxt, left < 0 ? '#D32F2F' : (left <= 30 ? '#F57C00' : '#00695C')));
  }

  rows.push({ type:'separator', margin:'md', color:'#EEEEEE' });
  rows.push(miniRow('เงินต้น', baht(a.principal) + ' ฿'));
  rows.push(miniRow('ดอกนายทุน/เดือน', baht(a.invMonth) + ' ฿'));
  rows.push(miniRow('ดอกนายทุน/ปี', baht(a.invYear) + ' ฿'));

  return {
    type:'bubble', size:'kilo',
    body:{
      type:'box', layout:'vertical', paddingAll:'lg', spacing:'none',
      action:{ type:'postback', label: a.name.length > 20 ? a.name.substring(0,18)+'..' : a.name, data:'plot|' + a.name },
      contents:[
        // แถบสีบาง + ชื่อแปลง
        { type:'box', layout:'vertical', contents:[
          txt(a.name, 'md', '#1A1A1A', 'bold'),
          txt('👤 ' + a.investor, 'xs', '#999999')
        ]},
        { type:'box', layout:'vertical', height:'3px', backgroundColor: accent, margin:'md', cornerRadius:'sm', contents:[] },
        { type:'box', layout:'vertical', margin:'md', spacing:'sm', contents: rows },
        txt('แตะเพื่อดูดีเทล →', 'xxs', '#BDBDBD', null, null, 'end')
      ]
    },
    styles:{ body:{ separator:false } }
  };
}

// แถวข้อมูลมินิมอล (key ซ้าย ค่าขวา)
function miniRow(k, v, valueColor) {
  return { type:'box', layout:'horizontal', contents:[
    txt(k, 'xs', '#9E9E9E', null, 5),
    txt(v, 'xs', valueColor || '#424242', 'bold', 5, 'end')
  ]};
}

function statusDetailCarousel(status) {
  var assets = readAssets().filter(function(a){ return a.status === status; });
  if (!assets.length) return [textMsg('ไม่มีแปลงในสถานะนี้')];

  var accent = (STYLE[status] || {}).color || '#333333';
  var messages = [];

  // แบ่งหน้าละ 11 การ์ด (LINE จำกัด 12/carousel — เผื่อการ์ดสรุปนำ 1 ใบ)
  // ใบแรกใส่การ์ดสรุปนำหน้า
  var CHUNK = 11;
  for (var i = 0; i < assets.length; i += CHUNK) {
    var slice = assets.slice(i, i + CHUNK);
    var bubbles = slice.map(function(a){ return plotBubble(a, accent); });

    // การ์ดสรุปนำ (เฉพาะ carousel ใบแรก)
    if (i === 0) {
      var emoji = (STYLE[status] || {}).emoji || '';
      bubbles.unshift(summaryLeadBubble(emoji + ' ' + status, assets.length, accent));
    }
    messages.push({
      type:'flex',
      altText: status + ' (' + assets.length + ' แปลง)' + (assets.length > CHUNK ? ' — หน้า ' + (Math.floor(i/CHUNK)+1) : ''),
      contents:{ type:'carousel', contents: bubbles }
    });
    if (messages.length >= 5) break; // LINE ส่งได้สูงสุด 5 ข้อความ/reply
  }
  return messages;
}

// การ์ดสรุปนำหน้า carousel
function summaryLeadBubble(title, count, accent) {
  return {
    type:'bubble', size:'kilo',
    body:{ type:'box', layout:'vertical', paddingAll:'xl', justifyContent:'center', spacing:'md',
      backgroundColor: accent,
      contents:[
        txt(title, 'lg', '#FFFFFF', 'bold'),
        txt(count + ' แปลง', 'xxl', '#FFFFFF', 'bold'),
        txt('ปัดซ้ายเพื่อดูรายแปลง →', 'xs', '#FFFFFF')
      ]}
  };
}

// ============================================================
// FLEX: รายนายทุน
// ============================================================
function investorListFlex() {
  var assets = readAssets();
  var inv = {};
  assets.forEach(function(a){ inv[a.investor] = (inv[a.investor]||0)+1; });

  var names = Object.keys(inv).sort(function(a,b){ return inv[b]-inv[a]; });
  var rows = [txt('เลือกนายทุนเพื่อดูสรุป', 'xs', '#9E9E9E')];
  names.slice(0, 12).forEach(function(name) {
    rows.push({
      type:'button', style:'primary', color:'#1565C0', height:'sm', margin:'sm',
      action:{ type:'postback', label:'👤 '+name+' ('+inv[name]+' แปลง)',
               data:'action=investor&name='+encodeURIComponent(name) }
    });
  });
  return bubble('👤 รายนายทุน', '#1565C0', rows);
}

function investorDetailFlex(name) {
  var assets = readAssets().filter(function(a){ return a.investor === name; });
  if (!assets.length) return textMsg('ไม่พบข้อมูลนายทุน: ' + name);

  var invMonth = 0, invYear = 0, principal = 0, risk = 0, active = 0;
  assets.forEach(function(a) {
    if (a.status==='ดำเนินการอยู่' || a.status==='ดำเนินการอยู่ (ต่อดอก)') {
      principal += a.principal;
      invMonth += a.invMonth;   // ดอกนายทุน/เดือน
      invYear += a.invYear;     // ดอกนายทุน/ปี
      active++;
      var l = daysLeft(a.end);
      if (l!==null && l<0) risk++;
    } else if (a.status==='อยู่ระหว่างผ่อนผัน') risk++;
  });

  // การ์ดสรุปเหมารวม (ใบแรก)
  var sumRows = [
    miniRow('จำนวนแปลง', assets.length + ' แปลง (ถือครอง ' + active + ')'),
    { type:'separator', margin:'md', color:'#EEEEEE' },
    miniRow('เงินต้นรวม', baht(principal) + ' ฿'),
    miniRow('ดอกนายทุน/เดือน', baht(invMonth) + ' ฿'),
    miniRow('ดอกนายทุน/ปี', baht(invYear) + ' ฿')
  ];
  if (risk) sumRows.push(miniRow('ต้องจับตา', risk + ' แปลง', '#D32F2F'));

  var summaryCard = {
    type:'bubble', size:'kilo',
    header:{ type:'box', layout:'vertical', backgroundColor:'#1565C0', paddingAll:'lg', contents:[
      txt('สรุปพอร์ตนายทุน', 'xs', '#FFFFFF'),
      txt('👤 ' + name, 'xl', '#FFFFFF', 'bold', null, 'end')
    ]},
    body:{ type:'box', layout:'vertical', paddingAll:'lg', spacing:'none', contents:[
      { type:'box', layout:'vertical', margin:'none', spacing:'sm', contents: sumRows }
    ]}
  };

  // การ์ดรายแปลง (ดีเทลครบ ผ่าน plotBubble) — แสดงครบทุกแปลง
  var plotCards = assets.map(function(a){
    var accent = (STYLE[a.status] || {}).color || '#1565C0';
    return plotBubble(a, accent);
  });
  var allBubbles = [summaryCard].concat(plotCards);

  // แบ่งเป็นหลาย carousel (12 bubble/ใบ) แสดงครบ
  var messages = [];
  for (var j = 0; j < allBubbles.length; j += 12) {
    messages.push({
      type:'flex', altText:'นายทุน ' + name,
      contents:{ type:'carousel', contents: allBubbles.slice(j, j + 12) }
    });
    if (messages.length >= 5) break;  // LINE ส่งได้สูงสุด 5 ข้อความ/reply
  }
  return messages;
}

// ============================================================
// FLEX: ครบกำหนดเดือนนี้
// ============================================================
function dueThisMonthFlex() {
  var assets = readAssets();
  var now = new Date();
  var thisMonth = now.getMonth(), thisYear = now.getFullYear();
  var due = assets.filter(function(a) {
    if (a.status!=='ดำเนินการอยู่' && a.status!=='ดำเนินการอยู่ (ต่อดอก)') return false;
    return a.end && a.end.getMonth()===thisMonth && a.end.getFullYear()===thisYear;
  });

  if (!due.length) return [textMsg('✅ เดือนนี้ไม่มีสัญญาครบกำหนด')];

  // เรียงตามความเร่งด่วน (ครบเร็วสุด/เกินก่อน)
  due.sort(function(x, y){ return (daysLeft(x.end)||0) - (daysLeft(y.end)||0); });

  // การ์ดสรุปนำ (รวมเงินต้น + ดอกนายทุนที่จะครบ)
  var sumPrincipal = 0, sumInvYear = 0;
  due.forEach(function(a){ sumPrincipal += a.principal; sumInvYear += a.invYear; });

  var leadCard = {
    type:'bubble', size:'kilo',
    header:{ type:'box', layout:'vertical', backgroundColor:'#EF6C00', paddingAll:'lg', contents:[
      txt('⏰ ครบกำหนดเดือนนี้', 'md', '#FFFFFF', 'bold'),
      txt(new Date().toLocaleDateString('th-TH', {month:'long', year:'numeric'}), 'xs', '#FFFFFF')
    ]},
    body:{ type:'box', layout:'vertical', paddingAll:'lg', spacing:'none', contents:[
      { type:'box', layout:'vertical', margin:'none', spacing:'sm', contents:[
        miniRow('จำนวน', due.length + ' แปลง', '#E65100'),
        miniRow('เงินต้นรวม', baht(sumPrincipal) + ' ฿'),
        miniRow('ดอกนายทุน/ปีรวม', baht(sumInvYear) + ' ฿')
      ]},
      { type:'text', text:'ปัดดูรายแปลง →', size:'xxs', color:'#BDBDBD', margin:'md' }
    ]}
  };

  var bubbles = [leadCard].concat(due.map(function(a){ return plotBubble(a, '#EF6C00'); }));
  var messages = [];
  for (var j = 0; j < bubbles.length; j += 12) {
    messages.push({ type:'flex', altText:'ครบกำหนดเดือนนี้ (' + due.length + ')',
      contents:{ type:'carousel', contents: bubbles.slice(j, j + 12) }});
    if (messages.length >= 5) break;
  }
  return messages;
}


var THAI_MONTHS_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                        'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

// การ์ดเลือกเดือน (6 เดือน: เดือนนี้ + อีก 5 เดือนข้างหน้า)
function expireMonthSelectorFlex() {
  var now = new Date();
  var rows = [txt('เลือกเดือนที่ต้องการดูสัญญาครบกำหนด', 'xs', '#9E9E9E')];

  for (var i = 0; i < 6; i++) {
    var d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    var m = d.getMonth();
    var y = d.getFullYear();
    var label = THAI_MONTHS_FULL[m] + ' ' + (y + 543);
    var prefix = (i === 0) ? '📅 ' : '';

    rows.push({
      type: 'button', style: 'primary', color: '#EF6C00', height: 'sm', margin: 'sm',
      action: { type: 'postback', label: prefix + label, data: 'action=expiremonth&m=' + m + '&y=' + y }
    });
  }

  return bubble('⏰ ครบกำหนดสัญญา (เลือกเดือน)', '#EF6C00', rows);
}

// carousel ของเดือนที่เลือก
function expireMonthCarousel(month, year) {
  var assets = readAssets();
  var due = assets.filter(function(a) {
    if (a.status!=='ดำเนินการอยู่' && a.status!=='ดำเนินการอยู่ (ต่อดอก)') return false;
    return a.end && a.end.getMonth()===month && a.end.getFullYear()===year;
  });

  var monthLabel = THAI_MONTHS_FULL[month] + ' ' + (year + 543);

  if (!due.length) return [textMsg('✅ เดือน' + monthLabel + ' ไม่มีสัญญาครบกำหนด')];

  due.sort(function(x, y){ return (daysLeft(x.end)||0) - (daysLeft(y.end)||0); });

  var sumPrincipal = 0, sumInvYear = 0;
  due.forEach(function(a){ sumPrincipal += a.principal; sumInvYear += a.invYear; });

  var leadCard = {
    type:'bubble', size:'kilo',
    header:{ type:'box', layout:'vertical', backgroundColor:'#EF6C00', paddingAll:'lg', contents:[
      txt('⏰ ครบกำหนด', 'md', '#FFFFFF', 'bold'),
      txt(monthLabel, 'xs', '#FFFFFF')
    ]},
    body:{ type:'box', layout:'vertical', paddingAll:'lg', spacing:'none', contents:[
      { type:'box', layout:'vertical', margin:'none', spacing:'sm', contents:[
        miniRow('จำนวน', due.length + ' แปลง', '#E65100'),
        miniRow('เงินต้นรวม', baht(sumPrincipal) + ' ฿'),
        miniRow('ดอกนายทุน/ปีรวม', baht(sumInvYear) + ' ฿')
      ]},
      { type:'text', text:'ปัดดูรายแปลง →', size:'xxs', color:'#BDBDBD', margin:'md' }
    ]}
  };

  var bubbles = [leadCard].concat(due.map(function(a){ return plotBubble(a, '#EF6C00'); }));
  var messages = [];
  for (var j = 0; j < bubbles.length; j += 12) {
    messages.push({ type:'flex', altText:'ครบกำหนด ' + monthLabel + ' (' + due.length + ')',
      contents:{ type:'carousel', contents: bubbles.slice(j, j + 12) }});
    if (messages.length >= 5) break;
  }
  return messages;
}


// ============================================================
// ค้นหาแปลงด้วยชื่อ
// ============================================================
function searchPlot(keyword) {
  var assets = readAssets();
  var found = assets.filter(function(a){ return a.name.indexOf(keyword) > -1; });
  if (!found.length) return null;
  // เจอหลายแปลง → carousel, เจอแปลงเดียว → การ์ดเดียว
  var accent = function(a){ return (STYLE[a.status] || {}).color || '#333333'; };
  if (found.length === 1) {
    return { type:'flex', altText: found[0].name, contents: plotBubble(found[0], accent(found[0])) };
  }
  var bubbles = found.slice(0, 12).map(function(a){ return plotBubble(a, accent(a)); });
  return { type:'flex', altText:'ผลค้นหา "' + keyword + '"', contents:{ type:'carousel', contents: bubbles }};
}

// ============================================================
// FLEX: คู่มือคีย์เวิร์ด
// ============================================================
function manualFlex() {
var cmds = [
    ['#admin', 'เปิดเมนูหลัก', '#1A237E'],
    ['#overview', 'ภาพรวมพอร์ต', '#004D40'],
    ['#status', 'เช็คทุกสถานะ', '#2E7D32'],
    ['#plots', 'เช็ครายแปลงทั้งหมด', '#00838F'],
    ['#investor', 'ดูสรุปรายนายทุน', '#1565C0'],
    ['#due', 'ครบกำหนดเดือนนี้', '#EF6C00'],
    ['#expire', 'ครบกำหนด เลือกเดือนล่วงหน้า', '#D84315']   // ← เพิ่มใหม่
];
  var rows = [txt('กดปุ่มด้านล่างเพื่อใช้งานได้เลย', 'xs', '#9E9E9E')];
  cmds.forEach(function(c) {
    rows.push({
      type:'button', style:'primary', color: c[2], height:'sm', margin:'sm',
      action:{ type:'message', label: c[0] + '  ·  ' + c[1], text: c[0] }
    });
  });
  rows.push({ type:'separator', margin:'md', color:'#EEEEEE' });
  rows.push(txt('💡 พิมพ์ #id — ดู userId ตัวเอง', 'xxs', '#9E9E9E'));
  rows.push(txt('💡 พิมพ์ชื่อแปลง — ค้นหาแปลงนั้นทันที', 'xxs', '#9E9E9E'));

  return {
    type:'flex', altText:'คู่มือคีย์เวิร์ด',
    contents:{
      type:'bubble', size:'mega',
      body:{ type:'box', layout:'vertical', paddingAll:'lg', spacing:'none', contents:[
        txt('📖 คู่มือคีย์เวิร์ด', 'lg', '#1A1A1A', 'bold'),
        { type:'box', layout:'vertical', height:'3px', backgroundColor:'#37474F', margin:'md', cornerRadius:'sm', contents:[] },
        { type:'box', layout:'vertical', margin:'md', spacing:'sm', contents: rows }
      ]}
    }
  };
}

// ============================================================
// Flex primitives
// ============================================================
function bubble(title, accentColor, bodyContents, hideBackBtn) {
  var inner = [
    { type:'box', layout:'vertical', contents:[
      txt(title, 'lg', '#1A1A1A', 'bold')
    ]},
    { type:'box', layout:'vertical', height:'3px', backgroundColor: accentColor, margin:'md', cornerRadius:'sm', contents:[] },
    { type:'box', layout:'vertical', margin:'md', spacing:'sm', contents: bodyContents }
  ];
  var card = {
    type:'bubble', size:'mega',
    body:{ type:'box', layout:'vertical', paddingAll:'lg', spacing:'none', contents: inner }
  };
  if (!hideBackBtn) {
    card.footer = { type:'box', layout:'vertical', paddingAll:'md', contents:[{
      type:'button', style:'link', height:'sm',
      action:{ type:'message', label:'⬅ เมนูหลัก', text:'#admin' }
    }]};
  }
  return { type:'flex', altText: title, contents: card };
}
function txt(text, size, color, weight, flex, align) {
  var o = { type:'text', text:String(text), size:size||'md', color:color||'#333333', wrap:true };
  if (weight) o.weight = weight;
  if (flex != null) o.flex = flex;
  if (align) o.align = align;
  return o;
}
function kv(k, v, color) {
  return { type:'box', layout:'horizontal', margin:'sm', contents:[
    txt(k, 'sm', '#666666', null, 6),
    txt(v, 'sm', color||'#333333', 'bold', 5, 'end')
  ]};
}
function textMsg(t) { return { type:'text', text:t }; }

// ============================================================
// LINE reply (ไม่เสียโควตา)
// ============================================================
function reply(replyToken, messages) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method:'post', contentType:'application/json',
    headers:{ 'Authorization':'Bearer ' + LINE.token },
    payload: JSON.stringify({ replyToken: replyToken, messages: messages }),
    muteHttpExceptions: true
  });
}

function parseQuery(q) {
  var out = {};
  (q||'').split('&').forEach(function(pair){
    var kv = pair.split('=');
    out[kv[0]] = decodeURIComponent(kv[1]||'');
  });
  return out;
}

// ===== setup =====
// ============================================================
// 🚀 รันฟังก์ชันนี้ครั้งเดียว — สร้างชีต LINE + UserAuth อัตโนมัติ
//    แล้วไปกรอกค่าในชีตเอง ไม่ต้องแตะโค้ด
// ============================================================
function setupLineSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ----- ชีต LINE (config) -----
  var line = ss.getSheetByName('LINE');
  if (!line) line = ss.insertSheet('LINE');
  line.clear();
  line.getRange(1, 1, 1, 3).setValues([['คีย์ (ห้ามแก้)', 'ค่า (กรอกตรงนี้)', 'คำอธิบาย']]);
  var lineRows = [
    ['token', '', 'Channel Access Token จาก LINE Developers Console'],
    ['groupId', '', 'groupId กลุ่มทีม (พิมพ์ #id ในกลุ่มเพื่อดู) — สำหรับแจ้งเตือนอัตโนมัติ'],
    ['masterAdmin', '', 'userId แอดมินหลัก (พิมพ์ #id ในแชตเพื่อดู)'],
    ['alertDays', '60,30,15,5', 'เตือนล่วงหน้ากี่วัน (คั่นด้วยจุลภาค)'],
    ['webUrl', 'https://infinityrichglobal.github.io/APHITHANASAP/', 'ลิงก์ปุ่มเปิดระบบในการ์ด'],
    ['sheetData', 'DATABASE', 'ชื่อชีตข้อมูลหลัก (ปกติไม่ต้องแก้)'],
    ['sheetAuth', 'UserAuth', 'ชื่อชีตสิทธิ์ผู้ใช้ (ปกติไม่ต้องแก้)']
  ];
  line.getRange(2, 1, lineRows.length, 3).setValues(lineRows);
  // จัดหน้าตา
  line.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#1A237E').setFontColor('#FFFFFF');
  line.setColumnWidth(1, 130); line.setColumnWidth(2, 320); line.setColumnWidth(3, 420);
  line.setFrozenRows(1);

  // ----- ชีต UserAuth (สิทธิ์) -----
  var auth = ss.getSheetByName('UserAuth');
  if (!auth) auth = ss.insertSheet('UserAuth');
  auth.clear();
  auth.getRange(1, 1, 1, 4).setValues([['userId', 'ชื่อ', 'สถานะ', 'วันที่ขอ']]);
  auth.getRange(2, 1, 1, 4).setValues([['(userId จะโผล่เองเมื่อมีคนขอสิทธิ์)', '', 'รอ', '']]);
  auth.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#2E7D32').setFontColor('#FFFFFF');
  auth.setColumnWidth(1, 340); auth.setColumnWidth(2, 150); auth.setColumnWidth(3, 100); auth.setColumnWidth(4, 160);
  auth.setFrozenRows(1);
  // ทำ dropdown สถานะให้เลือก อนุมัติ/รอ/ระงับ
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(['อนุมัติ', 'รอ', 'ระงับ'], true).build();
  auth.getRange(2, 3, 500, 1).setDataValidation(rule);

  // ล้าง cache config เผื่อเคยอ่านค่าเก่า
  _lineCache = null;

  SpreadsheetApp.getUi && Logger.log('สร้างชีต LINE + UserAuth เรียบร้อย! ไปกรอกค่าในชีต LINE ได้เลย');
  Logger.log('✅ เสร็จ: สร้างชีต "LINE" (กรอก token/groupId/masterAdmin) และ "UserAuth" (จัดการสิทธิ์)');
}

// เก็บ setupTriggers ไว้เหมือนเดิม (ตั้งเวลาแจ้งเตือน)


////////////////////////////////////////////////////////////
// ===== แจ้งเตือนอัตโนมัติตามเวลา (รายสัปดาห์/รายเดือน) =====
////////////////////////////////////////////////////////////
function weeklyContractAlert() {
  var assets = readAssets();
  var nearDue = [], overdue = [], grace = [];

  assets.forEach(function(a) {
    if (a.status === 'ดำเนินการอยู่' || a.status === 'ดำเนินการอยู่ (ต่อดอก)') {
      if (!a.end) return;
      var left = daysLeft(a.end);
      if (left < 0) overdue.push({ a: a, days: Math.abs(left) });
      else if (LINE.alertDaysArr.indexOf(left) > -1) nearDue.push({ a: a, days: left });
    } else if (a.status === 'อยู่ระหว่างผ่อนผัน') {
      grace.push({ a: a });
    }
  });

  if (nearDue.length || overdue.length || grace.length) {
    var bubble = buildAlertFlex(nearDue, overdue, grace);
    pushFlex('แจ้งเตือนสัญญาประจำสัปดาห์', bubble);
  }

  // ส่งแจ้งเตือนเข้า Telegram ทุกวันจันทร์
  sendWeeklyTelegramAlert(nearDue, overdue, grace);
}

function buildAlertFlex(nearDue, overdue, grace) {
  var content = [txt(new Date().toLocaleDateString('th-TH', {weekday:'long', day:'numeric', month:'long', year:'numeric'}), 'xs', '#9E9E9E')];

  if (overdue.length) {
    content.push(sectionHeader('🔴 เกินกำหนดแล้ว (' + overdue.length + ')', '#C62828'));
    overdue.forEach(function(o) { content.push(miniRow(o.a.name, 'เกินมา ' + o.days + ' วัน', '#C62828')); });
  }
  if (nearDue.length) {
    content.push(sectionHeader('⏰ ใกล้ครบสัญญา (' + nearDue.length + ')', '#EF6C00'));
    nearDue.forEach(function(o) { content.push(miniRow(o.a.name, 'เหลือ ' + o.days + ' วัน', '#EF6C00')); });
  }
  if (grace.length) {
    content.push(sectionHeader('⚠️ อยู่ระหว่างผ่อนผัน (' + grace.length + ')', '#F9A825'));
    grace.forEach(function(g) { content.push(miniRow(g.a.name, 'ควรตัดสินใจ', '#F9A825')); });
  }

  return {
    type:'bubble', size:'mega',
    body:{ type:'box', layout:'vertical', paddingAll:'lg', spacing:'none', contents:[
      txt('📋 แจ้งเตือนสัญญา', 'lg', '#1A1A1A', 'bold'),
      { type:'box', layout:'vertical', height:'3px', backgroundColor:'#1A237E', margin:'md', cornerRadius:'sm', contents:[] },
      { type:'box', layout:'vertical', margin:'md', spacing:'sm', contents: content }
    ]},
    footer:{ type:'box', layout:'vertical', paddingAll:'md', contents:[{
      type:'button', style:'primary', color:'#1A237E', height:'sm',
      action:{ type:'uri', label:'เปิดระบบดูรายละเอียด', uri: LINE.webUrl }
    }]}
  };
}

function monthlySummary() {
  var assets = readAssets();
  var count = {}, principal = 0, invMonth = 0, invYear = 0;
  var dueInMonth = [];

  var now = new Date();
  var curMonth = now.getMonth();
  var curYear = now.getFullYear();

  assets.forEach(function(a) {
    count[a.status] = (count[a.status] || 0) + 1;
    if (a.status === 'ดำเนินการอยู่' || a.status === 'ดำเนินการอยู่ (ต่อดอก)') {
      principal += a.principal;
      invMonth += a.invMonth;   // ดอกนายทุน
      invYear += a.invYear;

      if (a.end) {
        var dEnd = new Date(a.end);
        if (dEnd.getMonth() === curMonth && dEnd.getFullYear() === curYear) {
          dueInMonth.push(a);
        }
      }
    }
  });

  var rows = [txt('ประจำเดือน ' + new Date().toLocaleDateString('th-TH', {month:'long', year:'numeric'}), 'xs', '#9E9E9E')];
  Object.keys(STYLE).forEach(function(s) {
    if (count[s]) rows.push(miniRow(STYLE[s].emoji + ' ' + s, count[s] + ' แปลง', STYLE[s].color));
  });
  rows.push({ type: 'separator', margin: 'md', color:'#EEEEEE' });
  rows.push(miniRow('💰 เงินต้นรวม', baht(principal) + ' ฿'));
  rows.push(miniRow('📈 ดอกนายทุน/เดือน', baht(invMonth) + ' ฿'));
  rows.push(miniRow('📅 ดอกนายทุน/ปี', baht(invYear) + ' ฿'));

  var card = {
    type:'bubble', size:'mega',
    body:{ type:'box', layout:'vertical', paddingAll:'lg', spacing:'none', contents:[
      txt('📊 สรุปพอร์ตการลงทุน', 'lg', '#1A1A1A', 'bold'),
      { type:'box', layout:'vertical', height:'3px', backgroundColor:'#004D40', margin:'md', cornerRadius:'sm', contents:[] },
      { type:'box', layout:'vertical', margin:'md', spacing:'sm', contents: rows }
    ]},
    footer:{ type:'box', layout:'vertical', paddingAll:'md', contents:[{
      type:'button', style:'primary', color:'#004D40', height:'sm',
      action:{ type:'uri', label:'เปิดระบบ', uri: LINE.webUrl }
    }]}
  };
  pushFlex('สรุปพอร์ตประจำเดือน', card);

  // ส่งแจ้งเตือนสรุปพอร์ตเข้า Telegram ทุกต้นเดือน
  sendMonthlyTelegramSummary(count, principal, invMonth, invYear, dueInMonth);
}

function sendWeeklyTelegramAlert(nearDue, overdue, grace) {
  try {
    var todayStr = new Date().toLocaleDateString('th-TH', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    
    var msg = '📋 <b>[APHITHANASAP - แจ้งเตือนสถานะสัญญาประจำวันจันทร์]</b>\n' +
              '📅 ' + todayStr + '\n\n';
              
    if (overdue && overdue.length > 0) {
      msg += '🔴 <b>สัญญาที่เกินกำหนด/ค้างคา (' + overdue.length + ' แปลง):</b>\n';
      overdue.forEach(function(o, idx) {
        var invStr = o.a.investor ? (' (นายทุน: ' + o.a.investor + ')') : '';
        var dateStr = 'สัญญา: ' + fmtDate(o.a.start) + ' ถึง ' + fmtDate(o.a.end);
        msg += (idx + 1) + '. <b>' + o.a.name + '</b>' + invStr + '\n' +
               '   └ ' + dateStr + ' | ⚠️ เกินมา ' + o.days + ' วัน (เงินต้น: ' + baht(o.a.principal) + ' บ.)\n';
      });
      msg += '\n';
    }
    
    if (nearDue && nearDue.length > 0) {
      msg += '⏰ <b>สัญญาใกล้ครบกำหนด (' + nearDue.length + ' แปลง):</b>\n';
      nearDue.forEach(function(n, idx) {
        var invStr = n.a.investor ? (' (นายทุน: ' + n.a.investor + ')') : '';
        var dateStr = 'สัญญา: ' + fmtDate(n.a.start) + ' ถึง ' + fmtDate(n.a.end);
        msg += (idx + 1) + '. <b>' + n.a.name + '</b>' + invStr + '\n' +
               '   └ ' + dateStr + ' | ⏳ เหลืออีก ' + n.days + ' วัน (เงินต้น: ' + baht(n.a.principal) + ' บ.)\n';
      });
      msg += '\n';
    }
    
    if (grace && grace.length > 0) {
      msg += '⚠️ <b>อยู่ระหว่างผ่อนผัน (' + grace.length + ' แปลง):</b>\n';
      grace.forEach(function(g, idx) {
        var invStr = g.a.investor ? (' (นายทุน: ' + g.a.investor + ')') : '';
        var dateStr = 'สัญญา: ' + fmtDate(g.a.start) + ' ถึง ' + fmtDate(g.a.end);
        msg += (idx + 1) + '. <b>' + g.a.name + '</b>' + invStr + '\n' +
               '   └ ' + dateStr + ' | ทุนรับซื้อ: ' + baht(g.a.principal) + ' บ.\n';
      });
      msg += '\n';
    }
    
    if ((!overdue || !overdue.length) && (!nearDue || !nearDue.length) && (!grace || !grace.length)) {
      msg += '✅ สัปดาห์นี้ไม่มีสัญญาที่เกินกำหนดหรือใกล้ครบกำหนดครับ\n\n';
    }
    
    msg += '🌐 <a href="' + (LINE.webUrl || 'https://infinityrichglobal.github.io/APHITHANASAP/') + '">เปิดเข้าระบบจัดการทรัพย์สิน</a>';
    sendTelegram(msg);
  } catch (err) {
    console.error('sendWeeklyTelegramAlert error:', err);
  }
}

function sendMonthlyTelegramSummary(count, principal, invMonth, invYear, dueInMonth) {
  try {
    var monthStr = new Date().toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    var msg = '📊 <b>[APHITHANASAP - สรุปพอร์ตประจำเดือน]</b>\n' +
              '🗓️ <b>ประจำเดือน:</b> ' + monthStr + '\n\n' +
              '📌 <b>สถานะทรัพย์สินทั้งหมด:</b>\n' +
              '• ดำเนินการอยู่: ' + (count['ดำเนินการอยู่'] || 0) + ' แปลง\n' +
              '• ดำเนินการอยู่ (ต่อดอก): ' + (count['ดำเนินการอยู่ (ต่อดอก)'] || 0) + ' แปลง\n' +
              '• อยู่ระหว่างผ่อนผัน: ' + (count['อยู่ระหว่างผ่อนผัน'] || 0) + ' แปลง\n' +
              '• ไถ่ถอนแล้ว: ' + (count['ไถ่ถอนแล้ว'] || 0) + ' แปลง\n' +
              '• หลุดเป็นกรรมสิทธิ์: ' + (count['หลุดเป็นกรรมสิทธิ์'] || 0) + ' แปลง\n\n' +
              '💰 <b>สรุปยอดการเงินพอร์ต:</b>\n' +
              '• เงินต้นรวม: <b>' + baht(principal) + '</b> บาท\n' +
              '• ดอกเบี้ยนายทุน/เดือน: <b>' + baht(invMonth) + '</b> บาท\n' +
              '• ดอกเบี้ยนายทุน/ปี: <b>' + baht(invYear) + '</b> บาท\n\n';
              
    if (dueInMonth && dueInMonth.length > 0) {
      msg += '⏰ <b>แปลงที่ครบกำหนดในเดือนนี้ (' + dueInMonth.length + ' แปลง):</b>\n';
      dueInMonth.forEach(function(d, idx) {
        var invStr = d.investor ? (' (นายทุน: ' + d.investor + ')') : '';
        var dateStr = 'สัญญา: ' + fmtDate(d.start) + ' ถึง ' + fmtDate(d.end);
        msg += (idx + 1) + '. <b>' + d.name + '</b>' + invStr + '\n' +
               '   └ ' + dateStr + ' | เงินต้น: ' + baht(d.principal) + ' บ.\n';
      });
      msg += '\n';
    }
    
    msg += '🌐 <a href="' + (LINE.webUrl || 'https://infinityrichglobal.github.io/APHITHANASAP/') + '">เปิดเข้าระบบจัดการทรัพย์สิน</a>';
    sendTelegram(msg);
  } catch (err) {
    console.error('sendMonthlyTelegramSummary error:', err);
  }
}

function sectionHeader(label, color) {
  return { type: 'box', layout: 'vertical', margin: 'lg', contents: [
    txt(label, 'md', color, 'bold'),
    { type: 'separator', margin: 'sm', color: color }
  ]};
}

function itemRow(name, detail, color) {
  return { type: 'box', layout: 'horizontal', margin: 'sm', contents: [
    txt('• ' + name, 'sm', '#333333', null, 6),
    txt(detail, 'sm', color, 'bold', 4, 'end')
  ]};
}

function kvRow(k, v, color) {
  return { type: 'box', layout: 'horizontal', margin: 'md', contents: [
    txt(k, 'sm', '#666666', null, 5),
    txt(v, 'md', color, 'bold', 5, 'end')
  ]};
}

function pushFlex(altText, bubble) {
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + LINE.token },
    payload: JSON.stringify({
      to: LINE.groupId,
      messages: [{ type: 'flex', altText: altText, contents: bubble }]
    }),
    muteHttpExceptions: true
  });
  Logger.log('LINE: ' + res.getResponseCode() + ' ' + res.getContentText());
}


function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var fn = t.getHandlerFunction();
    if (fn === 'weeklyContractAlert' || fn === 'monthlySummary') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('weeklyContractAlert').timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  ScriptApp.newTrigger('monthlySummary').timeBased()
    .onMonthDay(1).atHour(9).create();
  Logger.log('ตั้ง trigger เรียบร้อย: จันทร์ 8 โมง + วันที่ 1 เก้าโมง');
}


// helper ส่ง push หลายข้อความ
function pushMessages(to, messages) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method:'post', contentType:'application/json',
    headers:{ 'Authorization':'Bearer ' + LINE.token },
    payload: JSON.stringify({ to: to, messages: messages.slice(0, 5) }),
    muteHttpExceptions: true
  });
}


// ============================================================
// 📋 สร้างชีต FlexJSON — ดึง JSON จริงของแต่ละ Flex ออกมา
//    รันครั้งเดียว → ได้ชีต "FlexJSON" (คอลัมน์ C คือ JSON เต็ม)
//    เอา JSON แต่ละแถวไปวางที่ https://developers.line.biz/flex-simulator/
//    เพื่อลองปรับดีไซน์เอง แล้วค่อยเอาโค้ดที่ปรับแล้วมาบอกให้แก้ในสคริปต์จริง
//    (ดึงค่าจริงจาก DATABASE มาสร้าง ไม่แก้ข้อมูลต้นทาง)
// ============================================================
function createFlexMockup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('FlexJSON');
  if (!sheet) sheet = ss.insertSheet('FlexJSON');
  sheet.clear();

  var out = [['Flex', 'altText', 'JSON (contents)']];

  function addRow(name, flexMsg) {
    if (!flexMsg) return;
    // ฟังก์ชัน Flex บางตัวคืนอ็อบเจ็กต์เดี่ยว {type:'flex',...} บางตัวคืน array ของแบบนั้น (หลายข้อความ)
    var arr = Array.isArray(flexMsg) ? flexMsg : [flexMsg];
    arr.forEach(function(m, idx) {
      if (!m || !m.contents) return;
      out.push([
        name + (arr.length > 1 ? ' #' + (idx + 1) : ''),
        m.altText || '',
        JSON.stringify(m.contents, null, 2)
      ]);
    });
  }

  var assets = readAssets();
  var a = assets[0];

  addRow('adminMenuFlex', adminMenuFlex());
  addRow('overviewFlex', overviewFlex());
  addRow('statusSummaryFlex', statusSummaryFlex());
  addRow('manualFlex', manualFlex());
  addRow('allPlotsCarousel', allPlotsCarousel());
  addRow('riskCarousel', riskCarousel());
  addRow('investorListFlex', investorListFlex());
  addRow('dueThisMonthFlex', dueThisMonthFlex());
  if (a) {
    addRow('plotBubble (ตัวอย่าง: ' + a.name + ')',
      { type:'flex', altText: a.name, contents: plotBubble(a, (STYLE[a.status]||{}).color || '#00838F') });
    addRow('plotAdvanceBubble (ตัวอย่าง: ' + a.name + ')', plotAdvanceBubble(a));
    if (a.investor) addRow('investorDetailFlex (ตัวอย่าง: ' + a.investor + ')', investorDetailFlex(a.investor));
  }

  sheet.getRange(1, 1, out.length, 3).setValues(out);
  sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#1A237E').setFontColor('#FFFFFF');
  sheet.setColumnWidth(1, 220); sheet.setColumnWidth(2, 260); sheet.setColumnWidth(3, 700);
  sheet.getRange(1, 1, out.length, 3).setWrap(false);
  sheet.setFrozenRows(1);
  Logger.log('✅ สร้างชีต FlexJSON แล้ว (' + (out.length - 1) + ' แถว) — copy JSON คอลัมน์ C ไปวางที่ Flex Message Simulator ได้เลย');
}