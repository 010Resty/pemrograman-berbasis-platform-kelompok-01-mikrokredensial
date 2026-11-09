import '../../core/api_client.dart';

class AdminOverview {
  AdminOverview({
    required this.totalStudents,
    required this.totalTeachers,
    required this.totalCourses,
    required this.totalCertificates,
  });

  final int totalStudents;
  final int totalTeachers;
  final int totalCourses;
  final int totalCertificates;

  factory AdminOverview.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asInt(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return AdminOverview(
      totalStudents: asInt(m['totalStudents']),
      totalTeachers: asInt(m['totalTeachers']),
      totalCourses: asInt(m['totalCourses']),
      totalCertificates: asInt(m['totalCertificates']),
    );
  }
}

class AdminUser {
  AdminUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.isActive,
  });

  final int id;
  final String name;
  final String email;
  final String role;
  final bool isActive;

  factory AdminUser.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asId(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return AdminUser(
      id: asId(m['id']),
      name: '${m['name'] ?? ''}',
      email: '${m['email'] ?? ''}',
      role: '${m['role'] ?? ''}',
      isActive: m['isActive'] != false,
    );
  }
}

class AdminInvitation {
  AdminInvitation({
    required this.id,
    required this.email,
    required this.status,
    this.inviteUrl,
    this.token,
  });

  final int id;
  final String email;
  final String status;
  final String? inviteUrl;
  final String? token;

  factory AdminInvitation.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asId(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return AdminInvitation(
      id: asId(m['id']),
      email: '${m['email'] ?? ''}',
      status: '${m['status'] ?? ''}',
      inviteUrl: m['inviteUrl'] as String?,
      token: m['token'] as String?,
    );
  }
}

class AdminVoucher {
  AdminVoucher({
    required this.code,
    required this.courseId,
    required this.kind,
    required this.status,
  });

  final String code;
  final int courseId;
  final String kind;
  final String status;

  factory AdminVoucher.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asId(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return AdminVoucher(
      code: '${m['code'] ?? ''}',
      courseId: asId(m['courseId']),
      kind: '${m['kind'] ?? ''}',
      status: '${m['status'] ?? ''}',
    );
  }
}

class AdminPaymentRow {
  AdminPaymentRow({
    required this.id,
    required this.userName,
    required this.courseTitle,
    required this.invoice,
    required this.status,
    required this.amountExpected,
    this.rejectReason,
  });

  final int id;
  final String userName;
  final String courseTitle;
  final String invoice;
  final String status;
  final int amountExpected;
  final String? rejectReason;

  factory AdminPaymentRow.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asInt(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    int asId(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return AdminPaymentRow(
      id: asId(m['id']),
      userName: '${m['userName'] ?? m['user_name'] ?? ''}',
      courseTitle: '${m['courseTitle'] ?? ''}',
      invoice: '${m['invoice'] ?? ''}',
      status: '${m['status'] ?? ''}',
      amountExpected: asInt(m['amountExpected']),
      rejectReason: m['rejectReason'] as String?,
    );
  }
}

class AdminApi {
  AdminApi(this._api);

  final ApiClient _api;

  Future<AdminOverview> overview() {
    return _api.get<AdminOverview>(
      '/admin/overview',
      AdminOverview.fromJson,
    );
  }

  Future<List<AdminUser>> users({String role = 'student', int limit = 50}) async {
    final data = await _api.get<List<Object?>>(
      '/admin/users?role=$role&limit=$limit',
      apiList,
    );
    return data.map(AdminUser.fromJson).toList();
  }

  Future<List<AdminInvitation>> invitations() async {
    final data = await _api.get<List<Object?>>(
      '/admin/invitations',
      apiList,
    );
    return data.map(AdminInvitation.fromJson).toList();
  }

  Future<AdminInvitation> createInvitation(
      {required String email, String? name}) async {
    final body = <String, Object?>{'email': email};
    if (name != null) body['name'] = name;
    final data = await _api.post<Object?>(
      '/admin/invitations',
      body: body,
      fromData: (json) => json,
    );
    final m = (data as Map?)?.cast<String, Object?>();
    final inv = m?['invitation'];
    return AdminInvitation.fromJson(inv ?? data);
  }

  Future<List<AdminVoucher>> vouchers({int limit = 50}) async {
    final data = await _api.get<List<Object?>>(
      '/admin/vouchers?limit=$limit',
      apiList,
    );
    return data.map(AdminVoucher.fromJson).toList();
  }

  Future<List<AdminPaymentRow>> pendingPayments({int limit = 50}) async {
    final data = await _api.get<List<Object?>>(
      '/admin/payments?status=menunggu&limit=$limit',
      apiList,
    );
    return data.map(AdminPaymentRow.fromJson).toList();
  }

  Future<void> verifyPayment({
    required int paymentId,
    required bool accept,
    int? amountPaid,
    String? reason,
  }) {
    final body = <String, Object?>{
      'decision': accept ? 'terima' : 'tolak',
    };
    if (accept && amountPaid != null) body['amountPaid'] = amountPaid;
    if (!accept && reason != null) body['reason'] = reason;
    return _api.post<Object?>(
      '/admin/payments/$paymentId/verify',
      body: body,
      fromData: (_) => null,
    );
  }
}
