# Kontrak API Backend ARISTOTELES

> **Sumber kebenaran**: route (`src/modules/*/ *.routes.ts`), middleware
> (`src/middlewares/auth.middleware.ts`), validator Zod di service,
> controller, `src/db/schema.ts`, dan 35+ file tes integrasi (241 tes hijau).
> Dokumen ini **mendeskripsikan implementasi yang ada** — bukan usulan.
> Prefix global: `/api/v1` (kecuali ditulis lain). Hal yang belum pasti
> ditandai `[Perlu konfirmasi]`.
>
> Terakhir diselaraskan: 2026-11-24 — migrasi s/d `0035` (15 indeks
> komposit hasil audit optimasi), `GET /admin/vouchers/stats`, filter
> `GET /instructor/review-queue?courseId=`, proyeksi polling pembayaran,
> agregat `getBest`/revenue/eligibility batch, paginasi daftar milik sendiri.
> Suite penuh: 241 tes hijau di ~35 file (`npm test`).
> Patch keamanan 2026-11-04 tetap berlaku (rate-limit auth/voucher/invitation/
> quiz/payments/upload, escape LIKE, audit lintas modul, invite atomik,
> TiptapValidationError, trust proxy + CORS env, redaksi token di log).
> Lihat `git log` untuk detail per tahap.

## 1. Konvensi umum

### 1.1 Envelope respons

Sukses: `{ "status": "success", "message": string, "data": T }`.
Gagal: `{ "status": "error", "message": string, "data": null }`
plus salah satu: `errors: [{field, message}]` (validasi Zod) atau
`code: string` (galat bisnis semua modul; contoh quiz: `NOT_QUIZ`/`QUIZ_EMPTY`/`UNKNOWN_QUESTION`/`INVALID_OPTION`/`NOT_MANAGER`, upload: `MIME_NOT_ALLOWED`/`INVALID_BASE64`/`EMPTY_FILE`/`FILE_TOO_LARGE`/`MIME_MISMATCH`, payments: `VOUCHER_INVALID`/`AMOUNT_INSUFFICIENT`/`PAYMENT_LOCKED`/...)
atau `failReasons: string[]` (+`requirements`) khusus `NOT_ELIGIBLE` sertifikat.
Frontend (`apiRequest`) hanya menerima envelope ini. Pengecualian kecil yang disengaja:
envelope 404/500 global tanpa `code`, dan `GET /invitations/validate` tanpa `code` (404 vs 410 sudah cukup sebagai pembeda).

### 1.2 Autentikasi & otorisasi

- Skema: `Authorization: Bearer <JWT>` (`authenticate`).
- JWT: `sub` = id numerik, `email`, `role`; issuer `aristoteles-backend`,
  audience `aristoteles-client`; default kedaluwarsa 15 menit.
- `requireRole(...allowed)` → 403 `"Akses ditolak untuk peran ini"` bila role tak cocok.
- `optionalAuthenticate` → publik boleh, terisi `req.user` bila token valid.
- Tanpa token di endpoint privat → 401 `"Token autentikasi diperlukan"`.
- Token basi/rusak → 401 `"Token kedaluwarsa atau tidak valid"`.
- Identitas selalu dari JWT; tidak ada `userId` dari body untuk aksi milik sendiri.
- Akun `isActive=false` ditolak saat login (403); token yang sudah terbit
  tetap berlaku sampai kedaluwarsa (±15 mnt).

### 1.3 Kepemilikan & akses belajar (dipakai lintas modul)

- `canManageCourse(userId, role, courseId)` = `admin` ATAU `courses.createdBy`
  ATAU baris `course_instructors` → penjaga tulis kurikulum/kuis/tugas/sertifikat.
- `canReadCourseTree` = `published`/`archived` publik; `draft` hanya pengelola
  (asing → **404**, anti-enumerasi).
- `hasCourseAccess`/`resolveLearningGuard` = admin/pengelola ATAU enrollment
  `active`/`completed`. Tanpa akses → **403 `NO_ACCESS`** (detail materi anon → 401).

---

## 2. Autentikasi — `POST /api/v1/auth/*`, `GET /api/v1/auth/me`

Alur saat ini: `register` → `verify-email` (keduanya menerbitkan pasangan
`accessToken` + `refreshToken` sekali pakai); reset via `forgot-password` →
`verify-reset-code` → `reset-password`. Klien mobile memakai `POST /refresh`
(rotasi; token lama hangus, pakai ulang = seluruh sesi dicabut) dan
`POST /logout` (cabut satu/banyak sesi). Semua endpoint auth dilindungi
`authOtpLimiter` (default 30x/15 mnt/IP).

| Endpoint | Auth | Body | Sukses | Error |
|---|---|---|---|---|
| `POST /register` | — + rate-limit | `{name(2–100), username(3–30: huruf kecil/angka/titik/_/-, unik), email(≤191, dilowercase), password(8–72)}` | 201 `{message, email, expiresInSeconds}` (OTP, bukan token) | 400 validasi; 409 `"Email sudah terdaftar"` / `"Username sudah dipakai"`; 429 bila limit |
| `POST /verify-email` | — + rate-limit | `{email, code(6 digit)}` | 201 `{accessToken, user}` + tandai verified | 400/404/409/410 OTP; 409 username direbut saat verifikasi ("daftar ulang"); 429 |
| `POST /resend-verification` | — + rate-limit | `{email}` (cooldown 60 dtk) | 200 `{message, expiresInSeconds}` | 400/429 |
| `POST /forgot-password` | — + rate-limit | `{email}` (respons generik anti-enumerasi) | 200 generik | 429 |
| `POST /verify-reset-code` | — + rate-limit | `{email, code}` | 200 generik valid | 400/410; 429 |
| `POST /reset-password` | — + rate-limit | `{email, code, newPassword(8–72)}` | 200 | 400/410; 429 |
| `POST /login` | — + rate-limit | `{email, password(1–72)}` | 200 `{accessToken, refreshToken(64-hex, simpan aman), user}` | 400 generik; 403 bila `isActive=false`; 429 |
| `POST /refresh` | — + rate-limit | `{refreshToken!}` (opaque, sekali pakai) | 200 `{accessToken, refreshToken(baru), refreshExpiresAt, user}` (token lama dicabut + catat penerus; pakai ulang dalam grace `REFRESH_REUSE_GRACE_MS` default 60 dtk disusuri rantainya (maks 10 lompatan) → 200; rantai basi/terputus → 401 + seluruh sesi dicabut) | 400 validasi; 401 token tak dikenal/kedaluwarsa/dicabut/nonaktif; 429 |
| `POST /logout` | JWT | `{refreshToken?}` (tanpa = cabut semua sesi sendiri) | 200 `{revoked}` | 401 tanpa token akses |
| `GET /me` | JWT | — | 200 `{user{id,name,username,email,role,avatarUrl(/api/v1/files/:id/content|null)}}` (query ulang DB; `Cache-Control: no-store`) | 401 token hilang/tak valid/user terhapus |

Efek samping: tidak ada (stateless; logout = hapus token di klien).
Uji: login dalam tiap fixture tes (tidak ada file khusus auth).

---

## 2b. Profil milik sendiri — `GET/PATCH /me/profile`, `DELETE /me/profile/avatar`

Kolom profil (`phone`, `gender L/P`, `birth_place`, `birth_date`, `avatar_file_id`) nullable; migrasi 0016. Email + role tak dapat diubah dari sini. Avatar = berkas `kind=avatar` (migrasi 0017; JPG/PNG/WebP ≤2MB, publik, semua peran terautentikasi boleh unggah) milik sendiri — rujuk file orang lain/kind lain ditolak.

| Endpoint | Auth | Body | Sukses | Error |
|---|---|---|---|---|
| `GET /me/profile` | JWT | — | 200 `{id,name,username,email,role,phone,gender,birthPlace,birthDate(YYYY-MM-DD),avatarFileId,avatarUrl(/api/v1/files/:id/content),coverFileId,coverUrl,emailVerified,createdAt}` | 401 |
| `PATCH /me/profile` | JWT | strict parsial `{name(2–100), username(3–30 lowercase unik), phone, gender(L/P), birthPlace(≤100), birthDate(YYYY-MM-DD ≥1900 ≤hari ini), avatarFileId, coverFileId}`; string kosong → null; email/role ditolak | 200 profil penuh + audit `profile.update` (field yang berubah) | 400 validasi/strict/`INVALID_AVATAR`/`INVALID_COVER`; 409 `USERNAME_TAKEN`; 401 |
| `DELETE /me/profile/avatar` | JWT | — | 200 profil (avatar null) | 401 |

Uji: `profile.test.ts` (6: baca, simpan+null, validasi ketat, username, avatar+hapus, guru).

---

## 3. Kursus — `/api/v1/courses`, `/api/v1/instructor/courses`

Komentar `course.routes.ts:8` ("hanya published") **kedaluwarsa** — kode aktual:
katalog publik = `published` + `archived`; `draft` tidak bocor.

| Endpoint | Auth/Role | Sukses | Error |
|---|---|---|---|
| `GET /courses?category=&period=&level=&q=&status=published\|archived&limit=&page=&sort=newest\|oldest` | publik | 200 array kursus (default limit 20, maks 100; `status` selain dua nilai → diabaikan = keduanya; `level` asing → diabaikan) | 200 selalu (query tak valid → fallback default, bukan 400) |
| `GET /courses/:id` | opsional | 200 detail + `instructors[]`; arsip publik; draft → 404 kecuali pengelola | 404 hilang/draft-asing/id non-int |
| `POST /courses` | teacher/admin | 201; **selalu `status:'draft'`**; relasi pengampu pembuat atomik | 400 Zod (`title` 10–120, `category` string 1–100 wajib AKTIF di tabel kelola-admin, `level` ∈ {Pemula, Menengah, Lanjutan} default Pemula, `durationMonths` 1–36, `description` 30–5000, `coverUrl` kosong/`/api/…`/http(s) ≤500, `period` ∈ {upcoming, ongoing, ended}, `startMonth` 1–100, `priceNominal` int ≥0, `outcomes` 2–20 × ≥10 karakter, `tools` 1–20) + `INVALID_CATEGORY` bila kategori asing/nonaktif |
| `PATCH /courses/:id` | teacher/admin + pengelola | 200 (termasuk ganti `status` draft↔published↔archived; `priceNominal` → `priceLabel` dihitung ulang; ganti `category` wajib aktif) | 400 schema parsial kosong/tak valid + `INVALID_CATEGORY`; 403 pengelola-bukan (`exists?403:404`) |
| `DELETE /courses/:id` | teacher/admin + pengelola | 200 `data:null`; cascade tree via FK; cover internal `/api/v1/files/:id/content` dibersihkan best-effort | 403/404 pola sama |
| `GET /instructor/courses[?scope=mine]` | teacher/admin | teacher (atau admin `scope=mine`): kursus yang diampu/dibuat; admin default: semua + filter `status` | 401/403 |
| `GET /courses/rankings?limit=` | publik | 200 array `{courseId,title,category,level,image,priceLabel,priceNominal,period,studentCount,instructorNames[]}` — published saja, urut enrollment aktif terbanyak (tanpa rating; backend belum punya penilaian) | limit non-angka → default 10 (dibatasi 1–50) |

Uji relevan: `material-pass-score.test.ts` (skema `passScore` materi).

### 3a. Kategori kursus — `/api/v1/categories`, `/api/v1/admin/categories`

Sumber kebenaran dropdown/filter kategori adalah tabel `course_categories` (migrasi 0026, seed 8 bawaan).
`courses.category` menyimpan NAMA (tanpa FK) agar kursus lama tetap tampil bila kategorinya dinonaktifkan.
Nonaktif = hilang dari pilihan & daftar publik; kursus lama yang memakainya tetap valid.

| Endpoint | Auth/Role | Sukses | Error |
|---|---|---|---|
| `GET /categories` | publik | 200 array aktif `{id,slug,name,sortOrder}` (sortOrder,id) | — |
| `GET /admin/categories` | admin | 200 semua `{id,slug,name,sortOrder,isActive,courseCount,createdAt,updatedAt}` + audit tidak ada (baca) | 401/403 |
| `GET /admin/categories/:id` | admin | 200 satu kategori + `courseCount` | 401/403/404 `CATEGORY_NOT_FOUND` |
| `POST /admin/categories` `{name 2–100, slug? auto, sortOrder?}` | admin | 201 + audit `category.create` | 400 Zod/slug tak valid; 409 `CATEGORY_TAKEN` |
| `PATCH /admin/categories/:id` `{name?, isActive?, sortOrder?}` | admin | 200 + audit `category.update`; ganti nama ikut mengubah `courses.category` pemakai (atomik) | 400/404 `CATEGORY_NOT_FOUND`/409 `CATEGORY_TAKEN` |
| `DELETE /admin/categories/:id` | admin | 200 + audit `category.delete`; hanya bila tak dipakai kursus | 404/409 `CATEGORY_IN_USE` |

Uji relevan: `categories/__tests__/categories.test.ts`.

---

## 4. Kurikulum — `/api/v1/courses/:courseId/modules`, `/modules/*`, `/submodules/*`, `/materials/*`

Struktur (modul/submodul/daftar materi): publik untuk published/archived.
Tulis: teacher/admin + `canManageCourse` (403 bila bukan pengelola).

| Endpoint | Akses baca | Catatan |
|---|---|---|
| `GET /courses/:courseId/modules`, `GET /modules/:mid`, `GET /modules/:mid/submodules`, `GET /submodules/:sid`, list materi (`/modules/:mid/materials`, `/submodules/:sid/materials`) | publik | **Isi `content` materi = `null` bila peminta tanpa hak akses**; penuh bila berhak |
| `GET /materials/:matId` | butuh hak akses | draft-asing 404; tanpa akses: anon 401, terdaftar 403 `NO_ACCESS` |
| `POST /courses/:courseId/modules` `{title 3–255, description ≤5000?, type materi\|tugas\|kuis, position 0–10000}` | tulis | 201 |
| `PATCH/DELETE /modules/:mid` | tulis | hapus cascade |
| `POST /modules/:mid/submodules`, `PATCH/DELETE /submodules/:sid` | tulis | hapus submodul menghapus materinya satu-per-satu |
| `POST /submodules/:sid/materials` `{title 3–255, type 7-nilai (materi/tugas/kuis/video/bacaan/audio/foto), duration ≤50?, content JSON Tiptap ≤1jt char, contentSchemaVersion 1–99?, passScore 0–100? default 70, position}` | tulis | 400 bila Tiptap tak valid (node/mark whitelist, tolak `data:`/`javascript:`, kedalaman ≤50) |
| `PATCH/DELETE /materials/:matId` | tulis | patch parsial non-kosong + opsional `expectedUpdatedAt` (409 `MATERIAL_CONFLICT` + `data.currentUpdatedAt` bila berubah sejak dibuka), `changeSignificance: ringan\|penting` + `changeReason` (dicatat di audit K-08) |
| `GET /materials/:matId/changes?limit=` | teacher/admin pengelola | — | 200 riwayat resmi dari audit (`action, actorName, metadata{changed,significance,reason}, createdAt`; terbaru dulu, maks 100) |

Uji relevan: tidak ada file khusus kurikulum (tercakup fixture modul lain).

---

## 5. Enrollment & akses — `/api/v1/courses/:id/*`, `/me/enrollments`, `/admin/courses/:id/grants*`

| Endpoint | Auth/Role | Body | Sukses | Error |
|---|---|---|---|---|
| `POST /courses/:id/enroll` | JWT | — | 201 (200 bila reaktivasi `expired/cancelled`); `{courseId,status:'active',source:'free',reactivated}` | 404 draft/hilang; 403 `ENROLLMENT_CLOSED` (arsip/period ended); 403 `NEEDS_MANUAL_GRANT` (berbayar); 409 `ALREADY_ENROLLED`; 401 |
| `GET /courses/:id/access` | JWT | — | 200 `{hasAccess,isManager,enrollment{status,source,enrolledAt}\|null}` | 404 |
| `GET /me/enrollments` | JWT | — | 200 array join kursus | 401 |
| `POST /admin/courses/:id/grants` | admin | `{userId\|email, reason 5–500}` (salah satu identitas wajib) | 201 `{status:'active',source:'manual'}` + audit `enrollment.grant` (transaksi; upsert) | 400 validasi/`CANNOT_GRANT_SELF`; 404 kursus/target; 403 non-admin |
| `POST /admin/courses/:id/grants/:userId/revoke` | admin | `{reason 5–500}` | 200 `{status:'cancelled'}` + audit `enrollment.revoke` | 400/404 (`ENROLLMENT_NOT_FOUND`)/409 `ALREADY_CANCELLED` |

Aturan status: `active`/`completed` = punya akses; `expired`/`cancelled` = tidak. Tidak ada endpoint yang menyetel `completed`/`expired` — **transisi itu belum tersedia (gap, lihat §14)**.
Uji: `enrollments.test.ts` (14 kasus: sukses, duplikat, semua penolakan, gating, grant/revoke+audit, katalog arsip, completed).

---

## 6. Progres — `/materials/:id/progress`, `/me/progress`

| Endpoint | Auth | Sukses | Error |
|---|---|---|---|
| `POST /materials/:id/progress` | JWT + hak akses | 200 `{materialId,completed:true,alreadyCompleted,certificateIssued}` (idempoten; baris kedua hanya refresh waktu; sertifikat modul auto-terbit bila baru lengkap) | 403 `NO_ACCESS`; 404 draft-asing/hilang/id buruk |
| `DELETE /materials/:id/progress` | JWT + hak akses | 200 `data:null` (idempoten) | sama |
| `GET /me/progress[?courseId=]` | JWT | 200 `number[]` milik sendiri | 400 `courseId` tak valid; 404 kursus asing/hilang |
| `GET /me/progress/summary` | JWT | 200 `{totalCourses,totalMaterials,completedMaterials,percent,perCourse[]}` — persen = Σ selesai / Σ materi kursus yang diikuti × 100, **satu desimal** (mis. 63.9) | 401 tanpa token |

Uji: `progress.test.ts` (401, id invalid, idempoten, filter, isolasi, draft, batalkan); `progress-summary.test.ts` (ringkasan kosong, persen desimal 63.9, per-kursus 75.0/100.0, isolasi antar-peserta).

---

## 7. Kuis — `/materials/:id/quiz*`

Materi harus `type:'kuis'` (selain itu 400). Penilaian 100% server; skor klien ditolak skema strict.

| Endpoint | Auth/Role | Sukses | Error |
|---|---|---|---|
| `PUT /materials/:id/quiz` | teacher/admin pengelola | 200 bank baru `{isCorrect,explanation,imageUrl/audioUrl/fileUrl/fileName?}` (lampiran opsional, wajib URL berkas server `/api/v1/files/...`; ganti atomik; snapshot lama utuh) | 400 (0/2 kunci, <2 opsi, 0 soal, URL lampiran asing); 403 siswa; 400 non-kuis |
| `GET /materials/:id/quiz` | JWT + hak akses | 200 soal **tanpa** `isCorrect`/`explanation` (dengan lampiran bila ada) | 400 non-kuis; 404; 403 `NO_ACCESS`; 401 |
| `POST /materials/:id/quiz-attempts` | JWT + hak akses | 201 `{attemptId,score,total,correct,passScore,passed,bestScore,attempts,overallPassed,certificateIssued}`; `score=round(correct/total*100)`; `passScore` = snapshot materi; append-only; sertifikat modul auto-terbit bila baru lengkap | 400 (skor buatan, duplikat `questionId`, id asing, opsi lintas soal, kuis kosong) |
| `GET /materials/:id/quiz-attempts` | JWT + hak akses | 200 riwayat milik sendiri (tanpa kunci/snapshot/answers) | 403/404 |
| `GET /materials/:id/quiz-best` | JWT + hak akses | 200 `{attempts,bestScore,effectivePassScore,passed}`; lulus **menempel** (OR atas snapshot tiap percobaan) | 403/404 |

`passScore` per materi via `PATCH /materials/:id` (0–100, default 70).
Uji: `quiz.test.ts` + `material-pass-score.test.ts`.

---

## 8. Tugas — `/materials/:id/submissions*`

Alur: `POST /api/v1/uploads` (`kind:"assignment"`, PDF ≤10MB, magic-bytes) → `fileId` → submit. Materi harus `type:'tugas'`.

| Endpoint | Auth/Role | Body | Sukses | Error |
|---|---|---|---|---|
| `POST /materials/:id/submissions` | JWT + hak akses | strict `{fileId, studentNim?(1–30), note?(≤2000)}`; nama dari profil; `studentNim`/nilai/feedback klien **ditolak skema** | 201 baris baru `{status:'submitted',fileUrl:/api/v1/files/:id/content,...}` (resubmit = baris baru, riwayat utuh) | 400 `NOT_TASK`/`INVALID_FILE_KIND`/Zod; 403 `NO_ACCESS`/`FILE_FORBIDDEN` (berkas milik orang lain); 404 berkas/materi |
| `GET /materials/:id/submissions[?userId=]` | JWT | — | 200 `{manager,rows[]}` (peserta: milik sendiri; pengelola: semua + saring) | 403/404 |
| `GET /materials/:id/submissions/status` | JWT + hak akses | — | 200 `{attempts,graded,passed,lastStatus,bestScore,lastSubmission}`; lulus menempel (`EXISTS passed`) | 403/404 |
| `GET /materials/:id/submissions/:subId` | JWT | — | 200 (milik sendiri/pengelola; asing → 404) | 403/404 |
| `GET /instructor/review-queue[?courseId=]` | teacher/admin | — | 200 agregat `{courses[{tasks[{pending,graded,total,avgScore}]}],pendingTotal,gradedTotal,avgScore}` (kursus kelola; admin = semua; `courseId` melingkupi 1 kursus + tetap cek kepengelolaan, bukan pengelola → kosong) | 401/403 |
| `POST /materials/:id/submissions/:subId/grade` | teacher/admin pengelola | strict `{score 0–100, decision passed\|failed\|revision_requested **wajib**, feedback?(≤2000), rubric?{kelengkapan,ketepatan,kerapian 0–100}}` — skor atau rubrik wajib salah satu; bila rubrik dikirim, **server menghitung rata-rata bulat** (skor kiriman diabaikan) + simpan `rubric_scores` (null bila tanpa rubrik) | 200 + `gradedBy/gradedAt` + audit `submission.grade` (transaksi; audit catat rubrik) | 400 Zod; 403 `NOT_MANAGER`/role; 404 |

Uji: `submissions.test.ts` (submit×N, validasi berkas, isolasi, revision→lulus, sticky-pass, proteksi berkas 6 skenario).

---

## 9. Sertifikat — `/modules/:id/certificate`, `/me/certificates`, `/certificates/verify/:code`, `/instructor/*`

Satu baris per (peserta, modul); `UNIQUE(userId,moduleId)` + transaksi = idempoten & anti-ganda. Semua materi = wajib; syarat per-tipe: biasa→progres, kuis→lulus, tugas→lulus.

**Sertifikat kursus (Fase B):** satu baris per (peserta, kursus) dengan `moduleId NULL`; terbit otomatis (tak pernah menggagalkan aksi utama) saat semua modul berkonten sudah bersertifikat `issued`. Keunikan ditegakkan aplikasi (cek-dalam-transaksi + retry tabrakan kode, bukan UNIQUE karena NULL). Setelah terbit, sertifikat modul `issued` digantikan satu per satu (transaksi masing-masing; gagal satu tak menghentikan lain; percobaan berikut self-heal) → status `superseded` + alasan `Digantikan sertifikat kursus <KODE>`. Daftar milik sendiri menyembunyikan `superseded`; riwayat instruktur + verifikasi tetap menampilkannya. Unduh modul `superseded` → 410 beserta kode pengganti; terbit ulang modul `superseded` → 409 `CERT_SUPERSEDED`. PDF modul maupun kursus dibuat malas dari data + cache `uploads/certificates/<KODE>.pdf` (tanpa migrasi file).

**Terbit otomatis (tanpa klik):** setiap progres materi ditandai (`POST /materials/:id/progress`), percobaan kuis dinilai (`POST /materials/:id/quiz-attempts`), atau tugas dinilai (`POST /materials/:id/submissions/:subId/grade`) memicu `tryAutoIssueForMaterial` — bila modul itu baru saja lengkap, sertifikat langsung diterbitkan di tempat yang sama (idempoten; `sudah_terbit`/belum lengkap → diam, tidak pernah menggagalkan aksi utama). Tombol "terbitkan" manual tidak ada di frontend; respons progres & kuis menyertakan `certificateIssued: true|false` (penilaian tugas memicu diam-diam karena penerimanya peserta lain).

| Endpoint | Auth/Role | Sukses | Error |
|---|---|---|---|---|
| `POST /modules/:id/certificate` | JWT + hak akses | Tetap didukung sebagai jalur manual/ulang: 201 baru / 200 sudah ada `{id,code ATS-YYYY-XXXXXXXX,recipientName,courseId/Title,moduleId/Title,status,issuedAt,...}`; snapshot nama+persyaratan; audit `certificate.issue` | 403 `NOT_ELIGIBLE` (+`failReasons`,`requirements`); 409 `CERT_REVOKED`; 404 |
| `POST /courses/:id/certificate` | JWT + hak akses | Klaim manual sertifikat kursus (pemulih bila auto-issue terlewat): 201 baru / 200 sudah ada; 403 `NOT_ELIGIBLE` + `failReasons` per modul yang belum bersertifikat; 409 `CERT_REVOKED` | 403 `NO_ACCESS`; 404 |
| `GET /me/certificates` | JWT | 200 milik sendiri (tanpa `superseded`; baris kursus `moduleId/moduleTitle: null`; tiap baris `instructorName` + `signatureUrl` untuk sampul) | 401 |
| `GET /me/certificates/:id/download` | JWT (pemilik/pengelola kursus) | 200 `application/pdf` + `Content-Disposition: attachment; filename="Sertifikat-<Judul>-<Nama>.pdf"`; PDF landscape A4 gaya referensi — logo + ARISTOTELES kiri atas, chip kode, penerima, uraian kelulusan, tanggal + tanda tangan instruktur utama kiri bawah (gambar bila ada, fallback nama diketik), pita navy kanan "SERTIFIKAT KOMPETENSI" + medali emas (kursus) / perak (modul), QR + kode verifikasi kanan bawah (tanpa URL tercetak); dibuat malas dari data + cache disk `uploads/certificates/v4-<KODE>.pdf` (prefix v4 menginvalidasi desain lama; berkas v3/v2 dihapus malas; tanpa migrasi; gagal PDF tak mengganggu terbit/daftar/verifikasi) | 401; 404 milik orang lain; 403 `CERT_REVOKED`; 410 `CERT_SUPERSEDED` (+ kode pengganti di pesan) |
| `GET /me/modules/:id/certificate-status` | JWT + hak akses | 200 `{eligible,requirements[],failReasons[],certificate?}` | 403/404 |
| `GET /certificates/verify/:code` | **publik** | 200 minimal `{code,recipientName,courseTitle,moduleTitle|null,instructorName,signatureUrl,status,revokeReason,issuedAt,revokedAt}` (`status` termasuk `superseded`; `moduleTitle` null = level kursus); tanpa userId/email/nilai | 404 `CODE_NOT_FOUND` |
| `GET /instructor/signature` | teacher/admin | 200 `{fileId,url}` tanda tangan milik sendiri (null bila belum pasang) | 401 |
| `POST /instructor/signature` | teacher/admin | 200 `{fileId,url,clearedPdfs}` pasang/ganti (`{fileId}` kind `signature` milik sendiri; file lama + cache PDF kursus yang ditandatangani dibersihkan; audit) | 400 kind bukan signature; 403 bukan milik; 404 file hilang |
| `DELETE /instructor/signature` | teacher/admin | 200 `{fileId:null}` lepas tanda tangan (kembali ke nama diketik; cache dibersihkan; audit) | 401 |
| `GET /certificates/verify/:code/qr` | **publik** (rate-limit baca 600x/15 mnt) | 200 `image/png` QR tautan verifikasi (dipakai fasimil sampul; tanpa PII) | 404 `CODE_NOT_FOUND` |
| `GET /instructor/certificates/summary` | teacher/admin (scope kursus tanggung jawab) | 200 `{eligibleCount,issuedActiveCount,notEligibleCount,revokedCount,perCourse[],recentlyEligible[]}` untuk tab ringkasan `instruktur/sertifikat` | 200 kosong bila belum mengampu |
| `GET /instructor/modules/:id/certificate-status` | teacher/admin scope | 200 `{moduleId,moduleTitle,courseId,courseTitle,eligibleCount,issuedCount,notEligibleCount,revokedCount}` | 403/404 |
| `GET /instructor/eligibility?courseId=&moduleId=&status=&q=` | teacher/admin scope | 200 `{items,total}` bentuk frontend `{id:"moduleId:userId",studentName,nim,courseId/Title,moduleId/Title,materialDone/Total,quizStatus,taskStatus,status}` | 400 query tak valid; 403 luar scope |
| `GET /instructor/eligibility/:id` | teacher/admin scope | 200 rincian `{...entry,certificateId,failReasons,materials,quizzes,tasks}`; `id` gabungan `moduleId:userId` | 404 `ELIGIBILITY_NOT_FOUND`; 403/404 |
| `GET /instructor/certificates?courseId=&moduleId=&status=aktif\|dicabut\|digantikan\|issued\|revoked\|superseded&q=&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=&page=` | teacher/admin (scope kursus tanggung jawab) | 200 `{items,total}` bentuk frontend `{id,code,studentName,printedName,recipientName,courseId/Title,moduleId/Title|null,issuedAt,status:aktif\|dicabut\|digantikan,revokedAt,revokeReason}` (termasuk dicabut + digantikan) | 403 luar scope |
| `GET /instructor/certificates/:certId` | teacher/admin scope | 200 bentuk frontend + `requirementsSnapshot`,`revokedBy` | 403/404 |
| `POST /instructor/certificates/:certId/revoke` | teacher/admin scope | 200 `status:'dicabut'` + `revokeReason/By/At` + audit; verify publik tetap `revoked` | 400 alasan (<5); 409 `ALREADY_REVOKED`; 403/404 |
| `GET /instructor/modules/:id/eligibility[?status=]` | teacher/admin scope | 200 `{items:[{userId,studentName,email,status: sudah_terbit\|memenuhi\|menunggu_penilaian\|belum_memenuhi,...}]}` | 403/404 |

Tidak ada PDF server (keputusan: JSON + halaman printable). Re-issue pasca-revoke terminal (409).
Uji: `certificates.test.ts` (8: eligible+terbit+idempoten+snapshot, NOT_ELIGIBLE, verify, list/scope/eligibility, revoke+audit, concurrency paralel).

---

## 10. Voucher — `/vouchers/redeem`, `/admin/vouchers*`

| Endpoint | Auth/Role | Body | Sukses | Error |
|---|---|---|---|---|
| `POST /vouchers/redeem` | JWT | strict `{code, courseId?}` (kode dinormalisasi uppercase; `courseId` opsional — absen = pakai kursus terikat voucher, diisi beda = `COURSE_MISMATCH`) | 201 `{status:'active',source:'voucher'}` + enrollment + audit; anti-race (`FOR UPDATE` + `UNIQUE(voucher,user)` + kenaikan bersyarat + retry backoff) | 404 `CODE_NOT_FOUND`/kursus; 403 `VOUCHER_DISABLED`/`VOUCHER_EXPIRED`/`QUOTA_EXHAUSTED`/`VOUCHER_FOR_ACCOUNT`/`COURSE_MISMATCH`/`ENROLLMENT_CLOSED`; 409 `ALREADY_ENROLLED`/`ALREADY_REDEEMED` |
| `POST /vouchers/validate` | JWT | strict `{code, courseId}` | 200 `{valid,code,discountType,discountValue,discountAmount,priceNominal}` (tanpa hanguskan kuota) | 400 `NOT_DISCOUNT`; 403/404/409 sama seperti redeem |
| `POST /admin/vouchers` | admin | `{code?(4–32 A-Z0-9-, auto `ATS-XXXXXXXX`), courseId!, kind!, maxUses? (personal dipaksa 1; umum wajib ≥1), assignedUserId/email? (personal wajib, umum dilarang), discountType+discountValue? (wajib bila kind=diskon), expiresAt? (masa depan)}` | 201 (personal `assigned`, umum `available`) + audit | 400 validasi/`PERSONAL_MAX_USES`/`ASSIGNEE_FORBIDDEN`/`INVALID_EXPIRY`; 404 kursus/penerima; 409 `CODE_TAKEN` |
| `GET /admin/vouchers?...` | admin | filter courseId/status/kind/q/limit(≤100)/page; status grup: `active` (=available/assigned belum kedaluwarsa), `expired` (=expired ATAU lewat tanggal) | 200 `{items[{remaining,assignedEmail...}],total}` (total = hitungan server) | — |
| `GET /admin/vouchers/stats[?...]` | admin | filter courseId/kind/q yang sama (tanpa status) | 200 `{total,aktif,habis,kedaluarsa,total=aktif+habis+kedaluarsa+batal}` — 1 query agregat (ganti 5× list) | 401/403 |
| `GET /admin/vouchers/:code` (+`/:code/redemptions`) | admin | — | 200 detail + `assignedEmail` + ≤50 redemptions terakhir + `redemptionCount` (total sebenarnya) | 404 |
| `POST /admin/vouchers/:code/disable` | admin | `{reason?}` | 200 `revoked` + audit | 409 final/sudah-revoked |
| `POST /admin/vouchers/:code/enable` | admin | — | 200 kembali ke `assigned`/`available` + audit | 409 bukan-revoked |

Uji: `voucher-admin.test.ts` (12: create/validasi, redeem+redeemed, personal, mismatch/draft/ended, expired/disable/enable, **konkurensi 5 paralel**, users, assign, invitation, **stats 1-query konsisten + filter + 403**).

---

## 10b. Promo kurasi admin — `/promos*`, `/admin/promos*` (diskon percent-only)

Kurasi per kursus (bukan global): kampanye + keanggotaan `promo_courses`.
Harga resmi (`priceNominal`) tidak berubah; promo = sumber diskon resmi di samping
voucher-diskon. Non-stack: promo vs voucher diambil **terbesar** saat buat antrean
pembayaran (voucher yang kalah tidak dikonsumsi). Snapshot `promoSlug` disimpan di
pembayaran; verifikasi admin tidak berubah (voucher null → tidak ada hanguskan).

| Endpoint | Auth/Role | Body | Sukses | Error |
|---|---|---|---|---|
| `GET /promos` | publik | — | 200 kampanye `active` dalam jendela + kursus `published` (`promoPrice`, `badgeLabel`, `promoEndsAt`) | — |
| `GET /promos/course/:courseId` | publik | — | 200 kuote promo kursus (`{slug,title,badgeLabel,discountPercent,discountAmount,promoPrice,priceNominal}`) atau `null` bila tak ada promo aktif | — |
| `GET /promos/:slug` | publik | — | 200 detail + kursus | 404 kedaluwarsa/draft/hilang |
| `POST /admin/promos` | admin | `{slug 3–100 (huruf kecil-angka-), title 3–200, badgeLabel?, type: diskon\|kurasi\|patungan, discountPercent 1–90 (wajib bila diskon, dilarang selainnya), status draft\|active\|archived, startsAt?, endsAt? (mulai ≤ selesai)}` | 201 + audit `promo.create` | 400 validasi; 409 `SLUG_TAKEN` |
| `GET /admin/promos` | admin | filter status/type | 200 + `courseCount` | — |
| `GET /admin/promos/:slug` | admin | — | 200 kampanye + semua kursus anggota (termasuk draft; untuk kelola sebelum aktif) | 404 |
| `PATCH /admin/promos/:slug` | admin | parsial (aturan persen sama; jendela mulai ≤ selesai divalidasi ulang; non-diskon membersihkan persen) | 200 + audit `promo.update` | 400 `DISCOUNT_REQUIRED`/`DISCOUNT_FORBIDDEN`/`INVALID_WINDOW`; 404 |
| `POST /admin/promos/:slug/courses` | admin | `{courseId!, position?, customBadge?, patunganPrice? (total grup, wajib > 0, hanya bila kampanye patungan)}` | 201 + audit | 400 `COURSE_DRAFT`/`COURSE_ARCHIVED`/`COURSE_FREE` (gratis dilarang untuk diskon), `PATUNGAN_PRICE_FORBIDDEN`; 404; 409 `ALREADY_INCLUDED` |
| `DELETE /admin/promos/:slug/courses/:courseId` | admin | — | 200 + audit (idempoten) | 404 promo |
| `DELETE /admin/promos/:slug` | admin | — | 200 hapus kampanye + anggotanya + audit `promo.delete` | 403 non-admin; 404 hilang; 409 `PROMO_IN_USE` (grup patungan pending / pembayaran menunggu masih menunjuk slug) |

Type: `diskon` = potongan persen real; `kurasi` = pajang tanpa ubah harga;
`patungan` = kursus eligible grup patungan. Harga patungan per kursus
(`promo_courses.patungan_price`, total grup, opsional) menimpa nominal katalog
saat hitung iuran; kosong = ikut `priceNominal`. Iuran tetap dibagi habis ke anggota.
Kolom `proposedBy` disiapkan untuk alur usulan instruktur (fase 2; perlu keputusan + endpoint approve).

Uji: `promos/__tests__/promo.test.ts` (kelola admin-only, validasi persen 1–90,
draft/expired hidden publik, `promoPrice` 20% dari 200rb = 160rb, pembayaran
pakai promo tanpa voucher, voucher-vs-promo terbesar menang dua arah, kuote per kursus).

---

## 10b2. Grup patungan — `/patungan/*`, `/admin/patungan/*` (username tervalidasi, lunas-semua)

Satu grup = satu kursus, total anggota 2–15 termasuk pembuat (otomatis anggota #1).
Hanya kursus anggota kampanye `patungan` aktif yang eligible (tanpa fallback).
Iuran per anggota dihitung server (bilangan bulat, jumlah = nominal kursus),
dibayar sendiri-sendiri lewat antrean pembayaran (tanpa voucher/promo).
Akses (`source: "payment:patungan"`) dibuka ke SEMUA anggota sekaligus hanya saat
seluruh anggota `diverifikasi` — tanpa akses parsial. Pembuat boleh batal selama
belum ada iuran masuk; setelah ada iuran, hanya admin (penanganan manual + audit).

| Endpoint | Auth/Role | Body | Sukses | Error |
|---|---|---|---|---|
| `POST /patungan/members/validate` | JWT + rate-limit | `{courseId!, usernames[1–14]}` | 200 `{ready, members[{username,exists,displayName}], shares, creatorShare, total, course, campaign}` atau `{ready:false, members, error{code,message}}` (selalu 200 agar live-check tidak dianggap gagal) | 401; 404 kursus/draft |
| `POST /patungan/groups` | JWT + rate-limit | sama | 201 detail grup pending + audit `patungan.create` (pembuat otomatis anggota #1) | 400 `USERNAME_INVALID`/`MEMBER_COUNT_INVALID`/`MEMBER_DUPLICATE`/`SELF_INCLUDED`/`COURSE_FREE`; 403 `COURSE_NOT_ELIGIBLE`/`ENROLLMENT_CLOSED`; 404 `USER_NOT_FOUND`/`COURSE_NOT_FOUND`; 409 `ALREADY_HAS_ACCESS`/`PAYMENT_QUEUE_OPEN`/`GROUP_ALREADY_PENDING` |
| `GET /patungan/groups/mine` | JWT | — | 200 daftar grup saya + `paidCount` | 401 |
| `GET /patungan/groups/:id` | JWT (anggota/admin) | — | 200 detail + anggota (username, nama, iuran, status bayar) | 401/404; 403 `GROUP_FORBIDDEN` |
| `POST /patungan/groups/:id/cancel` | JWT pembuat | `{reason?}` | 200 `cancelled` + audit (hanya bila semua anggota `unpaid`) | 400 `CANCEL_REASON_REQUIRED` (bila ada iuran masuk tanpa alasan); 401/404; 403 `GROUP_FORBIDDEN`/`CANCEL_NEEDS_ADMIN`; 409 `GROUP_NOT_PENDING` |
| `POST /admin/patungan/groups/:id/cancel` | admin | `{reason?}` | 200 `cancelled` + `paidMembers[]` (username, iuran, status, paymentId) + audit (batal kapan pun selama pending; iuran masuk ditangani manual) | 400 `CANCEL_REASON_REQUIRED` (bila ada iuran masuk tanpa alasan); 404; 409 `GROUP_NOT_PENDING` |
| `POST /courses/:id/payments` (+`patunganGroupId`) | JWT + rate-limit | `{patunganGroupId!}` (tanpa `voucherCode`) | 201 iuran (`amountExpected` = iuran anggota, `patunganGroupId`) + status anggota → `menunggu` | 400 `PATUNGAN_NO_VOUCHER`; 403 `PATUNGAN_NOT_MEMBER`; 404 `GROUP_NOT_FOUND`; 409 `PATUNGAN_QUEUE_CONFLICT` (antrean individu terbuka) / `ALREADY_ENROLLED` |
| `POST /admin/payments/:id/verify` (iuran patungan) | admin | sama | terima: anggota → `diverifikasi`; bila semua lunas → grant semua + grup `complete` + audit `patungan.complete` (respons memuat `groupCompleted`); tolak: anggota → `ditolak` | 400 `AMOUNT_INSUFFICIENT`; 404; 409 `PAYMENT_LOCKED` |

Uji: `patungan/__tests__/patungan-rules.test.ts` (unit split/normalisasi) +
`patungan/__tests__/patungan.test.ts` (HTTP: validasi, aturan buat, bayar
sendiri-sendiri + gate lunas-semua, verifikasi ganda, cancel pembuat/admin +
alasan wajib bila ada iuran masuk).

---

## 10c. Pembayaran QRIS manual — `/courses/:id/payments`, `/payments/*`, `/me/payments`, `/admin/payments*`

Antrean `menunggu` dibuat peserta, bukti diunggah, admin verifikasi → enrollment
`source: "payment:manual"`. Diskon: voucher valid **atau** promo aktif, diambil
**terbesar** (seri dimenangkan promo agar kuota voucher tidak hangus); voucher yang
kalah tidak dikonsumsi. `amountExpected` adalah tagihan otoritatif (server hitung ulang
+ simpan ulang tiap `create` selama bukti belum diunggah).

| Endpoint | Auth/Role | Body | Sukses | Error |
|---|---|---|---|---|
| `POST /courses/:id/payments` | JWT + rate-limit | `{proofFileId?, voucherCode?}` (strict) | 201 antrean (idempoten per antrean terbuka) `{invoice,amountExpected,voucherCode,promoSlug,discountAmount,...}` + audit `payment.create` | 400 kursus gratis; 403 `ENROLLMENT_CLOSED` (arsip/ended), `NEEDS_MANUAL_GRANT` bila berbayar tanpa jalur ini? tidak — ini JALUR bayarnya; 404 kursus/draft; 409 `ALREADY_ENROLLED`; `VOUCHER_INVALID` (+ kode asli voucher) |
| `PATCH /payments/:id/proof` | JWT + rate-limit | `{proofFileId!}` (gambar jpg/png/webp ≤5MB, magic-bytes, milik sendiri) | 200 + audit `payment.proof` | 400 `FILE_INVALID`/kind; 403 bukan milik; 404; 409 `PAYMENT_LOCKED` |
| `DELETE /payments/:id` | JWT + rate-limit | — (batalkan antrean menunggu milik sendiri; hard delete + hapus file bukti bila tak dipakai antrean lain; patungan → anggota kembali `unpaid`) | 200 `{id,courseId,cancelled}` + audit `payment.cancel` | 401; 404; 409 `PAYMENT_LOCKED` (sudah diputus admin) / `GROUP_NOT_PENDING` |
| `GET /me/payments?courseId=` | JWT | — | 200 antrean terakhir kursus itu / `null` (untuk polling klien) | — |
| `GET /me/payments?status=&limit=&page=` | JWT | filter `menunggu\|diverifikasi\|ditolak`, limit 1–100 (default 20) | 200 `{items[{id,invoice,courseId,courseTitle,status,rejectReason,...}],total,page,limit}` (untuk bell peserta) | 401 |
| `GET /admin/payments?...` | admin | filter status/courseId/limit/page; seluruh antrean (manual + DOKU; tanpa gate bukti agar iuran patungan ikut tampil) | 200 `{items[{userEmail,userName,courseTitle,...,gateway,dokuReferenceId,dokuExpiresAt,promoSlug,patunganGroupId}],total}` | — |
| `POST /admin/payments/:id/verify` | admin | `{decision: terima\|tolak, amountPaid? (wajib bila terima), reason? (wajib bila tolak)}` | terima: 200 + enrollment aktif + hanguskan voucher bila ada + audit; tolak: 200 + alasan + audit | 400 `AMOUNT_INSUFFICIENT`/alasan/nominal; 404; 409 `PAYMENT_LOCKED`/`VOUCHER_EXHAUSTED`/`VOUCHER_REUSED` |

Uji: `payments/__tests__/payment-verify.test.ts` + `payment-rules.test.ts` (unit aturan nominal).

### 10c2. QRIS dinamis DOKU — `/payments/doku/*`, `/payments/:id/qr`

Pengganti total jalur manual (UI hanya mengekspos DOKU; endpoint manual
dipertahankan untuk antrean lawas). Nominal otoritatif tetap
`amountExpected` server (voucher/promo non-stack dihitung sebelum order DOKU).

| Endpoint | Auth/Role | Sukses | Error |
|---|---|---|---|
| `POST /courses/:id/payments` + `{gateway:"doku"}` | JWT + rate-limit | 201 antrean `menunggu` + kolom `dokuReferenceId/dokuExpiresAt` (+ audit `payment.create` gateway doku); QR kedaluwarsa pada antrean terbuka → generate ulang + audit `payment.doku.refresh` | 400 `PATUNGAN_DOKU_PENDING` (iuran patungan via DOKU menyusul) / `DOKU_NO_PROOF`; 403/404/409 sama seperti manual + `DOKU_QUEUE_CONFLICT` (antrean manual terbuka); 503 `DOKU_NOT_CONFIGURED` / `DOKU_NOT_WIRED` (tanpa QR palsu) |
| `GET /payments/:id/qr` | JWT pemilik/admin | 200 `image/png` QRIS dinamis (`no-store`) | 401/404 (`DOKU_QR_MISSING` bila QR belum ada) |
| `POST /payments/:id/doku/refresh` | JWT pemilik + rate-limit | 200 antrean (QR baru bila kedaluwarsa/hilang) + audit `payment.doku.refresh` | 404; 409 `PAYMENT_LOCKED`; 503 DOKU belum siap |
| `POST /payments/doku/notify` | **publik** + rate-limit (verifikasi signature RSA `DOKU_PUBLIC_KEY` atas raw body) | 200 `{id,status,deduped}`; sukses = grant `payment:doku` + hanguskan voucher + audit `payment.doku.notify` (idempoten: baris sudah diputus → `deduped:true`); gagal/kedaluwarsa = `ditolak` + alasan | 401 `SIGNATURE_INVALID`; 400 `DOKU_NOTIFY_UNKNOWN`; 404 `DOKU_REFERENCE_UNKNOWN`; 503 `DOKU_NOT_CONFIGURED` |

`POST /admin/payments/:id/verify` kini menolak baris DOKU (409 `DOKU_MANAGED`).
Uji: `doku/__tests__/doku.test.ts` (unit kripto/status/gate/QR tanpa DB/jaringan).

---

## 10d. Pengajuan instruktur & dasbor — `/instructor-applications*`, `/instructor/dashboard`

| Endpoint | Auth/Role | Body | Sukses | Error |
|---|---|---|---|---|
| `POST /instructor-applications` | publik + rate-limit | `{nama,email,tentang?,skill?,youtube?,linkedin?,referralEmail?,foto?,cv?}` + berkas (foto ≤2MB jpg/png/webp, CV PDF ≤5MB, magic-bytes) | 201 `{code,status:'submitted'}` + audit `application.submit` | 400 validasi/berkas; 409 `APPLICATION_EXISTS`/`EMAIL_TAKEN` |
| `GET /admin/instructor-applications?...` | admin | filter status/q/limit/page | 200 `{items,total}` | — |
| `GET /admin/instructor-applications/:id` | admin | — | 200 detail | 404 |
| `PATCH /admin/instructor-applications/:id` | admin | `{status: under_review\|approved\|rejected, reviewNote?}` | 200 + audit `application.review` (transaksional) | 400/404 |
| `DELETE /admin/instructor-applications/:id` | admin | — | 200 `{id}` + audit `application.delete` + hapus byte best-effort | 404 |
| `POST /admin/instructor-applications/:id/invite` | admin | `{expiresInDays?}` | 201 undangan + status `approved` + audit `application.invite` — **atomik satu transaksi** (tidak ada undangan yatim) | 404; 409 `ALREADY_REJECTED`/email terdaftar |
| `GET /instructor/dashboard/` | teacher/admin | — | 200 ringkasan agregat dari DB (kursus kelola, antrean, dsb; tanpa data contoh) | 401/403 |

---

## 10e. Bagi hasil instruktur + penarikan — `/admin/revenue-settings`, `/admin/payouts*`, `/me/earnings`, `/me/payouts`

Persen global milik admin; snapshot hak per pembayaran terverifikasi (manual + webhook DOKU, idempoten per `paymentId`, `floor(amountPaid × persen / 100)`); transfer dana manual di luar sistem.

| Endpoint | Auth/Role | Body | Sukses | Error |
|---|---|---|---|---|
| `GET /admin/revenue-settings` | admin | — | 200 `{instructorPercent, minWithdrawal}` (self-heal baris default 70/100000) | 403 |
| `PUT /admin/revenue-settings` | admin + rate-limit | `{instructorPercent 1–99, minWithdrawal ≥ 0}` | 200 + audit `revenue.settings.update` (hanya pembayaran berikutnya) | 400 validasi; 403 |
| `GET /admin/payouts?status=&limit=&page=` | admin | filter `diajukan/diproses/berhasil/ditolak` | 200 `{items(+instructorName/Email),total,page}` | 403 |
| `POST /admin/payouts/:id/process` | admin + rate-limit | `{action: setujui\|tolak\|tandai-ditransfer, reason?}` (alasan wajib bila tolak) | 200 `{id,status}` + audit `payout.process`; transisi: diajukan→diproses (setujui), diproses→berhasil (tandai-ditransfer), diajukan/diproses→ditolak | 400 validasi/tanpa alasan; 404; 409 `PAYOUT_LOCKED` (transisi ilegal) |
| `GET /me/earnings` | teacher | — | 200 `{totalEarned,available,pending,paid,percent,minWithdrawal,courses[{courseId,title,earned,payments}]}` (available = total − diajukan/diproses/berhasil) | 401/403 |
| `GET /me/payouts?status=&limit=&page=` | teacher | — | 200 `{items,total,page,limit}` milik sendiri | 401/403 |
| `POST /me/payouts` | teacher + rate-limit | `{amount int>0, bankName 1–100, accountNumber 4–50 (digit/spasi/strip), accountName 1–150}` | 201 `{id,amount,status:'diajukan',available}` + audit `payout.request`; kunci per instruktur (anti double-spend) | 400 validasi/`PAYOUT_BELOW_MINIMUM`/`PAYOUT_INSUFFICIENT`; 401/403 |

---

## 11. Admin pengguna & instruktur — `/admin/users`, `/admin/courses/:id/instructors`

| Endpoint | Role | Body | Sukses | Error |
|---|---|---|---|---|
| `GET /admin/overview` | admin | — | 200 `{totalStudents,totalTeachers,totalCourses,totalCertificates}` (4 agregat ringan untuk badge/kartu) | 403 |
| `GET /admin/reports?from=&to=&courseId=&limit=&page=` | admin | `from/to` YYYY-MM-DD, `courseId` angka, `limit` 1–100 (default 100), `page` ≥ 1 | 200 `{summary{...},perCourse[...incl. paymentsDitolak],certificates{issued,revoked},filters,paging{page,limit,total},insights{funnel[{stage,label,basis,count,pctOfFirst,pctOfPrev|null bila tahap sblm. nol}],rates{approval,rejection,completion,certPerEnrollment,certified,revoke},note},monthly[{month YYYY-MM,revenue,payments,enrollments,certificates}]` (read-only; deret 12 bulan terakhir, atau bulan dalam rentang from–to bila keduanya diisi maks 24; menghormati filter courseId; seluruh tahap funnel SATU lingkup filter — tahap 1 = pendaftar periode / peserta kursus; tiap tahap independen per tabel sehingga bisa naik; `avgProgress/pendingReviews` tetap snapshot) | 400 `INVALID_DATE/INVALID_RANGE/INVALID_COURSE_ID`; 403 |
| `GET /admin/users?role=&isActive=&q=&limit=&page=` | admin | — | 200 `{items{id,name,username,email,expertise,role,isActive,avatarUrl(/api/v1/files/:id/content\|null),coverUrl(\|null),createdAt},total}` **tanpa `passwordHash`** | 403 |
| `GET /admin/users/:id` | admin | — | 200 detail + `{avatarUrl,coverUrl,enrollmentCount,certificateCount}` tanpa `passwordHash` | 403/404 |
| `POST /admin/users` | admin | `{name 2–100, email, password 8–72}` (role dikunci `teacher`) | 201 + audit `user.create` | 400/409 `EMAIL_TAKEN` |
| `PATCH /admin/users/:id` | admin | `{name? 2–100, email?, expertise? ≤100 ("" = hapus), isActive?}` (min. 1 field; ganti status diri sendiri dilarang) | 200 + audit `user.update` | 400 validasi/ubah-status-diri; 404; 409 `EMAIL_TAKEN` |
| `POST /admin/courses/:id/instructors` | admin | `{userId\|email}` (target harus teacher/admin) | 201 + audit | 400 `NOT_TEACHER`; 404 |
| `DELETE /admin/courses/:id/instructors/:userId` | admin | — | 200 + audit | 404 `ASSIGNMENT_NOT_FOUND` |

Catatan: `courses.createdBy` tetap pengelola walau baris `course_instructors` dilepas.

---

## 12. Undangan instruktur — `/admin/invitations`, `/invitations/*`

Token `randomBytes(32).hex`, hanya hash SHA-256 disimpan; default kedaluwarsa 7 hari (maks 30).

| Endpoint | Auth | Sukses | Error |
|---|---|---|---|
| `POST /admin/invitations` | admin | 201 `{token}` **plaintext sekali saja** + `inviteUrl` + `emailSent` (email SMTP; gagal kirim tidak menggagalkan pembuatan) + audit | 400 validasi; 409 `EMAIL_TAKEN` |
| `GET /admin/invitations[?status=]` | admin | 200 `{items}` (tanpa hash) | — |
| `POST /admin/invitations/:id/revoke` | admin | 200 `revoked` + audit | 404/409 `STATUS_FINAL` |
| `POST /admin/invitations/:id/reissue` | admin | 200 token baru + `inviteUrl` + `emailSent` (hash lama hangus, berlaku 7 hari) + audit `invitation.reissue` | 404/409 `STATUS_FINAL` |
| `GET /invitations/validate?token=` | publik | 200 `{email,name,expiresAt}`; kedaluwarsa → tandai `expired` | 404/410 `INVITATION_EXPIRED` |
| `POST /invitations/accept` | publik | 201 `{accessToken,user{role:'teacher'}}` (transaksi: buat akun + `accepted` + audit) | 400; 404; 409 `ALREADY_ACCEPTED`/`EMAIL_TAKEN`; 410 |

---

## 13. Upload & berkas — `POST /api/v1/uploads`, `GET /api/v1/files/:id/content`

- Upload: JWT semua peran; `{filename 1–255, mimeType 1–100, kind, data base64 ≤20MB}`; MIME dicek vs klaim + **magic-bytes**; batas `image/cover` 4MB, `audio` 8MB, `pdf`/`assignment` 10MB (assignment wajib PDF), `avatar` 2MB (JPG/PNG/WebP), `profile_cover` 4MB (JPG/PNG/WebP); limit JSON global 15MB. → 201 `{id,url,mimeType,sizeBytes}`. Kind aset kursus (`image/audio/pdf/cover`) hanya teacher/admin (siswa → 403); `assignment` + berkas pelamar + `avatar`/`profile_cover` boleh semua peran terautentikasi.
- Optimasi gambar otomatis (backend, `image-optimization.service`): semua kind gambar (kecuali GIF animasi yang dilewati utuh) dinormalisasi EXIF → resize proporsional tanpa crop/upscale (cover ≤1600, materi ≤1200, avatar ≤256, dst) → WebP; dimensi >8000px/sisi ditolak (`IMAGE_DIMENSIONS_TOO_LARGE`); varian responsif `[320,480,800,1200,1600]` dibuat otomatis untuk srcset; kolom `files.width/height/original_size_bytes` + tabel `file_variants` (migrasi 0028).
- Serve: aset kursus + `avatar`/`profile_cover` publik (`Cache-Control: public, immutable`); `assignment` privat (`private, no-store`): pemilik, admin, atau **teacher pengampu kursus yang punya submission menautkan berkas** (teacher asing → 403; anon → 403). Tambahan query `?w=lebar` memilih varian terkecil yang ≥ lebar diminta (jatuh ke berkas asli bila tak ada); otorisasi privat tetap ikut baris file induk.

---

## 14. Keterbatasan yang diketahui (bukan kontrak, jangan diandalkan klien)

1. Tidak ada endpoint yang menyetel enrollment `completed`/`expired` — status itu hanya dibaca.
2. Rate limiting: `authOtpLimiter` (30x/15 mnt/IP/endpoint) di auth, `redeem`/`validate` voucher, `invitation validate/accept`, `POST quiz-attempts`, `POST /courses/:id/payments`, `PATCH /payments/:id/proof`, `POST /uploads`, `PUT /admin/revenue-settings`, `POST /admin/payouts/:id/process`, `POST /me/payouts`, `GET /files/:id/content` (via `publicReadLimiter` 600x/15 mnt), `GET /certificates/verify/:code`, katalog kursus/kurikulum publik + `GET /promos*` (via `publicReadLimiter`); `publicSubmitLimiter` di pengajuan publik. Limiter in-memory (multi-instance butuh Redis, lihat komentar `rate-limit.middleware.ts`); `trust proxy=1` aktif agar `req.ip` akurat di balik proxy. Token undangan di query (`GET /invitations/validate`) diredaksi dari access log.
3. `GET /me/progress?courseId=` tidak mensyaratkan akses (membaca milik sendiri).
4. Re-issue sertifikat pasca-revoke terminal (409). Snapshot kelayakan dibekukan by-design; penerbitan memverifikasi ulang keberadaan modul di dalam tx.
5. Daftar kursus instruktur/admin tanpa pagination total (`array` mentah pada beberapa list progres/kuis). Daftar eligibility global dibatasi eksplisit 500 baris (`MAX_ELIGIBILITY_ROWS`). Daftar voucher admin: paginasi + filter status grup + hitungan per status semuanya server-side.
6. `parseListQuery` sertifikat sengaja lenien (fallback abaikan query tak valid) demi kompatibilitas; `eligibilityQuery` strict 400.
7. Pencarian `q` kini di-escape (`\%\_`) di courses/vouchers/admin/applications/certificates.
8. Ganti email admin TIDAK me-reset `emailVerifiedAt` (sengaja, agar tidak mengunci akun — belum ada OTP ulang). Risiko: status verified lama terbawa; admin wajib pastikan kepemilikan email baru.
9. Audit (`audit_logs`): tercatat untuk create/update/delete kursus + kurikulum, ganti bank soal, nilai tugas, buat/lampirkan/verifikasi pembayaran, redeem/grant/revoke enrollment, buat/update/assign user, voucher/invitation/application/payment/promo actions, hapus/unggah berkas. TIDAK diaudit (sengaja, frekuensi tinggi / non-sensitif): tandai/batal progres, percobaan kuis (hanya nilai yang diaudit), baca/daftar.
