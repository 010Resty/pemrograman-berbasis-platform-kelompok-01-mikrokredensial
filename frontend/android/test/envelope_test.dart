import 'package:flutter_test/flutter_test.dart';

import 'package:aristoteles_app/core/api_client.dart';
import 'package:aristoteles_app/core/models.dart';

void main() {
  group('ApiClient.parseEnvelope', () {
    test('menerima envelope sukses', () {
      final env = ApiClient.parseEnvelope(
        '{"status":"success","message":"ok","data":{"a":1}}',
        200,
      );
      expect(env['status'], 'success');
      expect((env['data'] as Map)['a'], 1);
    });

    test('menolak respons kosong', () {
      expect(() => ApiClient.parseEnvelope('', 200),
          throwsA(isA<ApiException>()));
    });

    test('menolak non-JSON', () {
      expect(() => ApiClient.parseEnvelope('bukan-json', 200),
          throwsA(isA<ApiException>()));
    });

    test('menolak format tanpa status envelope', () {
      expect(() => ApiClient.parseEnvelope('{"data":{}}', 200),
          throwsA(isA<ApiException>()));
    });
  });

  group('AuthPayload.fromJson', () {
    test('membaca token + user dari data', () {
      final payload = AuthPayload.fromJson({
        'message': 'Login berhasil',
        'data': {
          'accessToken': 'acc',
          'refreshToken': 'ref',
          'user': {
            'id': 7,
            'name': 'Uji',
            'username': 'uji',
            'email': 'u@uji.id',
            'role': 'student',
          },
        },
      });
      expect(payload.accessToken, 'acc');
      expect(payload.refreshToken, 'ref');
      expect(payload.user.role, AppRole.student);
    });

    test('peran tak dikenal menjadi student (fail-closed)', () {
      expect(appRoleFromString('superadmin'), AppRole.student);
      expect(appRoleFromString(null), AppRole.student);
    });
  });
}
