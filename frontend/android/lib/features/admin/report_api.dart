import '../../core/api_client.dart';

class AdminReportCourse {
  AdminReportCourse({
    required this.courseId,
    required this.title,
    required this.status,
    required this.studentCount,
    required this.avgProgress,
    required this.pendingReviews,
    required this.revenueVerified,
    required this.paymentsMenunggu,
    required this.paymentsDiverifikasi,
    required this.certificatesIssued,
    required this.certificatesRevoked,
  });

  final int courseId;
  final String title;
  final String status;
  final int studentCount;
  final int avgProgress;
  final int pendingReviews;
  final int revenueVerified;
  final int paymentsMenunggu;
  final int paymentsDiverifikasi;
  final int certificatesIssued;
  final int certificatesRevoked;

  static int _asInt(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;

  factory AdminReportCourse.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    return AdminReportCourse(
      courseId: _asInt(m['courseId']),
      title: '${m['title'] ?? ''}',
      status: '${m['status'] ?? ''}',
      studentCount: _asInt(m['studentCount']),
      avgProgress: _asInt(m['avgProgress']),
      pendingReviews: _asInt(m['pendingReviews']),
      revenueVerified: _asInt(m['revenueVerified']),
      paymentsMenunggu: _asInt(m['paymentsMenunggu']),
      paymentsDiverifikasi: _asInt(m['paymentsDiverifikasi']),
      certificatesIssued: _asInt(m['certificatesIssued']),
      certificatesRevoked: _asInt(m['certificatesRevoked']),
    );
  }
}

class AdminReportSummary {
  AdminReportSummary({
    required this.totalStudents,
    required this.totalTeachers,
    required this.totalCourses,
    required this.totalCertificates,
    required this.activeEnrollments,
    required this.completedEnrollments,
    required this.paymentsMenunggu,
    required this.paymentsDiverifikasi,
    required this.paymentsDitolak,
    required this.revenueVerified,
    required this.voucherRedemptions,
  });

  final int totalStudents;
  final int totalTeachers;
  final int totalCourses;
  final int totalCertificates;
  final int activeEnrollments;
  final int completedEnrollments;
  final int paymentsMenunggu;
  final int paymentsDiverifikasi;
  final int paymentsDitolak;
  final int revenueVerified;
  final int voucherRedemptions;

  static int _asInt(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;

  factory AdminReportSummary.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    return AdminReportSummary(
      totalStudents: _asInt(m['totalStudents']),
      totalTeachers: _asInt(m['totalTeachers']),
      totalCourses: _asInt(m['totalCourses']),
      totalCertificates: _asInt(m['totalCertificates']),
      activeEnrollments: _asInt(m['activeEnrollments']),
      completedEnrollments: _asInt(m['completedEnrollments']),
      paymentsMenunggu: _asInt(m['paymentsMenunggu']),
      paymentsDiverifikasi: _asInt(m['paymentsDiverifikasi']),
      paymentsDitolak: _asInt(m['paymentsDitolak']),
      revenueVerified: _asInt(m['revenueVerified']),
      voucherRedemptions: _asInt(m['voucherRedemptions']),
    );
  }
}

class AdminReports {
  AdminReports({
    required this.summary,
    required this.perCourse,
    required this.certificatesIssued,
    required this.certificatesRevoked,
    this.from,
    this.to,
    this.courseId,
  });

  final AdminReportSummary summary;
  final List<AdminReportCourse> perCourse;
  final int certificatesIssued;
  final int certificatesRevoked;
  final String? from;
  final String? to;
  final int? courseId;

  factory AdminReports.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    final certs = (m['certificates'] as Map?)?.cast<String, Object?>() ?? {};
    final filters = (m['filters'] as Map?)?.cast<String, Object?>() ?? {};
    int asInt(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    final courses = m['perCourse'];
    return AdminReports(
      summary: AdminReportSummary.fromJson(m['summary']),
      perCourse: courses is List ? courses.map(AdminReportCourse.fromJson).toList() : [],
      certificatesIssued: asInt(certs['issued']),
      certificatesRevoked: asInt(certs['revoked']),
      from: filters['from'] as String?,
      to: filters['to'] as String?,
      courseId: filters['courseId'] is int
          ? filters['courseId'] as int
          : int.tryParse('${filters['courseId']}'),
    );
  }
}

class ReportApi {
  ReportApi(this._api);

  final ApiClient _api;

  static String fmtDay(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<AdminReports> fetch({DateTime? from, DateTime? to, int? courseId}) {
    final q = <String>[];
    if (from != null) q.add('from=${fmtDay(from)}');
    if (to != null) q.add('to=${fmtDay(to)}');
    if (courseId != null) q.add('courseId=$courseId');
    final suffix = q.isEmpty ? '' : '?${q.join('&')}';
    return _api.get<AdminReports>('/admin/reports$suffix', AdminReports.fromJson);
  }
}
