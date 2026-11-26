import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";

/**
 * Proxy foto profil SIMAT (anti-CORB/hotlink).
 * Browser memblokir <img> lintas-origin bila respons UNIRA tidak dikenali
 * sebagai gambar aman (teramati: CORB block). Backend mengambil byte gambar
 * server-to-server (tanpa referer browser) lalu meneruskannya same-origin
 * dengan Content-Type image/* yang benar + cache 1 jam.
 * - Hanya dipakai untuk sesi sendiri (avatarUrl own-session).
 * - Gagal (URL kosong, non-200, bukan gambar, >512KB) = null → frontend
 *   menampilkan inisial, bukan ikon rusak.
 */

interface CachedPhoto {
  data: Buffer;
  contentType: string;
  expiresAt: number;
}

const cache = new Map<number, CachedPhoto>();
const TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 100;
const MAX_BYTES = 512 * 1024;

const pruneCache = (): void => {
  if (cache.size <= MAX_ENTRIES) {
    // Tetap bersihkan entri kedaluwarsa agar memori tidak menumpuk.
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(key);
    }
    return;
  }
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  if (cache.size <= MAX_ENTRIES) return;
  // Penuh: buang yang paling lama kedaluwarsanya dulu.
  const ordered = [...cache.entries()].sort(
    (a, b) => a[1].expiresAt - b[1].expiresAt
  );
  for (const [key] of ordered.slice(0, cache.size - MAX_ENTRIES)) {
    cache.delete(key);
  }
};

/** Cek magic bytes: JPEG / PNG / GIF / WEBP. */
const isImageMagic = (buf: Buffer): boolean => {
  if (buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return true;
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;
  return (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  );
};

export const getUniraPhoto = async (
  userId: number
): Promise<CachedPhoto | null> => {
  const now = Date.now();
  const hit = cache.get(userId);
  if (hit && hit.expiresAt > now) return hit;
  cache.delete(userId);

  const rows = await db
    .select({ photoUrl: users.photoUrl, avatarFileId: users.avatarFileId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const row = rows[0];
  const url = row?.photoUrl?.trim() ?? "";
  if (!row || !url || !/^https:\/\//i.test(url) || /[\s<>"]/.test(url)) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        accept: "image/*",
        "accept-language": "id-ID,id;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Linux; Android 10; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
      },
    });
    if (!res.ok) {
      console.warn(`[unira:photo] http ${res.status}`);
      return null;
    }
    const contentType = (res.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!contentType.startsWith("image/")) {
      console.warn(`[unira:photo] non-image content-type (${contentType})`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES || !isImageMagic(buf)) {
      console.warn("[unira:photo] invalid image bytes");
      return null;
    }
    const entry: CachedPhoto = {
      data: buf,
      contentType,
      expiresAt: now + TTL_MS,
    };
    cache.set(userId, entry);
    pruneCache();
    return entry;
  } catch (error) {
    const name = error instanceof Error ? error.name : "unknown";
    console.warn(`[unira:photo] fetch failed (${name})`);
    return null;
  } finally {
    clearTimeout(timer);
  }
};
