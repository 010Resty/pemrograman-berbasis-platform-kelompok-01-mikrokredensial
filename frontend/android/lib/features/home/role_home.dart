import 'package:flutter/material.dart';

import '../../core/models.dart';

/// Cangkang home per peran (isi penuh menyusul Tahap 4–5).
/// Data yang tampil berasal dari sesi login, bukan contoh.
class RoleHomeScaffold extends StatelessWidget {
  const RoleHomeScaffold({
    super.key,
    required this.user,
    required this.onLogout,
    required this.title,
    required this.subtitle,
    required this.children,
  });

  final AppUser user;
  final Future<void> Function() onLogout;
  final String title;
  final String subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        actions: [
          IconButton(
            tooltip: 'Keluar',
            icon: const Icon(Icons.logout),
            onPressed: () async {
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
              if (confirm == true) await onLogout();
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              leading: CircleAvatar(
                child: Text(user.name.isEmpty ? '?' : user.name[0].toUpperCase()),
              ),
              title: Text(user.name),
              subtitle: Text('${user.email} · ${_roleLabel(user.role)}'),
            ),
          ),
          const SizedBox(height: 8),
          Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }

  static String _roleLabel(AppRole role) {
    switch (role) {
      case AppRole.teacher:
        return 'Instruktur';
      case AppRole.admin:
        return 'Admin';
      case AppRole.student:
        return 'Peserta';
    }
  }
}
