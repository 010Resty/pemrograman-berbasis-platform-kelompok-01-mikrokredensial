import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:aristoteles_app/widgets/app_logo.dart';

/// Uji widget logo: judul + subjudul tampil, ukuran mengikuti varian.
void main() {
  testWidgets('AppLogo menampilkan gambar + wordmark', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: AppLogo()),
    ));
    expect(find.byType(Image), findsOneWidget);
    expect(find.text('Aristoteles'), findsOneWidget);
    expect(find.text('Platform Mikrokredensial'), findsOneWidget);
  });

  testWidgets('showText false menyembunyikan wordmark', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: AppLogo(showText: false)),
    ));
    expect(find.byType(Image), findsOneWidget);
    expect(find.text('Aristoteles'), findsNothing);
  });
}
