import 'package:flutter/material.dart';

import '../../core/models.dart';
import 'role_home.dart';

class StudentHome extends StatelessWidget {
  const StudentHome({super.key, required this.user, required this.onLogout});

  final AppUser user;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    return RoleHomeScaffold(
      user: user,
      onLogout: onLogout,
      title: 'Beranda Peserta',
      subtitle: 'Katalog, kursusku, dan sertifikat hadir di Tahap 4 '
          'dengan perilaku 1:1 seperti halaman user di web.',
      children: const [
        _ComingSoonCard(
          icon: Icons.library_books,
          title: 'Semua Kursus (katalog)',
          desc: 'Cari, filter, dan daftar — sama seperti halaman Semua Kursus.',
        ),
        _ComingSoonCard(
          icon: Icons.school,
          title: 'Kursusku',
          desc: 'Belajar materi, kuis tanpa batas (nilai terbaik), dan tugas.',
        ),
        _ComingSoonCard(
          icon: Icons.verified,
          title: 'Sertifikat',
          desc: 'Otomatis terbit bila syarat modul terpenuhi + verifikasi publik.',
        ),
      ],
    );
  }
}

class TeacherHome extends StatelessWidget {
  const TeacherHome({super.key, required this.user, required this.onLogout});

  final AppUser user;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    return RoleHomeScaffold(
      user: user,
      onLogout: onLogout,
      title: 'Beranda Instruktur',
      subtitle: 'Kelola kursus, nilai tugas, dan pantau sertifikat (Tahap 5).',
      children: const [
        _ComingSoonCard(
          icon: Icons.book,
          title: 'Kursusku',
          desc: 'Kelola kurikulum, materi, kuis, dan tugas.',
        ),
        _ComingSoonCard(
          icon: Icons.fact_check,
          title: 'Penilaian',
          desc: 'Antrean tugas + rubrik seragam nasional.',
        ),
      ],
    );
  }
}

class AdminHome extends StatelessWidget {
  const AdminHome({super.key, required this.user, required this.onLogout});

  final AppUser user;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    return RoleHomeScaffold(
      user: user,
      onLogout: onLogout,
      title: 'Beranda Admin',
      subtitle: 'Kelola pengguna, undangan, voucher, dan pembayaran (Tahap 5).',
      children: const [
        _ComingSoonCard(
          icon: Icons.dashboard,
          title: 'Dasbor',
          desc: 'Ringkasan peserta, instruktur, kursus, dan sertifikat.',
        ),
        _ComingSoonCard(
          icon: Icons.payments,
          title: 'Verifikasi Pembayaran',
          desc: 'Terima/tolak antrean QRIS manual.',
        ),
      ],
    );
  }
}

class _ComingSoonCard extends StatelessWidget {
  const _ComingSoonCard(
      {required this.icon, required this.title, required this.desc});

  final IconData icon;
  final String title;
  final String desc;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
        title: Text(title),
        subtitle: Text(desc),
        trailing: const Chip(label: Text('Tahap berikutnya')),
      ),
    );
  }
}
