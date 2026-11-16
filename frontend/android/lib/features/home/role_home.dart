import 'package:flutter/material.dart';

import '../../core/models.dart';

/// Satu tab navigasi bawah: label + ikon + halaman root-nya.
/// Jumlah tab dibatasi 2–5 agar tetap ringkas di layar kecil.
class BottomNavTab {
  const BottomNavTab({required this.label, required this.icon, required this.page});

  final String label;
  final IconData icon;
  final Widget page;
}

/// Satu entri menu pada halaman "Lainnya" (pengelompokan menu sekunder).
class MoreMenuEntry {
  const MoreMenuEntry(
      {required this.icon, required this.title, required this.desc, required this.page});

  final IconData icon;
  final String title;
  final String desc;
  final Widget page;
}

/// Cangkang home per peran berbasis bottom navigation.
///
/// Tiap tab adalah root tersendiri ([IndexedStack]) — pindah tab tidak
/// menumpuk route, dan state tiap tab (posisi scroll, dsb.) tetap terjaga.
/// Navigasi detail di dalam tab tetap memakai `Navigator.push` seperti biasa.
class RoleBottomNavScaffold extends StatefulWidget {
  const RoleBottomNavScaffold({
    super.key,
    required this.user,
    required this.onLogout,
    this.onLogoutAll,
    required this.tabs,
  }) : assert(tabs.length >= 2, 'Minimal 2 tab.'),
       assert(tabs.length <= 5, 'Maksimal 5 tab agar tetap ringkas.');

  final AppUser user;
  final Future<void> Function() onLogout;

  /// Keluar dari SEMUA perangkat (`POST /auth/logout` tanpa token).
  /// Null = fitur tak tersedia (dialog hanya 1 opsi, kompatibel lama).
  final Future<void> Function()? onLogoutAll;
  final List<BottomNavTab> tabs;

  @override
  State<RoleBottomNavScaffold> createState() => _RoleBottomNavScaffoldState();
}

class _RoleBottomNavScaffoldState extends State<RoleBottomNavScaffold> {
  int _index = 0;

  Future<void> _confirmLogout() async {
    final all = widget.onLogoutAll;
    // Mode lama (1 opsi) bila pemanggil tak menyediakan keluar-semua.
    if (all == null) {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Keluar aplikasi?'),
          content: const Text('Sesi di perangkat ini akan dihapus.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Batal'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Keluar'),
            ),
          ],
        ),
      );
      if (confirm == true) await widget.onLogout();
      return;
    }
    final choice = await showDialog<_LogoutChoice>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Keluar aplikasi?'),
        content: const Text(
            'Keluar dari perangkat ini saja, atau cabut sesi di SEMUA perangkat?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(_LogoutChoice.cancel),
            child: const Text('Batal'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(_LogoutChoice.here),
            child: const Text('Perangkat ini'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(_LogoutChoice.all),
            child: const Text('Semua perangkat'),
          ),
        ],
      ),
    );
    if (choice == _LogoutChoice.here) {
      await widget.onLogout();
    } else if (choice == _LogoutChoice.all) {
      if (!mounted) return;
      final confirm = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Keluar semua perangkat?'),
          content: const Text(
              'Semua sesi (HP, tablet, browser lain) akan dicabut dan harus masuk ulang.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Batal'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                  backgroundColor: Theme.of(context).colorScheme.error),
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Ya, semua'),
            ),
          ],
        ),
      );
      if (confirm == true) await all();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            _UserHeader(user: widget.user, onLogout: _confirmLogout),
            Expanded(
              child: IndexedStack(
                index: _index,
                children: [for (final t in widget.tabs) t.page],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          for (final t in widget.tabs)
            NavigationDestination(icon: Icon(t.icon), label: t.label),
        ],
      ),
    );
  }
}

/// Baris identitas pengguna + tombol keluar di atas konten tab.
class _UserHeader extends StatelessWidget {
  const _UserHeader({required this.user, required this.onLogout});

  final AppUser user;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: ListTile(
        leading: CircleAvatar(
          child: Text(user.name.isEmpty ? '?' : user.name[0].toUpperCase()),
        ),
        title: Text(user.name),
        subtitle: Text('${user.email} · ${_roleLabel(user.role)}'),
        trailing: IconButton(
          tooltip: 'Keluar',
          icon: const Icon(Icons.logout),
          onPressed: onLogout,
        ),
      ),
    );
  }
}

/// Halaman pengelompok "Lainnya": daftar kartu menu sekunder yang
/// membuka halamannya masing-masing via `Navigator.push`.
class MoreMenuPage extends StatelessWidget {
  const MoreMenuPage({super.key, required this.title, required this.entries});

  final String title;
  final List<MoreMenuEntry> entries;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final e in entries)
            Card(
              child: ListTile(
                leading: Icon(e.icon),
                title: Text(e.title),
                subtitle: Text(e.desc),
                trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                onTap: () => Navigator.of(context)
                    .push(MaterialPageRoute(builder: (_) => e.page)),
              ),
            ),
        ],
      ),
    );
  }
}

String _roleLabel(AppRole role) {
  switch (role) {
    case AppRole.teacher:
      return 'Instruktur';
    case AppRole.admin:
      return 'Admin';
    case AppRole.student:
      return 'Peserta';
  }
}

enum _LogoutChoice { cancel, here, all }
