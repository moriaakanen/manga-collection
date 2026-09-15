/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: MangaVault Reading Tracker Webhook
 * =========================================================================
 * 
 * Script ini berfungsi menerima pembaruan status baca, volume yang dibaca,
 * rating, dan review dari website MangaVault dan langsung mengupdate baris
 * komik yang sesuai di Google Spreadsheet Anda.
 * 
 * CARA PEMASANGAN (Hanya 1 Menit):
 * 1. Buka spreadsheet koleksi komik Anda di browser:
 *    https://docs.google.com/spreadsheets/d/1Xew5o7ULMmckqOhxIlBQJ1dqHGbREYCGxv47hvkFPS8/edit
 * 2. Pastikan baris Header (Baris ke-1) memiliki kolom:
 *    - Kolom O (Kolom ke-15): "Status Baca"
 *    - Kolom P (Kolom ke-16): "Volume Terakhir Dibaca"
 *    - Kolom Q (Kolom ke-17): "Rating"
 *    - Kolom R (Kolom ke-18): "Review Baca"
 * 3. Klik menu "Extensions" > "Apps Script".
 * 4. Hapus kode default yang ada, lalu salin dan tempel (paste) seluruh kode di bawah ini.
 * 5. Klik "Save" (ikon disket).
 * 6. Klik tombol biru "Deploy" > "New deployment".
 * 7. Pada ikon gerigi (Select type), pilih "Web app".
 * 8. Isi konfigurasi:
 *    - Description: "MangaVault Tracker Sync"
 *    - Execute as: "Me" (email Anda)
 *    - Who has access: "Anyone" (PENTING: agar website bisa mengirim data tanpa login)
 * 9. Klik "Deploy", lalu izinkan akses (Authorize Access) akun Google Anda.
 * 10. Salin "Web app URL" yang muncul (berakhiran /exec) dan masukkan ke menu Settings di website MangaVault!
 * =========================================================================
 */

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    
    // Parameter yang diterima dari MangaVault:
    // { no: 1, judul: "Fist of the North Star", statusBaca: "Sedang Dibaca", volDibaca: 8, rating: 9, review: "Keren!" }
    const targetNo = parseInt(data.no);
    const targetTitle = String(data.judul || '').trim().toLowerCase();
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return responseJSON({ success: false, message: 'Spreadsheet kosong' });
    }
    
    // Ambil kolom A (No) dan B (Judul) untuk pencarian baris yang tepat
    const rangeData = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    let foundRow = -1;
    
    for (let i = 0; i < rangeData.length; i++) {
      const rowNo = parseInt(rangeData[i][0]);
      const rowTitle = String(rangeData[i][1] || '').trim().toLowerCase();
      
      if (rowNo === targetNo || (targetTitle && rowTitle === targetTitle)) {
        foundRow = i + 2; // offset header (baris ke-2 dst)
        break;
      }
    }
    
    if (foundRow === -1) {
      return responseJSON({ success: false, message: 'Judul komik tidak ditemukan di sheet' });
    }
    
    // Tulis data ke kolom O, P, Q, R (Kolom ke-15, 16, 17, 18)
    // Kolom 15: Status Baca
    if (data.statusBaca !== undefined) {
      sheet.getRange(foundRow, 15).setValue(data.statusBaca);
    }
    // Kolom 16: Volume Terakhir Dibaca
    if (data.volDibaca !== undefined) {
      sheet.getRange(foundRow, 16).setValue(data.volDibaca);
    }
    // Kolom 17: Rating
    if (data.rating !== undefined) {
      sheet.getRange(foundRow, 17).setValue(data.rating);
    }
    // Kolom 18: Review Baca
    if (data.review !== undefined) {
      sheet.getRange(foundRow, 18).setValue(data.review);
    }
    
    return responseJSON({
      success: true,
      message: 'Berhasil mengupdate baris ' + foundRow,
      row: foundRow,
      updated: data
    });
    
  } catch (error) {
    return responseJSON({ success: false, error: error.toString() });
  }
}

function doGet(e) {
  return responseJSON({ status: 'MangaVault Webhook is Active!' });
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
