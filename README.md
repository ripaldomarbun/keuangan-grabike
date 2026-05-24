# Grabike Batam — Catatan Keuangan Driver

Aplikasi web progresif pencatat keuangan harian untuk driver **Grabike** (ojek online) di Batam. Dirancang agar simpel, cepat, dan bisa dipakai offline di browser HP.

## Fitur

| Fitur | Keterangan |
|---|---|
| **Catat Pemasukan & Pengeluaran** | Form manual + dropdown kategori dinamis |
| **Catat Cepat (Satu Klik)** | 8 tombol quick action untuk transaksi rutin |
| **Ringkasan Saldo** | Uang bersih dibawa pulang, modal bensin, top-up kredit, biaya operasional |
| **Target Harian** | Progress bar target pendapatan bersih harian (default Rp150.000) |
| **Grafik Interaktif** | Tren arus kas 7 hari (line chart) + donut alokasi biaya |
| **Riwayat Transaksi** | Filter hari/minggu/bulan, pencarian teks, hapus transaksi |
| **Backup & Restore** | Export JSON/CSV, import JSON, hapus semua data |
| **Mode Tampilan** | Toggle preview mobile/desktop — cocok untuk development |
| **Penyimpanan Lokal** | Semua data tersimpan di localStorage browser |
| **Data Contoh** | Mock transaksi 6 hari terakhir untuk onboarding |

## Tech Stack

- **Vanilla JavaScript** (ES6+) — tanpa framework
- **CSS3** — Custom properties, glassmorphism, grid, responsive
- **HTML5** — Semantic markup, modal, form validation
- **Chart.js 4.x** — Visualisasi data keuangan (CDN)
- **localStorage** — Persistensi data offline

## Struktur File

```
keuangan-grab/
├── index.html          # Entry point & struktur UI
├── style.css           # Semua styling (dark theme, responsive)
├── store.js            # State management, CRUD, kalkulasi, backup
├── app.js              # Controller UI, event handlers, DOM manipulation
├── charts.js           # Inisialisasi & render Chart.js
└── README.md           # Dokumentasi proyek
```

## Arsitektur

Aplikasi mengikuti pola **Model-View-Controller** sederhana:

```
store.js         →  Model   (data + business logic)
index.html + CSS →  View    (struktur & styling)
app.js + charts  →  Controller (interaksi UI)
```

### Data Flow

1. User berinteraksi via form/button di `index.html`
2. `app.js` menangkap event → memanggil method di `store.js`
3. `store.js` memproses data → simpan ke localStorage → kembalikan summary
4. `app.js` memperbarui DOM (balance, target, riwayat)
5. `charts.js` membaca dari `store.js` → render ulang grafik

### Penyimpanan

| Key localStorage | Format | Deskripsi |
|---|---|---|
| `grabike_keuangan_transactions_simple` | `Transaction[]` | Array transaksi |
| `grabike_keuangan_settings_simple` | `Settings` | Konfigurasi driver & target |
| `grabike_view_mode` | `"mobile" | "desktop"` | Preferensi tampilan |

## Cara Pakai

1. Buka `index.html` di browser (desktop/HP)
2. Atur target harian via tombol ⚙️ **Target Harian**
3. Catat pendapatan bersih Grab atau pengeluaran via form atau quick-log
4. Pantau ringkasan, target, dan grafik di dashboard
5. Backup data via tombol 💾 **Backup Data**

## Pengembangan

### Menjalankan Lokal

Aplikasi murni client-side — cukup buka `index.html` di browser:

```bash
open index.html
# atau
npx serve .
```

### Menambahkan Kategori Baru

Edit `CATEGORIES` di `store.js:17-28`:

```js
pengeluaran: {
  bensin: { label: 'Bensin (Modal Awal)', icon: 'fuel', color: '#FF4D4D' },
  // tambah kategori baru di sini
}
```

### Menambahkan Quick Log

Tambah tombol di `index.html` dan handler di `app.js:283-356`.

## Spesifikasi Responsif

| Breakpoint | Target Device |
|---|---|
| > 900px | Desktop — grid 2 kolom |
| 768px–900px | Tablet kecil — 1 kolom, padding dikurangi |
| 600px–768px | HP landscape — font & spacing diperkecil |
| < 480px | HP portrait — layout sangat ringkas |

Tombol **Mobile/Desktop** di header untuk preview mode di layar lebar/kecil.

## Lisensi

Hak cipta © 2026 — Dibuat untuk pribadi driver Grabike Batam.
