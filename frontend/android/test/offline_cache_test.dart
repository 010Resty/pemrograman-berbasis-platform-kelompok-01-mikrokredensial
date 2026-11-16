import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:aristoteles_app/core/offline_cache.dart';

/// Uji cache offline (direktori temp, tanpa path_provider).
void main() {
  late Directory temp;
  late OfflineCache cache;

  setUp(() async {
    temp = await Directory.systemTemp.createTemp('offline_cache_test');
    cache = OfflineCache(directoryOverride: temp.path);
  });

  tearDown(() async {
    try {
      await temp.delete(recursive: true);
    } catch (_) {
      // abaikan
    }
  });

  test('simpan → baca kembali dengan data utuh', () async {
    await cache.saveJson('kunci', {
      'a': 1,
      'b': ['x', 'y']
    });
    final got = await cache.readJson('kunci', const Duration(minutes: 5));
    expect(got, isNotNull);
    final data = (got!.data as Map).cast<String, Object?>();
    expect(data['a'], 1);
  });

  test('kunci basi → null', () async {
    await cache.saveJson('basi', {'a': 1});
    final got = await cache.readJson('basi', Duration.zero);
    expect(got, isNull);
  });

  test('kunci hilang → null', () async {
    expect(await cache.readJson('tak-ada', const Duration(minutes: 5)),
        isNull);
  });

  test('clearAll menghapus semua kunci', () async {
    await cache.saveJson('satu', {'a': 1});
    await cache.saveJson('dua', {'b': 2});
    await cache.clearAll();
    expect(
        await cache.readJson('satu', const Duration(minutes: 5)), isNull);
    expect(await cache.readJson('dua', const Duration(minutes: 5)), isNull);
  });
}
