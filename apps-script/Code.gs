const SHEET_NAME = 'Transactions';
const SHEET_HEADERS = ['date', 'type', 'cat', 'desc', 'amt', 'ts', 'cancelledAt', 'cancelReason'];
const SESSION_TTL_SECONDS = 21600;
const SESSION_PREFIX = 'session:';

const ALLOWED_CATEGORIES = {
  income: ['เงินสด', 'เงินโอน'],
  expense: ['พนักงาน', 'ตลาด', 'ค่าเครื่องดื่ม', 'อื่นๆ']
};

function doGet() {
  return jsonResponse({
    ok: true,
    service: 'Suannaree API'
  });
}

function doPost(e) {
  try {
    const request = parseRequest(e);

    switch (request.action) {
      case 'login':
        return login(request.password);
      case 'validateSession':
        requireSession(request.token);
        return jsonResponse({ ok: true });
      case 'logout':
        logout(request.token);
        return jsonResponse({ ok: true });
      case 'list':
        requireSession(request.token);
        return jsonResponse({ ok: true, data: listTransactions() });
      case 'create':
        requireSession(request.token);
        return createTransaction(request);
      case 'cancel':
        requireSession(request.token);
        return cancelTransaction(request.ts, request.reason);
      default:
        throw new Error('ไม่รู้จักคำสั่งที่ร้องขอ');
    }
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: error.message || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์' });
  }
}

function parseRequest(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('ไม่พบข้อมูลคำขอ');
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error('รูปแบบข้อมูลคำขอไม่ถูกต้อง');
  }
}

function login(password) {
  const expectedPassword = PropertiesService.getScriptProperties().getProperty('APP_PASSWORD');
  if (!expectedPassword) {
    throw new Error('เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า APP_PASSWORD');
  }
  if (typeof password !== 'string' || password !== expectedPassword) {
    throw new Error('รหัสผ่านไม่ถูกต้อง');
  }

  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put(SESSION_PREFIX + token, '1', SESSION_TTL_SECONDS);
  return jsonResponse({ ok: true, token: token, expiresIn: SESSION_TTL_SECONDS });
}

function requireSession(token) {
  if (typeof token !== 'string' || !token) {
    throw new Error('ไม่ได้รับอนุญาต: ไม่พบเซสชัน');
  }

  const cache = CacheService.getScriptCache();
  const key = SESSION_PREFIX + token;
  if (cache.get(key) !== '1') {
    throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  }

  cache.put(key, '1', SESSION_TTL_SECONDS);
}

function logout(token) {
  if (typeof token === 'string' && token) {
    CacheService.getScriptCache().remove(SESSION_PREFIX + token);
  }
}

function listTransactions() {
  const sheet = getTransactionSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet.getRange(2, 1, lastRow - 1, SHEET_HEADERS.length).getValues().map(function (row) {
    return {
      date: normalizeSheetDate(row[0]),
      type: String(row[1] || ''),
      cat: String(row[2] || ''),
      desc: String(row[3] || ''),
      amt: Number(row[4]) || 0,
      ts: Number(row[5]) || 0,
      cancelledAt: normalizeDateTime(row[6]),
      cancelReason: String(row[7] || '')
    };
  });
}

function createTransaction(request) {
  const transaction = validateTransaction(request);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    getTransactionSheet().appendRow([
      transaction.date,
      transaction.type,
      transaction.cat,
      transaction.desc,
      transaction.amt,
      transaction.ts,
      '',
      ''
    ]);
  } finally {
    lock.releaseLock();
  }

  return jsonResponse({ ok: true });
}

function cancelTransaction(timestamp, reason) {
  const targetTimestamp = Number(timestamp);
  const cancelReason = String(reason || '').trim();
  if (!Number.isFinite(targetTimestamp) || targetTimestamp <= 0) {
    throw new Error('รหัสรายการไม่ถูกต้อง');
  }
  if (!cancelReason) throw new Error('กรุณาระบุเหตุผลที่ยกเลิกรายการ');
  if (cancelReason.length > 500) throw new Error('เหตุผลที่ยกเลิกต้องไม่เกิน 500 ตัวอักษร');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getTransactionSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) throw new Error('ไม่พบรายการที่ต้องการยกเลิก');

    const rows = sheet.getRange(2, 1, lastRow - 1, SHEET_HEADERS.length).getValues();
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (Number(rows[index][5]) === targetTimestamp) {
        if (rows[index][6]) throw new Error('รายการนี้ถูกยกเลิกแล้ว');
        sheet.getRange(index + 2, 7, 1, 2).setValues([[new Date(), cancelReason]]);
        return jsonResponse({ ok: true });
      }
    }
  } finally {
    lock.releaseLock();
  }

  throw new Error('ไม่พบรายการที่ต้องการยกเลิก');
}

function validateTransaction(request) {
  const date = String(request.date || '');
  const type = String(request.type || '');
  const category = String(request.cat || '');
  const description = String(request.desc || '').trim();
  const amount = Number(request.amt);
  const timestamp = Number(request.ts);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('วันที่ไม่ถูกต้อง');
  if (!ALLOWED_CATEGORIES[type]) throw new Error('ประเภทรายการไม่ถูกต้อง');
  if (ALLOWED_CATEGORIES[type].indexOf(category) === -1) throw new Error('หมวดหมู่ไม่ถูกต้อง');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('จำนวนเงินต้องมากกว่า 0');
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error('รหัสรายการไม่ถูกต้อง');
  if (description.length > 500) throw new Error('รายละเอียดต้องไม่เกิน 500 ตัวอักษร');

  return {
    date: date,
    type: type,
    cat: category,
    desc: description,
    amt: amount,
    ts: timestamp
  };
}

function getTransactionSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('ไม่พบ Google Sheet ที่ผูกกับ Apps Script');
  }

  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
    sheet.setFrozenRows(1);
  } else {
    const currentHeaders = sheet.getRange(1, 1, 1, SHEET_HEADERS.length).getValues()[0];
    SHEET_HEADERS.forEach(function (header, index) {
      if (!currentHeaders[index]) sheet.getRange(1, index + 1).setValue(header);
    });
  }
  return sheet;
}

function normalizeSheetDate(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value || '');
}

function normalizeDateTime(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  return String(value || '');
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
