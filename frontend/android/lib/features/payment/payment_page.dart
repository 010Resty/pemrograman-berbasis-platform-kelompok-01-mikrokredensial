import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../shared_ui.dart';
import '../../theme/app_tokens.dart';
import '../profile/profile_api.dart';
import 'payment_api.dart';

/// Bayar QRIS DINAMIS DOKU: buat antrean → pindai QR (nominal tampil
/// otomatis) → polling status → akses dibuka otomatis via webhook.
/// Kontrak: nominal otoritatif dari server (`amountExpected`).
class PaymentPage extends StatefulWidget {
  const PaymentPage({super.key, required this.api, required this.courseId});

  final ApiClient api;
  final int courseId;

  @override
  State<PaymentPage> createState() => _PaymentPageState();
}

class _PaymentPageState extends State<PaymentPage>
    with WidgetsBindingObserver {
  MyPayment? _payment;
  bool _loading = true;
  String? _error;
  bool _busy = false;
  Timer? _poll;
  Timer? _ticker;
  int _pollAttempt = 0;
  bool _checking = false;
  String? _pollError;
  final _voucherCtrl = TextEditingController();
  DiscountQuote? _discount;
  String? _voucherError;
  String? _lastRejection;

  Uint8List? _qrBytes;
  bool _qrLoading = false;
  String? _qrError;
  bool _refreshing = false;

  static const _backoff = [5, 10, 15];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _restore();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _poll?.cancel();
    _ticker?.cancel();
    _voucherCtrl.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final p = _payment;
    if (p == null || !p.isPending) return;
    switch (state) {
      case AppLifecycleState.resumed:
        _schedulePoll();
        _startTicker();
        break;
      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
      case AppLifecycleState.detached:
      case AppLifecycleState.hidden:
        _poll?.cancel();
        _ticker?.cancel();
        break;
    }
  }

  Future<void> _restore() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final existing = await PaymentApi(widget.api).mine(widget.courseId);
      if (!mounted) return;
      setState(() {
        _payment = existing;
        _qrBytes = null;
        _qrError = null;
      });
      if (existing != null) {
        if (existing.isRejected) {
          setState(() =>
              _lastRejection = existing.rejectReason ?? 'Pembayaran gagal.');
        } else if (!existing.isVerified) {
          _loadQr();
          _startPolling();
        }
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _startPolling() {
    _pollAttempt = 0;
    _pollError = null;
    _schedulePoll();
    _startTicker();
  }

  void _stopPolling() {
    _poll?.cancel();
    _ticker?.cancel();
  }

  void _schedulePoll() {
    _poll?.cancel();
    final secs = _backoff[_pollAttempt.clamp(0, _backoff.length - 1)];
    _poll = Timer(Duration(seconds: secs), () async {
      await _check(false);
      if (!mounted) return;
      final p = _payment;
      if (p != null && p.isPending) {
        _pollAttempt = (_pollAttempt + 1).clamp(0, _backoff.length - 1);
        _schedulePoll();
      }
    });
  }

  void _startTicker() {
    _ticker?.cancel();
    final p = _payment;
    if (p == null || !p.isPending || _qrRemaining == null) return;
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final cur = _payment;
      if (cur == null || !cur.isPending) {
        _ticker?.cancel();
        return;
      }
      setState(() {});
    });
  }

  Future<void> _check(bool manual) async {
    if (_checking) return;
    final current = _payment;
    if (current == null) return;
    _checking = true;
    try {
      final latest = await PaymentApi(widget.api).mine(widget.courseId);
      if (!mounted || latest == null || latest.id != current.id) return;
      setState(() {
        _payment = latest;
        _pollError = null;
      });
      if (latest.isVerified) {
        _stopPolling();
      } else if (latest.isRejected) {
        _stopPolling();
        setState(() =>
            _lastRejection = latest.rejectReason ?? 'Pembayaran gagal.');
      }
    } on ApiException catch (e) {
      // Auto-poll diam: simpan galat, hanya SnackBar bila manual.
      _pollError = e.message;
      if (manual && mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      _checking = false;
    }
  }

  Future<void> _applyVoucher() async {
    final code = _voucherCtrl.text.trim();
    if (code.isEmpty) return;
    setState(() {
      _busy = true;
      _voucherError = null;
    });
    try {
      final q = await VoucherApi(widget.api)
          .validateDiscount(code: code, courseId: widget.courseId);
      if (!mounted) return;
      setState(() => _discount = q);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _voucherError = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _create() async {
    setState(() => _busy = true);
    try {
      final created = await PaymentApi(widget.api).create(
        widget.courseId,
        voucherCode: _discount?.code,
      );
      if (!mounted) return;
      setState(() {
        _payment = created;
        _qrBytes = null;
        _qrError = null;
      });
      _loadQr();
      _startPolling();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Unduh PNG QRIS dinamis dari server (nominal tampil otomatis saat dipindai).
  Future<void> _loadQr() async {
    final id = _payment?.id;
    if (id == null) return;
    setState(() {
      _qrLoading = true;
      _qrError = null;
    });
    try {
      final bytes = await PaymentApi(widget.api).qrBytes(id);
      if (!mounted) return;
      setState(() => _qrBytes = Uint8List.fromList(bytes));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _qrError = e.message);
    } finally {
      if (mounted) setState(() => _qrLoading = false);
    }
  }

  /// Minta QR baru (kedaluwarsa/hilang) lalu muat ulang gambarnya.
  Future<void> _refreshQr() async {
    final id = _payment?.id;
    if (id == null || _refreshing) return;
    setState(() {
      _refreshing = true;
      _qrError = null;
    });
    try {
      final updated = await PaymentApi(widget.api).refreshDoku(id);
      if (!mounted) return;
      setState(() => _payment = updated);
      await _loadQr();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _qrError = e.message);
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  /// Sisa waktu QR (dari dokuExpiresAt server). Null = tak diketahui.
  Duration? get _qrRemaining {
    final exp = _payment?.dokuExpiresAt;
    if (exp == null || exp.isEmpty) return null;
    final end = DateTime.tryParse(exp);
    if (end == null) return null;
    final left = end.difference(DateTime.now());
    return left.isNegative ? Duration.zero : left;
  }

  bool get _qrExpired {
    final r = _qrRemaining;
    return r != null && r == Duration.zero;
  }

  String get _qrCountdown {
    final r = _qrRemaining;
    if (r == null) return '';
    final s = r.inSeconds;
    final m = (s ~/ 60).toString().padLeft(2, '0');
    final rest = (s % 60).toString().padLeft(2, '0');
    return '$m:$rest';
  }

  Future<void> _confirmCancel() async {
    final current = _payment;
    if (current == null) return;
    final yes = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Batalkan pengajuan?'),
        content: Text(
            'Antrean ${current.invoice} (${formatIDR(current.amountExpected)}) akan dihapus permanen. Anda bisa membuat QR baru kapan pun.'),
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
    setState(() => _busy = true);
    try {
      await PaymentApi(widget.api).cancel(current.id);
      if (!mounted) return;
      _stopPolling();
      if (Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
      } else {
        setState(() {
          _payment = null;
          _qrBytes = null;
          _qrError = null;
        });
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pembayaran QRIS')),
      body: _loading
          ? StateViews.loading()
          : _error != null
              ? StateViews.error(_error!, _restore)
              : _payment == null
                  ? _checkout()
                  : _statusSection(),
    );
  }

  Widget _checkout() {
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
        const Card(
          child: Padding(
            padding: EdgeInsets.all(AppSpacing.lg),
            child: Text(
                'Bayar via QRIS dinamis: pindai kode, nominal tampil otomatis, akses dibuka otomatis setelah terkonfirmasi. Tanpa unggah bukti.'),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        TextField(
          controller: _voucherCtrl,
          textCapitalization: TextCapitalization.characters,
          decoration: const InputDecoration(
            labelText: 'Kode voucher diskon (opsional)',
            border: OutlineInputBorder(),
          ),
        ),
        if (_voucherError != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text(_voucherError!,
                style: const TextStyle(color: Colors.red)),
          ),
        const SizedBox(height: AppSpacing.sm),
        OutlinedButton.icon(
          onPressed: _busy ? null : _applyVoucher,
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(64, 48),
          ),
          icon: const Icon(Icons.confirmation_number_outlined),
          label: const Text('Validasi voucher'),
        ),
        if (_discount != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Chip(
                label: Text(
                    'Diskon ${formatIDR(_discount!.discountAmount)} (${_discount!.code})')),
          ),
        const SizedBox(height: AppSpacing.lg),
        FilledButton(
          onPressed: _busy ? null : _create,
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
          child: Text(_busy ? 'Memproses…' : 'Buat QR pembayaran'),
        ),
      ],
    );
  }

  Widget _statusSection() {
    final p = _payment!;
    return RefreshIndicator(
      onRefresh: () => _check(true),
      child: ListView(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.lg +
              MediaQuery.of(context).padding.bottom +
              AppSpacing.sm,
        ),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Invoice ${p.invoice}',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: AppSpacing.sm),
                  Text('Tagihan: ${formatIDR(p.amountExpected)}',
                      style: const TextStyle(
                          fontSize: 24, fontWeight: FontWeight.w900)),
                  if (p.voucherCode != null)
                    Text('Voucher: ${p.voucherCode}'),
                  if (p.promoSlug != null) Text('Promo: ${p.promoSlug}'),
                  const SizedBox(height: AppSpacing.sm),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md,
                        vertical: AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border.all(
                        color: p.isVerified
                            ? Colors.green
                            : p.isRejected
                                ? Colors.red
                                : Colors.amber.shade800,
                      ),
                      borderRadius:
                          BorderRadius.circular(AppRadius.pill),
                    ),
                    child: Text(_statusLabel(p.status),
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: p.isVerified
                                ? Colors.green.shade700
                                : p.isRejected
                                    ? Colors.red.shade700
                                    : Colors.amber.shade800)),
                  ),
                  if (p.isRejected && p.rejectReason != null)
                    Padding(
                      padding:
                          const EdgeInsets.only(top: AppSpacing.sm),
                      child: Text('Alasan: ${p.rejectReason}'),
                    ),
                ],
              ),
            ),
          ),
          if (_lastRejection != null && p.isRejected) ...[
            const SizedBox(height: AppSpacing.sm),
            FilledButton(
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
              ),
              onPressed: () {
                setState(() {
                  _payment = null;
                  _lastRejection = null;
                  _qrBytes = null;
                  _qrError = null;
                });
              },
              child: const Text('Buat QR baru'),
            ),
          ],
          if (p.isPending) ...[
            const SizedBox(height: AppSpacing.sm),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  children: [
                    if (_qrLoading)
                      const SizedBox(
                        height: 220,
                        child: Center(child: CircularProgressIndicator()),
                      )
                    else if (_qrBytes != null)
                      Image.memory(_qrBytes!,
                          width: 220, height: 220, fit: BoxFit.contain)
                    else ...[
                      const Icon(Icons.qr_code_2,
                          size: 64, color: Colors.grey),
                      const SizedBox(height: AppSpacing.sm),
                      Text(_qrError ?? 'QR belum tersedia.',
                          textAlign: TextAlign.center),
                      const SizedBox(height: AppSpacing.sm),
                      OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(64, 48),
                        ),
                        onPressed: _loadQr,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Muat ulang QR'),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.sm),
                    const Text(
                      'Pindai dengan m-banking / e-wallet apa pun — nominal tampil otomatis.',
                      textAlign: TextAlign.center,
                    ),
                    if (_qrRemaining != null && !_qrExpired) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.md,
                            vertical: AppSpacing.sm),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          border:
                              Border.all(color: AppColors.primaryContainer),
                          borderRadius:
                              BorderRadius.circular(AppRadius.pill),
                        ),
                        child: Text('QR berlaku $_qrCountdown',
                            style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: AppColors.primary)),
                      )
                    ],
                    if (_qrExpired) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.md,
                            vertical: AppSpacing.sm),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          border: Border.all(color: AppColors.rose),
                          borderRadius:
                              BorderRadius.circular(AppRadius.pill),
                        ),
                        child: const Text('QR kedaluwarsa',
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: AppColors.rose)),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      FilledButton.icon(
                        style: FilledButton.styleFrom(
                          minimumSize: const Size(64, 48),
                        ),
                        onPressed: _refreshing ? null : _refreshQr,
                        icon: _refreshing
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.refresh),
                        label: Text(_refreshing
                            ? 'Memperbarui…'
                            : 'Buat QR baru'),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              _pollError == null
                  ? 'Status diperiksa otomatis (5 dtk, lalu 10 dtk, lalu 15 dtk). Tarik ke bawah untuk periksa manual.'
                  : 'Refresh otomatis terakhir gagal ($_pollError). Tarik ke bawah untuk periksa manual.',
              style: AppText.small),
            TextButton.icon(
              style: TextButton.styleFrom(
                minimumSize: const Size(64, 48),
              ),
              onPressed: _busy ? null : _confirmCancel,
              icon: const Icon(Icons.delete_outline,
                  size: 16, color: Colors.red),
              label: const Text('Batalkan pengajuan ini',
                  style: TextStyle(color: Colors.red, fontSize: 12)),
            ),
          ],
          if (p.isVerified)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(AppSpacing.lg),
                child: Text(
                    'Pembayaran terkonfirmasi DOKU. Akses kursus telah dibuka — lanjutkan belajar di Kursusku.'),
              ),
            ),
        ],
      ),
    );
  }

  String _statusLabel(String s) {
    switch (s) {
      case 'diverifikasi':
        return 'Terkonfirmasi';
      case 'ditolak':
        return 'Gagal';
      default:
        return 'Menunggu pembayaran';
    }
  }
}
