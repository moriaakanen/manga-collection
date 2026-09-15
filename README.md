# MangaVault 📚

Website katalog dan arsip koleksi komik/manga pribadi modern, estetik, dan responsif dengan fitur live synchronization dari Google Spreadsheet dan cover otomatis (hybrid via MyAnimeList / Jikan API).

![Preview Banner](https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1200&auto=format&fit=crop&q=80)

## ✨ Fitur Utama

- 🔄 **Live Sync dengan Google Sheets**: Data komik disinkronkan langsung dari Google Spreadsheet publik melalui endpoint CSV/gviz. Ada tombol manual sync untuk memuat perubahan seketika.
- 🖼️ **Sistem Sampul Cerdas (Hybrid Cover)**:
  - Otomatis mengambil cover beresolusi tinggi dari MyAnimeList (Jikan API).
  - Dilengkapi *client-side caching* (localStorage) agar pembukaan berikutnya instan.
  - Memiliki *fallback stylized cover* berdesain buku elegan jika cover belum ditemukan.
  - *Lazy-loading with IntersectionObserver* untuk performa super mulus (60fps).
- 📊 **Dashboard Statistik Koleksi**:
  - Total judul komik dalam arsip.
  - Total volume fisik yang dimiliki.
  - Jumlah & persentase komik yang sudah komplit.
  - Tracking komik bolong-bolong dan antrean beli ("Nanti dulu deh").
- 🔍 **Filter & Live Search Super Cepat**:
  - Pencarian instan (judul, pengarang, penerbit, catatan).
  - Filter Status Koleksi: *Semua, Komplit, Bolong-bolong, Nanti Dulu*.
  - Filter Penerbit: *Elex Media, Akasha, M&C!, Level Comics, GPU, Nalar*, dll.
  - Filter Jenis: *Series, One Shot, Novel/Light Novel*.
  - Multi-sorting: Nomor urut, Judul (A-Z), Volume terbanyak/tersedikit.
- 🎛️ **Dual View**:
  - **Grid View**: Tampilan kartu manga visual dengan efek hover dan indikator progres volume.
  - **Table View**: Tampilan tabel ringkas dan terperinci untuk inspeksi cepat.
- 📖 **Detail Modal Interaktif**:
  - Rincian volume yang dimiliki vs total volume terbit di Indonesia.
  - Catatan kondisi komik (misal: "vol 11 jelek", "volume dobel", dll.).
  - Tautan pencarian langsung ke MyAnimeList dan Google.

---

## 🚀 Cara Menjalankan Secara Lokal

Website ini dibangun menggunakan **Modern Vanilla Web Technologies (HTML5, CSS3, JavaScript ES6+)**, sehingga tidak memerlukan instalasi dependensi `node_modules` yang berat.

1. Buka file `index.html` langsung di browser Anda (klik ganda `index.html`), ATAU
2. Gunakan web server lokal (misalnya dengan VS Code Live Server atau perintah python/node):
   ```bash
   # Menggunakan Python
   python -m http.server 3000

   # Menggunakan Node.js
   npx serve .
   ```
3. Buka browser di `http://localhost:3000`.

---

## 🌐 Cara Deploy ke GitHub Pages (Gratis)

1. Pastikan repository sudah di-push ke GitHub.
2. Masuk ke halaman repository Anda di GitHub: `https://github.com/moriaakanen/manga-collection`.
3. Klik tab **Settings** > **Pages**.
4. Di bagian **Build and deployment** > **Branch**, pilih branch `main` dan folder `/ (root)`.
5. Klik **Save**. Dalam hitungan menit, website Anda sudah aktif dan online di `https://moriaakanen.github.io/manga-collection/`!

---

## 📄 Struktur File
```
manga-collection/
├── index.html       # Struktur markup halaman katalog & modal
├── style.css        # Desain Dark-Mode modern, animasi, responsif
├── app.js           # Logika fetch API, CSV parser, cache, filter & search
├── data.js          # Snapshot data komik awal (800+ judul)
├── README.md        # Dokumentasi lengkap
└── .gitignore       # Pengabaian file sementara
```
