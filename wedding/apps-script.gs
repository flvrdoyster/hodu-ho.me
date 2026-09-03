// 청첩장 RSVP 수집 + 방명록 조회
// 시트 A~F: 날짜 | 이름 | 참석여부 | 인원 | 메시지 | 비표시(TRUE면 방명록에서 제외)
// 배포: 배포 관리 → 편집(연필) → 버전은 반드시 "새 버전".
//       "새 배포"로 만들면 URL이 바뀌어 script.js의 APPS_SCRIPT_URL이 깨짐.

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

// 참석자 중 메시지가 있는 행만, 이름을 마스킹해서 반환.
// 원본 이름·날짜·참석여부·인원은 응답에 담지 않음.
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var rows = sheet.getDataRange().getValues();

  var items = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var attendance = String(row[2] || '').trim();
    var message = String(row[4] || '').trim();
    var hide = row[5];

    // A열 날짜 타입은 검사하지 않음 — getValues()가 주는 Date는 instanceof 판정이
    // 어긋날 때가 있음. 헤더("참석여부")·불참·빈 행은 아래 검사로 모두 걸러짐.
    if (attendance !== '참석') continue;
    if (!message) continue;
    if (hide === true || String(hide).trim().toUpperCase() === 'TRUE') continue;

    items.push({
      name: maskName(row[1]),
      message: message
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

// 배포 없이 doGet 응답 확인용. 웹앱은 doGet/doPost만 노출하므로 URL로는 접근 불가.
// Run은 저장된 코드로, URL은 배포된 버전으로 실행됨 — 고쳤으면 이걸로 먼저 확인.
function debugGuestbook() {
  Logger.log(doGet({ parameter: {} }).getContent());
}

// 가운데 마스킹: 2자 "김*" / 3자 "홍*화" / 4자 이상은 앞뒤 한 자만 남김
function maskName(name) {
  name = String(name || '').trim();
  var len = name.length;
  if (len <= 1) return name;
  if (len === 2) return name.charAt(0) + '*';
  var stars = new Array(len - 1).join('*');
  return name.charAt(0) + stars + name.charAt(len - 1);
}
