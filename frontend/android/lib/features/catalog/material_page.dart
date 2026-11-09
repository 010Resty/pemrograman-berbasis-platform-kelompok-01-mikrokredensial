import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../shared_ui.dart';
import '../learning/progress_api.dart';
import '../learning/quiz_api.dart';
import '../learning/submission_api.dart';
import '../learning/tiptap_text.dart';
import 'catalog_api.dart';

/// Satu materi: teks / kuis / tugas.
/// Kuis: nilai server, terbaik + riwayat, tanpa pembahasan (K-02).
/// Tugas: kumpul PDF, revisi tanpa batas, status kelulusan server (K-06).
/// Materi biasa selesai via tombol Berikutnya (K-04).
class MaterialDetailPage extends StatefulWidget {
  const MaterialDetailPage({
    super.key,
    required this.api,
    required this.courseId,
    required this.moduleId,
    required this.material,
    required this.isDone,
  });

  final ApiClient api;
  final int courseId;
  final String moduleId;
  final TreeMaterial material;
  final bool isDone;

  @override
  State<MaterialDetailPage> createState() => _MaterialDetailPageState();
}

class _MaterialDetailPageState extends State<MaterialDetailPage> {
  MaterialDetail? _detail;
  bool _loading = true;
  String? _error;
  bool _done;

  _MaterialDetailPageState() : _done = false;

  int? get _numericId => int.tryParse(widget.material.id);

  @override
  void initState() {
    super.initState();
    _done = widget.isDone;
    _load();
  }

  Future<void> _load() async {
    final mid = _numericId;
    if (mid == null) {
      setState(() {
        _loading = false;
        _error = 'Materi pratinjau tidak memiliki konten server.';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final detail =
          await CatalogApi(widget.api).detail(widget.courseId).then((_) =>
              CatalogApi(widget.api).material(mid));
      if (!mounted) return;
      setState(() => _detail = detail);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markDone() async {
    final mid = _numericId;
    if (mid == null || _done) return;
    setState(() => _done = true);
    try {
      await ProgressApi(widget.api).markDone(mid);
    } on ApiException {
      if (mounted) setState(() => _done = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.material.title)),
      body: _loading
          ? StateViews.loading()
          : _error != null
              ? StateViews.error(_error!, _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (widget.material.type == 'kuis')
                        _QuizBody(
                          api: widget.api,
                          materialId: _numericId!,
                          passScore: _detail?.passScore ?? 70,
                          onPass: _markDone,
                        )
                      else if (widget.material.type == 'tugas')
                        _TaskBody(
                          api: widget.api,
                          materialId: _numericId!,
                          brief: tiptapToText(_detail?.content),
                          onSubmitted: _markDone,
                        )
                      else ...[
                        if (tiptapToText(_detail?.content).isNotEmpty)
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Text(
                                tiptapToText(_detail?.content),
                                style: const TextStyle(height: 1.6),
                              ),
                            ),
                          )
                        else
                          const Card(
                            child: Padding(
                              padding: EdgeInsets.all(16),
                              child: Text('Konten materi belum tersedia.'),
                            ),
                          ),
                        const SizedBox(height: 16),
                        FilledButton.icon(
                          onPressed: _done ? null : _markDone,
                          icon: Icon(
                              _done ? Icons.check_circle : Icons.arrow_forward),
                          label: Text(_done
                              ? 'Selesai — lanjut ke materi berikut'
                              : 'Berikutnya (tandai selesai)'),
                        ),
                      ],
                    ],
                  ),
                ),
    );
  }
}

class _QuizBody extends StatefulWidget {
  const _QuizBody({
    required this.api,
    required this.materialId,
    required this.passScore,
    required this.onPass,
  });

  final ApiClient api;
  final int materialId;
  final int passScore;
  final VoidCallback onPass;

  @override
  State<_QuizBody> createState() => _QuizBodyState();
}

class _QuizBodyState extends State<_QuizBody> {
  List<QuizQuestion> _questions = [];
  QuizBest? _best;
  List<QuizAttemptRow> _history = [];
  List<int?> _answers = [];
  bool _loading = true;
  String? _error;
  bool _sending = false;
  QuizAttemptResult? _last;
  String? _submitError;

  int get _effectivePass => _best?.effectivePassScore ?? widget.passScore;

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
      final api = QuizApi(widget.api);
      final qs = await api.questions(widget.materialId);
      final best = await api.best(widget.materialId);
      final history = await api.history(widget.materialId);
      if (!mounted) return;
      setState(() {
        _questions = qs;
        _best = best;
        _history = history.take(5).toList();
        _answers = List<int?>.filled(qs.length, null);
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool get _complete =>
      _questions.isNotEmpty && !_answers.contains(null);

  Future<void> _submit() async {
    if (!_complete || _sending) return;
    setState(() {
      _sending = true;
      _submitError = null;
    });
    try {
      final payload = <Map<String, Object?>>[];
      for (var qi = 0; qi < _questions.length; qi++) {
        final picked = _answers[qi];
        payload.add({
          'questionId': _questions[qi].id,
          'optionId': picked == null
              ? null
              : _questions[qi].options[picked].id,
        });
      }
      final res =
          await QuizApi(widget.api).submit(widget.materialId, payload);
      if (!mounted) return;
      setState(() {
        _last = res;
        _answers = List<int?>.filled(_questions.length, null);
      });
      await _refreshBest();
      if (res.passed) widget.onPass();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _submitError = e.message);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _refreshBest() async {
    final api = QuizApi(widget.api);
    final best = await api.best(widget.materialId);
    final history = await api.history(widget.materialId);
    if (!mounted) return;
    setState(() {
      _best = best;
      _history = history.take(5).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return StateViews.loading('Memuat soal dari server…');
    if (_error != null) return StateViews.error(_error!, _load);
    if (_questions.isEmpty) {
      return const Card(
          child: Padding(
              padding: EdgeInsets.all(16),
              child: Text('Kuis ini belum memiliki soal.')));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Card(
          color: Theme.of(context).colorScheme.secondaryContainer,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Text(
              'Nilai minimal $_effectivePass untuk lolos'
              '${_best != null && _best!.attempts > 0 ? ' · Terbaik ${_best!.bestScore ?? 0} dari ${_best!.attempts} percobaan${_best!.passed ? ' · Lulus' : ''}' : ''}',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
        ),
        const SizedBox(height: 12),
        for (var qi = 0; qi < _questions.length; qi++) ...[
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${qi + 1}. ${_questions[qi].text}',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  RadioGroup<int>(
                    groupValue: _answers[qi],
                    onChanged: (int? v) {
                        if (_sending) return;
                        setState(() => _answers[qi] = v);
                      },
                    child: Column(
                      children: [
                        for (var oi = 0;
                            oi < _questions[qi].options.length;
                            oi++)
                          InkWell(
                            onTap: _sending
                                ? null
                                : () =>
                                    setState(() => _answers[qi] = oi),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                  vertical: 6),
                              child: Row(
                                children: [
                                  Radio<int>(value: oi),
                                  Expanded(
                                    child: Text(_questions[qi]
                                        .options[oi]
                                        .text),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
        ],
        if (_submitError != null) ...[
          AuthErrorInline(message: _submitError!),
          const SizedBox(height: 8),
        ],
        FilledButton.icon(
          onPressed: (!_complete || _sending) ? null : _submit,
          icon: _sending
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.send),
          label: Text(
              'Kirim jawaban (${_answers.where((a) => a != null).length}/${_questions.length})'),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 8),
          child: Text(
            'Dapat diulang tanpa batas — nilai terbaik yang dipakai. Hasil hanya berupa nilai.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11),
          ),
        ),
        if (_last != null)
          Card(
            color: _last!.passed
                ? Colors.green.shade50
                : Colors.amber.shade50,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Text(_last!.passed ? 'Lulus!' : 'Belum lulus',
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold)),
                  Text('Nilai: ${_last!.score}',
                      style: const TextStyle(
                          fontSize: 40, fontWeight: FontWeight.w900)),
                ],
              ),
            ),
          ),
        if (_history.isNotEmpty) ...[
          const SizedBox(height: 8),
          const Text('Riwayat percobaan',
              style: TextStyle(fontWeight: FontWeight.bold)),
          for (var i = 0; i < _history.length; i++)
            ListTile(
              dense: true,
              title: Text('Upaya ke-${_history.length - i}'),
              trailing: Chip(
                label: Text(
                    '${_history[i].score} · ${_history[i].passed ? 'Lulus' : 'Belum'}'),
              ),
            ),
        ],
      ],
    );
  }
}

class AuthErrorInline extends StatelessWidget {
  const AuthErrorInline({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(message),
    );
  }
}

class _TaskBody extends StatefulWidget {
  const _TaskBody({
    required this.api,
    required this.materialId,
    required this.brief,
    required this.onSubmitted,
  });

  final ApiClient api;
  final int materialId;
  final String brief;
  final VoidCallback onSubmitted;

  @override
  State<_TaskBody> createState() => _TaskBodyState();
}

class _TaskBodyState extends State<_TaskBody> {
  TaskStatus? _status;
  List<TaskSubmission> _history = [];
  bool _busy = false;
  String? _error;
  final _noteCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  @override
  void dispose() {
    _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    final api = SubmissionApi(widget.api);
    final st = await api.status(widget.materialId);
    final hist = await api.history(widget.materialId);
    if (!mounted) return;
    setState(() {
      _status = st;
      _history = hist;
    });
  }

  Future<void> _pickAndUpload() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final files = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf'],
      );
      if (files.isEmpty) {
        setState(() => _busy = false);
        return;
      }
      final file = files.first;
      final bytes = await file.readAsBytes();
      if (bytes.lengthInBytes > 10 * 1024 * 1024) {
        throw const FormatException('Ukuran PDF melebihi 10 MB.');
      }
      final sub = SubmissionApi(widget.api);
      final up = await sub.upload(
        filename: file.name,
        mimeType: 'application/pdf',
        kind: 'assignment',
        bytes: bytes,
      );
      await sub.submit(
        materialId: widget.materialId,
        fileId: up.id,
        note: _noteCtrl.text.trim().isEmpty ? null : _noteCtrl.text.trim(),
      );
      await _refresh();
      widget.onSubmitted();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Tugas terkumpul. Menunggu nilai instruktur.')),
        );
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } on FormatException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final st = _status;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.brief.isNotEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(widget.brief,
                  style: const TextStyle(height: 1.6)),
            ),
          ),
        if (st != null && st.attempts > 0)
          Card(
            color: st.passed ? Colors.green.shade50 : Colors.amber.shade50,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Text(
                st.passed
                    ? 'Lulus — nilai terbaik ${st.bestScore ?? '-'} dari ${st.attempts} kiriman.'
                    : 'Menunggu penilaian — ${st.attempts} kiriman${st.graded > 0 ? ' · ${st.graded} dinilai' : ''}.',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          ),
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 4),
          child: Text('Terkumpul ≠ lulus — kelulusan dan nilai dibaca dari server.'),
        ),
        if (_error != null) ...[
          AuthErrorInline(message: _error!),
          const SizedBox(height: 8),
        ],
        TextField(
          controller: _noteCtrl,
          maxLines: 2,
          maxLength: 500,
          decoration: const InputDecoration(
            labelText: 'Catatan untuk instruktur (opsional)',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 8),
        FilledButton.icon(
          onPressed: _busy ? null : _pickAndUpload,
          icon: _busy
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.upload_file),
          label: Text(_history.isEmpty ? 'Pilih PDF & kumpulkan' : 'Kumpulkan revisi (PDF baru)'),
        ),
        if (_history.isNotEmpty) ...[
          const SizedBox(height: 12),
          const Text('Riwayat kiriman',
              style: TextStyle(fontWeight: FontWeight.bold)),
          for (final h in _history)
            ListTile(
              dense: true,
              leading: const Icon(Icons.picture_as_pdf, color: Colors.red),
              title: Text(h.originalName ?? 'tugas.pdf',
                  overflow: TextOverflow.ellipsis),
              subtitle: Text(
                  '${h.status}${h.score != null ? ' · nilai ${h.score}' : ''}'),
            ),
        ],
      ],
    );
  }
}
