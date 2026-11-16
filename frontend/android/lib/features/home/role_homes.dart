import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/models.dart';
import '../admin/admin_dashboard_page.dart';
import '../admin/admin_pages.dart';
import '../admin/admin_reports_page.dart';
import '../catalog/catalog_page.dart';
import '../catalog/kursusku_page.dart';
import '../certificate/certificates_page.dart';
import '../instructor/inst_certificates_page.dart';
import '../instructor/instructor_courses_page.dart';
import '../instructor/review_queue_page.dart';
import '../payment/notifications_page.dart';
import '../payment/payment_history_page.dart';
import '../profile/profile_page.dart';
import 'role_home.dart';

/// Beranda peserta: 4 tab (menu sekunder dikelompokkan di "Lainnya").
class StudentHome extends StatelessWidget {
  const StudentHome(
      {super.key,
      required this.api,
      required this.user,
      required this.onLogout,
      this.onLogoutAll});

  final ApiClient api;
  final AppUser user;
  final Future<void> Function() onLogout;
  final Future<void> Function()? onLogoutAll;

  @override
  Widget build(BuildContext context) {
    return RoleBottomNavScaffold(
      user: user,
      onLogout: onLogout,
      onLogoutAll: onLogoutAll,
      tabs: [
        BottomNavTab(
            label: 'Kursusku',
            icon: Icons.school,
            page: KursuskuPage(api: api)),
        BottomNavTab(
            label: 'Katalog',
            icon: Icons.library_books,
            page: CatalogPage(api: api)),
        BottomNavTab(
            label: 'Notifikasi',
            icon: Icons.notifications_outlined,
            page: NotificationsPage(api: api)),
        BottomNavTab(
          label: 'Lainnya',
          icon: Icons.more_horiz,
          page: MoreMenuPage(title: 'Lainnya', entries: [
            MoreMenuEntry(
                icon: Icons.receipt_long,
                title: 'Riwayat Pembayaran',
                desc: 'Lanjutkan yang menunggu, lihat status verifikasi.',
                page: PaymentHistoryPage(api: api)),
            MoreMenuEntry(
                icon: Icons.verified,
                title: 'Sertifikat',
                desc: 'Unduh PDF dan verifikasi publik.',
                page: CertificatesPage(api: api)),
            MoreMenuEntry(
                icon: Icons.person,
                title: 'Profil Saya',
                desc: 'Lihat dan ubah data diri.',
                page: ProfilePage(api: api)),
          ]),
        ),
      ],
    );
  }
}

/// Beranda instruktur: 3 tab (menu sekunder dikelompokkan di "Lainnya").
class TeacherHome extends StatelessWidget {
  const TeacherHome(
      {super.key,
      required this.api,
      required this.user,
      required this.onLogout,
      this.onLogoutAll});

  final ApiClient api;
  final AppUser user;
  final Future<void> Function() onLogout;
  final Future<void> Function()? onLogoutAll;

  @override
  Widget build(BuildContext context) {
    return RoleBottomNavScaffold(
      user: user,
      onLogout: onLogout,
      onLogoutAll: onLogoutAll,
      tabs: [
        BottomNavTab(
            label: 'Kursusku',
            icon: Icons.book,
            page: InstructorCoursesPage(api: api)),
        BottomNavTab(
            label: 'Penilaian',
            icon: Icons.fact_check,
            page: ReviewQueuePage(api: api)),
        BottomNavTab(
          label: 'Lainnya',
          icon: Icons.more_horiz,
          page: MoreMenuPage(title: 'Lainnya', entries: [
            MoreMenuEntry(
                icon: Icons.verified,
                title: 'Sertifikat',
                desc: 'Ringkasan, riwayat, dan pencabutan.',
                page: InstCertificatesPage(api: api)),
            MoreMenuEntry(
                icon: Icons.person,
                title: 'Profil Saya',
                desc: 'Lihat dan ubah data diri.',
                page: ProfilePage(api: api)),
          ]),
        ),
      ],
    );
  }
}

/// Beranda admin: 4 tab (menu sekunder dikelompokkan di "Lainnya").
class AdminHome extends StatelessWidget {
  const AdminHome(
      {super.key,
      required this.api,
      required this.user,
      required this.onLogout,
      this.onLogoutAll});

  final ApiClient api;
  final AppUser user;
  final Future<void> Function() onLogout;
  final Future<void> Function()? onLogoutAll;

  @override
  Widget build(BuildContext context) {
    return RoleBottomNavScaffold(
      user: user,
      onLogout: onLogout,
      onLogoutAll: onLogoutAll,
      tabs: [
        BottomNavTab(
            label: 'Dasbor',
            icon: Icons.dashboard,
            page: AdminDashboardPage(api: api)),
        BottomNavTab(
            label: 'Laporan',
            icon: Icons.bar_chart_outlined,
            page: AdminReportsPage(api: api)),
        BottomNavTab(
            label: 'Verifikasi',
            icon: Icons.payments,
            page: AdminPaymentsPage(api: api)),
        BottomNavTab(
          label: 'Lainnya',
          icon: Icons.more_horiz,
          page: MoreMenuPage(title: 'Lainnya', entries: [
            MoreMenuEntry(
                icon: Icons.mail_outline,
                title: 'Undangan instruktur',
                desc: 'Buat dan pantau undangan.',
                page: AdminInvitationsPage(api: api)),
            MoreMenuEntry(
                icon: Icons.person,
                title: 'Profil Saya',
                desc: 'Lihat dan ubah data diri.',
                page: ProfilePage(api: api)),
          ]),
        ),
      ],
    );
  }
}
