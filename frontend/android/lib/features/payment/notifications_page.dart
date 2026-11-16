import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/notification_center.dart';
import '../../shared_ui.dart';
import '../certificate/certificate_api.dart';
import 'payment_api.dart';

/// Bell notifikasi: pembayaran menunggu/ditolak + sertifikat terbit.
///
/// Tanpa FCM (tanpa dep native baru): halaman memeriksa otomatis tiap
/// 60 detik + pull-to-refresh. Entri yang belum pernah dilihat
/// ditandai lencana BARU via [NotificationCenter] (rekam di secure
/// storage, bukan angka statis). Cermin bell web — data murni server.
class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key, required this.api});

  final ApiClient api;

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  static const _pollInterval = Duration(seconds: 60);

  List<MyPayment> _pending = [];
  List<MyPayment> _rejected = [];
  List<MyCertificate> _certs = [];
  Set<String> _freshIds = {};
  DateTime? _checkedAt;
  bool _loading = true;
  String? _error;
  Timer? _pollTimer;

  late final NotificationCenter _center;

  @override
  void initState() {
    super.initState();
    _center = NotificationCenter(widget.api);
    _load();
    // Polling lokal selagi halaman hidup (pengganti push FCM).
    _pollTimer = Timer.periodic(_pollInterval, (_) {
      if (mounted) _load(silent: true);
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  String _paySubtitle(MyPayment p) =>
      '${p.courseTitle ?? 'Kursus'} · ${formatIDR(p.amountExpected)}';

  String _certSubtitle(MyCertificate c) =>
      '${c.courseTitle} · ${c.issuedAt}';

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final pay = PaymentApi(widget.api);
      final certApi = CertificateApi(widget.api);

      List<MyPayment> pending = [];
      List<MyPayment> rejected = [];
      List<MyCertificate> certs = [];
      final check = await _center.check(
        fetchPending: () async {
          pending = (await pay.mineList(status: 'menunggu', limit: 5)).items;
          return [
            for (final p in pending)
              {'invoice': p.invoice, 'subtitle': _paySubtitle(p)}
          ];
        },
        fetchRejected: () async {
          rejected = (await pay.mineList(status: 'ditolak', limit: 5)).items;
          return [
            for (final p in rejected)
              {'invoice': p.invoice, 'subtitle': p.rejectReason ?? ''}
          ];
        },
        fetchCerts: () async {
          certs = (await certApi
                  .mine())
              .where((c) => c.status == 'issued')
              .toList();
          return [
            for (final c in certs)
              {'code': c.code, 'subtitle': _certSubtitle(c)}
          ];
        },
      );

      // Tandai dasar yang sekarang sebagai dilihat untuk kunjungan berikut,
      // tapi tampilkan lencana BARU untuk temuan pemeriksaan ini.
      await _center.markAllSeen(
        pendingIds: pending.map((p) => p.invoice).toList(),
        rejectedIds: rejected.map((p) => p.invoice).toList(),
        certCodes: certs.map((c) => c.code).toList(),
      );
      if (!mounted) return;
      setState(() {
        _pending = pending;
        _rejected = rejected;
        _certs = certs;
        _freshIds = {
          for (final f in check.fresh)
            if (f.kind == 'certificate')
              f.title.replaceFirst('Sertifikat terbit · ', '')
            else
              f.title.split('·').last.trim(),
        };
        _checkedAt = check.checkedAt;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      // Polling senyap gagal: jangan hapus daftar yang sudah ada.
      if (silent) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted && !silent) setState(() => _loading = false);
    }
  }

  bool _isFresh(String id) => _freshIds.contains(id);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifikasi'),
        bottom: _checkedAt == null
            ? null
            : PreferredSize(
                preferredSize: const Size.fromHeight(20),
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(
                    'Diperiksa ${formatDateTime(_checkedAt!.toIso8601String())} · otomatis tiap 60 dtk',
                    style: const TextStyle(fontSize: 11),
                  ),
                ),
              ),
      ),
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
                                  trailing: _isFresh(p.invoice)
                                      ? _baruBadge()
                                      : null,
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
                                  trailing: _isFresh(p.invoice)
                                      ? _baruBadge()
                                      : null,
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
                                  trailing: _isFresh(c.code)
                                      ? _baruBadge()
                                      : null,
                                ),
                              ),
                          ],
                        ),
                ),
    );
  }

  Widget _baruBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(999),
      ),
      child: const Text('BARU',
          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
    );
  }
}
