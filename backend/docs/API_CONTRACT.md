# Kontrak API Backend ARISTOTELES

> **Sumber kebenaran**: route (`src/modules/*/ *.routes.ts`), middleware
> (`src/middlewares/auth.middleware.ts`), validator Zod di service,
> controller, `src/db/schema.ts`, dan 7 file tes integrasi.
> Dokumen ini **mendeskripsikan implementasi yang ada** — bukan usulan.
> Prefix global: `/api/v1` (kecuali ditulis lain). Hal yang belum pasti
> ditandai `[Perlu konfirmasi]`.
>
> Terakhir diselaraskan: Tahap 4 (migrasi `0000–0007`).

## 1. Konvensi umum

### 1.1 Envelope respons

Sukses: `{ "status": "success", "message": string, "data": T }`.
Gagal: `{ "status": "error", "message": string, "data": null }`
plus salah satu: `errors: [{field, message}]` (validasi Zod) atau
`code: string` (galat bisnis modul enrollment/submission/certificate/voucher/admin/invitation)
atau `failReasons: string[]` (+`requirements`) khusus `NOT_ELIGIBLE` sertifikat.
Frontend (`apiRequest`) hanya menerima envelope ini.

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

| Endpoint | Auth | Body | Sukses | Error |
|---|---|---|---|---|
| `POST /register` | — | `{name(2–100), email(≤191, dilowercase), password(8–72)}`; `role` **selalu `student`** (input role diabaikan) | 201 `{accessToken, user{id,name,email,role}}` (+`message` ganda di dalam `data`) | 400 validasi/duplikat `"Email sudah terdaftar"` |
| `POST /login` | — | `{email, password(1–72)}` | 200 pola sama | 400 `"Email atau password salah"` (generik, anti-enumerasi); 403 `"Akun Anda dinonaktifkan..."` bila `isActive=false` |
| `GET /me` | JWT | — | 200 `{user{id,name,email,role}}` (query ulang DB; `Cache-Control: no-store`) | 401 token hilang/tak valid/user terhapus |

Efek samping: tidak ada (stateless; logout = hapus token di klien).
Uji: login dalam tiap fixture tes (tidak ada file khusus auth).

---

## 3. Kursus — `/api/v1/courses`, `/api/v1/instructor/courses`

Komentar `course.routes.ts:8` ("hanya published") **kedaluwarsa** — kode aktual:
katalog publik = `published` + `archived`; `draft` tidak bocor.

| Endpoint | Auth/Role | Sukses | Error |
|---|---|---|---|
| `GET /courses?category=&period=&q=&status=published\|archived&limit=&page=&sort=newest\|oldest` | publik | 200 array kursus (default limit 20, maks 100; `status` selain dua nilai → diabaikan = keduanya) | 200 selalu (query tak valid → fallback default, bukan 400) |
| `GET /courses/:id` | opsional | 200 detail + `instructors[]`; arsip publik; draft → 404 kecuali pengelola | 404 hilang/draft-asing/id non-int |
| `POST /courses` | teacher/admin | 201; **selalu `status:'draft'`**; relasi pengampu pembuat atomik | 400 Zod (`title` 10–120, `category` ∈ {Pengembangan Web, Basis Data, Jaringan, Keamanan, AI & Data, Infrastruktur, Desain, Bisnis}, `level` ∈ {Pemula, Menengah, Lanjutan} default Pemula, `durationMonths` 1–36, `description` 30–5000, `coverUrl` kosong/`/api/…`/http(s) ≤500, `period` ∈ {upcoming, ongoing, ended}, `startMonth` 1–100, `priceNominal` int ≥0, `outcomes` 2–20 × ≥10 karakter, `tools` 1–20) |
| `PATCH /courses/:id` | teacher/admin + pengelola | 200 (termasuk ganti `status` draft↔published↔archived; `priceNominal` → `priceLabel` dihitung ulang) | 400 schema parsial kosong/tak valid; 403 pengelola-bukan (`exists?403:404`) |
| `DELETE /courses/:id` | teacher/admin + pengelola | 200 `data:null`; cascade tree via FK; cover internal `/api/v1/files/:id/content` dibersihkan best-effort | 403/404 pola sama |
| `GET /instructor/courses[?scope=mine]` | teacher/admin | teacher (atau admin `scope=mine`): kursus yang diampu/dibuat; admin default: semua + filter `status` | 401/403 |

Uji relevan: `material-pass-score.test.ts` (skema `passScore` materi).

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
| `PATCH/DELETE /materials/:matId` | tulis | patch parsial non-kosong |

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
| `POST /materials/:id/progress` | JWT + hak akses | 200 `{materialId,completed:true,alreadyCompleted}` (idempoten; baris kedua hanya refresh waktu) | 403 `NO_ACCESS`; 404 draft-asing/hilang/id buruk |
| `DELETE /materials/:id/progress` | JWT + hak akses | 200 `data:null` (idempoten) | sama |
| `GET /me/progress[?courseId=]` | JWT | 200 `number[]` milik sendiri | 400 `courseId` tak valid; 404 kursus asing/hilang |

Uji: `progress.test.ts` (401, id invalid, idempoten, filter, isolasi, draft, batalkan).

---

## 7. Kuis — `/materials/:id/quiz*`

Materi harus `type:'kuis'` (selain itu 400). Penilaian 100% server; skor klien ditolak skema strict.

| Endpoint | Auth/Role | Sukses | Error |
|---|---|---|---|
| `PUT /materials/:id/quiz` | teacher/admin pengelola | 200 bank baru `{isCorrect,explanation}` (ganti atomik; snapshot lama utuh) | 400 (0/2 kunci, <2 opsi, 0 soal); 403 siswa; 400 non-kuis |
| `GET /materials/:id/quiz` | JWT + hak akses | 200 soal **tanpa** `isCorrect`/`explanation` | 400 non-kuis; 404; 403 `NO_ACCESS`; 401 |
| `POST /materials/:id/quiz-attempts` | JWT + hak akses | 201 `{attemptId,score,total,correct,passScore,passed,bestScore,attempts,overallPassed}`; `score=round(correct/total*100)`; `passScore` = snapshot materi; append-only | 400 (skor buatan, duplikat `questionId`, id asing, opsi lintas soal, kuis kosong) |
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
| `POST /materials/:id/submissions/:subId/grade` | teacher/admin pengelola | strict `{score 0–100 **wajib**, decision passed\|failed\|revision_requested **wajib**, feedback?(≤2000)}` | 200 + `gradedBy/gradedAt` + audit `submission.grade` (transaksi) | 400 Zod; 403 `NOT_MANAGER`/role; 404 |

Uji: `submissions.test.ts` (submit×N, validasi berkas, isolasi, revision→lulus, sticky-pass, proteksi berkas 6 skenario).

---

## 9. Sertifikat — `/modules/:id/certificate`, `/me/certificates`, `/certificates/verify/:code`, `/instructor/*`

Satu baris per (peserta, modul); `UNIQUE(userId,moduleId)` + transaksi = idempoten & anti-ganda. Semua materi = wajib; syarat per-tipe: biasa→progres, kuis→lulus, tugas→lulus.

| Endpoint | Auth/Role | Sukses | Error |
|---|---|---|---|
| `POST /modules/:id/certificate` | JWT + hak akses | 201 baru / 200 sudah ada `{id,code ATS-YYYY-XXXXXXXX,recipientName,courseId/Title,moduleId/Title,status,issuedAt,...}`; snapshot nama+persyaratan; audit `certificate.issue` | 403 `NOT_ELIGIBLE` (+`failReasons`,`requirements`); 409 `CERT_REVOKED`; 404 |
| `GET /me/certificates` | JWT | 200 milik sendiri | 401 |
| `GET /me/modules/:id/certificate-status` | JWT + hak akses | 200 `{eligible,requirements[],failReasons[],certificate?}` | 403/404 |
| `GET /certificates/verify/:code` | **publik** | 200 minimal `{code,recipientName,courseTitle,moduleTitle,status,issuedAt,revokedAt}`; tanpa userId/email/nilai | 404 `CODE_NOT_FOUND` |
| `GET /instructor/certificates?courseId=&moduleId=&status=issued\|revoked&q=&limit=&page=` | teacher/admin (scope kursus tanggung jawab) | 200 `{items,total}` (termasuk dicabut) | 403 luar scope |
| `GET /instructor/certificates/:certId` | teacher/admin scope | 200 + `requirementsSnapshot`,`revokedBy` | 403/404 |
| `POST /instructor/certificates/:certId/revoke` | teacher/admin scope | 200 `status:'revoked'` + `revokeReason/By/At` + audit; verify ikut `revoked` | 400 alasan (<5); 409 `ALREADY_REVOKED`; 403/404 |
| `GET /instructor/modules/:id/eligibility[?status=]` | teacher/admin scope | 200 `{items:[{userId,studentName,email,status: sudah_terbit\|memenuhi\|menunggu_penilaian\|belum_memenuhi,...}]}` | 403/404 |

Tidak ada PDF server (keputusan: JSON + halaman printable). Re-issue pasca-revoke terminal (409).
Uji: `certificates.test.ts` (8: eligible+terbit+idempoten+snapshot, NOT_ELIGIBLE, verify, list/scope/eligibility, revoke+audit, concurrency paralel).

---

## 10. Voucher — `/vouchers/redeem`, `/admin/vouchers*`

| Endpoint | Auth/Role | Body | Sukses | Error |
|---|---|---|---|---|
| `POST /vouchers/redeem` | JWT | strict `{code, courseId}` (kode dinormalisasi uppercase) | 201 `{status:'active',source:'voucher'}` + enrollment + audit; anti-race (`FOR UPDATE` + `UNIQUE(voucher,user)` + kenaikan bersyarat + retry backoff) | 404 `CODE_NOT_FOUND`/kursus; 403 `VOUCHER_DISABLED`/`VOUCHER_EXPIRED`/`QUOTA_EXHAUSTED`/`VOUCHER_FOR_ACCOUNT`/`COURSE_MISMATCH`/`ENROLLMENT_CLOSED`; 409 `ALREADY_ENROLLED`/`ALREADY_REDEEMED` |
| `POST /admin/vouchers` | admin | `{code?(4–32 A-Z0-9-, auto `ATS-XXXXXXXX`), courseId!, kind!, maxUses? (personal dipaksa 1; umum wajib ≥1), assignedUserId/email? (personal wajib, umum dilarang), expiresAt? (masa depan)}` | 201 (personal `assigned`, umum `available`) + audit | 400 validasi/`PERSONAL_MAX_USES`/`ASSIGNEE_FORBIDDEN`/`INVALID_EXPIRY`; 404 kursus/penerima; 409 `CODE_TAKEN` |
| `GET /admin/vouchers?...` | admin | filter courseId/status/kind/q | 200 `{items[{remaining,assignedEmail...}],total}` | — |
| `GET /admin/vouchers/:code` (+`/:code/redemptions`) | admin | — | 200 detail + ≤50 redemptions / riwayat `{items,total}` | 404 |
| `POST /admin/vouchers/:code/disable` | admin | `{reason?}` | 200 `revoked` + audit | 409 final/sudah-revoked |
| `POST /admin/vouchers/:code/enable` | admin | — | 200 kembali ke `assigned`/`available` + audit | 409 bukan-revoked |

Uji: `voucher-admin.test.ts` (11: create/validasi, redeem+redeemed, personal, mismatch/draft/ended, expired/disable/enable, **konkurensi 5 paralel**, users, assign, invitation).

---

## 11. Admin pengguna & instruktur — `/admin/users`, `/admin/courses/:id/instructors`

| Endpoint | Role | Body | Sukses | Error |
|---|---|---|---|---|
| `GET /admin/users?role=&isActive=&q=&limit=&page=` | admin | — | 200 `{items,total}` **tanpa `passwordHash`** | 403 |
| `POST /admin/users` | admin | `{name 2–100, email, password 8–72}` (role dikunci `teacher`) | 201 + audit `user.create` | 400/409 `EMAIL_TAKEN` |
| `PATCH /admin/users/:id` | admin | `{isActive}` | 200 + audit `user.enable/disable` | 400 ubah diri sendiri; 404 |
| `POST /admin/courses/:id/instructors` | admin | `{userId\|email}` (target harus teacher/admin) | 201 + audit | 400 `NOT_TEACHER`; 404 |
| `DELETE /admin/courses/:id/instructors/:userId` | admin | — | 200 + audit | 404 `ASSIGNMENT_NOT_FOUND` |

Catatan: `courses.createdBy` tetap pengelola walau baris `course_instructors` dilepas.

---

## 12. Undangan instruktur — `/admin/invitations`, `/invitations/*`

Token `randomBytes(32).hex`, hanya hash SHA-256 disimpan; default kedaluwarsa 7 hari (maks 30).

| Endpoint | Auth | Sukses | Error |
|---|---|---|---|
| `POST /admin/invitations` | admin | 201 `{token}` **plaintext sekali saja** + audit | 400 validasi; 409 `EMAIL_TAKEN` |
| `GET /admin/invitations[?status=]` | admin | 200 `{items}` (tanpa hash) | — |
| `POST /admin/invitations/:id/revoke` | admin | 200 `revoked` + audit | 404/409 `STATUS_FINAL` |
| `GET /invitations/validate?token=` | publik | 200 `{email,name,expiresAt}`; kedaluwarsa → tandai `expired` | 404/410 `INVITATION_EXPIRED` |
| `POST /invitations/accept` | publik | 201 `{accessToken,user{role:'teacher'}}` (transaksi: buat akun + `accepted` + audit) | 400; 404; 409 `ALREADY_ACCEPTED`/`EMAIL_TAKEN`; 410 |

---

## 13. Upload & berkas — `POST /api/v1/uploads`, `GET /api/v1/files/:id/content`

- Upload: JWT semua peran; `{filename 1–255, mimeType 1–100, kind, data base64 ≤20MB}`; MIME dicek vs klaim + **magic-bytes**; batas `image/cover` 4MB, `audio` 8MB, `pdf`/`assignment` 10MB (assignment wajib PDF); limit JSON global 15MB. → 201 `{id,url,mimeType,sizeBytes}`.
- Serve: aset kursus publik (`Cache-Control: public, immutable`); `assignment` privat (`private, no-store`): pemilik, admin, atau **teacher pengampu kursus yang punya submission menautkan berkas** (teacher asing → 403; anon → 403).

---

## 14. Keterbatasan yang diketahui (bukan kontrak, jangan diandalkan klien)

1. Tidak ada endpoint yang menyetel enrollment `completed`/`expired` — status itu hanya dibaca.
2. Tidak ada rate limiting; tidak ada pembersihan file orphan terjadwal.
3. `GET /me/progress?courseId=` tidak mensyaratkan akses (membaca milik sendiri).
4. Re-issue sertifikat pasca-revoke terminal (409).
5. Daftar kursus instruktur/admin tanpa pagination total (`array` mentah pada beberapa list progres/kuis).
