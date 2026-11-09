/// Konfigurasi environment aplikasi Android.
///
/// API base diisi lewat `--dart-define` agar beda per lingkungan:
/// `flutter run --dart-define=API_BASE_URL=https://api.domain.id/api/v1`
/// Default menunjuk backend lokal dari emulator Android
/// (10.0.2.2 = localhost mesin host).
class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000/api/v1',
  );

  static const Duration timeout = Duration(seconds: 15);
}
