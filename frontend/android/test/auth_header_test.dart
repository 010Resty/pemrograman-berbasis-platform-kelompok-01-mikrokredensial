import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:aristoteles_app/core/api_client.dart';

/// Regresi: token sesi WAJIB terkirim sebagai header Authorization.
/// Tanpa ini login sukses lalu langsung mental ke halaman login (401).
void main() {
  test('Authorization: Bearer <token> terkirim bila tokenProvider ada',
      () async {
    String? seen;
    final api = ApiClient(
      baseUrl: 'http://uji.invalid/api/v1',
      tokenProvider: () => 'tok123',
      httpClient: MockClient((req) async {
        seen = req.headers['authorization'];
        return http.Response(
            jsonEncode({'status': 'success', 'message': 'ok', 'data': {}}),
            200,
            headers: {'content-type': 'application/json'});
      }),
    );
    await api.get<Object?>('/me/profile', (j) => j);
    expect(seen, 'Bearer tok123');
  });

  test('tanpa token: tidak ada header Authorization (anonim)', () async {
    String? seen = 'unset';
    final api = ApiClient(
      baseUrl: 'http://uji.invalid/api/v1',
      httpClient: MockClient((req) async {
        seen = req.headers['authorization'];
        return http.Response(
            jsonEncode({'status': 'success', 'message': 'ok', 'data': {}}),
            200,
            headers: {'content-type': 'application/json'});
      }),
    );
    await api.get<Object?>('/courses', (j) => j);
    expect(seen, isNull);
  });
}
