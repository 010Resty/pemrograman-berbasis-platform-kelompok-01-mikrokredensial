import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../shared_ui.dart';
import '../certificate/certificate_api.dart';
import '../learning/progress_api.dart';
import 'catalog_api.dart';
import 'material_page.dart';

/// Isi kursus: modul → sub-modul → materi + progres + status sertifikat.
/// K-07: modul independen; kunci sekuensial hanya di dalam sub-modul yang sama.
class CourseDetailPage extends StatefulWidget {
  const CourseDetailPage({super.key, required this.api, required this.courseId});

  final ApiClient api;
  final int courseId;

  @override
  State<CourseDetailPage> createState() => _CourseDetailPageState();
}

class _ModuleCert {
  _ModuleCert(this.moduleId, this.status);
  final String moduleId;
  final ModuleCertStatus? status;
}

class _CourseDetailPageState extends State<CourseDetailPage> {
  CourseDetail? _course;
  List<TreeModule> _tree = [];
  Set<String> _done = {};
  List<_ModuleCert> _certs = [];
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
      final catalog = CatalogApi(widget.api);
      final detail = await catalog.detail(widget.courseId);
      final tree = await catalog.tree(widget.courseId);
      final done =
          await ProgressApi(widget.api).myIds(courseId: widget.courseId);
      final certApi = CertificateApi(widget.api);
      final certs = <_ModuleCert>[];
      for (final m in tree) {
        final mid = int.tryParse(m.id);
        final st =
            mid == null ? null : await certApi.moduleStatus(mid);
        certs.add(_ModuleCert(m.id, st));
      }
      if (!mounted) return;
      setState(() {
        _course = detail;
        _tree = tree;
        _done = done;
        _certs = certs;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool _locked(List<TreeMaterial> mats, int index) {
    for (var i = 0; i < index; i++) {
      if (!_done.contains(mats[i].id)) return true;
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_course?.title ?? 'Kursus')),
      body: _loading
          ? StateViews.loading()
          : _error != null
              ? StateViews.error(_error!, _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: _tree.length,
                    itemBuilder: (context, mi) {
                      final mod = _tree[mi];
                      final cert = _certs
                          .where((c) => c.moduleId == mod.id)
                          .map((c) => c.status)
                          .firstOrNull;
                      final allMats = mod.subModules
                          .expand((s) => s.materials)
                          .toList();
                      final doneCount =
                          allMats.where((m) => _done.contains(m.id)).length;
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: ExpansionTile(
                          initiallyExpanded: mi == 0,
                          title: Text(mod.title,
                              style:
                                  const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text(
                              '$doneCount/${allMats.length} selesai${cert != null && cert.eligible ? ' · memenuhi syarat sertifikat' : ''}'),
                          children: [
                            for (final sub in mod.subModules) ...[
                              Padding(
                                padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                                child: Align(
                                  alignment: Alignment.centerLeft,
                                  child: Text(sub.title,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w600)),
                                ),
                              ),
                              for (var i = 0; i < sub.materials.length; i++)
                                Builder(builder: (context) {
                                  final mat = sub.materials[i];
                                  final locked = _locked(sub.materials, i);
                                  final done = _done.contains(mat.id);
                                  return ListTile(
                                    dense: true,
                                    leading: Icon(
                                      done
                                          ? Icons.check_circle
                                          : locked
                                              ? Icons.lock_outline
                                              : _iconFor(mat.type),
                                      color: done ? Colors.green : null,
                                    ),
                                    title: Text(mat.title,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis),
                                    subtitle: Text(_typeLabel(mat.type)),
                                    enabled: !locked,
                                    onTap: locked
                                        ? null
                                        : () async {
                                            await Navigator.of(context).push(
                                              MaterialPageRoute(
                                                builder: (_) => MaterialDetailPage(
                                                  api: widget.api,
                                                  courseId: widget.courseId,
                                                  moduleId: mod.id,
                                                  material: mat,
                                                  isDone: done,
                                                ),
                                              ),
                                            );
                                            _load();
                                          },
                                  );
                                }),
                            ],
                          ],
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}

IconData _iconFor(String type) {
  switch (type) {
    case 'kuis':
      return Icons.quiz_outlined;
    case 'tugas':
      return Icons.assignment_outlined;
    case 'video':
      return Icons.play_circle_outline;
    case 'audio':
      return Icons.headphones_outlined;
    case 'foto':
      return Icons.image_outlined;
    default:
      return Icons.article_outlined;
  }
}

String _typeLabel(String type) {
  switch (type) {
    case 'kuis':
      return 'Kuis';
    case 'tugas':
      return 'Tugas';
    case 'video':
      return 'Video';
    case 'audio':
      return 'Audio';
    case 'foto':
      return 'Foto';
    default:
      return 'Materi';
  }
}
