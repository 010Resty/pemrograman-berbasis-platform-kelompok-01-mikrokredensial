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

/// Uji dialog keluar dua mode (kompatibel lama + semua perangkat).
void main() {
  testWidgets('tanpa onLogoutAll: dialog lama 1 opsi', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: RoleBottomNavScaffold(
        user: _user(),
        onLogout: () async {},
        tabs: const [
          BottomNavTab(label: 'Satu', icon: Icons.home, page: Text('A')),
          BottomNavTab(label: 'Dua', icon: Icons.settings, page: Text('B')),
        ],
      ),
    ));

    await tester.tap(find.byTooltip('Keluar'));
    await tester.pumpAndSettle();
    expect(find.text('Keluar aplikasi?'), findsOneWidget);
    expect(find.text('Perangkat ini'), findsNothing);
  });

  testWidgets('dengan onLogoutAll: dialog 3 opsi + konfirmasi', (tester) async {
    var here = 0;
    var all = 0;
    await tester.pumpWidget(MaterialApp(
      home: RoleBottomNavScaffold(
        user: _user(),
        onLogout: () async {
          here++;
        },
        onLogoutAll: () async {
          all++;
        },
        tabs: const [
          BottomNavTab(label: 'Satu', icon: Icons.home, page: Text('A')),
          BottomNavTab(label: 'Dua', icon: Icons.settings, page: Text('B')),
        ],
      ),
    ));

    await tester.tap(find.byTooltip('Keluar'));
    await tester.pumpAndSettle();
    expect(find.text('Perangkat ini'), findsOneWidget);
    expect(find.text('Semua perangkat'), findsOneWidget);

    await tester.tap(find.text('Semua perangkat'));
    await tester.pumpAndSettle();
    expect(find.text('Keluar semua perangkat?'), findsOneWidget);

    await tester.tap(find.text('Ya, semua'));
    await tester.pumpAndSettle();
    expect(all, 1);
    expect(here, 0);
  });
}
