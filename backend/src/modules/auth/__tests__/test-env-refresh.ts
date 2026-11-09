// Wajib dievaluasi SEBELUM db/index: mengarahkan pool ke database tes
// terpisah (aristoteles_test_auth), TIDAK PERNAH menyentuh database live.
process.env.DB_NAME = "aristoteles_test_auth";
