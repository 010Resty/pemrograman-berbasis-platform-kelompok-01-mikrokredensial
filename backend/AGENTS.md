# AGENTS — ARISTOTELES Backend

Panduan kerja agen coding backend. Ringkas dan wajib diikuti. Precedence tertinggi di atas semua skill.

## 1. Identitas dan tujuan

Backend LMS mikrokredensial (Express 4 + TypeScript strict + Drizzle ORM + MySQL/mysql2 + Zod).
Tujuan: kerjakan permintaan kecil dengan aman, jaga modul lain, lapor jujur.
Perintah: `npm run dev`, cek: `npx tsc --noEmit`, uji: `npm test`. Jangan install, migrasi (`db:generate/db:migrate/db:push/db:seed`), build, deploy, studio tanpa diminta eksplisit.

## 2. Teknologi terverifikasi (mengikat semua skill)

- Runtime: Node.js + Express 4 (`src/app.ts`, `src/server.ts`). Jangan ganti ke Fastify/Hono/NestJS/Bun/Deno tanpa diminta eksplisit.
- ORM satu-satunya: Drizzle ORM (`drizzle-orm` + `drizzle-kit`, `src/db/`, `drizzle.config.ts`). Abaikan contoh Sequelize/Prisma/TypeORM di skill.
- Validasi standar: Zod (`z.object`, `safeParse`, `z.infer`) untuk body/query/params/env. Jangan pakai Joi/Valibot/ArkType/Yup tanpa diminta.
- Auth: JWT (`jsonwebtoken`) + `bcryptjs`; `helmet`, `cors`, `morgan`, `nodemailer`. Jangan tulis secret/token ke kode/dokumen.
- Module style: ESM `import` (bukan CJS `require`). TypeScript strict, tanpa `any` di boundary.

## 3. Precedence skill

1. `AGENTS.md` ini + `frontend/AGENTS.md` + `docs/01,04,06,07,09` selalu menang atas skill mana pun.
2. Backend: `drizzle` (skema/query) > `zod` (validasi) > `nodejs-express-server` (pola Express, kecuali bagian Sequelize) > `nodejs-backend-patterns`/`nodejs-best-practices`/`backend-craft` (hanya referensi prinsip, bukan scaffold).
3. `backend-craft` (global) hanya boleh dipakai sebagai checklist prinsip setelah stack di atas dikunci. Klaim `When in doubt, activate` TIDAK berlaku di ARISTOTELES. Jangan ikuti anjuran ganti framework/ORM/library tanpa persetujuan eksplisit.

## 4. Larangan eksekusi tanpa persetujuan eksplisit

Dilarang menjalankan tanpa kata eksplisit user (`silakan install/migrate/build/run`):
`npm install`, `npx ...`, `drizzle-kit generate/migrate/push/studio`, `tsx src/db/migrate.ts`, `tsx src/db/seed.ts`, `sequelize.sync({alter:true})`, script `*.sh/*.py/*.cjs` di skill, perubahan `drizzle.config.ts`/`tsconfig.json`/`package.json`.

## 5. Duplikat yang diketahui

- `nodejs-backend-patterns` dan `typescript-advanced-types` terpasang ganda (backend + frontend) dengan isi divergen. Lihat `ARISTOTELES.md` di masing-masing folder skill untuk rute kanonis. Jangan tulis-ulang/sinkronkan isi tanpa persetujuan.
- Referensi `database-integration-postgresql-with-sequelize.md` di `nodejs-express-server` DINONAKTIFKAN untuk ARISTOTELES. Gunakan skill `drizzle`.
