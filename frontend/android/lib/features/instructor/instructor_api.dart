import '../../core/api_client.dart';

class InstructorCourse {
  InstructorCourse({
    required this.id,
    required this.title,
    this.studentCount = 0,
    this.pendingCount = 0,
  });

  final int id;
  final String title;
  final int studentCount;
  final int pendingCount;

  factory InstructorCourse.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asInt(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return InstructorCourse(
      id: asInt(m['id']),
      title: '${m['title'] ?? ''}',
      studentCount: asInt(m['studentCount']),
      pendingCount: asInt(m['pendingCount']),
    );
  }
}

class DashboardTotals {
  DashboardTotals({
    required this.activeCourses,
    required this.pendingReviews,
    required this.totalStudents,
  });

  final int activeCourses;
  final int pendingReviews;
  final int totalStudents;

  factory DashboardTotals.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asInt(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return DashboardTotals(
      activeCourses: asInt(m['activeCourses']),
      pendingReviews: asInt(m['pendingReviews']),
      totalStudents: asInt(m['totalStudents']),
    );
  }
}

class ReviewTask {
  ReviewTask({
    required this.materialId,
    required this.title,
    required this.pending,
    required this.total,
  });

  final int materialId;
  final String title;
  final int pending;
  final int total;

  factory ReviewTask.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asId(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return ReviewTask(
      materialId: asId(m['materialId']),
      title: '${m['title'] ?? ''}',
      pending: (m['pending'] is int) ? m['pending'] as int : int.tryParse('${m['pending'] ?? 0}') ?? 0,
      total: (m['total'] is int) ? m['total'] as int : int.tryParse('${m['total'] ?? 0}') ?? 0,
    );
  }
}

class ReviewQueueCourse {
  ReviewQueueCourse({
    required this.id,
    required this.title,
    required this.tasks,
  });

  final int id;
  final String title;
  final List<ReviewTask> tasks;

  factory ReviewQueueCourse.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    final tasks = m['tasks'];
    int asId(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return ReviewQueueCourse(
      id: asId(m['id']),
      title: '${m['title'] ?? ''}',
      tasks: tasks is List ? tasks.map(ReviewTask.fromJson).toList() : [],
    );
  }
}

class MaterialSubmission {
  MaterialSubmission({
    required this.id,
    required this.status,
    this.score,
    this.studentName,
    this.studentNim,
    this.fileUrl,
    this.originalName,
    this.feedback,
    this.rubric,
    this.submittedAt,
  });

  final int id;
  final String status;
  final int? score;
  final String? studentName;
  final String? studentNim;
  final String? fileUrl;
  final String? originalName;
  final String? feedback;
  final Map<String, int>? rubric;
  final String? submittedAt;

  factory MaterialSubmission.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asId(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    Map<String, int>? rub;
    final r = m['rubricScores'];
    if (r is Map) {
      int v(Object? x) => x is int ? x : int.tryParse('$x') ?? 0;
      rub = {
        'kelengkapan': v(r['kelengkapan']),
        'ketepatan': v(r['ketepatan']),
        'kerapian': v(r['kerapian']),
      };
    }
    return MaterialSubmission(
      id: asId(m['id']),
      status: '${m['status'] ?? ''}',
      score: m['score'] is int
          ? m['score'] as int
          : int.tryParse('${m['score'] ?? ''}'),
      studentName: m['studentName'] as String?,
      studentNim: m['studentNim'] as String?,
      fileUrl: m['fileUrl'] as String?,
      originalName: m['originalName'] as String?,
      feedback: m['feedback'] as String?,
      rubric: rub,
      submittedAt: m['submittedAt'] as String?,
    );
  }
}

class InstCertificateSummary {
  InstCertificateSummary({
    required this.issuedActiveCount,
    required this.eligibleCount,
    required this.notEligibleCount,
    required this.revokedCount,
  });

  final int issuedActiveCount;
  final int eligibleCount;
  final int notEligibleCount;
  final int revokedCount;

  factory InstCertificateSummary.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asInt(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return InstCertificateSummary(
      issuedActiveCount: asInt(m['issuedActiveCount']),
      eligibleCount: asInt(m['eligibleCount']),
      notEligibleCount: asInt(m['notEligibleCount']),
      revokedCount: asInt(m['revokedCount']),
    );
  }
}

class InstCertificateRecord {
  InstCertificateRecord({
    required this.id,
    required this.code,
    required this.studentName,
    required this.courseTitle,
    this.moduleTitle,
    required this.status,
    required this.issuedAt,
    this.revokeReason,
  });

  final Object id;
  final String code;
  final String studentName;
  final String courseTitle;
  final String? moduleTitle;
  final String status;
  final String issuedAt;
  final String? revokeReason;

  factory InstCertificateRecord.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    return InstCertificateRecord(
      id: m['id'] ?? 0,
      code: '${m['code'] ?? ''}',
      studentName: '${m['studentName'] ?? m['recipientName'] ?? ''}',
      courseTitle: '${m['courseTitle'] ?? ''}',
      moduleTitle: m['moduleTitle'] as String?,
      status: '${m['status'] ?? ''}',
      issuedAt: '${m['issuedAt'] ?? ''}',
      revokeReason: m['revokeReason'] as String?,
    );
  }
}

class InstructorApi {
  InstructorApi(this._api);

  final ApiClient _api;

  Future<DashboardTotals> dashboard() async {
    final data = await _api.get<Object?>(
      '/instructor/dashboard/',
      (json) => json,
    );
    final m = (data as Map?)?.cast<String, Object?>();
    final totals = m?['totals'];
    return DashboardTotals.fromJson(totals ?? data);
  }

  Future<List<InstructorCourse>> myCourses() async {
    final data = await _api.get<List<Object?>>(
      '/instructor/courses',
      (json) {
        final m = (json as Map?)?.cast<String, Object?>();
        return apiList(m?['courses'] ?? json);
      },
    );
    return data.map(InstructorCourse.fromJson).toList();
  }

  Future<List<ReviewQueueCourse>> reviewQueue() async {
    final data = await _api.get<List<Object?>>(
      '/instructor/review-queue',
      (json) {
        final m = (json as Map?)?.cast<String, Object?>();
        return apiList(m?['courses'] ?? json);
      },
    );
    return data.map(ReviewQueueCourse.fromJson).toList();
  }

  Future<List<MaterialSubmission>> submissions(int materialId) async {
    final data = await _api.get<Object?>(
      '/materials/$materialId/submissions',
      (json) => json,
    );
    final m = (data as Map?)?.cast<String, Object?>();
    final rows = m?['rows'];
    if (rows is! List) return [];
    return rows.map(MaterialSubmission.fromJson).toList();
  }

  Future<void> grade({
    required int materialId,
    required int submissionId,
    required int score,
    required String decision,
    String? feedback,
    Map<String, int>? rubric,
  }) async {
    final body = <String, Object?>{
      'score': score,
      'decision': decision,
    };
    if (feedback != null && feedback.isNotEmpty) body['feedback'] = feedback;
    if (rubric != null) body['rubric'] = rubric;
    await _api.post<Object?>(
      '/materials/$materialId/submissions/$submissionId/grade',
      body: body,
      fromData: (_) => null,
    );
  }

  Future<InstCertificateSummary> certSummary() {
    return _api.get<InstCertificateSummary>(
      '/instructor/certificates/summary',
      InstCertificateSummary.fromJson,
    );
  }

  Future<List<InstCertificateRecord>> certificates({int limit = 50}) async {
    final data = await _api.get<Object?>(
      '/instructor/certificates?limit=$limit',
      (json) => json,
    );
    final m = (data as Map?)?.cast<String, Object?>();
    final items = m?['items'];
    if (items is! List) return [];
    return items.map(InstCertificateRecord.fromJson).toList();
  }

  Future<InstCertificateRecord> certificateDetail(Object id) {
    return _api.get<InstCertificateRecord>(
      '/instructor/certificates/$id',
      InstCertificateRecord.fromJson,
    );
  }

  Future<void> revokeCertificate(Object id, String reason) async {
    await _api.post<Object?>(
      '/instructor/certificates/$id/revoke',
      body: {'reason': reason},
      fromData: (_) => null,
    );
  }
}
