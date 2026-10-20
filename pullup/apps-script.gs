function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  sheet.appendRow([
    data.date,
    data.setNumber,
    data.reps,
    data.romReps,
    data.black,
    data.green,
    data.restSeconds,
    data.note || '',
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ result: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function debugAppend() {
  doPost({
    postData: {
      contents: JSON.stringify({
        date: '2026-09-07',
        setNumber: 1,
        reps: 9,
        romReps: 8,
        black: 2,
        green: 1,
        restSeconds: 150,
        note: 'test',
      }),
    },
  });
}
