import 'dart:convert';

import 'api_client.dart';

/// Berkas hasil unggah backend (`POST /api/v1/uploads`).
class UploadedFile {
  UploadedFile({
    required this.id,
    required this.url,
    required this.mimeType,
    required this.sizeBytes,
  });

  final int id;
  final String url;
  final String mimeType;
  final int sizeBytes;

  factory UploadedFile.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asInt(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return UploadedFile(
      id: asInt(m['id']),
      url: '${m['url'] ?? ''}',
      mimeType: '${m['mimeType'] ?? ''}',
      sizeBytes: asInt(m['sizeBytes']),
    );
  }
}

/// Hasil validasi avatar di sisi klien (cermin batas backend K-avatar).
class AvatarValidation {
  const AvatarValidation._(this.ok, this.message);

  final bool ok;
  final String message;

  static const valid = AvatarValidation._(true, '');
  factory AvatarValidation.invalid(String message) =>
      AvatarValidation._(false, message);
}

/// API unggah berkas generik (cermin web `lib/api/uploads.ts`).
/// Batas ukuran/MIME mengikuti `backend/docs/API_CONTRACT.md` §13.
class UploadsApi {
  UploadsApi(this._api);

  final ApiClient _api;

  /// Batas klien untuk avatar: 2MB, JPG/PNG/WebP (sama dengan server).
  static const int avatarMaxBytes = 2 * 1024 * 1024;
  static const List<String> avatarMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  /// Validasi nama file + ukuran sebelum byte dikirim ke server.
  static AvatarValidation validateAvatar({
    required String filename,
    required int byteLength,
  }) {
    if (byteLength <= 0) {
      return AvatarValidation.invalid('Berkas gambar kosong.');
    }
    if (byteLength > avatarMaxBytes) {
      return AvatarValidation.invalid(
        'Ukuran foto maksimal 2MB (terpilih ${(byteLength / 1024 / 1024).toStringAsFixed(1)}MB).',
      );
    }
    final mime = mimeForFilename(filename);
    if (mime == null) {
      return AvatarValidation.invalid('Pilih berkas gambar (JPG/PNG/WebP).');
    }
    return AvatarValidation.valid;
  }

  /// Tebak MIME dari ekstensi (tanpa dep baru; cukup untuk 3 tipe avatar).
  static String? mimeForFilename(String filename) {
    final lower = filename.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    return null;
  }

  /// Unggah byte mentah sebagai `kind: avatar` (semua peran boleh).
  Future<UploadedFile> uploadAvatar({
    required String filename,
    required List<int> bytes,
  }) {
    final check = validateAvatar(filename: filename, byteLength: bytes.length);
    if (!check.ok) throw ApiException(check.message);
    final mime = mimeForFilename(filename) ?? 'image/jpeg';
    return _api.post<UploadedFile>(
      '/uploads',
      body: {
        'filename': filename,
        'mimeType': mime,
        'kind': 'avatar',
        'data': base64Encode(bytes),
      },
      fromData: UploadedFile.fromJson,
    );
  }
}
