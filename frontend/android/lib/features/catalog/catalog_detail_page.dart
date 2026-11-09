import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../shared_ui.dart';
import '../learning/enrollment_api.dart';
import '../payment/payment_page.dart';
import '../profile/profile_api.dart';
import 'catalog_api.dart';

/// Detail kursus: info, enroll gratis / tukar voucher / bayar.
class CatalogDetailPage extends StatefulWidget {
  const CatalogDetailPage({super.key, required this.api, required this.courseId});

  final ApiClient api;
  final int courseId;

  @override
  State<CatalogDetailPage> createState() => _CatalogDetailPageState();
}

class _CatalogDetailPageState extends State<CatalogDetailPage> {
  CourseDetail? _course;
  CourseAccess? _access;
  bool _loading = true;
  String? _error;
  final _voucher = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _voucher.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = CatalogApi(widget.api);
      final detail = await api.detail(widget.courseId);
      final access = await EnrollmentApi(widget.api).access(widget.courseId);
      if (!mounted) return;
      setState(() {
        _course = detail;
        _access = access;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _enrollFree() async {
    try {
      await EnrollmentApi(widget.api).enrollFree(widget.courseId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Berhasil mendaftar. Selamat belajar!')),
      );
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _redeem() async {
    final code = _voucher.text.trim();
    if (code.isEmpty) return;
    try {
      await VoucherApi(widget.api).redeem(code: code, courseId: widget.courseId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Voucher berhasil ditukar. Akses dibuka.')),
      );
      _voucher.clear();
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
      appBar: AppBar(title: const Text('Detail Kursus')),
      body: _loading
          ? StateViews.loading()
          : _error != null
              ? StateViews.error(_error!, _load)
              : _course == null
                  ? StateViews.empty('Tidak ditemukan',
                      'Kursus tidak tersedia atau sudah dihapus.')
                  : _body(),
    );
  }

  Widget _body() {
    final c = _course!;
    final access = _access;
    final hasAccess = access?.hasAccess == true || access?.isManager == true;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(c.title,
            style: Theme.of(context)
                .textTheme
                .headlineSmall
                ?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        Text('${c.category ?? 'Umum'} · ${c.level}',
            style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: 8),
        Text(
          c.isFree ? 'GRATIS' : c.priceLabel,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: c.isFree ? Colors.green.shade700 : null,
          ),
        ),
        if ((c.description ?? '').isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(c.description!),
        ],
        const SizedBox(height: 16),
        if (hasAccess)
          const Card(
            child: ListTile(
              leading: Icon(Icons.check_circle, color: Colors.green),
              title: Text('Anda sudah memiliki akses kursus ini.'),
            ),
          )
        else if (c.isFree)
          FilledButton.icon(
            onPressed: _enrollFree,
            icon: const Icon(Icons.play_arrow),
            label: const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text('Daftar gratis & mulai belajar'),
            ),
          )
        else ...[
          OutlinedButton.icon(
            onPressed: _enrollFree,
            icon: const Icon(Icons.play_arrow),
            label: const Text('Coba daftar'),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _voucher,
            textCapitalization: TextCapitalization.characters,
            decoration: const InputDecoration(
              labelText: 'Punya kode voucher? Tukar di sini',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _redeem,
            icon: const Icon(Icons.confirmation_number_outlined),
            label: const Text('Tukar voucher'),
          ),
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => PaymentPage(api: widget.api, courseId: c.id),
              ),
            ),
            icon: const Icon(Icons.qr_code),
            label: const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text('Bayar via QRIS'),
            ),
          ),
        ],
      ],
    );
  }
}
