import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/offline_cache.dart';
import '../../shared_ui.dart';
import '../../theme/app_tokens.dart';
import '../../widgets/course_card.dart';
import '../learning/enrollment_api.dart';
import '../learning/progress_api.dart';
import 'catalog_detail_page.dart';
import 'course_progress.dart';

/// Kursus Saya: metrik ringkas + filter status + kartu progres per kursus.
/// Progres dihitung real dari tree kurikulum × progres server.
class KursuskuPage extends StatefulWidget {
  const KursuskuPage({super.key, required this.api, this.showAppBar = true});

  final ApiClient api;

  /// False bila dipakai sebagai tab (header global sudah ada).
  final bool showAppBar;

  @override
  State<KursuskuPage> createState() => _KursuskuPageState();
}

class _KursuskuPageState extends State<KursuskuPage> {
  List<MyEnrollment> _items = [];
  ProgressSummary? _summary;
  String _filter = 'semua';
  bool _loading = true;
  String? _error;
  bool _offline = false;

  final _cache = OfflineCache();

  /// Future progres per kursus — dibuat malas saat kartu tampil,
  /// hasilnya dipakai ulang (tanpa fetch berulang).
  final Map<int, Future<CourseProgress>> _progressFutures = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  static Map<String, Object?> _toJson(MyEnrollment e) => {
        'courseId': e.courseId,
        'title': e.title,
        'status': e.status,
        'source': e.source,
      };

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = EnrollmentApi(widget.api);
      // Dua request independen: jalan konkuren via Future.wait.
      final results = await Future.wait<dynamic>([
        api.mine(),
        ProgressApi(widget.api).summary(),
      ]);
      final items = (results[0] as List<MyEnrollment>)
          .where((e) => e.isActive)
          .toList();
      final summary = results[1] as ProgressSummary;
      try {
        await _cache.saveJson(
            'kursusku_list', items.map(_toJson).toList());
      } catch (_) {
        // Best-effort: abaikan bila gagal.
      }
      if (!mounted) return;
      setState(() {
        _items = items;
        _summary = summary;
        _offline = false;
        // Progres per kursus TIDAK dihitung di muka (R3): tiap kartu
        // memuatnya sendiri saat tampil via _progressOf (memoized).
        _progressFutures.clear();
      });
    } on ApiException catch (e) {
      final cached =
          await _cache.readJson('kursusku_list', OfflineCache.catalogTtl);
      if (!mounted) return;
      final data = cached?.data;
      if (data is List && data.isNotEmpty) {
        setState(() {
          _items = data.map(MyEnrollment.fromJson).toList();
          _offline = true;
          _error = e.message;
          _progressFutures.clear();
        });
      } else {
        if (!mounted) return;
        setState(() => _error = e.message);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<MyEnrollment> get _filtered {
    switch (_filter) {
      case 'aktif':
        return _items
            .where((e) => e.status == 'active')
            .toList();
      case 'selesai':
        return _items
            .where((e) => e.status == 'completed')
            .toList();
      default:
        return _items;
    }
  }

  int _count(String key) {
    switch (key) {
      case 'aktif':
        return _items.where((e) => e.status == 'active').length;
      case 'selesai':
        return _items.where((e) => e.status == 'completed').length;
      default:
        return _items.length;
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasContent = _items.isNotEmpty;
    final body = _loading
        ? StateViews.loading('Memuat kursusku…')
        : (_error != null && !hasContent && !_offline)
            ? StateViews.error(_error!, _load)
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  padding: EdgeInsets.fromLTRB(
                    AppSpacing.md,
                    AppSpacing.md,
                    AppSpacing.md,
                    AppSpacing.md +
                        MediaQuery.of(context).padding.bottom +
                        AppSpacing.sm,
                  ),
                  children: [
                    const Text('Kursus Saya', style: AppText.display),
                    const SizedBox(height: AppSpacing.xs),
                    Text('Lacak perkembangan microcredentials Anda.',
                        style: AppText.small),
                    const SizedBox(height: AppSpacing.md),
                    if (_offline || (_error != null && hasContent))
                      const OfflineChip(
                          label:
                              'Mode offline — menampilkan data tersimpan.'),
                    _metricsCard(),
                    const SizedBox(height: AppSpacing.md),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          _filterChip('semua', 'Semua',
                              Icons.timelapse_outlined),
                          const SizedBox(width: AppSpacing.sm),
                          _filterChip('aktif', 'Sedang Berjalan',
                              Icons.play_circle_outlined),
                          const SizedBox(width: AppSpacing.sm),
                          _filterChip('selesai', 'Selesai',
                              Icons.verified_outlined),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    if (_filtered.isEmpty)
                      StateViews.empty('Belum ada kursus',
                          'Belum ada kursus pada filter ini. Jelajahi katalog untuk mulai belajar.'),
                    for (var i = 0; i < _filtered.length; i++) ...[
                      _courseCard(_filtered[i]),
                      if (i != _filtered.length - 1)
                        const SizedBox(height: AppSpacing.md),
                    ],
                    const SizedBox(height: AppSpacing.lg),
                  ],
                ),
              );
    if (widget.showAppBar) {
      return Scaffold(
        appBar: AppBar(title: const Text('Kursus Saya')),
        body: body,
      );
    }
    return body;
  }

  Widget _metricsCard() {
    final s = _summary;
    final pct = (s?.percent ?? 0) / 100;
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Colors.white, AppColors.heroEnd],
        ),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.hero,
      ),
      child: Stack(
        children: [
          const Positioned(
            right: -24,
            top: -24,
            child: _MetricsGlow(),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.analytics_outlined,
                        size: 18, color: AppColors.primary),
                    SizedBox(width: AppSpacing.sm),
                    Text('Progres Belajar',
                        style: AppText.caption),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    _mini('${_items.length}', 'Kursus Aktif',
                        AppColors.primary),
                    const SizedBox(width: AppSpacing.sm),
                    _mini(
                        '${s?.completedMaterials ?? 0}/${s?.totalMaterials ?? 0}',
                        'Modul Selesai',
                        AppColors.primaryContainer),
                    const SizedBox(width: AppSpacing.sm),
                    _mini('${(pct * 100).round()}%', 'Progres',
                        AppColors.primaryContainer),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _mini(String value, String label, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: AppColors.divider),
          borderRadius: BorderRadius.circular(AppRadius.sm),
        ),
        child: Column(
          children: [
            Text(value,
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: color)),
            const SizedBox(height: AppSpacing.xs),
            Text(label,
                textAlign: TextAlign.center, style: AppText.small),
          ],
        ),
      ),
    );
  }

  Widget _filterChip(String key, String label, IconData icon) {
    final active = _filter == key;
    return InkWell(
      onTap: () => setState(() => _filter = key),
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: Container(
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg, vertical: AppSpacing.md),
        decoration: BoxDecoration(
          color: active ? AppColors.primary : Colors.white,
          border: Border.all(
              color: active ? AppColors.primary : AppColors.border),
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon,
                size: 18,
                color: active ? Colors.white : AppColors.muted),
            const SizedBox(width: AppSpacing.sm),
            Text('$label (${_count(key)})',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: active ? Colors.white : AppColors.ink)),
          ],
        ),
      ),
    );
  }

  /// Future progres per kursus, dibuat malas saat kartu tampil dan
  /// dipakai ulang — daftar hanya memuat ringkasan di muka (R3).
  Future<CourseProgress> _progressOf(int courseId) =>
      _progressFutures.putIfAbsent(
        courseId,
        () => loadCourseProgress(widget.api, courseId),
      );

  Widget _courseCard(MyEnrollment e) {
    return FutureBuilder<CourseProgress>(
      future: _progressOf(e.courseId),
      builder: (context, snap) {
        final p = snap.data;
        final pct = p == null ? 0.0 : p.percent;
        final doneLabel = p == null
            ? 'Menghitung progres…'
            : p.totalMaterials == 0
                ? 'Belum ada materi'
                : 'Progres: ${p.doneCount}/${p.totalMaterials} materi';
        return CourseCard(
          title: e.title,
          levelLabel: e.status == 'completed' ? 'Selesai' : null,
          progress: pct,
          progressLabel: doneLabel,
          ctaLabel: 'Lanjut Belajar',
          onTap: () => _open(e.courseId),
          onCta: () => _open(e.courseId),
        );
      },
    );
  }

  void _open(int courseId) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CatalogDetailPage(
            api: widget.api, courseId: courseId),
      ),
    );
    _load();
  }
}

/// Bercak lembut dekoratif untuk kartu metrik (D2: kesan hidup).
class _MetricsGlow extends StatelessWidget {
  const _MetricsGlow();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 110,
      height: 110,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.primaryContainer.withValues(alpha: 0.10),
      ),
    );
  }
}
