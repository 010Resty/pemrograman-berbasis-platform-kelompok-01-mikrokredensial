import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_client.dart';

/// Status "sudah dilihat" untuk pusat notifikasi (tanpa server khusus).
///
/// Backend tidak punya tabel notifikasi; web memakai polling
/// `GET /me/payments` + sertifikat (cermin `user/+layout.svelte`).
/// Kelas ini menyimpan cuplikan terakhir di secure storage dan menghitung
/// selisihnya, sehingga lencana BARU bersifat jujur (bukan angka statis).
abstract class SeenStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
}

class SecureSeenStore implements SeenStore {
  SecureSeenStore([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);
}

/// Satu temuan baru untuk ditampilkan sebagai lencana BARU.
class FreshAlert {
  FreshAlert({required this.kind, required this.title, required this.subtitle});

  /// 'pending' | 'rejected' | 'certificate'
  final String kind;
  final String title;
  final String subtitle;
}

/// Hasil pemeriksaan notifikasi: daftar BARU + waktu periksa.
class NotificationCheck {
  NotificationCheck({required this.fresh, required this.checkedAt});

  final List<FreshAlert> fresh;
  final DateTime checkedAt;
}

/// Pusat notifikasi lokal: polling + diff vs terakhir dilihat.
///
/// Tanpa Firebase (tanpa dep native baru): pemeriksaan berjalan saat halaman
/// Notifikasi dibuka + pengatur waktu 60 detik selama halaman aktif.
/// Push FCM asli didokumentasikan sebagai langkah lanjutan di README.
class NotificationCenter {
  NotificationCenter(this._api, {SeenStore? seen})
      : _seen = seen ?? SecureSeenStore();

  final ApiClient _api;
  final SeenStore _seen;

  static const _kPending = 'notif_seen_pending';
  static const _kRejected = 'notif_seen_rejected';
  static const _kCerts = 'notif_seen_certs';

  /// Periksa pembayaran menunggu/ditolak + sertifikat terbit.
  /// [fetchPayments]/[fetchCerts] diinjeksikan agar mudah diuji (tanpa HTTP).
  Future<NotificationCheck> check({
    required Future<List<Map<String, String>>> Function() fetchPending,
    required Future<List<Map<String, String>>> Function() fetchRejected,
    required Future<List<Map<String, String>>> Function() fetchCerts,
  }) async {
    final pending = await fetchPending();
    final rejected = await fetchRejected();
    final certs = await fetchCerts();
    final fresh = <FreshAlert>[];

    fresh.addAll(await _diff(
      key: _kPending,
      rows: pending,
      idOf: (r) => r['invoice'] ?? '',
      alert: (r) => FreshAlert(
        kind: 'pending',
        title: 'Menunggu verifikasi · ${r['invoice'] ?? ''}',
        subtitle: r['subtitle'] ?? '',
      ),
    ));
    fresh.addAll(await _diff(
      key: _kRejected,
      rows: rejected,
      idOf: (r) => r['invoice'] ?? '',
      alert: (r) => FreshAlert(
        kind: 'rejected',
        title: 'Pembayaran ditolak · ${r['invoice'] ?? ''}',
        subtitle: r['subtitle'] ?? '',
      ),
    ));
    fresh.addAll(await _diff(
      key: _kCerts,
      rows: certs,
      idOf: (r) => r['code'] ?? '',
      alert: (r) => FreshAlert(
        kind: 'certificate',
        title: 'Sertifikat terbit · ${r['code'] ?? ''}',
        subtitle: r['subtitle'] ?? '',
      ),
    ));

    return NotificationCheck(fresh: fresh, checkedAt: DateTime.now());
  }

  /// Tandai semua yang ada saat ini sebagai "sudah dilihat".
  /// Dipakai setelah halaman Notifikasi selesai dimuat.
  Future<void> markAllSeen({
    required List<String> pendingIds,
    required List<String> rejectedIds,
    required List<String> certCodes,
  }) async {
    await _seen.write(_kPending, pendingIds.join(','));
    await _seen.write(_kRejected, rejectedIds.join(','));
    await _seen.write(_kCerts, certCodes.join(','));
  }

  Future<List<FreshAlert>> _diff({
    required String key,
    required List<Map<String, String>> rows,
    required String Function(Map<String, String>) idOf,
    required FreshAlert Function(Map<String, String>) alert,
  }) async {
    final ids = rows.map(idOf).where((e) => e.isNotEmpty).toList();
    final prevRaw = await _seen.read(key);
    // Kunjungan pertama (belum ada rekam): bukan "baru", langsung jadikan dasar.
    if (prevRaw == null) {
      await _seen.write(key, ids.join(','));
      return const [];
    }
    final prev = prevRaw.split(',').where((e) => e.isNotEmpty).toSet();
    final out = <FreshAlert>[];
    for (final r in rows) {
      final id = idOf(r);
      if (id.isNotEmpty && !prev.contains(id)) out.add(alert(r));
    }
    return out;
  }

  /// Panggil API backend langsung (bantuan untuk halaman; halaman boleh
  /// memanggil PaymentApi/CertificateApi sendiri lalu memakai markAllSeen).
  ApiClient get api => _api;
}
