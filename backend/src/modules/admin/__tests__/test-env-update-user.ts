// Wajib dievaluasi SEBELUM db/index (import pertama di admin-update-user.test.ts):
// mengarahkan pool ke database tes TERPISAH, tanpa menyentuh backend/.env.
process.env.DB_NAME = "aristoteles_test_adm";
process.env.JWT_SECRET =
  "uji-ubah-akun-admin-minimal-32-karakter-aman";
process.env.MAIL_PROVIDER = "log";
delete process.env.SMTP_HOST;
delete process.env.SMTP_PORT;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
delete process.env.SMTP_SECURE;
