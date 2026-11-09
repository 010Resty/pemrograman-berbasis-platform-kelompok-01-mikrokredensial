import authRoutes from "./modules/auth/auth.routes";
import courseRoutes, { instructorRouter } from "./modules/courses/course.routes";
import curriculaRoutes from "./modules/courses/curricula.routes";
import progressRoutes from "./modules/progress/progress.routes";
import quizRoutes from "./modules/quiz/quiz.routes";
import enrollmentRoutes from "./modules/enrollments/enrollment.routes";
import submissionRoutes from "./modules/submissions/submission.routes";
import certificateRoutes from "./modules/certificates/certificate.routes";
import voucherRoutes from "./modules/vouchers/voucher.routes";
import adminRoutes from "./modules/admin/admin.routes";
import invitationRoutes from "./modules/invitations/invitation.routes";
import paymentRoutes from "./modules/payments/payment.routes";
import promoRoutes from "./modules/promos/promo.routes";
import patunganRoutes from "./modules/patungan/patungan.routes";
import profileRoutes from "./modules/profile/profile.routes";
import applicationRoutes from "./modules/applications/application.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import { uploadsRouter, filesRouter } from "./modules/uploads/upload.routes";
import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { AuthValidationError } from "./modules/auth/auth.service";

dotenv.config();

const app: Application = express();

// Di balik proxy (staging/prod) agar req.ip akurat untuk rate-limit per IP.
// Aman untuk single-instance maupun multi-instance.
app.set("trust proxy", 1);

// Security middleware
app.use(helmet());

// CORS configuration: baca dari env, fallback dev.
const corsOrigin = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: corsOrigin.length === 1 ? corsOrigin[0] : corsOrigin,
    credentials: true,
  })
);

// Logging — redaksi query sensitif (token undangan, kode OTP)
// agar tidak tersimpan di access log.
morgan.token("redacted-url", (req) => {
  try {
    const raw = ((req as unknown as { originalUrl?: string }).originalUrl ?? req.url ?? "") as string;
    const q = raw.indexOf("?");
    if (q === -1) return raw;
    const params = new URLSearchParams(raw.slice(q + 1));
    for (const k of ["token", "code"]) {
      if (params.has(k)) params.set(k, "[redacted]");
    }
    const qs = params.toString();
    return qs ? `${raw.slice(0, q)}?${qs}` : raw.slice(0, q);
  } catch {
    return ((req as unknown as { originalUrl?: string }).originalUrl ?? req.url ?? "") as string;
  }
});
app.use(morgan(":method :redacted-url :status :response-time ms - :res[content-length]"));

// Body parsing (batas JSON dinaikkan untuk transport unggahan base64;
// validasi ukuran per-jenis tetap ditegakkan di modul uploads).
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "aristoteles-backend",
  });
});

// Authentication routes
app.use("/api/v1/auth", authRoutes);

// Course catalog & management
app.use("/api/v1/courses", courseRoutes);
app.use("/api/v1/instructor/courses", instructorRouter);
// Dashboard ringkasan instruktur (agregat database, tanpa data contoh)
app.use("/api/v1/instructor/dashboard", dashboardRoutes);
// Curriculum tree (modules / sub-modules / materials)
app.use("/api/v1", curriculaRoutes);
// Learning progress per user (own only, JWT identity)
app.use("/api/v1", progressRoutes);
// Quiz bank + attempts (server-side grading; client scores never trusted)
app.use("/api/v1", quizRoutes);
// Enrollment & akses kursus (pendaftaran mandiri gratis, grant/revoke admin)
app.use("/api/v1", enrollmentRoutes);
// Pengumpulan & penilaian tugas (riwayat append-only, lulus ditentukan server)
app.use("/api/v1", submissionRoutes);
// Sertifikat per modul (kelayakan, penerbitan idempoten, verifikasi, cabut)
app.use("/api/v1", certificateRoutes);
// Voucher akses kursus (buat/kelola admin, tukar atomik peserta)
app.use("/api/v1", voucherRoutes);
// Manajemen pengguna & penugasan instruktur (admin)
app.use("/api/v1", adminRoutes);
// Undangan instruktur (kelola admin, aktivasi publik)
app.use("/api/v1", invitationRoutes);
// Pengajuan minat instruktur (publik) + peninjauan (admin, K-01)
app.use("/api/v1", applicationRoutes);
// Pembayaran QRIS manual: ajukan + bukti (peserta), verifikasi + grant (admin)
app.use("/api/v1", paymentRoutes);
// Promo kurasi admin (diskon persen / pajang / patungan).
app.use("/api/v1", promoRoutes);
// Grup patungan: anggota username tervalidasi, iuran sendiri-sendiri,
// akses dibuka setelah semua lunas (tanpa akses parsial).
app.use("/api/v1", patunganRoutes);
// Profil milik sendiri (semua peran): baca + ubah + lepas avatar.
app.use("/api/v1", profileRoutes);

// Upload & serve berkas (gambar/audio/PDF/cover/tugas)
app.use("/api/v1/uploads", uploadsRouter);
app.use("/api/v1/files", filesRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: "error",
    message: "Route not found",
    data: null,
  });
});

// Global error handler
app.use(
  (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    if (err instanceof AuthValidationError) {
      res.status(err.httpStatus || 400).json({
        status: "error",
        message: err.message,
        errors: err.errors,
        data: null,
      });
      return;
    }

    console.error("Error:", err);

    res.status(500).json({
      status: "error",
      message: "Internal server error",
      data: null,
    });
  }
);

export default app;