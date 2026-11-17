import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/offline_cache.dart';
import '../../shared_ui.dart';
import '../../theme/app_tokens.dart';
import 'payment_api.dart';
import 'payment_page.dart';

/// Riwayat pembayaran peserta: filter status + ketuk untuk lanjut.
/// Titik kembali bila aplikasi ditutup saat menunggu konfirmasi DOKU —
/// detail [PaymentPage] otomatis melanjutkan tahap dari server.
class PaymentHistoryPage extends StatefulWidget {
  const PaymentHistoryPage({super.key, required this.api});

  final ApiClient api;

  @override
  State<PaymentHistoryPage> createState() => _PaymentHistoryPageState();
}

class _PaymentHistoryPageState extends State<PaymentHistoryPage> {
  String _filter = 'semua';
  List<MyPayment> _items = [];
  bool _loading = true;
  String? _error;
  bool _offline = false;

  final _cache = OfflineCache();
  static const _cacheKey = 'payment_history';

  static const _filters = [
    ('semua', 'Semua'),
    ('menunggu', 'Menunggu'),
    ('diverifikasi', 'Diverifikasi'),
    ('ditolak', 'Ditolak'),
  ];

  static Map<String, Object?> _toJson(MyPayment p) => {
        'id': p.id,
        'invoice': p.invoice,
        'courseId': p.courseId,
        'courseTitle': p.courseTitle,
        'status': p.status,
        'amountExpected': p.amountExpected,
        'amountPaid': p.amountPaid,
        'proofFileId': p.proofFileId,
        'rejectReason': p.rejectReason,
        'createdAt': p.createdAt,
        'verifiedAt': p.verifiedAt,
        'voucherCode': p.voucherCode,
        'promoSlug': p.promoSlug,
        'gateway': p.gateway,
        'dokuExpiresAt': p.dokuExpiresAt,
      };

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
      final res = await PaymentApi(widget.api).mineList(
        status: _filter == 'semua' ? null : _filter,
        limit: 50,
      );
      // mineList menelan ApiException -> items kosong saat offline.
      if (res.items.isEmpty) {
        final cached = await _cache.readJson(
            _cacheKey, OfflineCache.paymentsTtl);
        final data = cached?.data;
        if (!mounted) return;
        if (data is List && data.isNotEmpty) {
          setState(() {
            _items = data.map(MyPayment.fromJson).toList();
            _offline = true;
          });
          return;
        }
      }
      await _cache.saveJson(
          _cacheKey, res.items.map(_toJson).toList());
      if (!mounted) return;
      setState(() {
        _items = res.items;
        _offline = false;
      });
    } on ApiException catch (e) {
      final cached = await _cache.readJson(
          _cacheKey, OfflineCache.paymentsTtl);
      if (!mounted) return;
      final data = cached?.data;
      if (data is List && data.isNotEmpty) {
        setState(() {
          _items = data.map(MyPayment.fromJson).toList();
          _offline = true;
        });
      } else {
        setState(() => _error = e.message);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _confirmCancel(MyPayment p) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Batalkan pengajuan?'),
        content: Text(
            'Pengajuan ${p.invoice} (${formatIDR(p.amountExpected)}) akan dihapus permanen. Anda bisa membuat QR baru kapan pun.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Tidak')),
          FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Ya, batalkan')),
        ],
      ),
    );
    if (yes != true || !mounted) return;
    try {
      await PaymentApi(widget.api).cancel(p.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Pengajuan dibatalkan.')));
      _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Color _chipColor(String s) {
    switch (s) {
      case 'diverifikasi':
        return Colors.green.shade700;
      case 'ditolak':
        return Colors.red.shade700;
      default:
        return Colors.amber.shade800;
    }
  }

  String _label(String s) {
    switch (s) {
      case 'diverifikasi':
        return 'Diverifikasi';
      case 'ditolak':
        return 'Ditolak';
      default:
        return 'Menunggu';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Riwayat Pembayaran')),
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(AppSpacing.md,
                AppSpacing.md, AppSpacing.md, AppSpacing.xs),
            child: Row(
              children: [
                for (final f in _filters)
                  Padding(
                    padding:
                        const EdgeInsets.only(right: AppSpacing.sm),
                    child: ChoiceChip(
                      label: Text(f.$2, style: AppText.small),
                      selected: _filter == f.$1,
                      padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.md,
                          vertical: AppSpacing.md),
                      materialTapTargetSize:
                          MaterialTapTargetSize.padded,
                      onSelected: (_) {
                        if (_filter == f.$1) return;
                        setState(() => _filter = f.$1);
                        _load();
                      },
                    ),
                  ),
              ],
            ),
          ),
          if (_offline)
            const Padding(
              padding: EdgeInsets.fromLTRB(AppSpacing.md,
                  AppSpacing.sm, AppSpacing.md, 0),
              child: OfflineChip(
                  label:
                      'Mode offline — menampilkan riwayat tersimpan.'),
            ),
          Expanded(
            child: _loading
                ? StateViews.loading()
                : _error != null
                    ? StateViews.error(_error!, _load)
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: _items.isEmpty
                            ? ListView(children: [
                                StateViews.empty('Belum ada pembayaran',
                                    'Pengajuan QRIS untuk kursus berbayar akan tercatat di sini.')
                              ])
                            : ListView.builder(
                                padding: EdgeInsets.fromLTRB(
                                  AppSpacing.md,
                                  AppSpacing.md,
                                  AppSpacing.md,
                                  AppSpacing.md +
                                      MediaQuery.of(context)
                                          .padding
                                          .bottom +
                                      AppSpacing.sm,
                                ),
                                itemCount: _items.length,
                                itemBuilder: (ctx, i) {
                                  final p = _items[i];
                                  return Padding(
                                    padding: const EdgeInsets.only(
                                        bottom: AppSpacing.sm),
                                    child: Card(
                                      margin: EdgeInsets.zero,
                                      elevation: 0,
                                      shape: RoundedRectangleBorder(
                                        borderRadius:
                                            BorderRadius.circular(
                                                AppRadius.lg),
                                        side: BorderSide(
                                            color: AppColors.border),
                                      ),
                                      child: ListTile(
                                        leading: const Icon(
                                            Icons.receipt_long),
                                        title: Text(
                                          p.courseTitle ??
                                              'Kursus #${p.courseId}',
                                          style: const TextStyle(
                                              fontWeight: FontWeight.bold),
                                        ),
                                        subtitle: Text(
                                            '${p.invoice} · ${formatIDR(p.amountExpected)}',
                                            style: AppText.small),
                                        trailing: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      horizontal:
                                                          AppSpacing.md,
                                                      vertical:
                                                          AppSpacing.xs),
                                              decoration: BoxDecoration(
                                                color: Colors.white,
                                                border: Border.all(
                                                    color: _chipColor(
                                                        p.status)),
                                                borderRadius:
                                                    BorderRadius.circular(
                                                        AppRadius.pill),
                                              ),
                                              child: Text(_label(p.status),
                                                  style: TextStyle(
                                                      fontSize: 12,
                                                      fontWeight:
                                                          FontWeight.bold,
                                                      color: _chipColor(
                                                          p.status))),
                                            ),
                                            if (p.isPending)
                                              IconButton(
                                                tooltip:
                                                    'Batalkan pengajuan',
                                                icon: const Icon(
                                                    Icons.delete_outline,
                                                    color: Colors.red),
                                                onPressed: () =>
                                                    _confirmCancel(p),
                                              ),
                                          ],
                                        ),
                                        onTap: () => Navigator.of(context)
                                            .push(
                                          MaterialPageRoute(
                                            builder: (_) => PaymentPage(
                                                api: widget.api,
                                                courseId: p.courseId),
                                          ),
                                        )
                                            .then((_) {
                                          if (mounted) _load();
                                        }),
                                      ),
                                    ),
                                  );
                                },
                              ),
                      ),
          ),
        ],
      ),
    );
  }
}
