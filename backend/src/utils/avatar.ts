/**
 * Resolusi URL avatar: upload manual (avatarFileId) selalu menang,
 * foto SIMAT sebagai fallback.
 * CATATAN: nilai ini hanya dipakai untuk respons SESI SENDIRI + profil
 * sendiri (login/me/refresh/profil). Foto SIMAT dikembalikan sebagai URL
 * proxy same-origin per-user (/api/v1/auth/unira/photo/:id) agar kebal
 * CORB/hotlink/CSP lintas-origin dan bisa dimuat <img> tanpa token
 * (setara keterbukaan berkas avatar publik); URL eksternal mentah tidak
 * pernah dikirim ke browser. Daftar user lain tetap memakai avatarFileId.
 */
export const uniraPhotoProxyPath = (userId: number | string): string =>
  `/api/v1/auth/unira/photo/${userId}`;

export const resolveAvatarUrl = (
  avatarFileId: number | null | undefined,
  photoUrl: string | null | undefined,
  userId?: number | string | null
): string | null => {
  if (typeof avatarFileId === "number" && Number.isInteger(avatarFileId)) {
    return `/api/v1/files/${avatarFileId}/content`;
  }
  if (
    (typeof userId === "number" || typeof userId === "string") &&
    String(userId).length > 0 &&
    typeof photoUrl === "string"
  ) {
    const trimmed = photoUrl.trim();
    if (
      trimmed.length > 0 &&
      trimmed.length <= 500 &&
      trimmed.startsWith("https://") &&
      !/[\s<>"]/.test(trimmed)
    ) {
      return uniraPhotoProxyPath(userId);
    }
  }
  return null;
};
