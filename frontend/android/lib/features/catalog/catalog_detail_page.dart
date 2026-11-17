import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../shared_ui.dart';
import '../../theme/app_tokens.dart';
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
      // Dua request independen: jalan konkuren via Future.wait.
      final results = await Future.wait<dynamic>([
        api.detail(widget.courseId),
        EnrollmentApi(widget.api).access(widget.courseId),
      ]);
      if (!mounted) return;
      setState(() {
        _course = results[0] as CourseDetail;
        _access = results[1] as CourseAccess;
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
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          Text(c.title, style: AppText.title.copyWith(fontSize: 20)),
          const SizedBox(height: AppSpacing.xs),
          Text('${c.category ?? 'Umum'} · ${c.level}',
              style: AppText.caption),
          const SizedBox(height: AppSpacing.sm),
          Text(
            c.isFree ? 'GRATIS' : c.priceLabel,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: c.isFree ? AppColors.success : AppColors.ink,
            ),
          ),
          if ((c.description ?? '').isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Text(c.description!, style: AppText.body),
          ],
          const SizedBox(height: AppSpacing.lg),
          if (hasAccess)
            Card(
              margin: EdgeInsets.zero,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadius.md),
                side: BorderSide(color: AppColors.border),
              ),
              child: const ListTile(
                leading:
                    Icon(Icons.check_circle, color: AppColors.success),
                title: Text('Anda sudah memiliki akses kursus ini.',
                    style: AppText.bodyStrong),
              ),
            )
          else if (c.isFree)
            FilledButton.icon(
              onPressed: _enrollFree,
              icon: const Icon(Icons.play_arrow),
              label: const Padding(
                padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
                child: Text('Daftar gratis & mulai belajar'),
              ),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
              ),
            )
          else ...[
            OutlinedButton.icon(
              onPressed: _enrollFree,
              icon: const Icon(Icons.play_arrow),
              label: const Text('Coba daftar'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _voucher,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: 'Punya kode voucher? Tukar di sini',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton.icon(
              onPressed: _redeem,
              icon: const Icon(Icons.confirmation_number_outlined),
              label: const Text('Tukar voucher'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            FilledButton.icon(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => PaymentPage(api: widget.api, courseId: c.id),
                ),
              ),
              icon: const Icon(Icons.qr_code),
              label: const Padding(
                padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
                child: Text('Bayar via QRIS'),
              ),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
