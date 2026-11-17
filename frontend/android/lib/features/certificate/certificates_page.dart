import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api_client.dart';
import '../../core/offline_cache.dart';
import '../../shared_ui.dart';
import '../../theme/app_tokens.dart';
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
  bool _offline = false;
  final _code = TextEditingController();
  VerifyResult? _verifyResult;
  String? _verifyError;
  bool _verifying = false;

  final _cache = OfflineCache();
  static const _cacheKey = 'cert_list';

  static Map<String, Object?> _toJson(MyCertificate c) => {
        'id': c.id,
        'code': c.code,
        'courseTitle': c.courseTitle,
        'moduleTitle': c.moduleTitle,
        'status': c.status,
        'issuedAt': c.issuedAt,
      };

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
      // mine() menelan ApiException -> [] saat offline: fallback ke cache.
      if (rows.isEmpty) {
        final cached = await _cache.readJson(
            _cacheKey, OfflineCache.certificatesTtl);
        final data = cached?.data;
        if (!mounted) return;
        if (data is List && data.isNotEmpty) {
          setState(() {
            _items = data.map(MyCertificate.fromJson).toList();
            _offline = true;
          });
          return;
        }
      }
      await _cache.saveJson(
          _cacheKey, rows.map(_toJson).toList());
      if (!mounted) return;
      setState(() {
        _items = rows;
        _offline = false;
      });
    } on ApiException catch (e) {
      final cached = await _cache.readJson(
          _cacheKey, OfflineCache.certificatesTtl);
      if (!mounted) return;
      final data = cached?.data;
      if (data is List && data.isNotEmpty) {
        setState(() {
          _items = data.map(MyCertificate.fromJson).toList();
          _offline = true;
        });
      } else {
        setState(() => _error = e.message);
      }
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
                    padding: EdgeInsets.fromLTRB(
                      AppSpacing.md,
                      AppSpacing.md,
                      AppSpacing.md,
                      AppSpacing.md +
                          MediaQuery.of(context).padding.bottom +
                          AppSpacing.sm,
                    ),
                    children: [
                      if (_offline)
                        const OfflineChip(
                            label:
                                'Mode offline — menampilkan sertifikat tersimpan.'),
                      Card(
                        margin: EdgeInsets.zero,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(AppRadius.lg),
                          side: BorderSide(color: AppColors.border),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(AppSpacing.lg),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const Text('Verifikasi publik',
                                  style: AppText.section),
                              const SizedBox(height: AppSpacing.sm),
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
                                  const SizedBox(width: AppSpacing.sm),
                                  FilledButton(
                                      style: FilledButton.styleFrom(
                                        minimumSize:
                                            const Size(64, 48),
                                      ),
                                      onPressed:
                                          _verifying ? null : _verify,
                                      child: const Text('Cek')),
                                ],
                              ),
                              if (_verifyError != null)
                                Padding(
                                  padding: const EdgeInsets.only(
                                      top: AppSpacing.sm),
                                  child: Text(_verifyError!,
                                      style: const TextStyle(
                                          fontSize: 12,
                                          color: AppColors.rose)),
                                ),
                              if (_verifyResult != null)
                                Padding(
                                  padding: const EdgeInsets.only(
                                      top: AppSpacing.sm),
                                  child: Text(
                                      '${_verifyResult!.recipientName} · ${_verifyResult!.courseTitle}${_verifyResult!.moduleTitle != null ? ' · ${_verifyResult!.moduleTitle}' : ''} — ${_verifyResult!.status}',
                                      style: AppText.caption),
                                ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      if (_items.isEmpty)
                        StateViews.empty('Belum ada sertifikat',
                            'Sertifikat terbit otomatis setelah seluruh syarat modul terpenuhi.')
                      else
                        for (final c in _items)
                          Padding(
                            padding: const EdgeInsets.only(
                                bottom: AppSpacing.sm),
                            child: Card(
                              margin: EdgeInsets.zero,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(
                                    AppRadius.lg),
                                side: BorderSide(
                                    color: AppColors.border),
                              ),
                              child: ListTile(
                                leading: const Icon(Icons.verified,
                                    color: AppColors.success),
                                title: Text(c.moduleTitle ??
                                    c.courseTitle),
                                subtitle: Text(
                                    '${c.code} · ${formatDateTime(c.issuedAt)} · ${c.status}',
                                    style: AppText.small),
                                trailing: IconButton(
                                  tooltip: 'Unduh PDF',
                                  icon: const Icon(Icons.download),
                                  onPressed: () => _download(c),
                                ),
                              ),
                            ),
                          ),
                    ],
                  ),
                ),
    );
  }
}
