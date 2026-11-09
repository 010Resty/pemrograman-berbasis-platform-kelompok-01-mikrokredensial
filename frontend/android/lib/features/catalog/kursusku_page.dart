import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../shared_ui.dart';
import '../learning/enrollment_api.dart';
import '../learning/progress_api.dart';
import 'course_detail_page.dart';

/// Kursusku: daftar kursus yang diikuti + progres keseluruhan.
class KursuskuPage extends StatefulWidget {
  const KursuskuPage({super.key, required this.api});

  final ApiClient api;

  @override
  State<KursuskuPage> createState() => _KursuskuPageState();
}

class _KursuskuPageState extends State<KursuskuPage> {
  List<MyEnrollment> _items = [];
  ProgressSummary? _summary;
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
      final api = EnrollmentApi(widget.api);
      final items =
          (await api.mine()).where((e) => e.isActive).toList();
      final summary = await ProgressApi(widget.api).summary();
      if (!mounted) return;
      setState(() {
        _items = items;
        _summary = summary;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Kursusku')),
      body: _loading
          ? StateViews.loading()
          : _error != null
              ? StateViews.error(_error!, _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(12),
                    children: [
                      if (_summary != null && _summary!.totalMaterials > 0)
                        Card(
                          child: ListTile(
                            leading: CircularProgressIndicator(
                              value: _summary!.percent / 100,
                            ),
                            title: Text(
                                '${_summary!.percent.toStringAsFixed(1)}% selesai'),
                            subtitle: Text(
                                '${_summary!.completedMaterials}/${_summary!.totalMaterials} materi · ${_summary!.totalCourses} kursus'),
                          ),
                        ),
                      if (_items.isEmpty)
                        const Padding(
                          padding: EdgeInsets.only(top: 24),
                          child: Text(
                            'Belum ada kursus yang diikuti. Jelajahi katalog untuk mulai belajar.',
                            textAlign: TextAlign.center,
                          ),
                        ),
                      for (final e in _items)
                        Card(
                          child: ListTile(
                            title: Text(e.title),
                            subtitle:
                                Text(e.source.replaceAll('payment:', 'Bayar · ')),
                            trailing:
                                const Icon(Icons.arrow_forward_ios, size: 16),
                            onTap: () async {
                              await Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => CourseDetailPage(
                                      api: widget.api,
                                      courseId: e.courseId),
                                ),
                              );
                              _load();
                            },
                          ),
                        ),
                    ],
                  ),
                ),
    );
  }
}
