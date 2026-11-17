import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api_client.dart';
import '../../core/file_url.dart';
import '../../shared_ui.dart';
import '../../theme/app_tokens.dart';
import '../learning/submission_api.dart';
import 'instructor_api.dart';

/// Sertifikat instruktur: ringkasan, riwayat, detail, cabut.
class InstCertificatesPage extends StatefulWidget {
  const InstCertificatesPage({super.key, required this.api});

  final ApiClient api;

  @override
  State<InstCertificatesPage> createState() => _InstCertificatesPageState();
}

class _InstCertificatesPageState extends State<InstCertificatesPage> {
  InstCertificateSummary? _summary;
  List<InstCertificateRecord> _rows = [];
  InstructorSignature? _sig;
  bool _loading = true;
  bool _sigBusy = false;
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
      final api = InstructorApi(widget.api);
      final results = await Future.wait([
        api.certSummary(),
        api.certificates(),
        api.mySignature(),
      ]);
      if (!mounted) return;
      setState(() {
        _summary = results[0] as InstCertificateSummary;
        _rows = results[1] as List<InstCertificateRecord>;
        _sig = results[2] as InstructorSignature?;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Unggah + pasang tanda tangan (dipakai blok tanda tangan PDF).
  Future<void> _uploadSignature() async {
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      maxWidth: 1200,
      imageQuality: 90,
    );
    if (picked == null) return;
    setState(() => _sigBusy = true);
    try {
      final bytes = await picked.readAsBytes();
      final mime = picked.mimeType ?? 'image/png';
      final up = await SubmissionApi(widget.api).upload(
        filename: picked.name,
        mimeType: mime,
        kind: 'signature',
        bytes: bytes,
      );
      final res =
          await InstructorApi(widget.api).setSignature(up.id);
      if (!mounted) return;
      setState(() => _sig =
          InstructorSignature(fileId: res.fileId, url: res.url));
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(res.clearedPdfs > 0
              ? 'Tanda tangan tersimpan. ${res.clearedPdfs} PDF lama ikut diperbarui.'
              : 'Tanda tangan tersimpan.')));
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _sigBusy = false);
    }
  }

  Future<void> _removeSignature() async {
    final ok = await confirmDialog(context,
        title: 'Lepas tanda tangan?',
        message:
            'PDF berikutnya kembali memakai nama diketik.',
        confirmText: 'Ya, lepas',
        danger: true);
    if (ok != true) return;
    setState(() => _sigBusy = true);
    try {
      await InstructorApi(widget.api).removeSignature();
      if (!mounted) return;
      setState(() => _sig = null);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Tanda tangan dilepas.')));
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _sigBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sertifikat')),
      body: _loading
          ? StateViews.loading()
          : _error != null
              ? StateViews.error(_error!, _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: EdgeInsets.fromLTRB(
                      AppSpacing.md,
                      AppSpacing.md,
                      AppSpacing.md,
                      AppSpacing.md +
                          MediaQuery.of(context).padding.bottom +
                          AppSpacing.sm,
                    ),
                    children: [
                      _SignatureCard(
                        sig: _sig,
                        busy: _sigBusy,
                        baseUrl: widget.api.baseUrl,
                        onUpload: _uploadSignature,
                        onRemove: _removeSignature,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      if (_summary != null)
                        Row(
                          children: [
                            Expanded(
                                child: _StatCard(
                                    label: 'Aktif',
                                    value:
                                        '${_summary!.issuedActiveCount}')),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                                child: _StatCard(
                                    label: 'Memenuhi',
                                    value:
                                        '${_summary!.eligibleCount}')),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                                child: _StatCard(
                                    label: 'Dicabut',
                                    value:
                                        '${_summary!.revokedCount}')),
                          ],
                        ),
                      const SizedBox(height: AppSpacing.sm),
                      if (_rows.isEmpty)
                        StateViews.empty('Belum ada sertifikat',
                            'Sertifikat terbit otomatis setelah syarat modul terpenuhi.')
                      else
                        for (final r in _rows)
                          Card(
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius:
                                  BorderRadius.circular(AppRadius.md),
                              side:
                                  BorderSide(color: AppColors.border),
                            ),
                            child: ListTile(
                              leading: Builder(builder: (context) {
                                final avatar = resolveAvatarUrl(
                                    r.studentAvatarUrl, widget.api.baseUrl);
                                if (avatar != null) {
                                  return CircleAvatar(
                                      // R5: decode secukupnya (avatar daftar).
                                      backgroundImage: ResizeImage(
                                          NetworkImage(avatar),
                                          width: 96,
                                          height: 96),
                                      onBackgroundImageError:
                                          (Object err, StackTrace? stack) {});
                                }
                                return Icon(
                                    r.status == 'revoked'
                                        ? Icons.cancel
                                        : Icons.verified,
                                    color: r.status == 'revoked'
                                        ? AppColors.rose
                                        : AppColors.success);
                              }),
                              title: Text(r.studentName),
                              subtitle: Text(
                                  '${r.courseTitle}${r.moduleTitle != null ? ' · ${r.moduleTitle}' : ''}\n${r.code} · ${r.status}',
                                  style: AppText.small),
                              isThreeLine: true,
                              trailing: const Icon(
                                  Icons.arrow_forward_ios,
                                  size: 16,
                                  color: AppColors.muted),
                              onTap: () async {
                                await Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) =>
                                        _InstCertDetailPage(
                                            api: widget.api,
                                            certId: r.id),
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

/// Kartu tanda tangan instruktur untuk blok tanda tangan PDF sertifikat.
class _SignatureCard extends StatelessWidget {
  const _SignatureCard({
    required this.sig,
    required this.busy,
    required this.baseUrl,
    required this.onUpload,
    required this.onRemove,
  });

  final InstructorSignature? sig;
  final bool busy;
  final String baseUrl;
  final Future<void> Function() onUpload;
  final Future<void> Function() onRemove;

  @override
  Widget build(BuildContext context) {
    final url = resolveAvatarUrl(sig?.url, baseUrl);
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        side: BorderSide(color: AppColors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Tanda tangan sertifikat',
                style:
                    TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: AppSpacing.xs),
            const Text(
                'Tercetak di PDF sertifikat kursus yang Anda tandatangani. Tanpa ini, PDF memakai nama diketik.',
                style: AppText.small),
            const SizedBox(height: AppSpacing.sm),
            Container(
              height: 72,
              width: double.infinity,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(AppRadius.sm),
                color: Colors.white,
              ),
              child: url != null
                  // R5: decode secukupnya (pratinjau kecil).
                  ? Image.network(url,
                      height: 64,
                      fit: BoxFit.contain,
                      cacheWidth: 256,
                      loadingBuilder: (context, child, progress) {
                        if (progress == null) return child;
                        return const SizedBox(
                          height: 64,
                          child: Center(
                            child: SizedBox.square(
                              dimension: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2),
                            ),
                          ),
                        );
                      },
                      errorBuilder: (context, err, stack) =>
                          const Text('Gagal memuat pratinjau',
                              style: AppText.small))
                  : const Text('Belum ada tanda tangan',
                      style: AppText.small),
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      shape: RoundedRectangleBorder(
                        borderRadius:
                            BorderRadius.circular(AppRadius.md),
                      ),
                    ),
                    onPressed: busy ? null : onUpload,
                    icon: const Icon(Icons.upload),
                    label: Text(busy
                        ? 'Mengunggah…'
                        : (sig?.fileId != null
                            ? 'Ganti tanda tangan'
                            : 'Pasang tanda tangan')),
                  ),
                ),
                if (sig?.fileId != null) ...[
                  const SizedBox(width: AppSpacing.sm),
                  IconButton(
                    tooltip: 'Lepas tanda tangan',
                    style: IconButton.styleFrom(
                      minimumSize: const Size(48, 48),
                    ),
                    onPressed: busy ? null : onRemove,
                    icon: const Icon(Icons.delete_outline,
                        color: AppColors.rose),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        side: BorderSide(color: AppColors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          children: [
            Text(value,
                style: const TextStyle(
                    fontSize: 22, fontWeight: FontWeight.bold)),
            Text(label, style: AppText.small),
          ],
        ),
      ),
    );
  }
}

class _InstCertDetailPage extends StatefulWidget {
  const _InstCertDetailPage({required this.api, required this.certId});

  final ApiClient api;
  final Object certId;

  @override
  State<_InstCertDetailPage> createState() => _InstCertDetailPageState();
}

class _InstCertDetailPageState extends State<_InstCertDetailPage> {
  InstCertificateRecord? _cert;
  bool _loading = true;
  String? _error;
  final _reason = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final c = await InstructorApi(widget.api)
          .certificateDetail(widget.certId);
      if (!mounted) return;
      setState(() => _cert = c);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _revoke() async {
    final reason = _reason.text.trim();
    if (reason.length < 5) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Alasan pencabutan minimal 5 karakter.')));
      return;
    }
    try {
      await InstructorApi(widget.api)
          .revokeCertificate(widget.certId, reason);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sertifikat dicabut.')));
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
      appBar: AppBar(title: const Text('Detail Sertifikat')),
      body: _loading
          ? StateViews.loading()
          : _error != null
              ? StateViews.error(_error!, _load)
              : _cert == null
                  ? StateViews.empty('Tidak ditemukan',
                      'Sertifikat tidak tersedia.')
                  : Builder(builder: (context) {
                      final c = _cert!;
                      return ListView(
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.lg,
                          AppSpacing.lg,
                          AppSpacing.lg,
                          AppSpacing.lg +
                              MediaQuery.of(context).padding.bottom +
                              AppSpacing.sm,
                        ),
                        children: [
                          Text(c.studentName,
                              style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold)),
                          Text(c.courseTitle, style: AppText.body),
                          if (c.moduleTitle != null)
                            Text(c.moduleTitle!, style: AppText.small),
                          const SizedBox(height: AppSpacing.sm),
                          Text('Kode: ${c.code}',
                              style:
                                  const TextStyle(fontFamily: 'monospace')),
                          Text('Status: ${c.status}'),
                          Text(
                              'Terbit: ${formatDateTime(c.issuedAt)}'),
                          if (c.revokeReason != null)
                            Text('Alasan cabut: ${c.revokeReason}',
                                style: AppText.small),
                          if (c.status == 'aktif' ||
                              c.status == 'issued') ...[
                            const SizedBox(height: AppSpacing.lg),
                            TextField(
                              controller: _reason,
                              maxLines: 2,
                              decoration: const InputDecoration(
                                labelText:
                                    'Alasan pencabutan (wajib, min. 5 karakter)',
                                border: OutlineInputBorder(),
                              ),
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            FilledButton.icon(
                              style: FilledButton.styleFrom(
                                  minimumSize:
                                      const Size.fromHeight(48),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(
                                        AppRadius.md),
                                  ),
                                  backgroundColor: Theme.of(context)
                                      .colorScheme
                                      .error),
                              onPressed: () async {
                                final ok = await confirmDialog(context,
                                    title: 'Cabut sertifikat?',
                                    message:
                                        'Pencabutan tercatat permanen di riwayat.',
                                    confirmText: 'Ya, cabut',
                                    danger: true);
                                if (ok == true) _revoke();
                              },
                              icon: const Icon(Icons.cancel),
                              label: const Text('Cabut sertifikat'),
                            ),
                          ],
                        ],
                      );
                    }),
    );
  }
}
