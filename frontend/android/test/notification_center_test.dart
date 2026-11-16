import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:http/http.dart' as http;

import 'package:aristoteles_app/core/api_client.dart';
import 'package:aristoteles_app/core/notification_center.dart';

/// SeenStore dalam memori untuk uji (tanpa secure storage).
class MemorySeen implements SeenStore {
  final map = <String, String>{};

  @override
  Future<String?> read(String key) async => map[key];

  @override
  Future<void> write(String key, String value) async {
    map[key] = value;
  }
}

ApiClient dummyApi() => ApiClient(
      baseUrl: 'http://uji.invalid/api/v1',
      httpClient: MockClient((_) async => http.Response('{}', 200)),
    );

/// Uji pusat notifikasi: kunjungan pertama seed, berikutnya diff jujur.
void main() {
  test('kunjungan pertama bukan BARU (jadi dasar)', () async {
    final center =
        NotificationCenter(dummyApi(), seen: MemorySeen());
    final check = await center.check(
      fetchPending: () async => [
        {'invoice': 'INV-1', 'subtitle': 'Kursus A'}
      ],
      fetchRejected: () async => [],
      fetchCerts: () async => [],
    );
    expect(check.fresh, isEmpty);
  });

  test('invoice baru kedua kali → 1 BARU', () async {
    final seen = MemorySeen();
    final center = NotificationCenter(dummyApi(), seen: seen);
    Future<NotificationCheck> run(List<String> invoices) => center.check(
          fetchPending: () async => [
            for (final i in invoices) {'invoice': i, 'subtitle': 'x'}
          ],
          fetchRejected: () async => [],
          fetchCerts: () async => [],
        );

    await run(['INV-1']);
    final second = await run(['INV-1', 'INV-2']);
    expect(second.fresh, hasLength(1));
    expect(second.fresh.single.title, contains('INV-2'));
  });

  test('markAllSeen menghapus lencana berikut', () async {
    final seen = MemorySeen();
    final center = NotificationCenter(dummyApi(), seen: seen);
    await center.check(
      fetchPending: () async => [
        {'invoice': 'INV-1', 'subtitle': 'x'}
      ],
      fetchRejected: () async => [],
      fetchCerts: () async => [],
    );
    await center.markAllSeen(
        pendingIds: ['INV-1'], rejectedIds: [], certCodes: []);
    final again = await center.check(
      fetchPending: () async => [
        {'invoice': 'INV-1', 'subtitle': 'x'}
      ],
      fetchRejected: () async => [],
      fetchCerts: () async => [],
    );
    expect(again.fresh, isEmpty);
  });

  test('sertifikat baru terdeteksi via kode', () async {
    final seen = MemorySeen();
    final center = NotificationCenter(dummyApi(), seen: seen);
    await center.check(
      fetchPending: () async => [],
      fetchRejected: () async => [],
      fetchCerts: () async => [
        {'code': 'ATS-1', 'subtitle': 'Kursus A'}
      ],
    );
    final second = await center.check(
      fetchPending: () async => [],
      fetchRejected: () async => [],
      fetchCerts: () async => [
        {'code': 'ATS-1', 'subtitle': 'Kursus A'},
        {'code': 'ATS-2', 'subtitle': 'Kursus B'},
      ],
    );
    expect(second.fresh, hasLength(1));
    expect(second.fresh.single.kind, 'certificate');
  });
}
