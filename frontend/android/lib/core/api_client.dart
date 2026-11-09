import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'config.dart';

/// Galat request API. Cermin `BackendRequestError` milik web
/// (`frontend/web/src/lib/api/backend.ts`): pesan Indonesia yang jujur,
/// tanpa sukses palsu.
class ApiException implements Exception {
  ApiException(this.message, {this.httpStatus = 0, this.code, this.errors});

  final String message;

  /// Status HTTP; 0 = jaringan gagal / timeout (tidak ada respons).
  final int httpStatus;

  /// Kode mesin backend (`code`), mis. EMAIL_UNVERIFIED, MATERIAL_CONFLICT.
  final String? code;

  final List<ApiFieldError>? errors;

  @override
  String toString() => 'ApiException($httpStatus): $message';
}

class ApiFieldError {
  ApiFieldError({required this.field, required this.message});

  final String field;
  final String message;

  factory ApiFieldError.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    return ApiFieldError(
      field: '${m['field'] ?? ''}',
      message: '${m['message'] ?? ''}',
    );
  }
}

/// Menyediakan access token saat ini (boleh null = anonim).
typedef TokenProvider = String? Function();

/// Klien HTTP tipis mengikuti `frontend/shared/contract/envelope.md`:
/// envelope ketat `{status,message,data}`, timeout 15 detik,
/// dedup tidak dilakukan di sini (cukup untuk Tahap 3).
class ApiClient {
  ApiClient({String? baseUrl, TokenProvider? tokenProvider, http.Client? httpClient})
      : baseUrl = (baseUrl ?? ApiConfig.baseUrl).replaceAll(RegExp(r'/+$'), ''),
        _tokenProvider = tokenProvider,
        _http = httpClient ?? http.Client();

  final String baseUrl;
  final TokenProvider? _tokenProvider;
  final http.Client _http;

  /// Dipanggil setiap respons 401 agar UI bisa mengembalikan ke login.
  void Function()? onUnauthorized;

  void close() => _http.close();

  Future<T> get<T>(String path, T Function(Object? json) fromData) {
    return _send<T>('GET', path, null, fromData);
  }

  Future<T> post<T>(
    String path, {
    Object? body,
    required T Function(Object? json) fromData,
  }) {
    return _send<T>('POST', path, body, fromData);
  }

  Future<T> patch<T>(
    String path, {
    Object? body,
    required T Function(Object? json) fromData,
  }) {
    return _send<T>('PATCH', path, body, fromData);
  }

  Future<T> put<T>(
    String path, {
    Object? body,
    required T Function(Object? json) fromData,
  }) {
    return _send<T>('PUT', path, body, fromData);
  }

  Future<void> delete(String path) {
    return _send<Object?>('DELETE', path, null, (_) => null);
  }

  /// Unduh byte mentah dengan header auth (berkas privat, PDF sertifikat).
  Future<List<int>> downloadBytes(String path) async {
    final url = Uri.parse('$baseUrl${path.startsWith('/') ? path : '/$path'}');
    final headers = <String, String>{'accept': '*/*'};
    final token = _tokenProvider?.call();
    if (token != null && token.isNotEmpty) {
      headers['authorization'] = 'Bearer $token';
    }
    http.Response res;
    try {
      res = await _http.get(url, headers: headers).timeout(ApiConfig.timeout);
    } on TimeoutException {
      throw ApiException('Waktu permintaan habis. Periksa koneksi lalu coba lagi.',
          code: 'timeout');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('Backend tidak terjangkau. Periksa server dan alamat API.');
    }
    if (res.statusCode == 401) {
      onUnauthorized?.call();
      throw ApiException('Sesi berakhir. Masuk kembali.', httpStatus: 401);
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException('Gagal mengunduh (HTTP ${res.statusCode}).',
          httpStatus: res.statusCode);
    }
    return res.bodyBytes;
  }

  Future<T> _send<T>(
    String method,
    String path,
    Object? body,
    T Function(Object? json) fromData,
  ) async {
    final url = Uri.parse('$baseUrl${path.startsWith('/') ? path : '/$path'}');
    final headers = <String, String>{'accept': 'application/json'};
    final token = _tokenProvider?.call();
    if (token != null && token.isNotEmpty) {
      headers['authorization'] = 'Bearer $token';
    }
    String? payload;
    if (body != null) {
      headers['content-type'] = 'application/json';
      payload = jsonEncode(body);
    }

    http.Response res;
    try {
      final future = switch (method) {
        'GET' => _http.get(url, headers: headers),
        'DELETE' => _http.delete(url, headers: headers),
        'PATCH' => _http.patch(url, headers: headers, body: payload),
        'PUT' => _http.put(url, headers: headers, body: payload),
        _ => _http.post(url, headers: headers, body: payload),
      };
      res = await future.timeout(ApiConfig.timeout);
    } on TimeoutException {
      throw ApiException(
        'Waktu permintaan habis. Periksa koneksi internet lalu coba lagi.',
        code: 'timeout',
      );
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(
        'Backend tidak terjangkau. Periksa server dan alamat API.',
      );
    }

    final envelope = _parseEnvelope(res);
    if (res.statusCode == 401) {
      onUnauthorized?.call();
    }
    if (res.statusCode < 200 ||
        res.statusCode >= 300 ||
        envelope['status'] != 'success') {
      final failure = envelope['data'] == null
          ? envelope
          : <String, Object?>{...envelope};
      final errors = failure['errors'];
      throw ApiException(
        '${failure['message'] ?? 'Permintaan gagal (HTTP ${res.statusCode}).'}',
        httpStatus: res.statusCode,
        code: failure['code'] as String?,
        errors: errors is List
            ? errors.map(ApiFieldError.fromJson).toList()
            : null,
      );
    }
    return fromData(envelope['data']);
  }

  /// Parse ketat: hanya terima envelope `{status,message,data}`.
  static Map<String, Object?> parseEnvelope(String text, int httpStatus) {
    if (text.isEmpty) {
      throw ApiException('Respons kosong dari server (HTTP $httpStatus).',
          httpStatus: httpStatus);
    }
    Object? json;
    try {
      json = jsonDecode(text);
    } catch (_) {
      throw ApiException(
          'Respons server bukan JSON valid (HTTP $httpStatus).',
          httpStatus: httpStatus);
    }
    if (json is! Map ||
        (json['status'] != 'success' && json['status'] != 'error')) {
      throw ApiException(
          'Format respons server tidak dikenali (HTTP $httpStatus).',
          httpStatus: httpStatus);
    }
    return json.cast<String, Object?>();
  }

  Map<String, Object?> _parseEnvelope(http.Response res) =>
      parseEnvelope(res.body, res.statusCode);
}

/// Normalisasi respons list: array langsung atau `{items|...}`.
/// Dipakai semua daftar agar tidak ada cabang mati di call-site.
List<Object?> apiList(Object? json, [String key = 'items']) {
  if (json is List) return json.cast<Object?>();
  final m = (json as Map?)?.cast<String, Object?>();
  final inner = m?[key];
  if (inner is List) return inner.cast<Object?>();
  return const [];
}
