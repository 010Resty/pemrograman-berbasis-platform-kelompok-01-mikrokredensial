// Wajib dievaluasi SEBELUM db/index (import pertama di invitation-reissue.test.ts):
// mengarahkan pool ke database tes, memaksa mode log (tanpa email asli),
// dan JWT rahasia deterministik — tanpa menyentuh backend/.env.
process.env.DB_NAME = "aristoteles_test_inv";
process.env.JWT_SECRET =
  "uji-terbit-ulang-undangan-minimal-32-karakter-aman";
process.env.MAIL_PROVIDER = "log";
delete process.env.SMTP_HOST;
delete process.env.SMTP_PORT;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
delete process.env.SMTP_SECURE;
process.env.FRONTEND_URL = "http://localhost:5173";
