import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:aristoteles_app/features/auth/auth_scaffold.dart';
import 'package:aristoteles_app/features/auth/auth_widgets.dart';
import 'package:aristoteles_app/widgets/app_logo.dart';
import 'package:aristoteles_app/widgets/auth_background.dart';

/// Uji tampilan auth baru: gradien + logo + kartu form + field melengkung.
void main() {
  testWidgets('AuthScaffold: logo, judul, dan kartu form tampil',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: AuthScaffold(
        title: 'Masuk',
        subtitle: 'Subjudul',
        badge: 'Akun Peserta',
        children: [Text('isi-form')],
      ),
    ));
    expect(find.byType(AuthBackground), findsOneWidget);
    expect(find.byType(Image), findsOneWidget);
    expect(find.text('ARISTOTELES'), findsOneWidget);
    expect(find.text('AKUN PESERTA'), findsOneWidget);
    expect(find.text('Masuk'), findsOneWidget);
    expect(find.text('isi-form'), findsOneWidget);
  });

  testWidgets('SplashGate loading: logo + indikator di atas gradien',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(
        body: AuthBackground(
          child: Center(child: AppLogo()),
        ),
      ),
    ));
    expect(find.byType(AuthBackground), findsOneWidget);
    expect(find.text('Aristoteles'), findsOneWidget);
  });

  test('skor kekuatan sandi: 4 kriteria bertahap', () {
    expect(passwordStrengthScore('pendek'), lessThan(2));
    expect(passwordStrengthScore('abcdefgh'), 1);
    expect(passwordStrengthScore('Abcdefgh'), 2);
    expect(passwordStrengthScore('Abcdefg1'), 3);
    expect(passwordStrengthScore('Abcdefg1!'), 4);
    expect(passwordStrengthLabel(0), 'Lemah');
    expect(passwordStrengthLabel(4), 'Sangat kuat');
  });
}
