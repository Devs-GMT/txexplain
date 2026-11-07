# TxExplain: catatan untuk report

Catatan kerja, bukan README. Diisi tiap fase. Hanya hal yang benar-benar terjadi.

## Keputusan

| Hal | Keputusan | Alasan |
|---|---|---|
| Deploy | Vercel (situs dan API) | Brief terbaru; PRD menyebut GitHub Pages |
| Backend | Vercel Functions `/api/sig`, `/api/explain`, bukan Cloudflare Worker | Satu deploy, key Groq di env var Vercel |
| AI | Groq, model `openai/gpt-oss-120b` (env `GROQ_MODEL`) | Tersedia di key; belum dibandingkan dengan model lain |
| Konflik skill vs giga.ai | giga.ai menang (eyebrow, label kapital, daftar titik tengah dipakai) | Arahan pemilik proyek |
| Contoh transfer token | USDT testnet dari faucet BOT Chain, bukan token buatan sendiri | Saran senior; tidak perlu kontrak tambahan |
| Chip "a successful vote" | Tetap di PRD, tapi contoh sukses kita `addNote` (tidak ada kontrak polling) | Diteruskan ke PM; sementara ditulis "A successful transaction" |
| Mainnet | Terakhir, setelah seluruh flow beres dan BOT asli diminta ke Kak Venita | Catatan tim |
| Logo TxExplain | Buat sendiri (SVG), tanpa aset Giga | Arahan pemilik proyek |
| Logo BOT Chain | Resmi, diunduh dari botchain.ai (`logo.png`, `icons/footer-logo.png`) ke `public/brand/`, tidak diubah | Logo mitra tidak boleh digambar ulang. Wordmark-nya putih, jadi hanya terbaca di latar gelap (footer) |
| Link footer | Disesuaikan dengan isi proyek, bukan salinan footer Giga. Kolom: Product, Resources, Project. Privacy, Terms, About dihilangkan karena halamannya tidak ada | Arahan pemilik proyek |
| Akun X | https://x.com/botprojectgf, dipasang di kolom Project footer. Post demo tetap menandai @BOTChain_ai sesuai PRD | Akun disediakan pemilik proyek |
| Repo GitHub | Belum ada. Link "GitHub" dan "Docs" (README repo TxExplain) sementara menunjuk ke section "How it works", diganti di satu tempat saat repo dibuat | Repo juga dibutuhkan untuk impor ke Vercel |
| Footer sebelum mainnet | Menampilkan kontrak testnet 968 dengan label "Testnet" | Tidak mengklaim mainnet sebelum ada |
| Section stat besar | Tidak dirender sampai ada data nyata dari mainnet, jadi website awalnya 6 section terlihat | PRD sendiri menyuruh menyembunyikannya |
| "Find the reason" | Replay `eth_call` dijalankan otomatis untuk tx gagal, bukan lewat tombol | Lebih cepat bagi pengguna; hasilnya sama dengan PRD |
| Halaman "Common errors" | Satu section di `/app` berisi tabel kode Panic dan penyebab umum, karena footer PRD menyebutnya | Tidak ada halaman terpisah |

## Fase 2 dan 3: hasil

- `DebugNotes.sol` (testnet 968): `0xFa7b17eB7989DbF7A2D90a583A25d5Ad9e764b7d`. 9 tes kontrak.
- Tx contoh di testnet: sukses, out of gas, custom error `AuthorCannotVote`, transfer 10 USDT, transfer 0,001 BOT.
- Logic: fetch, decode (ABI pengguna, ABI bawaan, 4byte), revert reason (Error, Panic, custom, replay `eth_call`), fix checklist, notes dan 👍.
- API: `/api/sig` (4byte, oldest-first), `/api/explain` (Groq + pemeriksa fakta).
- Tes: 36 tes decode/API/klien, ditambah 9 tes kontrak.

## Bug yang ditemukan lewat pengujian

1. Tx pembuatan kontrak dibaca sebagai pemanggilan fungsi (selector `0x60806040`) dan memicu lookup 4byte sia-sia. Ditemukan tes `contract creation`.
2. `getNotes` tidak mengembalikan id, jadi 👍 tidak mungkin dibuat di UI. Ditambah `getNoteIds`, kontrak di-deploy ulang.
3. Field `at` pada hasil ethers bertabrakan dengan `Array.prototype.at` (waktu note `NaN`). Dibaca secara posisi.
4. Pesan 👍 ganda berbunyi "unknown custom error". Sekarang memetakan semua custom error kontrak ke pesan manusia.
5. Fix checklist untuk `AuthorCannotVote` menyarankan hal yang salah. Diperbaiki dengan aturan sendiri.
6. Tes pertama saya berisi assertion yang selalu lolos (tautologis). Diganti dengan pengecekan nyata.

## Verifikasi AI

- Ringkasan AI hanya menerima fakta hasil decode. Alamat dan angka (di atas 10) di jawaban harus ada di fakta.
- Masalah: pembulatan yang jujur ("0.001" untuk 0.00104304) bisa ditolak, dan ringkasan hilang.
- Solusi yang diterapkan: toleransi pembulatan untuk desimal (bilangan bulat tetap harus persis), retry satu kali dengan alasan penolakan, dan ringkasan cadangan dari template tanpa AI. `summarize()` selalu mengembalikan ringkasan dan melabeli sumbernya (`ai` atau `template`).

## Batasan yang diketahui

- Replay revert memakai state di block sebelum tx, bukan urutan di dalam block; RPC non-archive bisa gagal untuk tx lama.
- Out of gas dikenali dari `gasUsed == gasLimit`; tx yang revert dan kebetulan memakai seluruh gas bisa salah terbaca.
- Hasil 4byte adalah tebakan (selector bisa bentrok) dan akan dilabeli begitu.
- Rate limit per instance serverless, bukan batas keras.
- Alur MetaMask asli belum diuji; yang teruji adalah `window.ethereum` tiruan dengan wallet nyata di testnet.
- Testnet `rpc.bohr.life` tidak bisa dijangkau dari jaringan penulis tanpa VPN tingkat sistem.

## Insiden

- Key Groq sempat ditempel di chat. Disarankan diganti; key baru disimpan di `.dev.vars` (gitignored), tidak pernah di repo.
- Saat mengisi `.env`, `DEPLOYER_PRIVATE_KEY` pertama berisi alamat wallet (42 karakter), bukan private key. Ketahuan dari error Hardhat dan diperbaiki pemilik.

## Pertanyaan terbuka untuk PM

- Contoh "successful vote": perlu kontrak polling, atau cukup `addNote`?
- URL repo GitHub TxExplain belum ada (dibutuhkan untuk link footer dan impor Vercel).

## Fase 4: progres

- Dependensi: Vite, GSAP 3.15 (ScrambleText, SplitText, TextPlugin, ScrollTrigger sudah termasuk), Prism.
- Token warna dan font diisi dari PRD, palet dikonversi ke OKLCH (nilai visual sama).
- Skill Hallmark dipakai di jalur custom. Untuk bagian yang bertentangan dengan giga.ai (eyebrow, label kapital), giga.ai dan PRD yang menang, dan akan dicatat sebagai waiver di stamp CSS.

### 4a: halaman app (`/app`, `/tx/:hash`), selesai dan diuji

- Dibangun: input hash, chip contoh testnet, panel Add ABI (tempel atau seret artifact), tabel Common errors, tahap Explaining, ringkasan yang diketik, fungsi dan input, uang yang berpindah, event, gas dan biaya, timeline, tab Raw (Prism), debug notes dengan 👍 (ikon SVG, label "This fix worked"), tombol Share, footer yang membaca kontrak.
- Semua teks dari chain (isi note, pesan revert, field event) di-escape lewat `html` bertag. Diuji di browser: `<img onerror>` tampil sebagai teks dan tidak dieksekusi.
- Diuji di Chrome sungguhan terhadap testnet: hash tidak valid, hash tidak ditemukan, tab Raw, tombol back, tx sukses, tx gagal, transfer USDT, tampilan mobile 390px. Tidak ada error konsol selain `/api/explain` 404 di Vite dev, yang memang tidak punya API (ringkasan jatuh ke template).
- Belum diuji: MetaMask sungguhan di browser, tx pending dengan auto-refresh, API Vercel di production.
- Dua kerapian dari hasil tangkapan layar: baris hash di kartu status, jarak judul kartu status.
- Perintah yang sempat ditolak pemilik proyek (tambah CSS, buat skrip uji, jalankan) dijelaskan ulang, lalu dijalankan setelah disetujui.
- Skrip pembantu `scripts/screenshot.mjs` (tangkapan layar + error konsol) disimpan; skrip uji sementara dihapus.

### 4b dan 4c: website (`/`) dengan animasi, selesai dan dicek di Chrome (1280px dan 390px)

- Arah gaya: meniru mekanisme interaksi giga.ai, bukan teks atau mereknya. Semua kalimat ditulis sendiri.
- Dibangun: pita marquee berjalan (berhenti saat di-hover), hero dengan judul diketik dan kursor `_` berkedip, widget demo dengan switch Failed/Success/Transfer (tab aktif menyala, stopwatch, ✗ bergetar, berganti otomatis sampai pengguna mengklik), input hash dengan chip contoh, strip hex ke English (ScrambleText, tab Transfer/Failed/Call), empat kartu, cerita gagal-sampai-fix yang main baris demi baris, diagram "How it works" (empat sumber mengalir ke satu node), kartu kepercayaan dengan tooltip, CTA penutup, footer.
- Semua isi demo berasal dari tx contoh di testnet dan berlabel "Example". Hex di strip dihitung dari data nyata (10 USDT = 0x989680, selector 0xa169ce09 milik boom(), data revert Error(string)). Stopwatch hanya menghitung lama animasi ketik, bukan klaim kecepatan.
- Angka besar (statistik mainnet) sengaja tidak dibuat sampai ada data mainnet asli.
- Perubahan di app atas masukan pemilik proyek: garis warna 2px di atas kartu dihapus, titik tengah diganti koma atau kurung, marquee menggantikan bar pengumuman.
- Aksesibilitas dan gerak: tablist dengan panah kiri/kanan, konten terlihat tanpa JS (kecuali nav dan footer, yang dipasang JS seperti di app), `prefers-reduced-motion` mematikan semua animasi, reveal hanya menyembunyikan blok di bawah layar setelah JS jalan.
- sloplint (hallmark): dijalankan tanpa `--render`. Sisa temuan: tidak ada stempel Hallmark di baris pertama CSS (proyek ini memakai PRD, bukan tema Hallmark), `:focus-visible` dan `:active` dilaporkan hilang hanya karena gaya itu ada di components.css, bukan site.css. Tooltip tersembunyi sekarang hanya di bawah kelas `.js`.
- Belum: tes di perangkat sentuh sungguhan, `sloplint --render`, pengecekan Lighthouse.

## Daftar deliverable

- [x] Kontrak DebugNotes + tes (testnet)
- [x] Logic app + API
- [x] App UI `/app` dan `/tx/:hash` (4a)
- [x] Website 7 section, hero widget, animasi GSAP, responsive (4b dan 4c)
- [ ] Footer, README, deploy Vercel (Fase 5)
- [ ] Mainnet deploy, alamat di README dan footer
- [ ] Akun X, 4 postingan, video demo 90 detik
