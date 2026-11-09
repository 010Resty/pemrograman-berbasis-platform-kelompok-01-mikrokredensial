import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:aristoteles_app/core/api_client.dart';
import 'package:aristoteles_app/features/catalog/catalog_api.dart';
import 'package:aristoteles_app/features/certificate/certificate_api.dart';
import 'package:aristoteles_app/features/payment/payment_api.dart';
import 'package:aristoteles_app/features/learning/quiz_api.dart';

/// Uji kontrak `frontend/shared` dengan HTTP mock (tanpa backend).
/// Memastikan parse respons sesuai envelope + bentuk data tiap endpoint.
ApiClient mockClient(Map<String, Object?> Function(Uri url, Map<String, String> headers, String? body) handler) {
  return ApiClient(
    baseUrl: 'http://uji.invalid/api/v1',
    httpClient: MockClient((req) async {
      final result = handler(req.url, req.headers, req.body.isEmpty ? null : req.body);
      return http.Response(jsonEncode(result['json']), result['code'] as int,
          headers: {'content-type': 'application/json'});
    }),
  );
}

Map<String, Object?> ok(Object? data) =>
    {'status': 'success', 'message': 'ok', 'data': data};

void main() {
  group('kontrak katalog', () {
    test('list: array mentah', () async {
      final api = CatalogApi(mockClient((url, headers, body) {
        return {
          'code': 200,
          'json': ok([
            {'id': 1, 'title': 'Web', 'priceNominal': 0}
          ]),
        };
      }));
      final rows = await api.list();
      expect(rows, hasLength(1));
      expect(rows.single.isFree, isTrue);
    });

    test('tree: modul + sub + materi', () async {
      final api = CatalogApi(mockClient((url, headers, body) {
        final path = url.path;
        if (path.endsWith('/materials')) {
          return {
            'code': 200,
            'json': ok({
              'materials': [
                {'id': 9, 'title': 'M1', 'type': 'materi'}
              ]
            }),
          };
        }
        if (path.endsWith('/submodules')) {
          return {
            'code': 200,
            'json': ok({
              'submodules': [
                {'id': 7, 'title': 'S1'}
              ]
            }),
          };
        }
        return {
          'code': 200,
          'json': ok([
            {'id': 5, 'title': 'Modul 1'}
          ]),
        };
      }));
      final tree = await api.tree(1);
      expect(tree, hasLength(1));
      expect(tree.single.subModules, hasLength(1));
      expect(tree.single.subModules.single.materials.single.id, '9');
    });
  });

  group('kontrak kuis (K-02)', () {
    test('submit: penilaian server + terbaik', () async {
      final api = QuizApi(mockClient((url, headers, body) {
        return {
          'code': 201,
          'json': ok({
            'materialId': 2,
            'score': 80,
            'total': 2,
            'correct': 1,
            'passScore': 70,
            'passed': true,
            'bestScore': 80,
            'attempts': 3,
            'overallPassed': true,
          }),
        };
      }));
      final r = await api.submit(2, [
        {'questionId': 1, 'optionId': 10}
      ]);
      expect(r.score, 80);
      expect(r.overallPassed, isTrue);
    });

    test('best + history tahan 401 (best-effort null/kosong)', () async {
      final api = QuizApi(mockClient((url, headers, body) {
        return {
          'code': 403,
          'json': {
            'status': 'error',
            'message': 'X',
            'data': null,
            'code': 'NO_ACCESS'
          },
        };
      }));
      expect(await api.best(2), isNull);
      expect(await api.history(2), isEmpty);
    });
  });

  group('kontrak pembayaran + sertifikat', () {
    test('my-list tanpa courseId: {items,total}', () async {
      final api = PaymentApi(mockClient((url, headers, body) {
        expect(url.queryParameters.containsKey('courseId'), isFalse);
        return {
          'code': 200,
          'json': ok({
            'items': [
              {
                'id': 3,
                'invoice': 'INV-1',
                'courseId': 1,
                'status': 'menunggu',
                'amountExpected': 150000,
              }
            ],
            'total': 2,
            'page': 1,
            'limit': 20,
          }),
        };
      }));
      final list = await api.mineList(status: 'menunggu');
      expect(list.total, 2);
      expect(list.items.single.isPending, isTrue);
    });

    test('sertifikat saya: array + unduh butuh auth', () async {
      String? auth;
      final api = CertificateApi(ApiClient(
        baseUrl: 'http://uji.invalid/api/v1',
        tokenProvider: () => 't',
        httpClient: MockClient((req) async {
          auth = req.headers['authorization'];
          return http.Response(
              jsonEncode(ok([
                {
                  'id': 9,
                  'code': 'ATS-2026-X',
                  'courseTitle': 'K1',
                  'status': 'issued',
                  'issuedAt': '2026-01-01'
                }
              ])),
              200,
              headers: {'content-type': 'application/json'});
        }),
      ));
      final rows = await api.mine();
      expect(rows.single.code, 'ATS-2026-X');
      expect(auth, 'Bearer t');
    });
  });

  group('envelope', () {
    test('401 tanpa login melempar + panggil onUnauthorized', () async {
      var called = false;
      final api = ApiClient(
        baseUrl: 'http://uji.invalid/api/v1',
        httpClient: MockClient((req) async => http.Response(
            jsonEncode({
              'status': 'error',
              'message': 'Token kedaluwarsa',
              'data': null
            }),
            401,
            headers: {'content-type': 'application/json'})),
      )..onUnauthorized = () => called = true;
      await expectLater(
          api.get<Object?>('/me', (json) => json),
          throwsA(isA<ApiException>()));
      expect(called, isTrue);
    });
  });
}
