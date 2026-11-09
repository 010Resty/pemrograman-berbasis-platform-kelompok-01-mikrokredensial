import '../../core/api_client.dart';

class ProgressSummary {
  ProgressSummary({
    required this.totalCourses,
    required this.totalMaterials,
    required this.completedMaterials,
    required this.percent,
  });

  final int totalCourses;
  final int totalMaterials;
  final int completedMaterials;
  final double percent;

  factory ProgressSummary.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    num asNum(Object? v) => v is num ? v : 0;
    return ProgressSummary(
      totalCourses: asNum(m['totalCourses']).toInt(),
      totalMaterials: asNum(m['totalMaterials']).toInt(),
      completedMaterials: asNum(m['completedMaterials']).toInt(),
      percent: (asNum(m['percent'])).toDouble(),
    );
  }

  static ProgressSummary empty() => ProgressSummary(
      totalCourses: 0, totalMaterials: 0, completedMaterials: 0, percent: 0);
}

class ProgressApi {
  ProgressApi(this._api);

  final ApiClient _api;

  /// Id materi selesai milik sendiri (angka server).
  Future<Set<String>> myIds({int? courseId}) async {
    final q = courseId == null ? '' : '?courseId=$courseId';
    final data = await _api.get<List<Object?>>(
      '/me/progress$q',
      apiList,
    );
    return data.map((e) => '$e').toSet();
  }

  /// Tandai selesai (K-04). Optimistis di UI, batal bila server menolak.
  Future<Map<String, Object?>> markDone(int materialId) {
    return _api.post<Map<String, Object?>>(
      '/materials/$materialId/progress',
      body: const {},
      fromData: (json) => (json as Map?)?.cast<String, Object?>() ?? {},
    );
  }

  Future<ProgressSummary> summary() async {
    try {
      final data = await _api.get<Object?>(
        '/me/progress/summary',
        (json) => json,
      );
      return ProgressSummary.fromJson(data);
    } on ApiException {
      return ProgressSummary.empty();
    }
  }
}
