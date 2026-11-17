import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/file_url.dart';
import '../../core/offline_cache.dart';
import '../../shared_ui.dart';
import '../../theme/app_tokens.dart';
import '../../widgets/course_card.dart';
import '../catalog/catalog_detail_page.dart';
import 'promo_api.dart';

/// Daftar promo & hibah: kampanye aktif + kursus anggotanya.
/// Harga promo informatif; nominal bayar selalu dihitung server.
class PromoPage extends StatefulWidget {
  const PromoPage({super.key, required this.api});

  final ApiClient api;

  @override
  State<PromoPage> createState() => _PromoPageState();
}

class _PromoPageState extends State<PromoPage> {
  List<PromoCampaign> _items = [];
  bool _loading = true;
  String? _error;
  bool _offline = false;

  final _cache = OfflineCache();
  static const _cacheKey = 'promo_list';

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
      final rows = await PromoApi(widget.api).list();
      await _cache.saveJson(
          _cacheKey, rows.map((c) => c.toJson()).toList());
      if (!mounted) return;
      setState(() {
        _items = rows;
        _offline = false;
      });
    } on ApiException catch (e) {
      // Offline (R6): tampilkan kampanye tersimpan bila ada.
      final cached = await _cache.readJson(
          _cacheKey, OfflineCache.catalogTtl);
      if (!mounted) return;
      final data = cached?.data;
      if (data is List) {
        setState(() {
          _items = data.map(PromoCampaign.fromJson).toList();
          _offline = true;
        });
      } else {
        setState(() => _error = e.message);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _endsLabel(PromoCampaign c) {
    final end = c.endsAt;
    if (end == null || end.isEmpty) return 'Berlaku selama tersedia';
    return 'Berakhir ${formatDateTime(end)}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Promo & Hibah')),
      body: _loading
          ? StateViews.loading('Memuat promo…')
          : _error != null
              ? StateViews.error(_error!, _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _items.isEmpty
                      ? ListView(children: [
                          StateViews.empty('Belum ada promo aktif',
                              'Kembali lagi nanti untuk penawaran terbaru.')
                        ])
                      : ListView.separated(
                          padding: EdgeInsets.fromLTRB(
                            AppSpacing.md,
                            AppSpacing.md,
                            AppSpacing.md,
                            AppSpacing.md +
                                MediaQuery.of(context).padding.bottom +
                                AppSpacing.sm,
                          ),
                          itemCount:
                              _items.length + (_offline ? 1 : 0),
                          separatorBuilder: (context, index) =>
                              const SizedBox(height: AppSpacing.md),
                          itemBuilder: (context, i) {
                            if (_offline && i == 0) {
                              return const OfflineChip(
                                label:
                                    'Offline — menampilkan promo tersimpan.',
                              );
                            }
                            final c =
                                _items[_offline ? i - 1 : i];
                            return Card(
                              margin: EdgeInsets.zero,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(
                                    AppRadius.lg),
                                side: BorderSide(color: AppColors.border),
                              ),
                              child: InkWell(
                                onTap: () => Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => PromoDetailPage(
                                        api: widget.api, slug: c.slug),
                                  ),
                                ),
                                borderRadius: BorderRadius.circular(
                                    AppRadius.lg),
                                child: Padding(
                                  padding:
                                      const EdgeInsets.all(AppSpacing.lg),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          if (c.badgeLabel != null)
                                            Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      horizontal:
                                                          AppSpacing.sm,
                                                      vertical:
                                                          AppSpacing.xs),
                                              decoration: BoxDecoration(
                                                color: AppColors.primary,
                                                borderRadius:
                                                    BorderRadius.circular(
                                                        AppRadius.xs),
                                              ),
                                              child: Text(c.badgeLabel!,
                                                  style: const TextStyle(
                                                      fontSize: 12,
                                                      fontWeight:
                                                          FontWeight.w700,
                                                      color: Colors.white)),
                                            ),
                                          if (c.badgeLabel != null)
                                            const SizedBox(
                                                width: AppSpacing.sm),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: AppSpacing.sm,
                                                vertical: AppSpacing.xs),
                                            decoration: BoxDecoration(
                                              color: AppColors.primarySoft,
                                              borderRadius:
                                                  BorderRadius.circular(
                                                      AppRadius.xs),
                                            ),
                                            child: Text(c.typeLabel,
                                                style: const TextStyle(
                                                    fontSize: 12,
                                                    fontWeight:
                                                        FontWeight.w700,
                                                    color:
                                                        AppColors.primary)),
                                          ),
                                          const Spacer(),
                                          if (c.discountPercent != null)
                                            Text('-${c.discountPercent}%',
                                                style: const TextStyle(
                                                    fontSize: 20,
                                                    fontWeight:
                                                        FontWeight.w900,
                                                    color:
                                                        AppColors.primary)),
                                        ],
                                      ),
                                      const SizedBox(height: AppSpacing.sm),
                                      Text(c.title,
                                          style: AppText.section),
                                      const SizedBox(height: AppSpacing.xs),
                                      Text(
                                          '${c.courses.length} kursus · ${_endsLabel(c)}',
                                          style: AppText.small),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                ),
    );
  }
}

/// Detail kampanye: daftar kursus anggota + CTA ke halaman kursus.
class PromoDetailPage extends StatefulWidget {
  const PromoDetailPage({super.key, required this.api, required this.slug});

  final ApiClient api;
  final String slug;

  @override
  State<PromoDetailPage> createState() => _PromoDetailPageState();
}

class _PromoDetailPageState extends State<PromoDetailPage> {
  PromoCampaign? _campaign;
  bool _loading = true;
  String? _error;

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
      final c = await PromoApi(widget.api).detail(widget.slug);
      if (!mounted) return;
      if (c == null) {
        setState(() => _error = 'Promo tidak ditemukan atau kedaluwarsa.');
      } else {
        setState(() => _campaign = c);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = _campaign;
    return Scaffold(
      appBar: AppBar(title: Text(c?.title ?? 'Detail Promo')),
      body: _loading
          ? StateViews.loading()
          : _error != null || c == null
              ? StateViews.error(_error ?? 'Promo tidak tersedia.', _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: c.courses.isEmpty
                      ? ListView(
                          padding: EdgeInsets.fromLTRB(
                            AppSpacing.md,
                            AppSpacing.md,
                            AppSpacing.md,
                            AppSpacing.md +
                                MediaQuery.of(context).padding.bottom +
                                AppSpacing.sm,
                          ),
                          children: [
                            _headerBanner(c),
                            const SizedBox(height: AppSpacing.md),
                            StateViews.empty(
                                'Belum ada kursus dalam promo ini',
                                'Promo ini belum memiliki kursus anggota.'),
                          ],
                        )
                      : ListView.separated(
                          padding: EdgeInsets.fromLTRB(
                            AppSpacing.md,
                            AppSpacing.md,
                            AppSpacing.md,
                            AppSpacing.md +
                                MediaQuery.of(context).padding.bottom +
                                AppSpacing.sm,
                          ),
                          itemCount: c.courses.length +
                              (c.type == 'patungan' ? 2 : 1),
                          separatorBuilder: (context, index) =>
                              const SizedBox(height: AppSpacing.md),
                          itemBuilder: (context, i) {
                            if (i == 0) {
                              return _headerBanner(c);
                            }
                            if (c.type == 'patungan' && i == 1) {
                              return Container(
                                padding:
                                    const EdgeInsets.all(AppSpacing.md),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(
                                      AppRadius.md),
                                  border: Border.all(
                                      color: AppColors.warning
                                          .withValues(alpha: 0.4)),
                                ),
                                child: const Text(
                                  'Kampanye patungan: pembentukan grup dilakukan via web. Harga iuran final dihitung server saat membayar.',
                                  style: AppText.small,
                                ),
                              );
                            }
                            final course = c.courses[
                                i - (c.type == 'patungan' ? 2 : 1)];
                            final img = resolveAvatarUrl(
                                course.image, widget.api.baseUrl);
                            return CourseCard(
                              title: course.title,
                              imageUrl: img,
                              priceLabel: course.priceLabel.isEmpty
                                  ? formatIDR(course.priceNominal)
                                  : course.priceLabel,
                              isFree: course.priceNominal <= 0,
                              promoPriceLabel: course.promoPrice != null
                                  ? formatIDR(course.promoPrice!)
                                  : null,
                              ctaLabel: 'Lihat Kursus',
                              onTap: () => _open(course.courseId),
                              onCta: () => _open(course.courseId),
                            );
                          },
                        ),
                ),
    );
  }

  Widget _headerBanner(PromoCampaign c) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Text(
        '${c.badgeLabel ?? c.typeLabel} · ${c.courses.length} kursus${c.endsAt != null && c.endsAt!.isNotEmpty ? ' · berakhir ${formatDateTime(c.endsAt!)}' : ''}',
        style: AppText.small,
      ),
    );
  }

  void _open(int courseId) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) =>
            CatalogDetailPage(api: widget.api, courseId: courseId),
      ),
    );
  }
}
