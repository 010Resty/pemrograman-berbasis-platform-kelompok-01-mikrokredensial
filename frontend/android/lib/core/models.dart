// Model ringan cermin kontrak `frontend/shared`.
// ignore_for_file: avoid_dynamic_calls

/// Peran pengguna (sama persis dengan backend).
enum AppRole { student, teacher, admin }

AppRole appRoleFromString(String? raw) {
  switch (raw) {
    case 'teacher':
      return AppRole.teacher;
    case 'admin':
      return AppRole.admin;
    default:
      return AppRole.student;
  }
}

class AppUser {
  AppUser({
    required this.id,
    required this.name,
    required this.username,
    required this.email,
    required this.role,
    this.avatarUrl,
  });

  final int id;
  final String name;
  final String username;
  final String email;
  final AppRole role;
  final String? avatarUrl;

  factory AppUser.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int id = 0;
    final rawId = m['id'];
    if (rawId is int) {
      id = rawId;
    } else if (rawId is String) {
      id = int.tryParse(rawId) ?? 0;
    }
    return AppUser(
      id: id,
      name: '${m['name'] ?? ''}',
      username: '${m['username'] ?? ''}',
      email: '${m['email'] ?? ''}',
      role: appRoleFromString(m['role'] as String?),
      avatarUrl: m['avatarUrl'] as String?,
    );
  }

  Map<String, Object?> toJson() => {
        'id': id,
        'name': name,
        'username': username,
        'email': email,
        'role': role.name,
        'avatarUrl': avatarUrl,
      };
}

class AuthPayload {
  AuthPayload({
    required this.accessToken,
    required this.user,
    this.refreshToken,
    this.refreshExpiresAt,
    this.message = '',
  });

  final String accessToken;
  final String? refreshToken;
  final String? refreshExpiresAt;
  final AppUser user;
  final String message;

  factory AuthPayload.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    final data = m['data'];
    final payload = data is Map ? data.cast<String, Object?>() : m;
    return AuthPayload(
      accessToken: '${payload['accessToken'] ?? ''}',
      refreshToken: payload['refreshToken'] as String?,
      refreshExpiresAt: payload['refreshExpiresAt'] as String?,
      user: AppUser.fromJson(payload['user']),
      message: '${m['message'] ?? ''}',
    );
  }
}
