# Modul `payments` — BELUM DIIMPLEMENTASIKAN

Direktori ini sengaja dipertahankan sebagai penanda keputusan yang belum diambil.

- Gateway pembayaran **belum diputuskan** (opsi: Midtrans/Xendit/Duitku/manual).
- Sampai diputuskan: **jangan** membuat file di sini dan jangan me-mount rute
  payments di `src/app.ts`.
- Alur terkait yang masih simulasi lokal: `frontend/src/routes/user/pembayaran/[courseId]/+page.svelte`
  (`purchaseCourse`, `saveReceipt`, kwitansi `window.print()`).
- Akses kursus resmi tetap lewat enrollment/voucher/hibah (lihat modul
  `enrollments/`, `vouchers/` dan `backend/docs/API_CONTRACT.md` §5, §10).
