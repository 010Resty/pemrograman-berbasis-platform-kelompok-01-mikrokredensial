import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import {
  getMailFrom,
  getMailProvider,
  getSmtpConfig,
  sendTestEmail,
} from "./mailer";

/**
 * Diagnosa konfigurasi email tanpa mencetak rahasia:
 * `npm run mail:check` → diagnosis saja (tanpa jaringan).
 * `npm run mail:check -- --to=nama@mail.com` → kirim 1 email uji asli.
 */
const main = async (): Promise<void> => {
  const toArg = process.argv
    .find((a) => a.startsWith("--to="))
    ?.slice("--to=".length)
    .trim();

  let cfg;
  try {
    cfg = getSmtpConfig();
  } catch (error) {
    console.error(
      `SMTP tidak valid: ${error instanceof Error ? error.message : error}`
    );
    console.error("Perbaiki mengikuti backend/.env.example lalu ulangi.");
    process.exitCode = 1;
    return;
  }

  const provider = getMailProvider();
  console.log(`provider : ${provider}`);
  if (cfg.host) {
    console.log(`smtp     : ${cfg.host}:${cfg.port} (secure=${cfg.secure})`);
    console.log(`user     : ${cfg.user}`);
  } else {
    console.log("smtp     : (belum diisi → mode log, email hanya ke console)");
  }
  console.log(`from     : ${getMailFrom()}`);
  console.log(
    `frontend : ${process.env.FRONTEND_URL?.trim() || "(kosong → fallback APP_URL/localhost:5173)"}`
  );

  if (!toArg) return;
  try {
    await sendTestEmail(toArg);
    console.log(`email uji terkirim ke ${toArg}`);
  } catch (error) {
    console.error(
      `gagal kirim: ${error instanceof Error ? error.message : error}`
    );
    process.exitCode = 1;
  }
};

void main();
