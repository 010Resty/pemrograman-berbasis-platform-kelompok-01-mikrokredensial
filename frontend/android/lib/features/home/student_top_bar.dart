import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/file_url.dart';
import '../../core/models.dart';
import '../../shared_ui.dart';
import '../../widgets/app_top_bar.dart';
import '../activity/activity_page.dart';
import '../profile/profile_page.dart';

/// Header modern ARISTOTELES: logo + judul, bell notifikasi,
/// avatar (foto asli bila ada). Dipakai semua role agar konsisten.
/// Bila [onOpenTab] tersedia, bell/avatar pindah tab (tanpa menumpuk route).
class StudentTopBar extends StatefulWidget {
  const StudentTopBar({
    super.key,
    required this.api,
    required this.user,
    this.onOpenTab,
    this.bellTabIndex,
    this.profileTabIndex,
    this.subtitle = 'Microcredentials',
    this.onLogout,
    this.onLogoutAll,
  });

  final ApiClient api;
  final AppUser user;

  /// Pindah tab (mis. Student: bell→3, avatar→4). Null = push biasa.
  final void Function(int index)? onOpenTab;
  final int? bellTabIndex;
  final int? profileTabIndex;
  final String subtitle;

  /// Bila diisi, tampil ikon Keluar di header (portal instruktur/admin).
  /// Student tidak mengisi ini (Keluar ada di tab Profil).
  final Future<void> Function()? onLogout;

  /// Keluar dari SEMUA perangkat. Null = hanya perangkat ini.
  final Future<void> Function()? onLogoutAll;

  @override
  State<StudentTopBar> createState() => _StudentTopBarState();
}

class _StudentTopBarState extends State<StudentTopBar> {
  bool _hasPending = false;

  @override
  void initState() {
    super.initState();
    _checkPending();
  }

  Future<void> _checkPending() async {
    try {
      final data = await widget.api.get<Object?>(
        '/me/payments?status=menunggu&limit=1',
        (json) => json,
      );
      final m = (data as Map?)?.cast<String, Object?>();
      final items = m?['items'];
      final total = m?['total'];
      final has = (items is List && items.isNotEmpty) ||
          (total is int && total > 0);
      if (mounted) setState(() => _hasPending = has);
    } catch (_) {
      // Bell tanpa dot bila backend tak terjangkau — tanpa error palsu.
    }
  }

  void _open(Widget page, {int? tabIndex}) {
    final go = widget.onOpenTab;
    if (go != null && tabIndex != null) {
      go(tabIndex);
      return;
    }
    Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => page));
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.user.name.trim();
    final initial =
        name.isEmpty ? '?' : name[0].toUpperCase();
    return AppTopBar(
      title: 'ARISTOTELES',
      subtitle: widget.subtitle,
      avatarUrl:
          resolveAvatarUrl(widget.user.avatarUrl, widget.api.baseUrl),
      userInitial: initial,
      showBellDot: _hasPending,
      onBell: () => _open(ActivityPage(api: widget.api),
          tabIndex: widget.bellTabIndex),
      onAvatar: () => _open(
          ProfilePage(
              api: widget.api,
              onLogout: widget.onLogout,
              onLogoutAll: widget.onLogoutAll),
          tabIndex: widget.profileTabIndex),
      onLogout: widget.onLogout == null
          ? null
          : () async {
              final ok = await confirmDialog(
                context,
                title: 'Keluar aplikasi?',
                message: 'Sesi di perangkat ini akan dihapus.',
                confirmText: 'Keluar',
              );
              if (ok == true) await widget.onLogout!();
            },
    );
  }
}
