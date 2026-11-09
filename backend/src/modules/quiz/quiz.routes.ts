import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import { authOtpLimiter } from "../../middlewares/rate-limit.middleware";
import {
  attemptHandler,
  bestHandler,
  getQuizHandler,
  historyHandler,
  putQuizHandler,
} from "./quiz.controller";

const router = Router();

const write = [authenticate, requireRole("teacher", "admin")];

// Soal untuk peserta: tanpa kunci jawaban dan tanpa pembahasan.
router.get("/materials/:id/quiz", authenticate, getQuizHandler);
// Kelola bank soal: hanya teacher pengelola + admin.
router.put("/materials/:id/quiz", ...write, putQuizHandler);

// Percobaan: jawaban dinilai server, skor klien tidak dipercaya.
// Dibatasi per IP agar kunci tidak bisa di-brute-force.
router.post("/materials/:id/quiz-attempts", authenticate, authOtpLimiter(), attemptHandler);
router.get("/materials/:id/quiz-attempts", authenticate, historyHandler);
router.get("/materials/:id/quiz-best", authenticate, bestHandler);

export default router;
