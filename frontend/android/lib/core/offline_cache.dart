import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

/// Cache offline berbasis berkas JSON (tanpa dep baru).
///
/// Tiap kunci = satu berkas `<key>.json` berisi `{savedAt, data}`.
/// Baca memakai TTL: basi = dianggap tak ada. Tulis best-effort
/// (gagal tulis tidak pernah melempar agar alur online tak terganggu).
///
/// Dipakai katalog + profil + sertifikat agar aplikasi tetap berguna
/// saat backend tak terjangkau, dengan spanduk "data tersimpan".
class OfflineCache {
  OfflineCache({String? directoryOverride}) : _dirOverride = directoryOverride;

  /// Injeksi direktori untuk uji (tanpa path_provider di test).
  final String? _dirOverride;

  static const Duration catalogTtl = Duration(minutes: 15);
  static const Duration profileTtl = Duration(minutes: 30);
  static const Duration certificatesTtl = Duration(minutes: 15);
  static const Duration paymentsTtl = Duration(minutes: 5);

  Future<Directory> _dir() async {
    final over = _dirOverride;
    if (over != null) return Directory(over);
    final base = await getApplicationDocumentsDirectory();
    final dir = Directory('${base.path}/offline_cache');
    if (!await dir.exists()) await dir.create(recursive: true);
    return dir;
  }

  String _name(String key) =>
      '${key.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_')}.json';

  /// Simpan data JSON-able (Map/List primitif) untuk [key].
  Future<void> saveJson(String key, Object? data) async {
    try {
      // Serialisasi dini agar data tak-JSON gagal di sini, bukan saat baca.
      final payload = jsonEncode({
        'savedAt': DateTime.now().toIso8601String(),
        'data': data,
      });
      final dir = await _dir();
      if (!await dir.exists()) await dir.create(recursive: true);
      await File('${dir.path}/${_name(key)}').writeAsString(payload);
    } catch (_) {
      // Best-effort: cache tidak boleh menggagalkan alur utama.
    }
  }

  /// Baca cache bila ada dan belum basi. Null = tak ada / basi / rusak.
  Future<CachedJson?> readJson(String key, Duration ttl) async {
    try {
      final dir = await _dir();
      final file = File('${dir.path}/${_name(key)}');
      if (!await file.exists()) return null;
      final m = (jsonDecode(await file.readAsString()) as Map)
          .cast<String, Object?>();
      final savedAt = DateTime.tryParse('${m['savedAt'] ?? ''}');
      if (savedAt == null) return null;
      if (DateTime.now().difference(savedAt) > ttl) return null;
      return CachedJson(data: m['data'], savedAt: savedAt);
    } catch (_) {
      return null;
    }
  }

  /// Hapus satu kunci (mis. setelah logout agar data akun tak tertinggal).
  Future<void> clearKey(String key) async {
    try {
      final dir = await _dir();
      final file = File('${dir.path}/${_name(key)}');
      if (await file.exists()) await file.delete();
    } catch (_) {
      // abaikan
    }
  }

  /// Hapus seluruh cache offline (dipakai saat logout).
  Future<void> clearAll() async {
    try {
      final dir = await _dir();
      if (!await dir.exists()) return;
      await for (final e in dir.list()) {
        if (e.path.endsWith('.json')) {
          try {
            await e.delete();
          } catch (_) {
            // lanjutkan ke berkas berikut
          }
        }
      }
    } catch (_) {
      // abaikan
    }
  }
}

/// Hasil baca cache: data mentah + waktu simpan (untuk label "diperbarui …").
class CachedJson {
  CachedJson({required this.data, required this.savedAt});

  final Object? data;
  final DateTime savedAt;
}
