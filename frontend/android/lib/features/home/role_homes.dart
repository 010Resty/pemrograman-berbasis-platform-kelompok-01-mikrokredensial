import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/models.dart';
import '../activity/activity_page.dart';
import '../admin/admin_dashboard_page.dart';
import '../admin/admin_pages.dart';
import '../admin/admin_reports_page.dart';
import '../catalog/catalog_page.dart';
import '../catalog/kursusku_page.dart';
import '../instructor/inst_certificates_page.dart';
import '../instructor/instructor_courses_page.dart';
import '../instructor/review_queue_page.dart';
import '../profile/profile_page.dart';
import 'role_home.dart';
import 'student_dashboard.dart';
import 'student_top_bar.dart';

/// Beranda peserta: 5 tab ala mockup (Beranda, Jelajahi, Kursus Saya,
/// Aktivitas, Profil). Header TopAppBar + bell/dot + avatar.
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
      headerBuilder: (goToTab) => StudentTopBar(
        api: api,
        user: user,
        subtitle: 'Microcredentials',
        onOpenTab: goToTab,
        bellTabIndex: 3,
        profileTabIndex: 4,
      ),
      tabsBuilder: (goToTab) => [
        BottomNavTab(
            label: 'Beranda',
            icon: Icons.home,
            page: StudentDashboard(
                api: api, user: user, onOpenTab: goToTab)),
        BottomNavTab(
            label: 'Jelajahi',
            icon: Icons.explore,
            page: CatalogPage(api: api, showAppBar: false)),
        BottomNavTab(
            label: 'Kursus Saya',
            icon: Icons.menu_book,
            page: KursuskuPage(api: api, showAppBar: false)),
        BottomNavTab(
            label: 'Aktivitas',
            icon: Icons.timeline,
            page: ActivityPage(api: api, showAppBar: false)),
        BottomNavTab(
            label: 'Profil',
            icon: Icons.account_circle,
            page: ProfilePage(
                api: api,
                showAppBar: false,
                onLogout: onLogout,
                onLogoutAll: onLogoutAll)),
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
      headerBuilder: (goToTab) => StudentTopBar(
        api: api,
        user: user,
        subtitle: 'Portal Instruktur',
        onLogout: onLogout,
        onLogoutAll: onLogoutAll,
      ),
      tabsBuilder: (goToTab) => [
        BottomNavTab(
            label: 'Kursusku',
            icon: Icons.book,
            page: InstructorCoursesPage(api: api, showAppBar: false)),
        BottomNavTab(
            label: 'Penilaian',
            icon: Icons.fact_check,
            page: ReviewQueuePage(api: api, showAppBar: false)),
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
                page: ProfilePage(
                    api: api,
                    onLogout: onLogout,
                    onLogoutAll: onLogoutAll)),
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
      headerBuilder: (goToTab) => StudentTopBar(
        api: api,
        user: user,
        subtitle: 'Portal Admin',
        onLogout: onLogout,
        onLogoutAll: onLogoutAll,
      ),
      tabsBuilder: (goToTab) => [
        BottomNavTab(
            label: 'Dasbor',
            icon: Icons.dashboard,
            page: AdminDashboardPage(api: api, showAppBar: false)),
        BottomNavTab(
            label: 'Laporan',
            icon: Icons.bar_chart_outlined,
            page: AdminReportsPage(api: api, showAppBar: false)),
        BottomNavTab(
            label: 'Verifikasi',
            icon: Icons.payments,
            page: AdminPaymentsPage(api: api, showAppBar: false)),
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
                page: ProfilePage(
                    api: api,
                    onLogout: onLogout,
                    onLogoutAll: onLogoutAll)),
          ]),
        ),
      ],
    );
  }
}
