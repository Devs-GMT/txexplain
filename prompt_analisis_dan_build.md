# Prompt TxExplain: analisis referensi Giga, lalu build

Cara pakai:
- Tahap A (analisis): upload `giga_reference_full.md` ke Claude chat, lalu tempel Prompt A.
- Tahap B (build): taruh `giga_reference_full.md` dan `project_context_full.txt` di folder repo, buka Claude Code, lalu tempel Prompt B.

---

## PROMPT A - Analisis referensi (Claude chat)

```
Lampiran: giga_reference_full.md. Isinya teks halaman giga.ai yang sudah lengkap
dan berurutan (announcement bar, navbar, hero, industries, dua scrollytelling,
customer story, CTA, compliance, footer). Saya memakai halaman ini sebagai
referensi UI untuk proyek saya sendiri. Brand Giga tidak akan ditiru.

Analisis dari 3 aspek. Jawab dalam bahasa Indonesia, istilah teknis boleh tetap
dalam bahasa Inggris. Dasarkan semua poin pada teks lampiran dan kutip frasa
aslinya sebagai bukti. Kalau suatu hal tidak bisa disimpulkan dari teks,
tulis "tidak terlihat dari data".

1. COPYWRITING
   a. Gaya bahasa: nada, panjang kalimat, kata kerja dominan, penggunaan
      angka, dan cara mereka bicara soal masalah vs hasil.
   b. Struktur kalimat per tipe elemen: H1, sub-headline, label eyebrow,
      deskripsi kartu, kutipan testimoni, microcopy.
   c. CTA: daftar semua CTA, polanya (kata kerja + objek?), letak, dan
      bagaimana CTA email-gate dibingkai ("Open your page", "Build my page",
      "Show me").
   d. Rumusan: buat 5-7 formula penulisan yang bisa dipakai ulang dengan
      template berisi slot, contoh:
      H1 = [pernyataan 2-4 kata, kalimat pendek, ditutup titik].
      Setiap formula diberi 1 contoh asli dari Giga.

2. UI/UX
   a. Hirarki informasi dari atas ke bawah: urutan section dan tujuan tiap
      section di funnel (awareness, bukti, edukasi, konversi).
   b. Tata letak ideal tiap section (grid, sticky, scrollytelling, tab, kartu)
      dan alasannya.
   c. Pola interaksi: demo widget di hero, gate email, scroll-driven stages,
      stat besar, kartu compliance.
   d. Rekomendasi jika saya membuat desain serupa untuk produk developer
      tool (TxExplain: paste hash transaksi, dapat penjelasan bahasa manusia).
      Format tabel: Elemen Giga | Fungsi | Padanan di TxExplain.

3. KETERBATASAN
   Sebutkan apa yang tidak bisa dianalisis dari teks saja (warna, spacing,
   timing animasi) dan apa yang perlu saya cek langsung di browser.
```

---

## PROMPT B - Build di Claude Code

```
Baca dulu dua file ini sampai selesai sebelum menulis kode:
1. project_context_full.txt  -> konteks kerja, PRD TxExplain (MVP), guidebook BOT Chain
2. giga_reference_full.md    -> referensi UI (struktur & copy giga.ai)

Aturan utama:
- Sumber kebenaran fitur, kontrak, alur, state, dan checklist adalah PRD di
  project_context_full.txt. Giga hanya dipakai untuk struktur halaman, hirarki,
  pola interaksi, dan gaya copy. Jangan menyalin teks, logo, atau brand Giga.
- Warna, font, dan tombol mengikuti section 8 PRD (graphite + amber #FF8A1F,
  Satoshi / Inter / JetBrains Mono, pill buttons).
- Jaringan: BOT Chain mainnet chain ID 677 (rpc.botchain.ai), testnet 968
  (rpc.bohr.life). Alamat kontrak ditaruh di satu konstanta config.
- Jangan pernah commit API key atau private key. Pakai env var.

Urutan kerja (berhenti dan minta konfirmasi di akhir tiap fase):
FASE 0. Ringkas pemahamanmu dalam 10 baris, daftar asumsi, dan hal yang
        belum jelas. Jangan menulis kode dulu.
FASE 1. Petakan 7 section website PRD ke struktur Giga (tabel: section PRD |
        padanan Giga | catatan copy). Tulis copy final tiap section dengan
        formula copywriting dari Giga (kalimat pendek, kata kerja kuat, CTA
        "kata kerja + objek").
FASE 2. Contract DebugNotes.sol (Solidity ^0.8.20, evmVersion paris) +
        skrip deploy testnet 968, lalu uji. Mainnet menyusul setelah saya
        dapat BOT untuk gas dari grup.
FASE 3. App: fetch + decode + revert reason + fix checklist + notes (PRD
        bagian 2, 3, 11), lalu Worker /sig dan /tx/explain.
FASE 4. Website 7 section + hero demo widget + animasi GSAP (PRD bagian 9,
        hormati prefers-reduced-motion), responsive.
FASE 5. Footer kreatif (PRD bagian 13), README, deploy ke Vercel.

Setiap fase: tampilkan daftar file yang diubah, cara menjalankan/menguji, dan
centang item "Must-haves" PRD yang sudah selesai.
```

---

## Catatan
- Deploy memakai Vercel (sesuai arahan tim). PRD menyebut GitHub Pages, jadi
  konfirmasi dulu ke tim apakah Vercel menggantikannya. Pada Vercel, aturan
  redirect `/tx/:hash` dibuat lewat `vercel.json` rewrites, bukan 404 redirect.
- Gas mainnet: minta BOT ke grup memakai alamat wallet MetaMask Anda sebelum Fase 2 mainnet.
- Deliverable lain: akun X, 4 postingan, video demo 90 detik (demo: failed tx -> reason -> fix -> note).
