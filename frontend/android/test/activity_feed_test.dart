import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:aristoteles_app/core/api_client.dart';
import 'package:aristoteles_app/features/activity/activity_feed.dart';

/// Uji feed aktivitas: gabungan pembayaran + sertifikat, urutan terbaru.
ApiClient mockClient(Map<String, Object?> Function(Uri url) handler) {
  return ApiClient(
    baseUrl: 'http://uji.invalid/api/v1',
    httpClient: MockClient((req) async {
      final result = handler(req.url);
      return http.Response(jsonEncode(result['json']), result['code'] as int,
          headers: {'content-type': 'application/json'});
    }),
  );
}

Map<String, Object?> ok(Object? data) =>
    {'status': 'success', 'message': 'ok', 'data': data};

String _iso(DateTime d) => d.toIso8601String();

void main() {
  group('activity feed', () {
    test('gabung + urut terbaru dulu + label grup benar', () async {
      final now = DateTime.now();
      final api = mockClient((url) {
        if (url.path.endsWith('/me/payments')) {
          return {
            'code': 200,
            'json': ok({
              'items': [
                {
                  'id': 1,
                  'invoice': 'INV-LAMA',
                  'courseId': 9,
                  'courseTitle': 'Kursus Lama',
                  'status': 'diverifikasi',
                  'amountExpected': 100000,
                  'createdAt': _iso(
                      now.subtract(const Duration(days: 5))),
                  'verifiedAt': _iso(
                      now.subtract(const Duration(days: 5))),
                },
                {
                  'id': 2,
                  'invoice': 'INV-BARU',
                  'courseId': 9,
                  'courseTitle': 'Kursus Baru',
                  'status': 'menunggu',
                  'amountExpected': 50000,
                  'createdAt': _iso(
                      now.subtract(const Duration(minutes: 30))),
                },
              ],
              'total': 2,
            }),
          };
        }
        if (url.path.endsWith('/me/certificates')) {
          return {
            'code': 200,
            'json': ok([
              {
                'id': 7,
                'code': 'ATS-1',
                'courseTitle': 'Kursus A',
                'status': 'issued',
                'issuedAt':
                    _iso(now.subtract(const Duration(days: 1, hours: 2))),
              }
            ]),
          };
        }
        return {
          'code': 404,
          'json': {
            'status': 'error',
            'message': 'tak dikenal',
            'data': null
          },
        };
      });

      final items = await loadActivityFeed(api);
      expect(items, hasLength(3));
      // Terbaru dulu: menunggu (1 jam) > sertifikat (kemarin) > lama.
      expect(items.first.kind, 'pending');
      expect(items[1].kind, 'certificate');
      expect(items.last.kind, 'verified');
      expect(activityGroupLabel(items.first.time), 'Hari ini');
      expect(activityGroupLabel(items[1].time), 'Kemarin');
      expect(activityGroupLabel(items.last.time), 'Sebelumnya');
      expect(activityTimeLabel(items.first.time), contains('mnt lalu'));
    });

    test('backend mati → feed kosong tanpa throw', () async {
      final api = mockClient((url) {
        return {
          'code': 500,
          'json': {
            'status': 'error',
            'message': 'rusak',
            'data': null
          },
        };
      });
      expect(await loadActivityFeed(api), isEmpty);
    });
  });
}
