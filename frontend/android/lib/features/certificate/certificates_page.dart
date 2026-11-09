import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api_client.dart';
import '../../shared_ui.dart';
import 'certificate_api.dart';

/// Sertifikat saya + unduh PDF + verifikasi publik.
class CertificatesPage extends StatefulWidget {
  const CertificatesPage({super.key, required this.api});

  final ApiClient api;

  @override
  State<CertificatesPage> createState() => _CertificatesPageState();
}

class _CertificatesPageState extends State<CertificatesPage> {
  List<MyCertificate> _items = [];
  bool _loading = true;
  String? _error;
  final _code = TextEditingController();
  VerifyResult? _verifyResult;
  String? _verifyError;
  bool _verifying = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await CertificateApi(widget.api).mine();
      if (!mounted) return;
      setState(() => _items = rows);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _download(MyCertificate c) async {
    try {
      final bytes =
          await CertificateApi(widget.api).downloadPdf(c.id);
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/sertifikat-${c.code}.pdf');
      await file.writeAsBytes(bytes, flush: true);
      await SharePlus.instance.share(ShareParams(
        files: [XFile(file.path)],
        text: 'Sertifikat ${c.code}',
      ));
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _verify() async {
    if (_code.text.trim().isEmpty) return;
    setState(() {
      _verifying = true;
      _verifyResult = null;
      _verifyError = null;
    });
    try {
      final res =
          await CertificateApi(widget.api).verify(_code.text.trim());
      if (!mounted) return;
      setState(() => _verifyResult = res);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _verifyError = e.message);
    } finally {
      if (mounted) setState(() => _verifying = false);
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
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const Text('Verifikasi publik',
                                  style:
                                      TextStyle(fontWeight: FontWeight.bold)),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Expanded(
                                    child: TextField(
                                      controller: _code,
                                      textCapitalization:
                                          TextCapitalization.characters,
                                      decoration: const InputDecoration(
                                        labelText: 'Kode sertifikat',
                                        border: OutlineInputBorder(),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  FilledButton(
                                      onPressed:
                                          _verifying ? null : _verify,
                                      child: const Text('Cek')),
                                ],
                              ),
                              if (_verifyError != null)
                                Padding(
                                  padding:
                                      const EdgeInsets.only(top: 8),
                                  child: Text(_verifyError!,
                                      style: const TextStyle(
                                          color: Colors.red)),
                                ),
                              if (_verifyResult != null)
                                Padding(
                                  padding:
                                      const EdgeInsets.only(top: 8),
                                  child: Text(
                                      '${_verifyResult!.recipientName} · ${_verifyResult!.courseTitle}${_verifyResult!.moduleTitle != null ? ' · ${_verifyResult!.moduleTitle}' : ''} — ${_verifyResult!.status}'),
                                ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      if (_items.isEmpty)
                        StateViews.empty('Belum ada sertifikat',
                            'Sertifikat terbit otomatis setelah seluruh syarat modul terpenuhi.')
                      else
                        for (final c in _items)
                          Card(
                            child: ListTile(
                              leading: const Icon(Icons.verified,
                                  color: Colors.green),
                              title: Text(c.moduleTitle ??
                                  c.courseTitle),
                              subtitle: Text(
                                  '${c.code} · ${formatDateTime(c.issuedAt)} · ${c.status}'),
                              trailing: IconButton(
                                tooltip: 'Unduh PDF',
                                icon: const Icon(Icons.download),
                                onPressed: () => _download(c),
                              ),
                            ),
                          ),
                    ],
                  ),
                ),
    );
  }
}
