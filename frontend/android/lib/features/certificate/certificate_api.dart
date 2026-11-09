import '../../core/api_client.dart';

class MyCertificate {
  MyCertificate({
    required this.id,
    required this.code,
    required this.courseTitle,
    this.moduleTitle,
    required this.status,
    required this.issuedAt,
  });

  final int id;
  final String code;
  final String courseTitle;
  final String? moduleTitle;
  final String status;
  final String issuedAt;

  factory MyCertificate.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asId(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return MyCertificate(
      id: asId(m['id']),
      code: '${m['code'] ?? ''}',
      courseTitle: '${m['courseTitle'] ?? ''}',
      moduleTitle: m['moduleTitle'] as String?,
      status: '${m['status'] ?? ''}',
      issuedAt: '${m['issuedAt'] ?? ''}',
    );
  }
}

class VerifyResult {
  VerifyResult({
    required this.code,
    required this.recipientName,
    required this.courseTitle,
    this.moduleTitle,
    required this.status,
    this.revokedAt,
  });

  final String code;
  final String recipientName;
  final String courseTitle;
  final String? moduleTitle;
  final String status;
  final String? revokedAt;

  factory VerifyResult.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    return VerifyResult(
      code: '${m['code'] ?? ''}',
      recipientName: '${m['recipientName'] ?? ''}',
      courseTitle: '${m['courseTitle'] ?? ''}',
      moduleTitle: m['moduleTitle'] as String?,
      status: '${m['status'] ?? ''}',
      revokedAt: m['revokedAt'] as String?,
    );
  }
}

class ModuleCertStatus {
  ModuleCertStatus({
    required this.eligible,
    required this.failReasons,
    this.certificateCode,
  });

  final bool eligible;
  final List<String> failReasons;
  final String? certificateCode;

  factory ModuleCertStatus.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    final fr = m['failReasons'];
    final cert = (m['certificate'] as Map?)?.cast<String, Object?>();
    return ModuleCertStatus(
      eligible: m['eligible'] == true,
      failReasons: fr is List ? fr.map((e) => '$e').toList() : [],
      certificateCode: cert?['code'] as String?,
    );
  }
}

class CertificateApi {
  CertificateApi(this._api);

  final ApiClient _api;

  Future<List<MyCertificate>> mine() async {
    try {
      final data = await _api.get<List<Object?>>(
        '/me/certificates',
        apiList,
      );
      return data.map(MyCertificate.fromJson).toList();
    } on ApiException {
      return [];
    }
  }

  Future<List<int>> downloadPdf(int id) {
    return _api.downloadBytes('/me/certificates/$id/download');
  }

  Future<VerifyResult> verify(String code) {
    return _api.get<VerifyResult>(
      '/certificates/verify/${Uri.encodeComponent(code.trim())}',
      VerifyResult.fromJson,
    );
  }

  Future<ModuleCertStatus?> moduleStatus(int moduleId) async {
    try {
      final data = await _api.get<Object?>(
        '/me/modules/$moduleId/certificate-status',
        (json) => json,
      );
      return ModuleCertStatus.fromJson(data);
    } on ApiException {
      return null;
    }
  }
}
