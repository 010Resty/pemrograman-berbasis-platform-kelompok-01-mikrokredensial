import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_client.dart';
import 'auth_api.dart';
import 'models.dart';

/// Sesi aplikasi: access token di memori, refresh token di secure storage.
/// Login-first: tidak ada sesi valid = wajib ke halaman login.
class SessionManager extends ChangeNotifier {
  SessionManager({required AuthApi authApi, FlutterSecureStorage? storage})
      : _auth = authApi,
        _storage = storage ?? const FlutterSecureStorage();

  static const _kAccess = 'access_token';
  static const _kRefresh = 'refresh_token';
  static const _kUser = 'session_user';

  final AuthApi _auth;
  final FlutterSecureStorage _storage;

  String? _accessToken;
  AppUser? _user;
  bool _ready = false;
  bool _busy = false;

  bool get ready => _ready;
  bool get busy => _busy;
  bool get loggedIn => _user != null && _accessToken != null;
  AppUser? get user => _user;
  String? get accessToken => _accessToken;

  void _setBusy(bool v) {
    _busy = v;
    notifyListeners();
  }

  /// Dipanggil sekali saat splash: coba hidupkan sesi dari refresh token.
  /// Gagal = tetap loggedOut (pengguna diarahkan ke login).
  Future<void> bootstrap() async {
    _setBusy(true);
    try {
      final refresh = await _storage.read(key: _kRefresh);
      if (refresh == null || refresh.isEmpty) return;
      final payload = await _auth.refresh(refresh);
      await _applyPayload(payload);
    } on ApiException {
      await clear();
    } finally {
      _ready = true;
      _setBusy(false);
    }
  }

  Future<void> login({required String email, required String password}) async {
    _setBusy(true);
    try {
      final payload = await _auth.login(email: email.trim(), password: password);
      await _applyPayload(payload);
    } finally {
      _setBusy(false);
    }
  }

  /// Terapkan pasangan sesi yang sudah ada (mis. hasil verifikasi OTP).
  Future<void> loginWithPayload(AuthPayload payload) async {
    _setBusy(true);
    try {
      await _applyPayload(payload);
    } finally {
      _setBusy(false);
    }
  }

  Future<void> logout({bool allDevices = false}) async {
    final refresh = await _storage.read(key: _kRefresh);
    try {
      if (allDevices) {
        await _auth.logout();
      } else if (refresh != null) {
        await _auth.logout(refreshToken: refresh);
      }
    } on ApiException {
      // Logout lokal tetap jalan walau server gagal dihubungi.
    }
    await clear();
  }

  /// Paksa rotasi manual (dipakai bila API mengembalikan 401).
  Future<bool> refreshNow() async {
    final refresh = await _storage.read(key: _kRefresh);
    if (refresh == null || refresh.isEmpty) {
      await clear();
      return false;
    }
    try {
      final payload = await _auth.refresh(refresh);
      await _applyPayload(payload);
      return true;
    } on ApiException {
      await clear();
      return false;
    }
  }

  Future<void> _applyPayload(AuthPayload payload) async {
    _accessToken = payload.accessToken;
    _user = payload.user;
    if (payload.refreshToken != null && payload.refreshToken!.isNotEmpty) {
      await _storage.write(key: _kRefresh, value: payload.refreshToken);
    }
    await _storage.write(key: _kUser, value: jsonEncode(payload.user.toJson()));
    notifyListeners();
  }

  Future<void> clear() async {
    _accessToken = null;
    _user = null;
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
    await _storage.delete(key: _kUser);
    notifyListeners();
  }
}
