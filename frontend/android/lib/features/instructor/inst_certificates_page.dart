import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../shared_ui.dart';
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
      final api = InstructorApi(widget.api);
      final summary = await api.certSummary();
      final rows = await api.certificates();
      if (!mounted) return;
      setState(() {
        _summary = summary;
        _rows = rows;
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
      appBar: AppBar(title: const Text('Sertifikat')),
      body: _loading
          ? StateViews.loading()
          : _error != null
              ? StateViews.error(_error!, _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(12),
                    children: [
                      if (_summary != null)
                        Row(
                          children: [
                            Expanded(
                                child: _StatCard(
                                    label: 'Aktif',
                                    value:
                                        '${_summary!.issuedActiveCount}')),
                            const SizedBox(width: 8),
                            Expanded(
                                child: _StatCard(
                                    label: 'Memenuhi',
                                    value:
                                        '${_summary!.eligibleCount}')),
                            const SizedBox(width: 8),
                            Expanded(
                                child: _StatCard(
                                    label: 'Dicabut',
                                    value:
                                        '${_summary!.revokedCount}')),
                          ],
                        ),
                      const SizedBox(height: 8),
                      if (_rows.isEmpty)
                        StateViews.empty('Belum ada sertifikat',
                            'Sertifikat terbit otomatis setelah syarat modul terpenuhi.')
                      else
                        for (final r in _rows)
                          Card(
                            child: ListTile(
                              leading: Icon(
                                  r.status == 'revoked'
                                      ? Icons.cancel
                                      : Icons.verified,
                                  color: r.status == 'revoked'
                                      ? Colors.red
                                      : Colors.green),
                              title: Text(r.studentName),
                              subtitle: Text(
                                  '${r.courseTitle}${r.moduleTitle != null ? ' · ${r.moduleTitle}' : ''}\n${r.code} · ${r.status}'),
                              isThreeLine: true,
                              trailing:
                                  const Icon(Icons.arrow_forward_ios,
                                      size: 16),
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

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Text(value,
                style: const TextStyle(
                    fontSize: 22, fontWeight: FontWeight.bold)),
            Text(label, style: const TextStyle(fontSize: 12)),
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
                        padding: const EdgeInsets.all(16),
                        children: [
                          Text(c.studentName,
                              style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold)),
                          Text(c.courseTitle),
                          if (c.moduleTitle != null)
                            Text(c.moduleTitle!),
                          const SizedBox(height: 8),
                          Text('Kode: ${c.code}',
                              style:
                                  const TextStyle(fontFamily: 'monospace')),
                          Text('Status: ${c.status}'),
                          Text(
                              'Terbit: ${formatDateTime(c.issuedAt)}'),
                          if (c.revokeReason != null)
                            Text('Alasan cabut: ${c.revokeReason}'),
                          if (c.status == 'aktif' ||
                              c.status == 'issued') ...[
                            const SizedBox(height: 16),
                            TextField(
                              controller: _reason,
                              maxLines: 2,
                              decoration: const InputDecoration(
                                labelText:
                                    'Alasan pencabutan (wajib, min. 5 karakter)',
                                border: OutlineInputBorder(),
                              ),
                            ),
                            const SizedBox(height: 8),
                            FilledButton.icon(
                              style: FilledButton.styleFrom(
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
