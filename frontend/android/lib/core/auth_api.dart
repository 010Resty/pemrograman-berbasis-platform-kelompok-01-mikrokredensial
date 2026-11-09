import 'api_client.dart';
import 'models.dart';

/// Panggilan auth 1:1 mengikuti `frontend/shared/contract/endpoints.json`.
/// Tidak ada logika bisnis di sini — hanya transport + parse jujur.
class AuthApi {
  AuthApi(this._api);

  final ApiClient _api;

  Future<Map<String, Object?>> register({
    required String name,
    required String username,
    required String email,
    required String password,
  }) {
    return _api.post<Map<String, Object?>>(
      '/auth/register',
      body: {'name': name, 'username': username, 'email': email, 'password': password},
      fromData: (json) => (json as Map?)?.cast<String, Object?>() ?? {},
    );
  }

  Future<AuthPayload> verifyEmail({required String email, required String code}) {
    return _api.post<AuthPayload>(
      '/auth/verify-email',
      body: {'email': email, 'code': code},
      fromData: AuthPayload.fromJson,
    );
  }

  Future<void> resendVerification(String email) async {
    await _api.post<Object?>(
      '/auth/resend-verification',
      body: {'email': email},
      fromData: (_) => null,
    );
  }

  Future<void> forgotPassword(String email) async {
    await _api.post<Object?>(
      '/auth/forgot-password',
      body: {'email': email},
      fromData: (_) => null,
    );
  }

  Future<void> verifyResetCode({required String email, required String code}) async {
    await _api.post<Object?>(
      '/auth/verify-reset-code',
      body: {'email': email, 'code': code},
      fromData: (_) => null,
    );
  }

  Future<void> resetPassword({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    await _api.post<Object?>(
      '/auth/reset-password',
      body: {'email': email, 'code': code, 'newPassword': newPassword},
      fromData: (_) => null,
    );
  }

  Future<AuthPayload> login({required String email, required String password}) {
    return _api.post<AuthPayload>(
      '/auth/login',
      body: {'email': email, 'password': password},
      fromData: AuthPayload.fromJson,
    );
  }

  Future<AuthPayload> refresh(String refreshToken) {
    return _api.post<AuthPayload>(
      '/auth/refresh',
      body: {'refreshToken': refreshToken},
      fromData: AuthPayload.fromJson,
    );
  }

  Future<void> logout({String? refreshToken}) async {
    final body = <String, String>{};
    final token = refreshToken;
    if (token != null) body['refreshToken'] = token;
    await _api.post<Object?>(
      '/auth/logout',
      body: body,
      fromData: (_) => null,
    );
  }

  Future<AppUser> me() {
    return _api.get<AppUser>(
      '/auth/me',
      (json) {
        final m = (json as Map?)?.cast<String, Object?>();
        // Backend membungkus: { user: {...} }.
        return AppUser.fromJson(m?['user']);
      },
    );
  }
}
