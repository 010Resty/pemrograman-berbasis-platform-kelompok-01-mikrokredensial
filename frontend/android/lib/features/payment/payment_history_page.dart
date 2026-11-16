import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../shared_ui.dart';
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

  static const _filters = [
    ('semua', 'Semua'),
    ('menunggu', 'Menunggu'),
    ('diverifikasi', 'Diverifikasi'),
    ('ditolak', 'Ditolak'),
  ];

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
      if (!mounted) return;
      setState(() => _items = res.items);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
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

  Color _chipBg(String s) {
    switch (s) {
      case 'diverifikasi':
        return Colors.green.shade100;
      case 'ditolak':
        return Colors.red.shade100;
      default:
        return Colors.amber.shade100;
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
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
            child: Row(
              children: [
                for (final f in _filters)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(f.$2),
                      selected: _filter == f.$1,
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
                                padding: const EdgeInsets.all(12),
                                itemCount: _items.length,
                                itemBuilder: (ctx, i) {
                                  final p = _items[i];
                                  return Card(
                                    child: ListTile(
                                      leading: const Icon(Icons.receipt_long),
                                      title: Text(
                                        p.courseTitle ?? 'Kursus #${p.courseId}',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.bold),
                                      ),
                                      subtitle: Text(
                                          '${p.invoice} · ${formatIDR(p.amountExpected)}'),
                                      trailing: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Chip(
                                            label: Text(_label(p.status),
                                                style: const TextStyle(
                                                    fontSize: 11)),
                                            backgroundColor: _chipBg(p.status),
                                          ),
                                          if (p.isPending)
                                            IconButton(
                                              tooltip: 'Batalkan pengajuan',
                                              icon: const Icon(Icons.delete_outline,
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
