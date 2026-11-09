import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../shared_ui.dart';
import '../catalog/catalog_api.dart';
import 'instructor_api.dart';

/// Kursus yang saya ampu → struktur modul → materi.
class InstructorCoursesPage extends StatefulWidget {
  const InstructorCoursesPage({super.key, required this.api});

  final ApiClient api;

  @override
  State<InstructorCoursesPage> createState() => _InstructorCoursesPageState();
}

class _InstructorCoursesPageState extends State<InstructorCoursesPage> {
  List<InstructorCourse> _courses = [];
  bool _loading = true;
  String? _error;
  int? _openCourseId;
  List<TreeModule> _tree = [];
  bool _treeLoading = false;

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
      final rows = await InstructorApi(widget.api).myCourses();
      if (!mounted) return;
      setState(() => _courses = rows);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _open(int courseId) async {
    setState(() {
      _openCourseId = courseId;
      _treeLoading = true;
      _tree = [];
    });
    try {
      final tree = await CatalogApi(widget.api).tree(courseId);
      if (!mounted) return;
      setState(() => _tree = tree);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _treeLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Kursusku (Instruktur)')),
      body: _loading
          ? StateViews.loading()
          : _error != null
              ? StateViews.error(_error!, _load)
              : _courses.isEmpty
                  ? StateViews.empty('Belum ada kursus',
                      'Anda belum tercatat sebagai pengampu kursus apa pun.')
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: _courses.length,
                        itemBuilder: (context, i) {
                          final c = _courses[i];
                          final open = _openCourseId == c.id;
                          return Card(
                            child: ExpansionTile(
                              key: ValueKey(c.id),
                              initiallyExpanded: false,
                              onExpansionChanged: (v) {
                                if (v) {
                                  _open(c.id);
                                } else {
                                  setState(() => _openCourseId = null);
                                }
                              },
                              title: Text(c.title,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold)),
                              subtitle: Text(
                                  '${c.studentCount} peserta · ${c.pendingCount} menunggu dinilai'),
                              children: [
                                if (open && _treeLoading)
                                  const Padding(
                                    padding: EdgeInsets.all(16),
                                    child: CircularProgressIndicator(),
                                  )
                                else
                                  for (final m in _tree)
                                    ExpansionTile(
                                      title: Text(m.title),
                                      children: [
                                        for (final s in m.subModules)
                                          for (final mat in s.materials)
                                            ListTile(
                                              dense: true,
                                              title: Text(
                                                  '${s.title} · ${mat.title}',
                                                  maxLines: 2,
                                                  overflow:
                                                      TextOverflow.ellipsis),
                                              subtitle: Text(mat.type),
                                            ),
                                      ],
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
