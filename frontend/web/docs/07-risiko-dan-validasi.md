# 07 — Risiko dan Validasi ARISTOTELES

> `[Terverifikasi]` bukti kode/uji 2026-11-24, `[Keputusan pengguna]` acuan K-01–K-08, `[Rekomendasi]` usulan. Cara cek untuk pemula. Backend: 241/241 tes hijau; frontend: `npm run check` 0/0.

## Keamanan — mitigasi terverifikasi [Terverifikasi]

- Sesi tidak bisa dipalsukan: `aristoteles-session` hanya cache; guard portal verifikasi ke `GET /auth/me` (peran dari server). Cek: isi `localStorage` peran admin → guard tetap menolak tanpa sesi server valid. Sisa risiko: token akses di memori (XSS) — mitigasi DOMPurify + CSP + HttpOnly belum dipakai (refresh token di storage, by design mobile).
- API proksi tugas fail-closed: tanpa token → 401; backend offline → 502 jujur. Cek: POST tanpa login. Tidak ada sukses palsu.
- Bayar tidak bisa bypass: tidak ada `purchaseCourse` lokal; akses dari `GET /courses/:id/access` server. Cek: `owned-courses` manual → guard server tetap menolak tanpa enrollment/grant.
- XSS `{@html}`: sanitasi via `sanitizeTiptapHtml` (DOMPurify, allowlist ketat incl. `srcset` khusus berkas sendiri) + CSP `hooks.server.ts` (ditegakkan di produksi, Report-Only di dev). Cek: sisipkan `onerror`/`javascript:` di materi → dibuang.

## Risiko tersisa (jujur, bukan bug tersembunyi)

- Rate-limit backend in-memory per instance — multi-instance butuh Redis (`rate-limit.middleware.ts` mencatat ini).
- Transfer dana payout manual di luar sistem (by design; admin tandai-ditransfer beralasan + audit).
- Push FCM belum ada (polling 60 dtk + lencana lokal sebagai pengganti; butuh project Firebase).
- DOKU live menunggu API spec Fase 1b (transport `503 DOKU_NOT_WIRED` sengaja; tanpa QR palsu).
- Cache bell 45–60 dtk: basi sesaat; invalidasi per mutasi + clear saat logout/401.

## Skenario uji K-01–K-08 [Terverifikasi — semua lolos di backend]

- Kuis beda nilai: 60→80 lulus pakai 80; 90→50 tetap lulus (server `MAX` + lulus-menempel). Uji: `quiz.test.ts` 11/11.
- Voucher akun/kursus salah, sudah dipakai, dinonaktifkan, 5 request bersamaan → semua tolak, tepat 2 sukses pada `maxUses=2`. Uji: konkurensi 5 paralel.
- Sertifikat 1 syarat kurang → 403 `NOT_ELIGIBLE` + `failReasons`; lengkap → `certificateIssued:true`; unduh PDF; revoke → 409 terbit ulang.
- Resubmit tugas sampai lulus → boleh tanpa batas; rubrik rata-rata server.
- Refresh/navigasi → progres bertahan (persist server + re-sync).
- Ubah ringan → tanpa ulang; ubah penting → 409 + ulang terdampak saja + riwayat tercatat.
- K-04 Berikutnya = selesai materi biasa, tidak meluluskan kuis/tugas. Uji: alur peserta.
- K-07 mulai modul mana saja (server tanpa kunci antar-modul; aplikasi kunci dalam sub-modul).
