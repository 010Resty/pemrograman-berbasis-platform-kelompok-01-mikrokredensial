import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../shared_ui.dart';
import 'grade_page.dart';
import 'instructor_api.dart';

/// Antrean penilaian: kursus → tugas menunggu → daftar pengumpulan.
class ReviewQueuePage extends StatefulWidget {
  const ReviewQueuePage({super.key, required this.api});

  final ApiClient api;

  @override
  State<ReviewQueuePage> createState() => _ReviewQueuePageState();
}

class _ReviewQueuePageState extends State<ReviewQueuePage> {
  List<ReviewQueueCourse> _courses = [];
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
      final rows = await InstructorApi(widget.api).reviewQueue();
      if (!mounted) return;
      setState(() => _courses = rows);
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
      appBar: AppBar(title: const Text('Penilaian')),
      body: _loading
          ? StateViews.loading()
          : _error != null
              ? StateViews.error(_error!, _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _courses.isEmpty
                      ? ListView(children: [
                          StateViews.empty('Antrean kosong',
                              'Tidak ada pengumpulan yang menunggu dinilai.')
                        ])
                      : ListView.builder(
                          padding: const EdgeInsets.all(12),
                          itemCount: _courses.length,
                          itemBuilder: (context, i) {
                            final c = _courses[i];
                            if (c.tasks.isEmpty) {
                              return const SizedBox.shrink();
                            }
                            return Card(
                              margin: const EdgeInsets.only(bottom: 12),
                              child: ExpansionTile(
                                initiallyExpanded: true,
                                title: Text(c.title,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold)),
                                children: [
                                  for (final t in c.tasks)
                                    ListTile(
                                      title: Text(t.title,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis),
                                      subtitle: Text(
                                          '${t.pending} menunggu · ${t.total} total'),
                                      trailing:
                                          const Icon(Icons.arrow_forward_ios,
                                              size: 16),
                                      onTap: () async {
                                        await Navigator.of(context).push(
                                          MaterialPageRoute(
                                            builder: (_) => GradePage(
                                              api: widget.api,
                                              courseId: c.id,
                                              courseTitle: c.title,
                                              materialId: t.materialId,
                                              taskTitle: t.title,
                                            ),
                                          ),
                                        );
                                        _load();
                                      },
                                    ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
    );
  }
}
