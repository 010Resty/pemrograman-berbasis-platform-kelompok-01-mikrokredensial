import '../../core/api_client.dart';
import '../learning/progress_api.dart';
import 'catalog_api.dart';

/// Progres satu kursus (real): hitung dari tree kurikulum + progres server.
/// Dipakai Beranda (kartu lanjutkan) dan Kursus Saya (progress bar).
class CourseProgress {
  CourseProgress({
    required this.totalMaterials,
    required this.doneCount,
    this.firstPendingModule,
  });

  final int totalMaterials;
  final int doneCount;
  final String? firstPendingModule;

  double get percent =>
      totalMaterials <= 0 ? 0 : doneCount / totalMaterials;
}

Future<CourseProgress> loadCourseProgress(
    ApiClient api, int courseId) async {
  try {
    final results = await Future.wait([
      CatalogApi(api).tree(courseId),
      ProgressApi(api).myIds(courseId: courseId),
    ]);
    final tree = results[0] as List<TreeModule>;
    final done = results[1] as Set<String>;
    var total = 0;
    var doneCount = 0;
    String? firstPending;
    for (final mod in tree) {
      for (final sub in mod.subModules) {
        for (final mat in sub.materials) {
          total++;
          if (done.contains(mat.id)) {
            doneCount++;
          } else {
            firstPending ??= mod.title;
          }
        }
      }
    }
    return CourseProgress(
      totalMaterials: total,
      doneCount: doneCount,
      firstPendingModule: firstPending,
    );
  } on ApiException {
    return CourseProgress(totalMaterials: 0, doneCount: 0);
  }
}
