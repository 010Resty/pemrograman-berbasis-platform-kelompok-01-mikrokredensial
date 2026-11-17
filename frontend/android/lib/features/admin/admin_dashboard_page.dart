import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../shared_ui.dart';
import '../../theme/app_tokens.dart';
import 'admin_api.dart';
import 'admin_pages.dart';

/// Dasbor admin: ringkasan + navigasi kelola.
class AdminDashboardPage extends StatefulWidget {
  const AdminDashboardPage({super.key, required this.api, this.showAppBar = true});

  final ApiClient api;
  final bool showAppBar;

  @override
  State<AdminDashboardPage> createState() => _AdminDashboardPageState();
}

class _AdminDashboardPageState extends State<AdminDashboardPage> {
  AdminOverview? _data;
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
      final data = await AdminApi(widget.api).overview();
      if (!mounted) return;
      setState(() => _data = data);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final Widget body = _loading
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
                      LayoutBuilder(
                        builder: (context, constraints) {
                          final wide = constraints.maxWidth >= 600;
                          return GridView.count(
                            crossAxisCount: wide ? 4 : 2,
                            shrinkWrap: true,
                            physics:
                                const NeverScrollableScrollPhysics(),
                            mainAxisSpacing: AppSpacing.sm,
                            crossAxisSpacing: AppSpacing.sm,
                            childAspectRatio: 1.6,
                            children: [
                              _Stat('Peserta',
                                  '${_data?.totalStudents ?? 0}'),
                              _Stat('Instruktur',
                                  '${_data?.totalTeachers ?? 0}'),
                              _Stat('Kursus',
                                  '${_data?.totalCourses ?? 0}'),
                              _Stat('Sertifikat',
                                  '${_data?.totalCertificates ?? 0}'),
                            ],
                          );
                        },
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      _NavTile(
                        icon: Icons.people,
                        title: 'Peserta',
                        onTap: () =>
                            _go(AdminUsersPage(api: widget.api)),
                      ),
                      _NavTile(
                        icon: Icons.mail_outline,
                        title: 'Undangan instruktur',
                        onTap: () => _go(
                            AdminInvitationsPage(api: widget.api)),
                      ),
                      _NavTile(
                        icon: Icons.confirmation_number_outlined,
                        title: 'Voucher',
                        onTap: () =>
                            _go(AdminVouchersPage(api: widget.api)),
                      ),
                      _NavTile(
                        icon: Icons.payments_outlined,
                        title: 'Verifikasi pembayaran',
                        onTap: () => _go(
                            AdminPaymentsPage(api: widget.api)),
                      ),
                    ],
                  ),
                );
    if (widget.showAppBar) {
      return Scaffold(
        appBar: AppBar(title: const Text('Dasbor Admin')),
        body: body,
      );
    }
    return body;
  }

  Future<void> _go(Widget page) {
    return Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => page))
        .then((_) => _load());
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        side: BorderSide(color: AppColors.border),
      ),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(value,
                style: const TextStyle(
                    fontSize: 24, fontWeight: FontWeight.bold)),
            Text(label, style: AppText.small),
          ],
        ),
      ),
    );
  }
}

class _NavTile extends StatelessWidget {
  const _NavTile(
      {required this.icon, required this.title, required this.onTap});

  final IconData icon;
  final String title;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        side: BorderSide(color: AppColors.border),
      ),
      child: ListTile(
        leading: Icon(icon, color: AppColors.primary),
        title: Text(title),
        trailing: const Icon(Icons.arrow_forward_ios, size: 16),
        onTap: onTap,
      ),
    );
  }
}
