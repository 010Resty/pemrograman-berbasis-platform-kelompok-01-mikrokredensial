import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/file_url.dart';
import '../../core/models.dart';
import '../../core/offline_cache.dart';
import '../../shared_ui.dart';
import '../../theme/app_tokens.dart';
import '../../widgets/activity_tile.dart';
import '../../widgets/course_card.dart';
import '../../widgets/section_header.dart';
import '../activity/activity_feed.dart';
import '../activity/activity_page.dart';
import '../catalog/catalog_api.dart';
import '../catalog/catalog_detail_page.dart';
import '../catalog/course_progress.dart';
import '../catalog/kursusku_page.dart';
import '../certificate/certificates_page.dart';
import '../learning/enrollment_api.dart';
import '../learning/progress_api.dart';
import '../payment/payment_history_page.dart';
import '../promo/promo_page.dart';
import '../catalog/catalog_page.dart';
import '../profile/profile_page.dart';

/// Tab Beranda peserta: sapaan + ringkasan + lanjutkan + pintasan +
/// rekomendasi + aktivitas terkini. Semua angka dari server.
class StudentDashboard extends StatefulWidget {
  const StudentDashboard(
      {super.key, required this.api, required this.user, this.onOpenTab});

  final ApiClient api;
  final AppUser user;

  /// Pindah ke tab bawah (indeks): 1=Jelajahi, 2=Kursus Saya,
  /// 3=Aktivitas, 4=Profil. Null = buka sebagai halaman baru.
  final ValueChanged<int>? onOpenTab;

  @override
  State<StudentDashboard> createState() => _StudentDashboardState();
}

class _StudentDashboardState extends State<StudentDashboard> {
  List<MyEnrollment> _active = [];
  ProgressSummary? _summary;
  int _certCount = 0;
  CourseProgress? _continueProgress;
  MyEnrollment? _continueCourse;
  String? _continueLevel;
  List<PublicCourse> _recommended = [];
  List<ActivityItem> _recent = [];
  bool _loading = true;
  String? _error;
  bool _offline = false;

  final _cache = OfflineCache();

  String get _firstName {
    final parts = widget.user.name.trim().split(RegExp(r'\s+'));
    return parts.isEmpty ? 'Peserta' : parts.first;
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // Semua request independen jalan konkuren via Future.wait.
      final enrollF = EnrollmentApi(widget.api).mine();
      final summaryF = ProgressApi(widget.api).summary();
      final feedF = loadActivityFeed(widget.api)
          .catchError((_) => <ActivityItem>[]);
      final recoF = CatalogApi(widget.api)
          .list()
          .catchError((_) => <PublicCourse>[]);
      final results = await Future.wait<dynamic>(
          [enrollF, summaryF, feedF, recoF]);
      final enrollments = ((results[0] as List<MyEnrollment>)
          .where((e) => e.isActive)
          .toList());
      final summary = results[1] as ProgressSummary;
      final feed = results[2] as List<ActivityItem>;
      final reco = results[3] as List<PublicCourse>;
      CourseProgress? cont;
      String? level;
      MyEnrollment? first;
      if (enrollments.isNotEmpty) {
        first = enrollments.first;
        // Dua request ini independen satu sama lain: jalan bersamaan.
        final contF = loadCourseProgress(widget.api, first.courseId);
        final levelF = CatalogApi(widget.api)
            .detail(first.courseId)
            .then<String?>((d) => d.level)
            .catchError((_) => null);
        final both = await Future.wait<dynamic>([contF, levelF]);
        cont = both[0] as CourseProgress?;
        level = both[1] as String?;
      }
      try {
        if (!mounted) return;
        setState(() {
          _active = enrollments;
          _summary = summary;
          // R1: hitung sertifikat dari feed yang sama (tanpa GET ulang).
          _certCount =
              feed.where((e) => e.kind == 'certificate').length;
          _recent = feed.take(3).toList();
          _recommended = reco.take(5).toList();
          _continueCourse = first;
          _continueProgress = cont;
          _continueLevel = level;
          _offline = false;
        });
      } finally {
        // Tulis cache di latar (best-effort, tanpa memblokir UI/uji).
        _cache.saveJson('dashboard_reco',
            reco.take(5).map((c) => c.toJson()).toList());
        _cache.saveJson('dashboard_feed',
            feed.take(3).map((a) => a.toJson()).toList());
      }
    } on ApiException catch (e) {
      try {
        final recoCached = await _cache.readJson(
            'dashboard_reco', OfflineCache.catalogTtl);
        final feedCached = await _cache.readJson(
            'dashboard_feed', OfflineCache.catalogTtl);
        final recoData = recoCached?.data;
        final feedData = feedCached?.data;
        final hasReco = recoData is List && recoData.isNotEmpty;
        final hasFeed = feedData is List && feedData.isNotEmpty;
        if (hasReco || hasFeed) {
          if (!mounted) return;
          setState(() {
            if (hasReco) {
              _recommended =
                  recoData.map(PublicCourse.fromJson).toList();
            }
            if (hasFeed) {
              _recent =
                  feedData.map(ActivityItem.fromJson).toList();
            }
            _error = e.message;
            _offline = true;
          });
          return;
        }
      } catch (_) {
        // Abaikan: fallback ke error penuh di bawah.
      }
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _push(Widget page) {
    Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => page));
  }

  /// Buka tab bila tersedia, sonst dorong sebagai halaman baru.
  void _openTabOrPush(int tab, Widget page) {
    final go = widget.onOpenTab;
    if (go != null) {
      go(tab);
    } else {
      _push(page);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return StateViews.loading('Memuat beranda…');
    if (_error != null &&
        !_offline &&
        _recommended.isEmpty &&
        _recent.isEmpty) {
      return StateViews.error(_error!, _load);
    }
    return RefreshIndicator(
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
          if (_offline)
            const OfflineChip(
                label: 'Mode offline — menampilkan data tersimpan.'),
          _greeting(),
          const SizedBox(height: AppSpacing.md),
          _heroCard(),
          const SizedBox(height: AppSpacing.lg),
          if (_continueCourse != null) ...[
            SectionHeader(
              title: 'Lanjutkan Belajar',
              icon: Icons.play_circle_outlined,
              actionLabel: 'Kursusku',
              onAction: () => _openTabOrPush(
                  2, KursuskuPage(api: widget.api, showAppBar: true)),
            ),
            const SizedBox(height: AppSpacing.sm),
            _continueCard(),
            const SizedBox(height: AppSpacing.lg),
          ],
          const SectionHeader(
            title: 'Pintasan Akademik',
            icon: Icons.grid_view_outlined,
            iconColor: AppColors.purple,
          ),
          const SizedBox(height: AppSpacing.sm),
          _shortcuts(),
          const SizedBox(height: AppSpacing.lg),
          SectionHeader(
            title: 'Rekomendasi Untukmu',
            subtitle: 'Kurikulum berbasis riset terkini.',
            icon: Icons.workspace_premium_outlined,
            iconColor: AppColors.warning,
            actionLabel: 'Lihat Semua',
            onAction: () =>
                _openTabOrPush(1, CatalogPage(api: widget.api)),
          ),
          const SizedBox(height: AppSpacing.sm),
          _recommendedSection(),
          const SizedBox(height: AppSpacing.lg),
          SectionHeader(
            title: 'Aktivitas Terkini',
            icon: Icons.timeline_outlined,
            iconColor: AppColors.success,
            actionLabel: 'Semua',
            onAction: () =>
                _openTabOrPush(3, ActivityPage(api: widget.api)),
          ),
          const SizedBox(height: AppSpacing.sm),
          _recentSection(),
          const SizedBox(height: AppSpacing.xxl),
        ],
      ),
    );
  }

  Widget _recommendedSection() {
    if (_recommended.isEmpty) {
      return StateViews.empty('Belum ada rekomendasi',
          'Jelajahi katalog untuk menemukan kursus yang cocok untukmu.');
    }
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth >= 600) {
          return GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate:
                const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: AppSpacing.md,
              crossAxisSpacing: AppSpacing.md,
              childAspectRatio: 1.6,
            ),
            itemCount: _recommended.length,
            itemBuilder: (context, i) =>
                _courseCard(_recommended[i]),
          );
        }
        return Column(
          children: [
            for (var i = 0; i < _recommended.length; i++) ...[
              _courseCard(_recommended[i]),
              if (i != _recommended.length - 1)
                const SizedBox(height: AppSpacing.md),
            ],
          ],
        );
      },
    );
  }

  Widget _recentSection() {
    if (_recent.isEmpty) {
      return StateViews.empty('Belum ada aktivitas',
          'Pembayaran dan sertifikat baru akan muncul di sini.');
    }
    return Column(
      children: [
        for (var i = 0; i < _recent.length; i++) ...[
          _activityRow(_recent[i]),
          if (i != _recent.length - 1)
            const SizedBox(height: AppSpacing.sm),
        ],
      ],
    );
  }

  Widget _greeting() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md, vertical: AppSpacing.sm),
          decoration: BoxDecoration(
            color: AppColors.primarySoft,
            border: Border.all(color: AppColors.primaryBorder),
            borderRadius: BorderRadius.circular(AppRadius.pill),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.verified,
                  size: 14, color: AppColors.primary),
              SizedBox(width: AppSpacing.xs),
              Text('PESERTA AKTIF MICROCREDENTIAL',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.6,
                      color: AppColors.primary)),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text('Halo, $_firstName', style: AppText.display),
        Text('Selamat datang kembali di laboratorium digital Anda.',
            style: AppText.small),
      ],
    );
  }

  Widget _heroCard() {
    final pct = (_summary?.percent ?? 0) / 100;
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
            right: -30,
            top: -30,
            child: _GlowBlob(diameter: 130, opacity: 0.10),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('INDEKS PEMBELAJARAN',
                              style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.6,
                                  color: AppColors.muted)),
                          SizedBox(height: AppSpacing.xs),
                          Text('Ringkasan Belajar',
                              style: AppText.section),
                        ],
                      ),
                    ),
                    Stack(
                      alignment: Alignment.center,
                      children: [
                        SizedBox(
                          width: 64,
                          height: 64,
                          child: CircularProgressIndicator(
                            value: pct.clamp(0.0, 1.0),
                            strokeWidth: 6,
                            backgroundColor: AppColors.primarySoft,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(
                                    AppColors.primaryContainer),
                          ),
                        ),
                        Text('${(pct * 100).round()}%',
                            style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    _mini('${_active.length}', 'Kursus Aktif',
                        AppColors.primary),
                    const SizedBox(width: AppSpacing.sm),
                    _mini('${_summary?.completedMaterials ?? 0}',
                        'Modul Selesai', AppColors.primaryContainer),
                    const SizedBox(width: AppSpacing.sm),
                    _mini('$_certCount', 'Sertifikat Resmi',
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
        padding:
            const EdgeInsets.symmetric(vertical: AppSpacing.md),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: AppColors.divider),
          borderRadius: BorderRadius.circular(AppRadius.sm),
        ),
        child: Column(
          children: [
            Text(value,
                style: TextStyle(
                    fontSize: 20,
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

  Widget _continueCard() {
    final e = _continueCourse!;
    final p = _continueProgress;
    final pct = p == null ? 0.0 : p.percent;
    final info = p == null
        ? 'Lanjutkan dari progres terakhir.'
        : '${p.doneCount}/${p.totalMaterials} materi selesai'
            '${p.firstPendingModule != null ? ' · ${p.firstPendingModule}' : ''}';
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        side: BorderSide(color: AppColors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(e.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppText.section),
            if (_continueLevel != null)
              Padding(
                padding:
                    const EdgeInsets.only(top: AppSpacing.xs),
                child: Text(_continueLevel!,
                    style: AppText.small),
              ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                    child: Text(info,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.small)),
                Text('${(pct * 100).round()}%',
                    style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary)),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.pill),
              child: LinearProgressIndicator(
                value: pct.clamp(0.0, 1.0),
                minHeight: 8,
                backgroundColor: AppColors.primarySoft,
                valueColor: const AlwaysStoppedAnimation<Color>(
                    AppColors.primaryContainer),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => _push(CatalogDetailPage(
                    api: widget.api, courseId: e.courseId)),
                icon: const Icon(Icons.play_arrow, size: 18),
                label: const Text('Lanjut Belajar'),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _shortcuts() {
    final tiles = [
      _Shortcut(Icons.library_books_outlined, 'Semua\nKursus',
          AppColors.primarySoft, AppColors.primaryContainer,
          () => _openTabOrPush(1, CatalogPage(api: widget.api))),
      _Shortcut(Icons.school_outlined, 'Kursus\nSaya',
          AppColors.infoSoft, AppColors.info,
          () => _openTabOrPush(2, KursuskuPage(api: widget.api))),
      _Shortcut(Icons.verified_outlined, 'Sertifikat',
          AppColors.warningSoft, AppColors.warning,
          () => _push(CertificatesPage(api: widget.api))),
      _Shortcut(Icons.receipt_long_outlined, 'Riwayat\nBayar',
          AppColors.successSoft, AppColors.success,
          () => _push(PaymentHistoryPage(api: widget.api))),
      _Shortcut(Icons.group_add_outlined, 'Promo &\nHibah',
          AppColors.roseSoft, AppColors.rose,
          () => _push(PromoPage(api: widget.api))),
      _Shortcut(Icons.person_outlined, 'Profil\nSaya',
          AppColors.purpleSoft, AppColors.purple,
          () => _openTabOrPush(4, ProfilePage(api: widget.api))),
    ];
    return LayoutBuilder(
      builder: (context, constraints) {
        // Lebar 3 kolom dengan spasi 12: deterministik, tanpa sliver.
        final tileWidth = (constraints.maxWidth - 24) / 3;
        return Wrap(
          spacing: AppSpacing.md,
          runSpacing: AppSpacing.md,
          children: [
            for (final t in tiles)
              SizedBox(
                width: tileWidth,
                child: InkWell(
                  onTap: t.onTap,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        vertical: AppSpacing.md),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border.all(color: AppColors.border),
                      borderRadius:
                          BorderRadius.circular(AppRadius.md),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: t.bg,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(t.icon,
                              color: t.fg, size: 22),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(t.label,
                            textAlign: TextAlign.center,
                            style: AppText.small.copyWith(
                                fontWeight: FontWeight.w600,
                                color: AppColors.ink)),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _courseCard(PublicCourse c) {
    final img = resolveAvatarUrl(c.image, widget.api.baseUrl);
    return CourseCard(
      title: c.title,
      categoryLabel: c.category,
      levelLabel: c.level,
      imageUrl: img,
      priceLabel: c.isFree ? '' : c.priceLabel,
      isFree: c.isFree,
      ctaLabel: 'Lihat Kursus',
      onTap: () => _openCourse(c.id),
      onCta: () => _openCourse(c.id),
    );
  }

  void _openCourse(int id) {
    _push(CatalogDetailPage(api: widget.api, courseId: id));
  }

  Widget _activityRow(ActivityItem item) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: ActivityTile(
        icon: item.icon,
        iconColor: item.color,
        title: item.title,
        subtitle: item.subtitle,
        timeLabel: activityTimeLabel(item.time),
        accentLeft: item.kind == 'verified',
        onTap: () {
          if (item.courseId != null) {
            _openCourse(item.courseId!);
          }
        },
      ),
    );
  }
}

class _Shortcut {
  _Shortcut(this.icon, this.label, this.bg, this.fg, this.onTap);

  final IconData icon;
  final String label;
  final Color bg;
  final Color fg;
  final VoidCallback onTap;
}

/// Bercak lembut dekoratif untuk kartu hero (D2: kesan hidup).
class _GlowBlob extends StatelessWidget {
  const _GlowBlob({required this.diameter, required this.opacity});

  final double diameter;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: diameter,
      height: diameter,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.primaryContainer.withValues(alpha: opacity),
      ),
    );
  }
}
