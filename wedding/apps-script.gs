/**
 * 청첩장 RSVP + 방명록 Apps Script
 *
 * 시트 컬럼 (A~F, 헤더 행 없어도 동작함):
 *   A 날짜(자동)  B 이름  C 참석여부  D 인원  E 메시지  F hide(선택, TRUE면 방명록에서 제외)
 *
 * 배포 방법:
 *   Apps Script 편집기에 이 파일 내용을 그대로 붙여넣기
 *   → 배포 관리 → 편집(연필 아이콘) → 버전: 새 버전 → 배포
 *   ⚠️ "새 배포"를 새로 만들면 URL이 바뀌어서 wedding/script.js의
 *      APPS_SCRIPT_URL이 깨짐. 반드시 기존 배포를 "편집"할 것.
 */

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  sheet.appendRow([
    new Date(),
    data.name,
    data.attendance,
    data.guests,
    data.message
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ result: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 방명록 조회 (JSONP). 참석자이면서 메시지가 있는 행만, 이름은 마스킹해서 반환.
 * 원본 이름·날짜·참석여부·인원은 응답에 절대 포함하지 않음.
 *
 * 사용: GET .../exec?callback=cb  →  cb({"result":"ok","items":[{"name":"홍*화","message":"..."}]})
 */
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var rows = sheet.getDataRange().getValues();

  var items = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var timestamp = row[0];
    if (!(timestamp instanceof Date)) continue; // 헤더 행 등 데이터가 아닌 행은 건너뜀

    var name = row[1];
    var attendance = row[2];
    var message = row[4];
    var hide = row[5];

    if (attendance !== '참석') continue;
    if (!message || String(message).trim() === '') continue;
    if (hide === true || String(hide).trim().toUpperCase() === 'TRUE') continue;

    items.push({
      name: maskName(name),
      message: String(message).trim()
    });
  }

  items.reverse(); // 최신순

  var payload = JSON.stringify({ result: 'ok', items: items });
  var callback = e.parameter.callback;

  if (callback && /^[\w$.]+$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + '(' + payload + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

/** 가운데 마스킹: 2자 "김*" / 3자 "홍*화" / 4자 이상 앞뒤 한 자만 남기고 전부 "*" */
function maskName(name) {
  name = String(name || '').trim();
  var len = name.length;
  if (len <= 1) return name;
  if (len === 2) return name.charAt(0) + '*';
  var stars = new Array(len - 1).join('*'); // len-2개
  return name.charAt(0) + stars + name.charAt(len - 1);
}
