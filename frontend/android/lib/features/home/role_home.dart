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
    this.header,
    this.headerBuilder,
    this.tabs,
    this.tabsBuilder,
  })  : assert(tabs != null || tabsBuilder != null,
            'Isi tabs atau tabsBuilder.'),
        assert((tabs?.length ?? 2) >= 2, 'Minimal 2 tab.'),
        assert((tabs?.length ?? 5) <= 5, 'Maksimal 5 tab agar tetap ringkas.');

  final AppUser user;
  final Future<void> Function() onLogout;

  /// Keluar dari SEMUA perangkat (`POST /auth/logout` tanpa token).
  /// Null = fitur tak tersedia (dialog hanya 1 opsi, kompatibel lama).
  final Future<void> Function()? onLogoutAll;

  /// Header kustom (mis. TopAppBar modern). Null = bangun via headerBuilder
  /// atau fallback identitas lama.
  final Widget? header;

  /// Header yang butuh pindah tab (bell/avatar tanpa menumpuk route).
  final Widget Function(void Function(int index) goToTab)? headerBuilder;

  /// Daftar tab statis (dipakai bila tabsBuilder null).
  final List<BottomNavTab>? tabs;

  /// Pembangun tab dengan akses pindah tab (dipakai Beranda agar
  /// pintasan bisa redirect ke tab, bukan menumpuk halaman).
  final List<BottomNavTab> Function(void Function(int index) goToTab)?
      tabsBuilder;

  @override
  State<RoleBottomNavScaffold> createState() => _RoleBottomNavScaffoldState();
}

class _RoleBottomNavScaffoldState extends State<RoleBottomNavScaffold> {
  int _index = 0;
  late final List<BottomNavTab> _tabs;
  Widget? _header;

  void _goToTab(int i) {
    if (i >= 0 && i < _tabs.length) {
      setState(() => _index = i);
    }
  }

  @override
  void initState() {
    super.initState();
    // Di-resolve sekali agar instance halaman tiap tab tetap sama
    // (IndexedStack menjaga state: posisi scroll, dsb.).
    final builder = widget.tabsBuilder;
    _tabs = builder != null ? builder(_goToTab) : widget.tabs!;
    final hb = widget.headerBuilder;
    if (widget.header == null && hb != null) {
      // Header butuh goToTab — resolve sekali seperti tabs.
      _header = hb(_goToTab);
    }
  }

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
            widget.header ??
                _header ??
                _UserHeader(user: widget.user, onLogout: _confirmLogout),
            Expanded(
              child: IndexedStack(
                index: _index,
                children: [for (final t in _tabs) t.page],
              ),
            ),
          ],
        ),
      ),
      // Bar putih transparan + ikon & label biru untuk tab aktif,
      // tanpa pil indikator keunguan bawaan M3 (lihat AppTheme).
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.94),
          border: Border(
              top: BorderSide(color: Colors.grey.shade200)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0F000000),
              blurRadius: 12,
              offset: Offset(0, -4),
            ),
          ],
        ),
        child: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: (i) => setState(() => _index = i),
          destinations: [
            for (final t in _tabs)
              NavigationDestination(icon: Icon(t.icon), label: t.label),
          ],
        ),
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
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: CircleAvatar(
          backgroundColor: const Color(0xFFE5EEFF),
          foregroundColor: const Color(0xFF004AC6),
          child: Text(user.name.isEmpty ? '?' : user.name[0].toUpperCase()),
        ),
        title: Text(user.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text('${user.email} · ${_roleLabel(user.role)}',
            maxLines: 1, overflow: TextOverflow.ellipsis),
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
    final bottom = MediaQuery.of(context).padding.bottom;
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: ListView(
        padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + bottom),
        children: [
          for (final e in entries) ...[
            Card(
              child: ListTile(
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 4),
                leading: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFF004AC6).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(e.icon,
                      size: 20, color: const Color(0xFF004AC6)),
                ),
                title: Text(e.title,
                    style:
                        const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text(e.desc),
                trailing:
                    const Icon(Icons.arrow_forward_ios, size: 16),
                onTap: () => Navigator.of(context)
                    .push(MaterialPageRoute(builder: (_) => e.page)),
              ),
            ),
            const SizedBox(height: 8),
          ],
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
