import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/models.dart';
import '../admin/admin_dashboard_page.dart';
import '../admin/admin_pages.dart';
import '../catalog/catalog_page.dart';
import '../catalog/kursusku_page.dart';
import '../certificate/certificates_page.dart';
import '../instructor/inst_certificates_page.dart';
import '../instructor/instructor_courses_page.dart';
import '../instructor/review_queue_page.dart';
import '../payment/notifications_page.dart';
import '../profile/profile_page.dart';
import 'role_home.dart';

class StudentHome extends StatelessWidget {
  const StudentHome(
      {super.key, required this.api, required this.user, required this.onLogout});

  final ApiClient api;
  final AppUser user;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    return RoleHomeScaffold(
      user: user,
      onLogout: onLogout,
      title: 'Beranda Peserta',
      subtitle: 'Katalog, belajar, pembayaran, dan sertifikat.',
      children: [
        _MenuTile(
            api: api,
            icon: Icons.library_books,
            title: 'Semua Kursus',
            desc: 'Cari, filter, daftar, dan tukar voucher.',
            page: (a) => CatalogPage(api: a)),
        _MenuTile(
            api: api,
            icon: Icons.school,
            title: 'Kursusku',
            desc: 'Belajar materi, kuis, dan tugas.',
            page: (a) => KursuskuPage(api: a)),
        _MenuTile(
            api: api,
            icon: Icons.notifications_outlined,
            title: 'Notifikasi',
            desc: 'Pembayaran menunggu/ditolak dan sertifikat baru.',
            page: (a) => NotificationsPage(api: a)),
        _MenuTile(
            api: api,
            icon: Icons.verified,
            title: 'Sertifikat',
            desc: 'Unduh PDF dan verifikasi publik.',
            page: (a) => CertificatesPage(api: a)),
        _MenuTile(
            api: api,
            icon: Icons.person,
            title: 'Profil Saya',
            desc: 'Lihat dan ubah data diri.',
            page: (a) => ProfilePage(api: a)),
      ],
    );
  }
}

class TeacherHome extends StatelessWidget {
  const TeacherHome(
      {super.key, required this.api, required this.user, required this.onLogout});

  final ApiClient api;
  final AppUser user;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    return RoleHomeScaffold(
      user: user,
      onLogout: onLogout,
      title: 'Beranda Instruktur',
      subtitle: 'Kelola kursus, nilai tugas, dan pantau sertifikat.',
      children: [
        _MenuTile(
            api: api,
            icon: Icons.book,
            title: 'Kursusku',
            desc: 'Struktur modul dan materi yang Anda ampu.',
            page: (a) => InstructorCoursesPage(api: a)),
        _MenuTile(
            api: api,
            icon: Icons.fact_check,
            title: 'Penilaian',
            desc: 'Antrean tugas + rubrik seragam nasional.',
            page: (a) => ReviewQueuePage(api: a)),
        _MenuTile(
            api: api,
            icon: Icons.verified,
            title: 'Sertifikat',
            desc: 'Ringkasan, riwayat, dan pencabutan.',
            page: (a) => InstCertificatesPage(api: a)),
        _MenuTile(
            api: api,
            icon: Icons.person,
            title: 'Profil Saya',
            desc: 'Lihat dan ubah data diri.',
            page: (a) => ProfilePage(api: a)),
      ],
    );
  }
}

class AdminHome extends StatelessWidget {
  const AdminHome(
      {super.key, required this.api, required this.user, required this.onLogout});

  final ApiClient api;
  final AppUser user;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    return RoleHomeScaffold(
      user: user,
      onLogout: onLogout,
      title: 'Beranda Admin',
      subtitle: 'Kelola pengguna, undangan, voucher, dan pembayaran.',
      children: [
        _MenuTile(
            api: api,
            icon: Icons.dashboard,
            title: 'Dasbor',
            desc: 'Ringkasan + kelola semua antrean.',
            page: (a) => AdminDashboardPage(api: a)),
        _MenuTile(
            api: api,
            icon: Icons.payments,
            title: 'Verifikasi Pembayaran',
            desc: 'Terima/tolak antrean QRIS manual.',
            page: (a) => AdminPaymentsPage(api: a)),
        _MenuTile(
            api: api,
            icon: Icons.mail_outline,
            title: 'Undangan instruktur',
            desc: 'Buat dan pantau undangan.',
            page: (a) => AdminInvitationsPage(api: a)),
        _MenuTile(
            api: api,
            icon: Icons.person,
            title: 'Profil Saya',
            desc: 'Lihat dan ubah data diri.',
            page: (a) => ProfilePage(api: a)),
      ],
    );
  }
}

class _MenuTile extends StatelessWidget {
  const _MenuTile(
      {required this.api,
      required this.icon,
      required this.title,
      required this.desc,
      required this.page});

  final ApiClient api;
  final IconData icon;
  final String title;
  final String desc;
  final Widget Function(ApiClient api) page;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Icon(icon),
        title: Text(title),
        subtitle: Text(desc),
        trailing: const Icon(Icons.arrow_forward_ios, size: 16),
        onTap: () => Navigator.of(context)
            .push(MaterialPageRoute(builder: (_) => page(api))),
      ),
    );
  }
}
