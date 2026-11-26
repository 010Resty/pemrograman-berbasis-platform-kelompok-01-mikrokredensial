import { AuthValidationError } from "./auth.service";

/**
 * Klien backend-to-backend ke API UNIRA SIMAT.
 * - Tidak menyimpan password/token; hanya dipakai dalam request.
 * - Tidak melempar HTML mentah UNIRA ke pengguna.
 * - Semua kegagalan jaringan/timeout dipetakan ke 503 agar frontend
 *   menampilkan "layanan UNIRA tidak tersedia".
 */

export interface UniraTokenResult {
  accessToken: string;
  refreshToken: string | null;
  tokenId: string | null;
}

export interface UniraProfile {
  /** Identifier stabil dari profil resmi (teramati: data.id = NIM). */
  providerUserId: string;
  nim: string;
  name: string;
  email: string;
  prodi: string | null;
  fakultas: string | null;
  /** Foto profil SIMAT (`thumbnail`, absolut https siap render). */
  photoUrl: string | null;
  /** Status akademik SIMAT (teramati: "aktif"). */
  status: string | null;
  raw: unknown;
}

interface UniraConfig {
  baseUrl: string;
  timeoutMs: number;
  client: string;
  profilePath: string;
  allowClaimFallback: boolean;
  origin: string;
  referer: string;
  userAgent: string;
  /** Basis host foto SIMAT untuk thumbnail relatif (teramati: img/profil/...). */
  photoBase: string;
}

export const getUniraConfig = (): UniraConfig => {
  const rawBase =
    process.env.UNIRA_API_BASE_URL?.trim() || "https://api.unira.ac.id";
  const timeoutRaw = Number.parseInt(
    process.env.UNIRA_TIMEOUT_MS ?? "10000",
    10
  );
  return {
    baseUrl: rawBase.replace(/\/+$/, ""),
    timeoutMs:
      Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 10000,
    client: process.env.UNIRA_CLIENT?.trim() || "simat",
    profilePath: process.env.UNIRA_PROFILE_PATH?.trim() || "/v1/saya",
    allowClaimFallback:
      (process.env.UNIRA_ALLOW_UNVERIFIED_CLAIM_FALLBACK ?? "")
        .trim()
        .toLowerCase() === "true",
    // Header browser SIMAT (hasil audit DevTools): API menolak request tanpa
    // origin/referer simat (403) walau Bearer valid. Default meniru browser.
    origin:
      process.env.UNIRA_ORIGIN?.trim() || "https://simat.unira.ac.id",
    referer:
      process.env.UNIRA_REFERER?.trim() || "https://simat.unira.ac.id/",
    userAgent:
      process.env.UNIRA_USER_AGENT?.trim() ||
      "Mozilla/5.0 (Linux; Android 10; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
    photoBase:
      process.env.UNIRA_PHOTO_BASE_URL?.trim() || "https://api.unira.ac.id",
  };
};

const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const readBodyPreview = async (res: Response): Promise<string> => {
  try {
    const text = await res.text();
    return text.slice(0, 500);
  } catch {
    return "";
  }
};

/**
 * Log diagnostik redacted ke terminal backend.
 * ATURAN: jangan pernah memanggil dengan password, token, atau profil
 * (berisi PII). Hanya langkah + status HTTP + cuplikan body yang disanitasi.
 */
const logUnira = (step: string, detail: string): void => {
  console.warn(`[unira:${step}] ${detail}`);
};

/** Samarkan rahasia yang mungkin terbawa dalam cuplikan body error. */
const sanitizePreview = (text: string, secrets: string[]): string => {
  let out = text.slice(0, 300);
  for (const secret of secrets) {
    if (secret && secret.length >= 4 && out.includes(secret)) {
      out = out.split(secret).join("[redacted]");
    }
  }
  // Samarkan token JWT yang mungkin terbawa dalam body.
  return out.replace(
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    "[redacted-token]"
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/** Ambil access token UNIRA via POST form-urlencoded (teruji: /v1/token). */
export const requestUniraToken = async (
  username: string,
  password: string
): Promise<UniraTokenResult> => {
  const config = getUniraConfig();
  const body = new URLSearchParams();
  body.set("username", username);
  body.set("password", password);
  body.set("client", config.client);

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${config.baseUrl}/v1/token`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/vnd.api+json",
        },
        body: body.toString(),
      },
      config.timeoutMs
    );
  } catch (error) {
    const name = error instanceof Error ? `${error.name}: ${error.message}` : "unknown";
    logUnira("token", `request failed (${name})`);
    if (error instanceof Error && error.name === "AbortError") {
      throw new AuthValidationError(
        "Layanan autentikasi UNIRA sedang tidak tersedia. Coba lagi beberapa saat.",
        null,
        503
      );
    }
    throw new AuthValidationError(
      "Layanan autentikasi UNIRA sedang tidak tersedia. Coba lagi beberapa saat.",
      null,
      503
    );
  }

  if (res.status === 401 || res.status === 422 || res.status === 400) {
    logUnira("token", `http ${res.status} (kredensial ditolak UNIRA)`);
    throw new AuthValidationError("NIM atau password SIMAT tidak valid");
  }
  if (res.status === 429) {
    logUnira("token", "http 429 (rate-limit UNIRA)");
    throw new AuthValidationError(
      "Terlalu banyak percobaan login. Silakan coba kembali nanti.",
      null,
      429
    );
  }
  if (!res.ok) {
    const preview = sanitizePreview(await readBodyPreview(res), [password]);
    logUnira("token", `http ${res.status} ${preview}`);
    if (res.status >= 500) {
      throw new AuthValidationError(
        "Layanan autentikasi UNIRA sedang tidak tersedia. Coba lagi beberapa saat.",
        null,
        503
      );
    }
    throw new AuthValidationError("NIM atau password SIMAT tidak valid");
  }

  let json: unknown;
  try {
    json = JSON.parse(await res.text());
  } catch {
    throw new AuthValidationError(
      "Identitas pengguna tidak dapat diverifikasi melalui UNIRA",
      null,
      502
    );
  }

  // Bentuk teramati: { data: { id, type, attributes: { access, refresh } } }.
  // Toleransi bentuk lain tanpa mengarang endpoint baru.
  const data = isRecord(json) ? json["data"] : null;
  const attributes =
    isRecord(data) && isRecord(data["attributes"])
      ? data["attributes"]
      : null;
  const access =
    (attributes ? asNonEmptyString(attributes["access"]) : null) ??
    (attributes ? asNonEmptyString(attributes["access_token"]) : null) ??
    (isRecord(json) ? asNonEmptyString(json["access_token"]) : null) ??
    (isRecord(json) ? asNonEmptyString(json["access"]) : null);

  if (!access) {
    throw new AuthValidationError(
      "Identitas pengguna tidak dapat diverifikasi melalui UNIRA",
      null,
      502
    );
  }

  const refresh =
    (attributes ? asNonEmptyString(attributes["refresh"]) : null) ??
    (attributes ? asNonEmptyString(attributes["refresh_token"]) : null);
  const tokenId = isRecord(data) ? asNonEmptyString(data["id"]) : null;

  logUnira("token", "token ok");
  return { accessToken: access, refreshToken: refresh, tokenId };
};

/** Dekode klaim JWT UNIRA tanpa verifikasi signature (diagnostik/fallback). */
export const decodeUniraClaims = (
  accessToken: string
): Record<string, unknown> | null => {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2 || !parts[1]) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Identitas dari klaim token UNIRA (struktur teramati 2026):
 * `{ jti, iss:"unira.ac.id", dat:{ id:"m<jti>h<nim>s", prodi, type:"mhs" } }`.
 * Token TIDAK memuat nama/email — hanya bukti auth + NIM.
 */
export interface UniraTokenIdentity {
  /** `dat.id` bila ada (terikat sesi token), else NIM. */
  stableId: string;
  /** NIM yang terbukti dimiliki pemegang token. */
  nim: string;
  prodi: string | null;
  kind: string | null;
}

/**
 * Ekstrak identitas dari klaim access token, terikat pada NIM input:
 * NIM input harus cocok persis dengan klaim `nim/username/sub`, atau
 * terkandung dalam `dat.id` (format teramati `m<jti>h<nim>s`).
 * Gagal (null) = token tidak membuktikan kepemilikan NIM tersebut.
 */
export const extractUniraIdentity = (
  accessToken: string,
  inputNim: string
): UniraTokenIdentity | null => {
  const claims = decodeUniraClaims(accessToken);
  if (!claims) return null;

  const dat = isRecord(claims["dat"]) ? claims["dat"] : null;
  const datId = dat ? asNonEmptyString(dat["id"]) : null;

  const exactNim =
    asNonEmptyString(claims["nim"]) ??
    asNonEmptyString(claims["username"]) ??
    (asNonEmptyString(claims["sub"]) !== null &&
    /^\d+$/.test(asNonEmptyString(claims["sub"]) as string)
      ? (claims["sub"] as string).trim()
      : null);

  let verifiedNim: string | null = null;
  if (exactNim !== null && exactNim === inputNim) {
    verifiedNim = inputNim;
  } else if (datId !== null && datId.includes(inputNim)) {
    verifiedNim = inputNim;
  }
  if (!verifiedNim) return null;

  const prodiRaw =
    (dat ? dat["prodi"] : null) ?? claims["prodi"] ?? null;
  const prodi =
    typeof prodiRaw === "string"
      ? prodiRaw.trim() || null
      : typeof prodiRaw === "number"
        ? String(prodiRaw)
        : null;
  const kind =
    (dat ? asNonEmptyString(dat["type"]) : null) ??
    asNonEmptyString(claims["type"]);

  return {
    stableId: datId ?? verifiedNim,
    nim: verifiedNim,
    prodi,
    kind,
  };
};

const pickFirstString = (
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: string[]
): string | null => {
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      const value = asNonEmptyString(source[key]);
      if (value) return value;
    }
  }
  return null;
};

/**
 * Thumbnail SIMAT → URL https absolut siap render di <img>.
 * Relatif ("img/profil/mhs/x.jpg") diabsolutkan ke host API UNIRA
 * (terbukti melayani image/jpeg; host web SIMAT memberi 404);
 * absolut non-https / skema berbahaya / terlalu panjang ditolak (null).
 */
const resolvePhotoUrl = (
  thumbnail: string | null,
  photoBase?: string
): string | null => {
  if (!thumbnail || thumbnail.length > 500 || /[\s<>"]/.test(thumbnail)) {
    return null;
  }
  if (/^https:\/\//i.test(thumbnail)) return thumbnail;
  if (/^[a-z][a-z0-9+.-]*:/i.test(thumbnail)) return null;
  const base = (photoBase?.trim() || "https://simat.unira.ac.id").replace(
    /\/+$/,
    ""
  );
  if (!/^https:\/\//i.test(base)) return null;
  const path = thumbnail.replace(/^\.\//, "").replace(/^\/+/, "");
  if (!path) return null;
  const abs = `${base}/${path}`;
  return abs.length <= 500 ? abs : null;
};

/** Normalisasi profil dari berbagai kemungkinan bentuk JSON:API. */
export const normalizeUniraProfile = (
  json: unknown,
  fallbackNim: string,
  photoBase?: string
): UniraProfile | null => {
  if (!isRecord(json)) return null;
  const data = isRecord(json["data"]) ? json["data"] : null;
  const attributes =
    data && isRecord(data["attributes"]) ? data["attributes"] : null;
  const included =
    data && isRecord(data["attributes"]) ? null : null;

  void included;

  const attr = attributes ?? {};
  const d = data ?? {};
  const root = json;

  const nim =
    pickFirstString([attr, d, root], [
      "nim",
      "nim_mhs",
      "nim_mahasiswa",
      "username",
      "nomor_induk",
      "no_induk",
    ]) ?? fallbackNim;

  const name = pickFirstString([attr, d, root], [
    "nama",
    "nama_lengkap",
    "nama_mahasiswa",
    "name",
    "full_name",
  ]);
  const email = pickFirstString([attr, d, root], [
    "email",
    "email_kampus",
    "email_mahasiswa",
    "mail",
  ]);
  const prodi =
    pickFirstString([attr, d, root], [
      "prodi",
      "program_studi",
      "jurusan",
    ]) ??
    (() => {
      // SIMAT mengirim prodi sebagai angka (teramati: 52).
      for (const source of [attr, d, root]) {
        const value = source?.["prodi"];
        if (typeof value === "number" && Number.isFinite(value)) {
          return String(value);
        }
      }
      return null;
    })();
  const fakultas = pickFirstString([attr, d, root], ["fakultas", "faculty"]);
  const status = pickFirstString([attr, d, root], [
    "status",
    "status_mahasiswa",
    "status_akademik",
  ]);
  // Foto profil SIMAT (teramati: attributes.thumbnail = "img/profil/mhs/....jpg").
  // Relatif → absolutkan ke host API UNIRA; hanya https yang diterima (sesuai
  // filter <img> frontend). Field sensitif lain (alamat/telepon/NIK/namaibu)
  // sengaja tidak dibaca.
  const thumbnailRaw = pickFirstString([attr, d, root], [
    "thumbnail",
    "foto",
    "photo",
    "avatar",
    "foto_profil",
  ]);
  const photoUrl = resolvePhotoUrl(thumbnailRaw, photoBase);

  // Identifier stabil: prioritaskan id profil resmi bila ada.
  const stableId =
    pickFirstString([d], ["id"]) ??
    pickFirstString([attr, d, root], [
      "id_mahasiswa",
      "user_id",
      "mahasiswa_id",
      "provider_user_id",
    ]) ??
    (email && nim ? `${nim}:${email.toLowerCase()}` : nim);

  if (!name || !email) return null;

  return {
    providerUserId: stableId,
    nim,
    name,
    email: email.toLowerCase(),
    prodi,
    fakultas,
    status,
    photoUrl,
    raw: json,
  };
};

/** GET profil resmi UNIRA dengan Bearer access token. */
export const fetchUniraProfile = async (
  accessToken: string,
  fallbackNim: string
): Promise<UniraProfile> => {
  const config = getUniraConfig();

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${config.baseUrl}${config.profilePath}`,
      {
        method: "GET",
        headers: {
          // Meniru persis request browser SIMAT yang terbukti berhasil:
          // Bearer saja tidak cukup, origin/referer simat wajib ada.
          accept: "*/*",
          authorization: `Bearer ${accessToken}`,
          origin: config.origin,
          referer: config.referer,
          "user-agent": config.userAgent,
          "accept-language": "id-ID,id;q=0.8",
        },
      },
      config.timeoutMs
    );
  } catch (error) {
    const name = error instanceof Error ? `${error.name}: ${error.message}` : "unknown";
    logUnira("profile", `request failed (${name})`);
    if (error instanceof Error && error.name === "AbortError") {
      throw new AuthValidationError(
        "Layanan autentikasi UNIRA sedang tidak tersedia. Coba lagi beberapa saat.",
        null,
        503
      );
    }
    throw new AuthValidationError(
      "Layanan autentikasi UNIRA sedang tidak tersedia. Coba lagi beberapa saat.",
      null,
      503
    );
  }

  if (!res.ok) {
    const preview = sanitizePreview(
      await readBodyPreview(res.clone?.() ?? res).catch(() => ""),
      []
    );
    logUnira("profile", `http ${res.status} ${preview}`);
    if (res.status === 401) {
      throw new AuthValidationError(
        "Identitas pengguna tidak dapat diverifikasi melalui UNIRA",
        null,
        502
      );
    }
    if (res.status === 403 || res.status === 404) {
      throw new AuthValidationError(
        "Identitas pengguna tidak dapat diverifikasi melalui UNIRA",
        null,
        502
      );
    }
    if (res.status >= 500) {
      throw new AuthValidationError(
        "Layanan autentikasi UNIRA sedang tidak tersedia. Coba lagi beberapa saat.",
        null,
        503
      );
    }
    throw new AuthValidationError(
      "Identitas pengguna tidak dapat diverifikasi melalui UNIRA",
      null,
      502
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(await res.text());
  } catch {
    throw new AuthValidationError(
      "Identitas pengguna tidak dapat diverifikasi melalui UNIRA",
      null,
      502
    );
  }

  const profile = normalizeUniraProfile(
    json,
    fallbackNim,
    getUniraConfig().photoBase
  );
  if (!profile) {
    logUnira("profile", "http 200 tetapi struktur profil tak dikenal");
    throw new AuthValidationError(
      "Identitas pengguna tidak dapat diverifikasi melalui UNIRA",
      null,
      502
    );
  }
  if (profile.nim !== fallbackNim) {
    logUnira("profile", "http 200 tetapi NIM profil != NIM login");
    throw new AuthValidationError(
      "Identitas pengguna tidak dapat diverifikasi melalui UNIRA",
      null,
      502
    );
  }
  logUnira("profile", "profile ok");
  return profile;
};
