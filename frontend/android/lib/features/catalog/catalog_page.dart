import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/file_url.dart';
import '../../core/offline_cache.dart';
import '../../shared_ui.dart';
import '../../theme/app_tokens.dart';
import '../../widgets/course_card.dart';
import '../promo/promo_api.dart';
import '../promo/promo_page.dart';
import 'catalog_api.dart';
import 'catalog_detail_page.dart';

/// Jelajahi: cari + filter kategori/level + promo + daftar kursus.
/// Semua filter memakai parameter backend yang real.
class CatalogPage extends StatefulWidget {
  const CatalogPage({super.key, required this.api, this.showAppBar = true});

  final ApiClient api;

  /// False bila dipakai sebagai tab (header global sudah ada).
  final bool showAppBar;

  @override
  State<CatalogPage> createState() => _CatalogPageState();
}

class _CatalogPageState extends State<CatalogPage> {
  final _search = TextEditingController();
  String _query = '';
  String? _category;
  String? _level;
  List<String> _categories = [];
  List<PublicCourse> _courses = [];
  PromoCampaign? _promo;
  bool _loading = true;
  String? _error;
  bool _offline = false;
  DateTime? _cacheTime;

  final _cache = OfflineCache();

  static const _levels = ['Pemula', 'Menengah', 'Lanjutan'];

  String get _cacheKey =>
      'catalog_list_q${_query.hashCode}_c${(_category ?? '').hashCode}_l${(_level ?? '').hashCode}';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = CatalogApi(widget.api);
      final results = await Future.wait([
        api.list(
          q: _query.isEmpty ? null : _query,
          category: _category,
          level: _level,
        ),
        api.categories(),
        PromoApi(widget.api).list(),
      ]);
      final rows = results[0] as List<PublicCourse>;
      final cats = results[1] as List<String>;
      final promos = results[2] as List<PromoCampaign>;
      await _cache.saveJson(_cacheKey, rows.map((c) => c.toJson()).toList());
      if (!mounted) return;
      setState(() {
        _courses = rows;
        _categories = cats;
        _promo = promos.isEmpty ? null : promos.first;
        _offline = false;
        _cacheTime = null;
      });
    } on ApiException catch (e) {
      final cached =
          await _cache.readJson(_cacheKey, OfflineCache.catalogTtl);
      if (!mounted) return;
      final data = cached?.data;
      if (data is List) {
        setState(() {
          _courses = data.map(PublicCourse.fromJson).toList();
          _offline = true;
          _cacheTime = cached!.savedAt;
        });
      } else {
        setState(() => _error = e.message);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _pickLevel() {
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: const Text('Semua Tingkat'),
              trailing:
                  _level == null ? const Icon(Icons.check) : null,
              onTap: () {
                setState(() => _level = null);
                Navigator.of(ctx).pop();
                _load();
              },
            ),
            for (final l in _levels)
              ListTile(
                title: Text(l),
                trailing:
                    _level == l ? const Icon(Icons.check) : null,
                onTap: () {
                  setState(() => _level = l);
                  Navigator.of(ctx).pop();
                  _load();
                },
              ),
          ],
        ),
      ),
    );
  }

  IconData _categoryIcon(String name) {
    final n = name.toLowerCase();
    if (n.contains('data') || n.contains('sains')) {
      return Icons.analytics_outlined;
    }
    if (n.contains('desain') || n.contains('design')) {
      return Icons.palette_outlined;
    }
    if (n.contains('web') || n.contains('program') || n.contains('kode')) {
      return Icons.code_outlined;
    }
    if (n.contains('mobile') || n.contains('android')) {
      return Icons.smartphone_outlined;
    }
    if (n.contains('ai') ||
        n.contains('kecerdasan') ||
        n.contains('machine')) {
      return Icons.psychology_outlined;
    }
    if (n.contains('jaring') || n.contains('network')) {
      return Icons.hub_outlined;
    }
    if (n.contains('aman') || n.contains('secur')) {
      return Icons.shield_outlined;
    }
    return Icons.school_outlined;
  }

  @override
  Widget build(BuildContext context) {
    final body = Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.md, AppSpacing.md, AppSpacing.md, AppSpacing.sm),
          child: Row(
            children: [
              Expanded(
                child: SearchBar(
                  controller: _search,
                  hintText: 'Cari judul atau deskripsi kursus…',
                  leading: const Icon(Icons.search),
                  trailing: _query.isEmpty
                      ? null
                      : [
                          IconButton(
                            tooltip: 'Bersihkan',
                            icon: const Icon(Icons.clear),
                            onPressed: () {
                              _search.clear();
                              setState(() => _query = '');
                              _load();
                            },
                          ),
                        ],
                  onSubmitted: (v) {
                    setState(() => _query = v.trim());
                    _load();
                  },
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              IconButton.filledTonal(
                tooltip: 'Filter tingkat',
                icon: Icon(Icons.tune,
                    color: _level == null ? null : AppColors.primary),
                onPressed: _pickLevel,
              ),
            ],
          ),
        ),
        if (_categories.isNotEmpty)
          SizedBox(
            height: 48,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md, vertical: AppSpacing.sm),
              itemCount: _categories.length + 1,
              separatorBuilder: (context, index) =>
                  const SizedBox(width: AppSpacing.sm),
              itemBuilder: (context, i) {
                if (i == 0) {
                  return _chip('Semua', Icons.apps_outlined,
                      _category == null, () {
                    setState(() => _category = null);
                    _load();
                  });
                }
                final c = _categories[i - 1];
                return _chip(c, _categoryIcon(c), _category == c,
                    () {
                  setState(() =>
                      _category = _category == c ? null : c);
                  _load();
                });
              },
            ),
          ),
        Expanded(
          child: _loading
              ? StateViews.loading('Memuat katalog…')
              : _error != null
                  ? StateViews.error(_error!, _load)
                  : _courses.isEmpty
                      ? StateViews.empty('Tidak ada kursus',
                          'Coba kata kunci atau filter lain.')
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView.separated(
                            padding: EdgeInsets.fromLTRB(
                              AppSpacing.md,
                              AppSpacing.md,
                              AppSpacing.md,
                              AppSpacing.md +
                                  MediaQuery.of(context).padding.bottom +
                                  AppSpacing.sm,
                            ),
                            itemCount: _courses.length +
                                (_promo != null ? 1 : 0) +
                                (_offline ? 1 : 0),
                            separatorBuilder: (context, index) =>
                                const SizedBox(height: AppSpacing.md),
                            itemBuilder: (context, i) {
                              var idx = i;
                              if (_promo != null) {
                                if (idx == 0) return _promoBanner();
                                idx -= 1;
                              }
                              if (_offline) {
                                if (idx == 0) return _offlineChip();
                                idx -= 1;
                              }
                              final c = _courses[idx];
                              return CourseCard(
                                title: c.title,
                                categoryLabel: c.category,
                                levelLabel: c.level,
                                imageUrl: resolveAvatarUrl(
                                    c.image, widget.api.baseUrl),
                                priceLabel: c.isFree
                                    ? null
                                    : (c.priceLabel.isEmpty
                                        ? formatIDR(c.priceNominal)
                                        : c.priceLabel),
                                isFree: c.isFree,
                                ctaLabel: 'Lihat Kursus',
                                onTap: () => _open(c.id),
                                onCta: () => _open(c.id),
                              );
                            },
                          ),
                        ),
        ),
      ],
    );
    if (widget.showAppBar) {
      return Scaffold(
        appBar: AppBar(title: const Text('Semua Kursus')),
        body: body,
      );
    }
    return body;
  }

  Widget _chip(
      String label, IconData icon, bool active, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.pill),
      child: Container(
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg, vertical: AppSpacing.md),
        decoration: BoxDecoration(
          color: active ? AppColors.primaryContainer : Colors.white,
          border: Border.all(
              color: active
                  ? AppColors.primaryContainer
                  : AppColors.border),
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon,
                size: 16,
                color: active ? Colors.white : AppColors.primary),
            const SizedBox(width: AppSpacing.xs),
            Text(label,
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: active ? Colors.white : AppColors.ink)),
          ],
        ),
      ),
    );
  }

  Widget _promoBanner() {
    final p = _promo!;
    return InkWell(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
            builder: (_) =>
                PromoPage(api: widget.api)),
      ),
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.primary, AppColors.primaryContainer],
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (p.badgeLabel != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius:
                            BorderRadius.circular(AppRadius.sm),
                      ),
                      child: Text(p.badgeLabel!,
                          style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Colors.white)),
                    ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(p.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.white)),
                  if (p.discountPercent != null)
                    Text('Diskon hingga ${p.discountPercent}%',
                        style: TextStyle(
                            fontSize: 12,
                            color: Colors.white.withValues(alpha: 0.9))),
                ],
              ),
            ),
            const Icon(Icons.local_offer_outlined,
                color: Colors.white, size: 36),
          ],
        ),
      ),
    );
  }

  Widget _offlineChip() {
    final when = _cacheTime == null
        ? ''
        : ' · ${formatDateTime(_cacheTime!.toIso8601String())}';
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.primaryBorder),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_outlined,
              size: 20, color: AppColors.primary),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text('Offline — data tersimpan$when.',
                style: AppText.small),
          ),
        ],
      ),
    );
  }

  void _open(int id) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) =>
            CatalogDetailPage(api: widget.api, courseId: id),
      ),
    );
  }
}
