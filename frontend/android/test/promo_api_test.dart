import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:aristoteles_app/core/api_client.dart';
import 'package:aristoteles_app/features/promo/promo_api.dart';

/// Uji parsing promo (HTTP mock, tanpa backend).
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

void main() {
  group('promo', () {
    test('list: kampanye aktif + kursus', () async {
      final api = PromoApi(mockClient((url) {
        expect(url.path, endsWith('/promos'));
        return {
          'code': 200,
          'json': ok([
            {
              'slug': 'flash-sale',
              'title': 'Flash Sale',
              'badgeLabel': 'Hemat 20%',
              'type': 'diskon',
              'discountPercent': 20,
              'endsAt': '2026-12-31T00:00:00Z',
              'courses': [
                {
                  'courseId': 1,
                  'title': 'Web Dasar',
                  'priceNominal': 200000,
                  'priceLabel': 'Rp200.000',
                  'discountPercent': 20,
                  'promoPrice': 160000,
                }
              ],
            }
          ]),
        };
      }));
      final rows = await api.list();
      expect(rows, hasLength(1));
      expect(rows.single.slug, 'flash-sale');
      expect(rows.single.typeLabel, 'Diskon');
      expect(rows.single.courses.single.promoPrice, 160000);
    });

    test('list kosong saat backend gagal (tanpa throw)', () async {
      final api = PromoApi(mockClient((url) {
        return {
          'code': 500,
          'json': {
            'status': 'error',
            'message': 'rusak',
            'data': null
          },
        };
      }));
      expect(await api.list(), isEmpty);
    });

    test('detail: 404 → null', () async {
      final api = PromoApi(mockClient((url) {
        return {
          'code': 404,
          'json': {
            'status': 'error',
            'message': 'tidak ada',
            'code': 'CODE_NOT_FOUND',
            'data': null
          },
        };
      }));
      expect(await api.detail('hilang'), isNull);
    });
  });
}
