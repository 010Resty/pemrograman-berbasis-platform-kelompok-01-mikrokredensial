import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../shared_ui.dart';
import '../certificate/certificate_api.dart';
import 'payment_api.dart';

/// Bell notifikasi: pembayaran menunggu/ditolak + sertifikat terbit.
/// Cermin bell web — data murni dari server, tanpa cache lokal.
class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key, required this.api});

  final ApiClient api;

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<MyPayment> _pending = [];
  List<MyPayment> _rejected = [];
  List<MyCertificate> _certs = [];
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
      final pay = PaymentApi(widget.api);
      final pending = await pay.mineList(status: 'menunggu', limit: 5);
      final rejected = await pay.mineList(status: 'ditolak', limit: 5);
      final certs = await CertificateApi(widget.api).mine();
      if (!mounted) return;
      setState(() {
        _pending = pending.items;
        _rejected = rejected.items;
        _certs = certs.where((c) => c.status == 'issued').toList();
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
      appBar: AppBar(title: const Text('Notifikasi')),
      body: _loading
          ? StateViews.loading()
          : _error != null
              ? StateViews.error(_error!, _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _pending.isEmpty &&
                          _rejected.isEmpty &&
                          _certs.isEmpty
                      ? ListView(children: [
                          StateViews.empty('Belum ada informasi penting',
                              'Pembayaran dan sertifikat baru akan muncul di sini.')
                        ])
                      : ListView(
                          padding: const EdgeInsets.all(12),
                          children: [
                            for (final p in _pending)
                              Card(
                                child: ListTile(
                                  leading: const Icon(Icons.hourglass_top,
                                      color: Colors.amber),
                                  title: Text(
                                      'Menunggu verifikasi · ${p.invoice}'),
                                  subtitle: Text(
                                      '${p.courseTitle ?? 'Kursus'} · ${formatIDR(p.amountExpected)}'),
                                ),
                              ),
                            for (final p in _rejected)
                              Card(
                                child: ListTile(
                                  leading: const Icon(Icons.cancel_outlined,
                                      color: Colors.red),
                                  title: Text(
                                      'Pembayaran ditolak · ${p.invoice}'),
                                  subtitle: Text(p.rejectReason ??
                                      'Periksa halaman pembayaran kursus.'),
                                ),
                              ),
                            for (final c in _certs)
                              Card(
                                child: ListTile(
                                  leading: const Icon(Icons.verified,
                                      color: Colors.green),
                                  title: Text(
                                      'Sertifikat terbit · ${c.courseTitle}'),
                                  subtitle:
                                      Text('${c.code} · ${c.issuedAt}'),
                                ),
                              ),
                          ],
                        ),
                ),
    );
  }
}
