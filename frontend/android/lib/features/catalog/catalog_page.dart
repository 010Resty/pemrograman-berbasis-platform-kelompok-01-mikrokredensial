import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/offline_cache.dart';
import '../../shared_ui.dart';
import 'catalog_api.dart';
import 'catalog_detail_page.dart';

/// Semua Kursus — katalog untuk peserta yang sudah login.
/// Cermin `user/semua-kursus` di web: cari + daftar + detail.
class CatalogPage extends StatefulWidget {
  const CatalogPage({super.key, required this.api});

  final ApiClient api;

  @override
  State<CatalogPage> createState() => _CatalogPageState();
}

class _CatalogPageState extends State<CatalogPage> {
  final _search = TextEditingController();
  String _query = '';
  List<PublicCourse> _courses = [];
  bool _loading = true;
  String? _error;
  bool _offline = false;
  DateTime? _cacheTime;

  final _cache = OfflineCache();

  String get _cacheKey =>
      _query.isEmpty ? 'catalog_list' : 'catalog_list_q_${_query.hashCode}';

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
      final rows = await CatalogApi(widget.api)
          .list(q: _query.isEmpty ? null : _query);
      await _cache.saveJson(_cacheKey, rows.map((c) => c.toJson()).toList());
      if (!mounted) return;
      setState(() {
        _courses = rows;
        _offline = false;
        _cacheTime = null;
      });
    } on ApiException catch (e) {
      // Offline: pakai daftar tersimpan bila ada.
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Semua Kursus')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
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
          Expanded(
            child: _loading
                ? StateViews.loading('Memuat katalog…')
                : _error != null
                    ? StateViews.error(_error!, _load)
                    : _courses.isEmpty
                        ? StateViews.empty('Tidak ada kursus',
                            'Coba kata kunci lain atau kembali lagi nanti.')
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView.builder(
                              itemCount:
                                  _courses.length + (_offline ? 1 : 0),
                              itemBuilder: (context, i) {
                                if (_offline && i == 0) {
                                  return Padding(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 12, vertical: 6),
                                    child: _offlineChip(),
                                  );
                                }
                                final c = _courses[_offline ? i - 1 : i];
                                return Card(
                                  margin: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 6),
                                  child: ListTile(
                                    leading: CircleAvatar(
                                      child: Text(c.title.isEmpty
                                          ? '?'
                                          : c.title[0].toUpperCase()),
                                    ),
                                    title: Text(c.title,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis),
                                    subtitle: Text(
                                        '${c.category ?? 'Umum'} · ${c.level}'),
                                    trailing: Text(
                                      c.isFree ? 'GRATIS' : c.priceLabel,
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: c.isFree
                                            ? Colors.green.shade700
                                            : null,
                                      ),
                                    ),
                                    onTap: () => Navigator.of(context).push(
                                      MaterialPageRoute(
                                        builder: (_) => CatalogDetailPage(
                                            api: widget.api, courseId: c.id),
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _offlineChip() {
    final when = _cacheTime == null
        ? ''
        : ' · ${formatDateTime(_cacheTime!.toIso8601String())}';
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.secondaryContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_outlined, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text('Offline — data tersimpan$when.',
                style: const TextStyle(fontSize: 12)),
          ),
        ],
      ),
    );
  }
}
