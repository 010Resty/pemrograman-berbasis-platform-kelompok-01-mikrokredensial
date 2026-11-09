import 'dart:async';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api_client.dart';
import '../../shared_ui.dart';
import '../learning/submission_api.dart';
import '../profile/profile_api.dart';
import 'payment_api.dart';

/// Bayar QRIS manual: ajukan → unggah bukti → polling verifikasi admin.
/// Kontrak: nominal otoritatif dari server (`amountExpected`).
class PaymentPage extends StatefulWidget {
  const PaymentPage({super.key, required this.api, required this.courseId});

  final ApiClient api;
  final int courseId;

  @override
  State<PaymentPage> createState() => _PaymentPageState();
}

class _PaymentPageState extends State<PaymentPage> {
  MyPayment? _payment;
  bool _loading = true;
  String? _error;
  bool _busy = false;
  Timer? _poll;
  final _voucherCtrl = TextEditingController();
  DiscountQuote? _discount;
  String? _voucherError;
  String? _lastRejection;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  @override
  void dispose() {
    _poll?.cancel();
    _voucherCtrl.dispose();
    super.dispose();
  }

  Future<void> _restore() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final existing =
          await PaymentApi(widget.api).mine(widget.courseId);
      if (!mounted) return;
      setState(() => _payment = existing);
      if (existing != null) {
        if (existing.isRejected) {
          setState(() =>
              _lastRejection = existing.rejectReason ?? 'Pengajuan ditolak.');
        } else if (!existing.isVerified) {
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
    _poll?.cancel();
    _poll = Timer.periodic(const Duration(seconds: 5), (_) => _check(false));
  }

  Future<void> _check(bool manual) async {
    final current = _payment;
    if (current == null) return;
    try {
      final latest =
          await PaymentApi(widget.api).mine(widget.courseId);
      if (!mounted || latest == null || latest.id != current.id) return;
      setState(() => _payment = latest);
      if (latest.isVerified) {
        _poll?.cancel();
      } else if (latest.isRejected) {
        _poll?.cancel();
        setState(
            () => _lastRejection = latest.rejectReason ?? 'Pengajuan ditolak.');
      }
    } on ApiException catch (e) {
      if (manual && mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
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
      setState(() => _payment = created);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _uploadProof() async {
    final picked =
        await ImagePicker().pickImage(source: ImageSource.gallery);
    if (picked == null) return;
    setState(() => _busy = true);
    try {
      final bytes = await picked.readAsBytes();
      final mime = picked.mimeType ?? 'image/jpeg';
      final sub = SubmissionApi(widget.api);
      final up = await sub.upload(
        filename: picked.name,
        mimeType: mime,
        kind: 'payment_proof',
        bytes: bytes,
      );
      final updated = await PaymentApi(widget.api)
          .attachProof(_payment!.id, up.id);
      if (!mounted) return;
      setState(() => _payment = updated);
      _startPolling();
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
      padding: const EdgeInsets.all(16),
      children: [
        const Card(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Text(
                'Bayar via QRIS statis platform, lalu unggah bukti. Admin memverifikasi; akses dibuka setelah disetujui.'),
          ),
        ),
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
            padding: const EdgeInsets.only(top: 8),
            child: Text(_voucherError!,
                style: const TextStyle(color: Colors.red)),
          ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: _busy ? null : _applyVoucher,
          icon: const Icon(Icons.confirmation_number_outlined),
          label: const Text('Validasi voucher'),
        ),
        if (_discount != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Chip(
                label: Text(
                    'Diskon ${formatIDR(_discount!.discountAmount)} (${_discount!.code})')),
          ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: _busy ? null : _create,
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
          child: Text(_busy ? 'Memproses…' : 'Buat pengajuan pembayaran'),
        ),
      ],
    );
  }

  Widget _statusSection() {
    final p = _payment!;
    return RefreshIndicator(
      onRefresh: () => _check(true),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Invoice ${p.invoice}',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text('Tagihan: ${formatIDR(p.amountExpected)}',
                      style: const TextStyle(
                          fontSize: 24, fontWeight: FontWeight.w900)),
                  if (p.voucherCode != null)
                    Text('Voucher: ${p.voucherCode}'),
                  if (p.promoSlug != null)
                    Text('Promo: ${p.promoSlug}'),
                  const SizedBox(height: 8),
                  Chip(
                    label: Text(_statusLabel(p.status)),
                    backgroundColor: p.isVerified
                        ? Colors.green.shade100
                        : p.isRejected
                            ? Colors.red.shade100
                            : Colors.amber.shade100,
                  ),
                  if (p.isRejected && p.rejectReason != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text('Alasan: ${p.rejectReason}'),
                    ),
                ],
              ),
            ),
          ),
          if (_lastRejection != null && p.isRejected) ...[
            const SizedBox(height: 8),
            FilledButton(
              onPressed: () {
                setState(() {
                  _payment = null;
                  _lastRejection = null;
                });
              },
              child: const Text('Ajukan ulang pembayaran'),
            ),
          ],
          if (p.isPending) ...[
            const SizedBox(height: 8),
            const Text(
                'Pindai QRIS platform sebesar total, screenshot bukti, lalu unggah di bawah.'),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: _busy ? null : _uploadProof,
              icon: const Icon(Icons.upload),
              label: Text(_busy ? 'Mengunggah…' : 'Unggah bukti bayar'),
            ),
            const SizedBox(height: 8),
            const Text(
                'Status diperiksa otomatis tiap 5 detik. Tarik ke bawah untuk periksa manual.',
                style: TextStyle(fontSize: 11)),
          ],
          if (p.isVerified)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                    'Pembayaran disetujui. Akses kursus telah dibuka — lanjutkan belajar di Kursusku.'),
              ),
            ),
        ],
      ),
    );
  }

  String _statusLabel(String s) {
    switch (s) {
      case 'diverifikasi':
        return 'Disetujui';
      case 'ditolak':
        return 'Ditolak';
      default:
        return 'Menunggu verifikasi';
    }
  }
}
