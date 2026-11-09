import 'dart:convert';

import '../../core/api_client.dart';

class TaskStatus {
  TaskStatus({
    required this.attempts,
    required this.graded,
    required this.passed,
    required this.bestScore,
  });

  final int attempts;
  final int graded;
  final bool passed;
  final int? bestScore;

  factory TaskStatus.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asInt(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return TaskStatus(
      attempts: asInt(m['attempts']),
      graded: asInt(m['graded']),
      passed: m['passed'] == true,
      bestScore: m['bestScore'] == null
          ? null
          : (m['bestScore'] is int
              ? m['bestScore'] as int
              : int.tryParse('${m['bestScore']}')),
    );
  }

  static TaskStatus empty() =>
      TaskStatus(attempts: 0, graded: 0, passed: false, bestScore: null);
}

class TaskSubmission {
  TaskSubmission({
    required this.id,
    required this.status,
    required this.score,
    required this.fileUrl,
    required this.originalName,
    required this.submittedAt,
    this.feedback,
    this.rubric,
  });

  final int id;
  final String status;
  final int? score;
  final String fileUrl;
  final String? originalName;
  final String submittedAt;
  final String? feedback;
  final Map<String, int>? rubric;

  factory TaskSubmission.fromJson(Object? json) {
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
    return TaskSubmission(
      id: asId(m['id']),
      status: '${m['status'] ?? 'submitted'}',
      score: m['score'] is int
          ? m['score'] as int
          : int.tryParse('${m['score'] ?? ''}'),
      fileUrl: '${m['fileUrl'] ?? ''}',
      originalName: m['originalName'] as String?,
      submittedAt: '${m['submittedAt'] ?? ''}',
      feedback: m['feedback'] as String?,
      rubric: rub,
    );
  }
}

class UploadedFile {
  UploadedFile({required this.id, required this.url});

  final int id;
  final String url;

  factory UploadedFile.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asId(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return UploadedFile(id: asId(m['id']), url: '${m['url'] ?? ''}');
  }
}

class SubmissionApi {
  SubmissionApi(this._api);

  final ApiClient _api;

  Future<TaskStatus> status(int materialId) async {
    try {
      final data = await _api.get<Object?>(
        '/materials/$materialId/submissions/status',
        (json) => json,
      );
      return TaskStatus.fromJson(data);
    } on ApiException {
      return TaskStatus.empty();
    }
  }

  Future<List<TaskSubmission>> history(int materialId) async {
    try {
      final data = await _api.get<List<Object?>>(
        '/materials/$materialId/submissions',
        (json) => apiList(json, 'rows'),
      );
      return data.map(TaskSubmission.fromJson).toList();
    } on ApiException {
      return [];
    }
  }

  /// Upload byte mentah sebagai file backend (base64 JSON).
  Future<UploadedFile> upload({
    required String filename,
    required String mimeType,
    required String kind,
    required List<int> bytes,
  }) {
    return _api.post<UploadedFile>(
      '/uploads',
      body: {
        'filename': filename,
        'mimeType': mimeType,
        'kind': kind,
        'data': base64Encode(bytes),
      },
      fromData: UploadedFile.fromJson,
    );
  }

  Future<TaskSubmission> submit({
    required int materialId,
    required int fileId,
    String? studentNim,
    String? note,
  }) {
    return _api.post<TaskSubmission>(
      '/materials/$materialId/submissions',
      body: {
        'fileId': fileId,
        if (studentNim != null && studentNim.isNotEmpty) 'studentNim': studentNim,
        if (note != null && note.isNotEmpty) 'note': note,
      },
      fromData: TaskSubmission.fromJson,
    );
  }
}
