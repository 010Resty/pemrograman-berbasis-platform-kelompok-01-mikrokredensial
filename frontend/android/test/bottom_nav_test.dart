import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:aristoteles_app/core/models.dart';
import 'package:aristoteles_app/features/home/role_home.dart';

AppUser _user() => AppUser(
      id: 1,
      name: 'Uji',
      username: 'uji',
      email: 'u@uji.id',
      role: AppRole.student,
    );

void main() {
  group('RoleBottomNavScaffold', () {
    testWidgets('menampilkan tab + header pengguna, pindah tab tanpa menumpuk route',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: RoleBottomNavScaffold(
          user: _user(),
          onLogout: () async {},
          tabs: const [
            BottomNavTab(label: 'Satu', icon: Icons.home, page: Text('Halaman Satu')),
            BottomNavTab(label: 'Dua', icon: Icons.settings, page: Text('Halaman Dua')),
          ],
        ),
      ));

      expect(find.text('Uji'), findsOneWidget);
      expect(find.text('Halaman Satu'), findsOneWidget);
      expect(find.byType(NavigationBar), findsOneWidget);

      await tester.tap(find.text('Dua'));
      await tester.pumpAndSettle();

      expect(find.text('Halaman Dua'), findsOneWidget);
      // Tetap satu route (tidak push halaman baru saat pindah tab).
      expect(find.byType(RoleBottomNavScaffold), findsOneWidget);
    });

    testWidgets('dialog keluar muncul saat ikon logout ditekan', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: RoleBottomNavScaffold(
          user: _user(),
          onLogout: () async {},
          tabs: const [
            BottomNavTab(label: 'Satu', icon: Icons.home, page: Text('Halaman Satu')),
            BottomNavTab(label: 'Dua', icon: Icons.settings, page: Text('Halaman Dua')),
          ],
        ),
      ));

      await tester.tap(find.byTooltip('Keluar'));
      await tester.pumpAndSettle();
      expect(find.text('Keluar aplikasi?'), findsOneWidget);
    });
  });

  group('MoreMenuPage', () {
    testWidgets('kartu menu membuka halaman via push', (tester) async {
      await tester.pumpWidget(const MaterialApp(
        home: MoreMenuPage(title: 'Lainnya', entries: [
          MoreMenuEntry(
              icon: Icons.verified,
              title: 'Sertifikat',
              desc: 'Unduh PDF.',
              page: Text('Detail Sertifikat')),
        ]),
      ));

      await tester.tap(find.text('Sertifikat'));
      await tester.pumpAndSettle();
      expect(find.text('Detail Sertifikat'), findsOneWidget);
    });
  });
}
