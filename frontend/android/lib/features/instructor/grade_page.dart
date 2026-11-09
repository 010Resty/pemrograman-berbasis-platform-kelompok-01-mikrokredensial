import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../shared_ui.dart';
import 'instructor_api.dart';

/// Nilai satu pengumpulan: rubrik seragam 3 kriteria (bobot sama),
/// keputusan, dan umpan balik. Rata-rata dihitung server.
class GradePage extends StatefulWidget {
  const GradePage({
    super.key,
    required this.api,
    required this.courseId,
    required this.courseTitle,
    required this.materialId,
    required this.taskTitle,
  });

  final ApiClient api;
  final int courseId;
  final String courseTitle;
  final int materialId;
  final String taskTitle;

  @override
  State<GradePage> createState() => _GradePageState();
}

class _GradePageState extends State<GradePage> {
  List<MaterialSubmission> _rows = [];
  bool _loading = true;
  String? _error;

  final Map<int, _GradeForm> _forms = {};

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
      final rows = await InstructorApi(widget.api)
          .submissions(widget.materialId);
      if (!mounted) return;
      setState(() => _rows = rows);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  _GradeForm _formFor(MaterialSubmission r) {
    return _forms.putIfAbsent(
      r.id,
      () => _GradeForm(
        kelengkapan: (r.rubric?['kelengkapan'] ?? r.score ?? 0).toDouble(),
        ketepatan: (r.rubric?['ketepatan'] ?? r.score ?? 0).toDouble(),
        kerapian: (r.rubric?['kerapian'] ?? r.score ?? 0).toDouble(),
        decision: 'passed',
        feedback: r.feedback ?? '',
      ),
    );
  }

  Future<void> _submit(MaterialSubmission r) async {
    final f = _formFor(r);
    try {
      await InstructorApi(widget.api).grade(
        materialId: widget.materialId,
        submissionId: r.id,
        score: ((f.kelengkapan + f.ketepatan + f.kerapian) / 3).round(),
        decision: f.decision,
        feedback: f.feedback.isEmpty ? null : f.feedback,
        rubric: {
          'kelengkapan': f.kelengkapan.round(),
          'ketepatan': f.ketepatan.round(),
          'kerapian': f.kerapian.round(),
        },
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Nilai tersimpan.')),
      );
      _forms.remove(r.id);
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.taskTitle)),
      body: _loading
          ? StateViews.loading()
          : _error != null
              ? StateViews.error(_error!, _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _rows.isEmpty
                      ? ListView(children: [
                          StateViews.empty('Belum ada pengumpulan',
                              'Peserta belum mengumpulkan tugas ini.')
                        ])
                      : ListView.builder(
                          padding: const EdgeInsets.all(12),
                          itemCount: _rows.length,
                          itemBuilder: (context, i) {
                            final r = _rows[i];
                            final f = _formFor(r);
                            return Card(
                              margin: const EdgeInsets.only(bottom: 12),
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                        r.studentName ??
                                            'Peserta #${r.id}',
                                        style: const TextStyle(
                                            fontWeight:
                                                FontWeight.bold)),
                                    Text(
                                        '${r.studentNim ?? '-'} · ${formatDateTime(r.submittedAt)} · ${r.status}'),
                                    if (r.score != null)
                                      Text('Nilai saat ini: ${r.score}',
                                          style: const TextStyle(
                                              fontWeight:
                                                  FontWeight.bold)),
                                    const SizedBox(height: 8),
                                    _RubricSlider(
                                      label: 'Kelengkapan',
                                      value: f.kelengkapan,
                                      onChanged: (v) => setState(
                                          () => f.kelengkapan = v),
                                    ),
                                    _RubricSlider(
                                      label: 'Ketepatan isi',
                                      value: f.ketepatan,
                                      onChanged: (v) => setState(
                                          () => f.ketepatan = v),
                                    ),
                                    _RubricSlider(
                                      label: 'Kerapian',
                                      value: f.kerapian,
                                      onChanged: (v) => setState(
                                          () => f.kerapian = v),
                                    ),
                                    DropdownButtonFormField<String>(
                                      initialValue: f.decision,
                                      decoration: const InputDecoration(
                                          labelText: 'Keputusan'),
                                      items: const [
                                        DropdownMenuItem(
                                            value: 'passed',
                                            child: Text('Lulus')),
                                        DropdownMenuItem(
                                            value: 'failed',
                                            child:
                                                Text('Tidak lulus')),
                                        DropdownMenuItem(
                                            value: 'revision_requested',
                                            child:
                                                Text('Minta revisi')),
                                      ],
                                      onChanged: (v) => setState(
                                          () => f.decision =
                                              v ?? 'passed'),
                                    ),
                                    const SizedBox(height: 8),
                                    TextField(
                                      controller: f.feedbackCtrl,
                                      maxLines: 2,
                                      decoration: const InputDecoration(
                                        labelText:
                                            'Umpan balik (opsional)',
                                        border: OutlineInputBorder(),
                                      ),
                                      onChanged: (v) => f.feedback = v,
                                    ),
                                    const SizedBox(height: 8),
                                    FilledButton(
                                      onPressed: () => _submit(r),
                                      child: const Text('Simpan nilai'),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                ),
    );
  }
}

class _GradeForm {
  _GradeForm({
    required this.kelengkapan,
    required this.ketepatan,
    required this.kerapian,
    required this.decision,
    required this.feedback,
  }) : feedbackCtrl = TextEditingController(text: feedback);

  double kelengkapan;
  double ketepatan;
  double kerapian;
  String decision;
  String feedback;
  final TextEditingController feedbackCtrl;
}

class _RubricSlider extends StatelessWidget {
  const _RubricSlider(
      {required this.label, required this.value, required this.onChanged});

  final String label;
  final double value;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SizedBox(
            width: 110,
            child: Text(label,
                style: const TextStyle(fontSize: 12))),
        Expanded(
          child: Slider(
              value: value, min: 0, max: 100, divisions: 20,
              label: value.round().toString(), onChanged: onChanged),
        ),
        SizedBox(
            width: 36,
            child: Text('${value.round()}',
                textAlign: TextAlign.right,
                style: const TextStyle(fontWeight: FontWeight.bold))),
      ],
    );
  }
}
