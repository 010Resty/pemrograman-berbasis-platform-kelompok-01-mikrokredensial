/// Absolutkan path berkas backend (/api/v1/files/:id/content) ke URL penuh.
/// baseUrl sudah mengandung /api/v1 (mis. http://10.0.2.2:3000/api/v1),
/// sehingga prefix /api/v1 dipotong agar tidak ganda.
String? resolveAvatarUrl(String? path, String baseUrl) {
  final raw = (path ?? '').trim();
  if (raw.isEmpty || raw.length > 2048) return null;
  if (raw.contains(' ') || raw.contains('<') || raw.contains('"')) return null;
  if (raw.startsWith('javascript:') || raw.startsWith('data:')) return null;
  if (raw.startsWith('https://')) return raw;
  if (raw.startsWith('http://localhost') || raw.startsWith('http://127.0.0.1')) {
    return raw;
  }
  // Emulator Android: 10.0.2.2 adalah localhost host.
  if (raw.startsWith('http://10.0.2.2')) return raw;
  final base = baseUrl.replaceAll(RegExp(r'/+$'), '');
  final rel = raw.startsWith('/api/v1/') ? raw.substring('/api/v1'.length) : raw;
  if (!rel.startsWith('/')) return null;
  return '$base$rel';
}
