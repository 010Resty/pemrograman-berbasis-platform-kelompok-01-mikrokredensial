import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:aristoteles_app/core/api_client.dart';
import 'package:aristoteles_app/core/uploads_api.dart';

/// Uji `UploadsApi` + validasi avatar (tanpa backend, HTTP mock).
ApiClient mockClient(
    Map<String, Object?> Function(Uri url, String? body) handler) {
  return ApiClient(
    baseUrl: 'http://uji.invalid/api/v1',
    httpClient: MockClient((req) async {
      final result = handler(req.url, req.body.isEmpty ? null : req.body);
      return http.Response(jsonEncode(result['json']), result['code'] as int,
          headers: {'content-type': 'application/json'});
    }),
  );
}

Map<String, Object?> ok(Object? data) =>
    {'status': 'success', 'message': 'ok', 'data': data};

void main() {
  group('validasi avatar (klien, cermin batas backend 2MB)', () {
    test('menolak ekstensi non-gambar', () {
      final v = UploadsApi.validateAvatar(
          filename: 'foto.pdf', byteLength: 1000);
      expect(v.ok, isFalse);
    });

    test('menolak di atas 2MB', () {
      final v = UploadsApi.validateAvatar(
          filename: 'foto.jpg',
          byteLength: UploadsApi.avatarMaxBytes + 1);
      expect(v.ok, isFalse);
      expect(v.message, contains('2MB'));
    });

    test('menerima jpg/png/webp dalam batas', () {
      for (final name in ['a.jpg', 'b.jpeg', 'c.png', 'd.webp']) {
        expect(
          UploadsApi.validateAvatar(filename: name, byteLength: 100).ok,
          isTrue,
          reason: name,
        );
      }
    });
  });

  group('uploadAvatar', () {
    test('mengirim kind avatar + base64', () async {
      Map<String, Object?>? sent;
      final api = UploadsApi(mockClient((url, body) {
        sent = (jsonDecode(body!) as Map).cast<String, Object?>();
        expect(url.path, contains('/uploads'));
        return {
          'code': 201,
          'json': ok({'id': 7, 'url': '/api/v1/files/7/content'}),
        };
      }));
      final up = await api.uploadAvatar(
          filename: 'saya.png', bytes: [1, 2, 3]);
      expect(up.id, 7);
      expect(sent?['kind'], 'avatar');
      expect(sent?['mimeType'], 'image/png');
      expect(sent?['data'], isNotEmpty);
    });

    test('menolak sebelum HTTP bila tak valid', () async {
      var called = false;
      final api = UploadsApi(mockClient((url, body) {
        called = true;
        return {
          'code': 201,
          'json': ok({'id': 1}),
        };
      }));
      expect(
        () => api.uploadAvatar(
            filename: 'x.exe',
            bytes: List.filled(10, 0)),
        throwsA(isA<ApiException>()),
      );
      expect(called, isFalse);
    });
  });
}
