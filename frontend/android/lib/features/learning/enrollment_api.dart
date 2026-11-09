import '../../core/api_client.dart';

class MyEnrollment {
  MyEnrollment(
      {required this.courseId,
      required this.title,
      required this.status,
      required this.source});

  final int courseId;
  final String title;
  final String status;
  final String source;

  bool get isActive => status == 'active' || status == 'completed';

  factory MyEnrollment.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asId(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return MyEnrollment(
      courseId: asId(m['courseId']),
      title: '${m['title'] ?? ''}',
      status: '${m['status'] ?? ''}',
      source: '${m['source'] ?? ''}',
    );
  }
}

class CourseAccess {
  CourseAccess(
      {required this.hasAccess, required this.isManager, this.status, this.source});

  final bool hasAccess;
  final bool isManager;
  final String? status;
  final String? source;

  factory CourseAccess.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    final e = (m['enrollment'] as Map?)?.cast<String, Object?>();
    return CourseAccess(
      hasAccess: m['hasAccess'] == true,
      isManager: m['isManager'] == true,
      status: e?['status'] as String?,
      source: e?['source'] as String?,
    );
  }
}

class EnrollmentApi {
  EnrollmentApi(this._api);

  final ApiClient _api;

  Future<Map<String, Object?>> enrollFree(int courseId) {
    return _api.post<Map<String, Object?>>(
      '/courses/$courseId/enroll',
      body: const {},
      fromData: (json) => (json as Map?)?.cast<String, Object?>() ?? {},
    );
  }

  Future<CourseAccess> access(int courseId) {
    return _api.get<CourseAccess>(
      '/courses/$courseId/access',
      CourseAccess.fromJson,
    );
  }

  Future<List<MyEnrollment>> mine() async {
    final data = await _api.get<List<Object?>>(
      '/me/enrollments',
      (json) => apiList(json),
    );
    return data.map(MyEnrollment.fromJson).toList();
  }
}
