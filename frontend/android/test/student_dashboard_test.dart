import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:aristoteles_app/core/api_client.dart';
import 'package:aristoteles_app/core/models.dart';
import 'package:aristoteles_app/features/home/student_dashboard.dart';

/// Uji smoke Beranda: sapaan + ringkasan + pintasan tampil dari mock.
ApiClient mockClient(Map<String, Object?> Function(Uri url) handler) {
  return ApiClient(
    baseUrl: 'http://uji.invalid/api/v1',
    httpClient: MockClient((req) async {
      final result = handler(req.url);
      return http.Response(jsonEncode(result['json']), result['code'] as int,
          headers: {'content-type': 'application/json'});
    }),
  );
}

Map<String, Object?> ok(Object? data) =>
    {'status': 'success', 'message': 'ok', 'data': data};

AppUser _user() => AppUser(
      id: 1,
      name: 'Budi Santoso',
      username: 'budi',
      email: 'budi@uji.id',
      role: AppRole.student,
    );

void main() {
  ApiClient dashboardApi() => mockClient((url) {
      final path = url.path;
      if (path.endsWith('/me/enrollments')) {
        return {
          'code': 200,
          'json': ok([
            {
              'courseId': 1,
              'title': 'Web Dasar',
              'status': 'active',
              'source': 'free'
            }
          ]),
        };
      }
      if (path.endsWith('/me/progress/summary')) {
        return {
          'code': 200,
          'json': ok({
            'totalCourses': 1,
            'totalMaterials': 10,
            'completedMaterials': 4,
            'percent': 40.0,
          }),
        };
      }
      if (path.endsWith('/me/certificates')) {
        return {
          'code': 200,
          'json': ok([
            {
              'id': 7,
              'code': 'ATS-1',
              'courseTitle': 'Web Dasar',
              'status': 'issued',
              'issuedAt': '2026-11-01T00:00:00Z',
            }
          ]),
        };
      }
      if (path.endsWith('/me/payments')) {
        return {
          'code': 200,
          'json': ok({'items': [], 'total': 0}),
        };
      }
      if (path.endsWith('/courses/1/modules')) {
        return {
          'code': 200,
          'json': ok({'modules': []}),
        };
      }
      if (path == '/api/v1/courses/1') {
        return {
          'code': 200,
          'json': ok({
            'id': 1,
            'title': 'Web Dasar',
            'priceNominal': 0,
            'level': 'Pemula',
          }),
        };
      }
      if (path.endsWith('/courses')) {
        return {
          'code': 200,
          'json': ok([
            {
              'id': 1,
              'title': 'Web Dasar',
              'category': 'Pemrograman',
              'level': 'Pemula',
              'priceNominal': 0,
              'priceLabel': 'GRATIS',
            }
          ]),
        };
      }
      if (path.endsWith('/me/progress')) {
        return {
          'code': 200,
          'json': ok([]),
        };
      }
      return {
        'code': 404,
        'json': {'status': 'error', 'message': '-', 'data': null},
      };
    });

  testWidgets('dashboard: sapaan + ringkasan + lanjut belajar',
      (tester) async {
    // Viewport tinggi agar seluruh ekor ListView (rekomendasi + aktivitas)
    // ikut ter-build di lingkungan uji (SliverList malas di luar cacheExtent).
    tester.view.physicalSize = const Size(800, 2000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
    final api = dashboardApi();
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
          body: StudentDashboard(api: api, user: _user())),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Halo, Budi'), findsOneWidget);
    expect(find.text('Lanjut Belajar'), findsOneWidget);
    expect(find.text('Pintasan Akademik'), findsOneWidget);
    expect(find.text('Rekomendasi Untukmu', skipOffstage: false),
        findsOneWidget);
    expect(find.textContaining('Web Dasar', skipOffstage: false),
        findsWidgets);
  });

  testWidgets('pintasan tab: redirect ke tab, bukan halaman baru', (tester) async {
    tester.view.physicalSize = const Size(800, 2000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
    int? opened;
    final api = dashboardApi();
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
          body: StudentDashboard(
        api: api,
        user: _user(),
        onOpenTab: (i) => opened = i,
      )),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Semua\nKursus'));
    await tester.pumpAndSettle();
    expect(opened, 1);

    await tester.tap(find.text('Kursus\nSaya'));
    await tester.pumpAndSettle();
    expect(opened, 2);
  });
}
