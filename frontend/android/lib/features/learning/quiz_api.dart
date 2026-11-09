import '../../core/api_client.dart';

class QuizOption {
  QuizOption({required this.id, required this.text});

  final int id;
  final String text;

  factory QuizOption.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asId(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return QuizOption(id: asId(m['id']), text: '${m['optionText'] ?? ''}');
  }
}

class QuizQuestion {
  QuizQuestion({required this.id, required this.text, required this.options});

  final int id;
  final String text;
  final List<QuizOption> options;

  factory QuizQuestion.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    final opts = m['options'];
    int asId(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return QuizQuestion(
      id: asId(m['id']),
      text: '${m['questionText'] ?? ''}',
      options:
          opts is List ? opts.map(QuizOption.fromJson).toList() : const [],
    );
  }
}

class QuizBest {
  QuizBest({
    required this.attempts,
    required this.bestScore,
    required this.effectivePassScore,
    required this.passed,
  });

  final int attempts;
  final int? bestScore;
  final int effectivePassScore;
  final bool passed;

  factory QuizBest.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asInt(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return QuizBest(
      attempts: asInt(m['attempts']),
      bestScore: m['bestScore'] == null
          ? null
          : (m['bestScore'] is int
              ? m['bestScore'] as int
              : int.tryParse('${m['bestScore']}')),
      effectivePassScore: asInt(m['effectivePassScore']),
      passed: m['passed'] == true,
    );
  }
}

class QuizAttemptRow {
  QuizAttemptRow(
      {required this.score, required this.passed, required this.attemptedAt});

  final int score;
  final bool passed;
  final String attemptedAt;

  factory QuizAttemptRow.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asInt(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return QuizAttemptRow(
      score: asInt(m['score']),
      passed: m['passed'] == true,
      attemptedAt: '${m['attemptedAt'] ?? ''}',
    );
  }
}

class QuizAttemptResult {
  QuizAttemptResult({
    required this.score,
    required this.passed,
    required this.bestScore,
    required this.attempts,
    required this.overallPassed,
  });

  final int score;
  final bool passed;
  final int? bestScore;
  final int attempts;
  final bool overallPassed;

  factory QuizAttemptResult.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int? asIntN(Object? v) =>
        v == null ? null : (v is int ? v : int.tryParse('$v'));
    int asInt(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return QuizAttemptResult(
      score: asInt(m['score']),
      passed: m['passed'] == true,
      bestScore: asIntN(m['bestScore']),
      attempts: asInt(m['attempts']),
      overallPassed: m['overallPassed'] == true,
    );
  }
}

class QuizApi {
  QuizApi(this._api);

  final ApiClient _api;

  Future<List<QuizQuestion>> questions(int materialId) async {
    final data = await _api.get<Object?>(
      '/materials/$materialId/quiz',
      (json) => json,
    );
    final m = (data as Map?)?.cast<String, Object?>();
    final list = m?['questions'];
    if (list is! List) return [];
    return list.map(QuizQuestion.fromJson).toList();
  }

  Future<QuizAttemptResult> submit(
      int materialId, List<Map<String, Object?>> answers) {
    return _api.post<QuizAttemptResult>(
      '/materials/$materialId/quiz-attempts',
      body: {'answers': answers},
      fromData: QuizAttemptResult.fromJson,
    );
  }

  Future<QuizBest?> best(int materialId) async {
    try {
      final data = await _api.get<Object?>(
        '/materials/$materialId/quiz-best',
        (json) => json,
      );
      return QuizBest.fromJson(data);
    } on ApiException {
      return null;
    }
  }

  Future<List<QuizAttemptRow>> history(int materialId) async {
    try {
      final data = await _api.get<List<Object?>>(
        '/materials/$materialId/quiz-attempts',
        apiList,
      );
      return data.map(QuizAttemptRow.fromJson).toList();
    } on ApiException {
      return [];
    }
  }
}
