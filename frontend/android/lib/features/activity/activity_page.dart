import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/offline_cache.dart';
import '../../shared_ui.dart';
import '../../theme/app_tokens.dart';
import '../../widgets/activity_tile.dart';
import '../certificate/certificates_page.dart';
import '../payment/payment_history_page.dart';
import '../payment/payment_page.dart';
import 'activity_feed.dart';

/// Tab Aktivitas: timeline pembayaran + sertifikat (data real).
/// Filter: Semua / Pembayaran / Sertifikat (tugas & kuis tidak punya
/// endpoint feed, jadi tidak ditampilkan — tanpa data palsu).
class ActivityPage extends StatefulWidget {
  const ActivityPage({super.key, required this.api, this.showAppBar = true});

  final ApiClient api;

  /// False bila dipakai sebagai tab (header global sudah ada).
  final bool showAppBar;

  @override
  State<ActivityPage> createState() => _ActivityPageState();
}

class _ActivityPageState extends State<ActivityPage> {
  List<ActivityItem> _items = [];
  String _filter = 'semua';
  bool _loading = true;
  String? _error;
  bool _offline = false;

  final _cache = OfflineCache();

  static const _filters = [
    ('semua', 'Semua'),
    ('pembayaran', 'Pembayaran'),
    ('sertifikat', 'Sertifikat'),
  ];

  static const _payKinds = {'pending', 'rejected', 'verified'};

  @override
  void initState() {
    super.initState();
    _load();
  }

  static const _cacheKey = 'activity_feed';

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await loadActivityFeed(widget.api);
      await _cache.saveJson(
          _cacheKey, items.map((e) => e.toJson()).toList());
      if (!mounted) return;
      setState(() {
        _items = items;
        _offline = false;
      });
    } on ApiException catch (e) {
      // Offline (R6): tampilkan feed tersimpan bila ada.
      final cached = await _cache.readJson(
          _cacheKey, OfflineCache.paymentsTtl);
      if (!mounted) return;
      final data = cached?.data;
      if (data is List) {
        setState(() {
          _items = data.map(ActivityItem.fromJson).toList();
          _offline = true;
        });
      } else {
        setState(() => _error = e.message);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<ActivityItem> get _filtered {
    switch (_filter) {
      case 'pembayaran':
        return _items.where((e) => _payKinds.contains(e.kind)).toList();
      case 'sertifikat':
        return _items.where((e) => e.kind == 'certificate').toList();
      default:
        return _items;
    }
  }

  void _open(ActivityItem item) {
    if (item.kind == 'certificate') {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => CertificatesPage(api: widget.api),
        ),
      );
      return;
    }
    if (item.courseId != null) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => PaymentPage(
              api: widget.api, courseId: item.courseId!),
        ),
      );
      return;
    }
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PaymentHistoryPage(api: widget.api),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final body = _loading
        ? StateViews.loading()
        : _error != null
            ? StateViews.error(_error!, _load)
            : RefreshIndicator(
                onRefresh: _load,
                child: CustomScrollView(
                    slivers: [
                      if (_offline)
                        const SliverToBoxAdapter(
                          child: Padding(
                            padding: EdgeInsets.fromLTRB(
                                AppSpacing.md,
                                AppSpacing.md,
                                AppSpacing.md,
                                0),
                            child: OfflineChip(
                                label:
                                    'Offline — menampilkan aktivitas tersimpan.'),
                          ),
                        ),
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(
                              AppSpacing.md,
                              AppSpacing.md,
                              AppSpacing.md,
                              AppSpacing.xs),
                          child: SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: [
                                for (final f in _filters)
                                  Padding(
                                    padding: const EdgeInsets.only(
                                        right: AppSpacing.sm),
                                    child: ChoiceChip(
                                      label: Text(f.$2,
                                          style: AppText.small),
                                      selected: _filter == f.$1,
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: AppSpacing.md,
                                          vertical: AppSpacing.md),
                                      materialTapTargetSize:
                                          MaterialTapTargetSize.padded,
                                      onSelected: (_) => setState(
                                          () => _filter = f.$1),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      if (_filtered.isEmpty)
                        SliverFillRemaining(
                          hasScrollBody: false,
                          child: StateViews.empty(
                              'Belum ada aktivitas',
                              _filter == 'semua'
                                  ? 'Pembayaran dan sertifikat baru akan muncul di sini.'
                                  : 'Tidak ada aktivitas pada filter ini.'),
                        )
                      else
                        SliverList(
                          delegate: SliverChildBuilderDelegate(
                            (context, i) =>
                                _groupOrItem(_grouped(), i),
                            childCount: _rowCount(_grouped()),
                          ),
                        ),
                      SliverToBoxAdapter(
                        child: SizedBox(
                          height: MediaQuery.of(context).padding.bottom +
                              AppSpacing.sm,
                        ),
                      ),
                    ],
                  ),
                );
    if (widget.showAppBar) {
      return Scaffold(
        appBar: AppBar(title: const Text('Aktivitas & Riwayat')),
        body: body,
      );
    }
    return body;
  }

  Map<String, List<ActivityItem>> _grouped() {
    final map = <String, List<ActivityItem>>{};
    for (final e in _filtered) {
      final g = activityGroupLabel(e.time);
      (map[g] ??= []).add(e);
    }
    const order = ['Hari ini', 'Kemarin', 'Sebelumnya'];
    final sorted = <String, List<ActivityItem>>{};
    for (final k in order) {
      if (map.containsKey(k)) sorted[k] = map[k]!;
    }
    for (final k in map.keys) {
      sorted.putIfAbsent(k, () => map[k]!);
    }
    return sorted;
  }

  int _rowCount(Map<String, List<ActivityItem>> grouped) {
    var n = 0;
    for (final list in grouped.values) {
      n += 1 + list.length;
    }
    return n;
  }

  Widget _groupOrItem(Map<String, List<ActivityItem>> grouped, int i) {
    var idx = i;
    for (final entry in grouped.entries) {
      if (idx == 0) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.md,
              AppSpacing.md, AppSpacing.sm),
          child: Row(
            children: [
              Text(entry.key, style: AppText.small),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                  child: Divider(color: AppColors.divider, height: 1)),
            ],
          ),
        );
      }
      idx -= 1;
      if (idx < entry.value.length) {
        final item = entry.value[idx];
        return Padding(
          padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md, vertical: AppSpacing.xs),
          child: ActivityTile(
            icon: item.icon,
            iconColor: item.color,
            title: item.title,
            subtitle: item.subtitle,
            timeLabel: activityTimeLabel(item.time),
            accentLeft: item.kind == 'verified',
            onTap: () => _open(item),
          ),
        );
      }
      idx -= entry.value.length;
    }
    return const SizedBox.shrink();
  }
}
