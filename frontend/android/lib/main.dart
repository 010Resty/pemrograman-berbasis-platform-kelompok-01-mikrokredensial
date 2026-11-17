import 'package:flutter/material.dart';

import 'core/api_client.dart';
import 'core/auth_api.dart';
import 'core/offline_cache.dart';
import 'core/session.dart';
import 'features/auth/auth_scaffold.dart';
import 'features/auth/login_page.dart';
import 'features/auth/password_pages.dart';
import 'features/auth/register_page.dart';
import 'features/auth/verify_email_page.dart';
import 'features/home/home_router.dart';
import 'theme/app_theme.dart';

/// ARISTOTELES Android — login-first, tanpa rute publik.
///
/// Navigasi dikelola satu [Navigator] dengan tumpukan layar auth.
/// Setelah sesi valid, [SplashGate]/[HomeRouter] mengambil alih.
void main() {
  // Token provider diikat ke sesi (late-binding): ApiClient butuh sesi
  // untuk header Authorization, sesi butuh ApiClient untuk AuthApi —
  // holder ini memutus ketergantungan sirkularnya. Tanpa ini TIDAK ADA
  // request ber-token yang membawa header (login sukses lalu langsung
  // logout oleh 401 + refresh yang terbakar sia-sia).
  SessionManager? sessionHolder;
  final api = ApiClient(tokenProvider: () => sessionHolder?.accessToken);
  final session = SessionManager(authApi: AuthApi(api));
  sessionHolder = session;
  api.onUnauthorized = () => session.clear();
  // 401 → coba rotasi refresh token dulu (single-flight); hanya bila gagal
  // sesi dibersihkan dan pengguna diarahkan ke login.
  api.onRefreshNeeded = () => session.refreshNow();
  runApp(AristotelesApp(session: session, authApi: AuthApi(api), api: api));
}

class AristotelesApp extends StatefulWidget {
  const AristotelesApp(
      {super.key, required this.session, required this.authApi, required this.api});

  final SessionManager session;
  final ApiClient api;
  final AuthApi authApi;

  @override
  State<AristotelesApp> createState() => _AristotelesAppState();
}

enum _AuthRoute { login, register, verify, forgot, reset }

class _AristotelesAppState extends State<AristotelesApp> {
  _AuthRoute _route = _AuthRoute.login;
  String _pendingEmail = '';

  @override
  void initState() {
    super.initState();
    widget.session.bootstrap();
  }

  void _go(_AuthRoute route) => setState(() => _route = route);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ARISTOTELES',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: SplashGate(
        session: widget.session,
        onAuthenticated: () => HomeRouter(
          user: widget.session.user!,
          api: widget.api,
          // Cache offline milik akun dihapus agar data tak tertinggal.
          onLogout: () async {
            await OfflineCache().clearAll();
            await widget.session.logout();
          },
          onLogoutAll: () async {
            await OfflineCache().clearAll();
            await widget.session.logout(allDevices: true);
          },
        ),
        onUnauthenticated: () => _authScreen(),
      ),
    );
  }

  Widget _authScreen() {
    switch (_route) {
      case _AuthRoute.login:
        return LoginPage(
          session: widget.session,
          onRegister: () => _go(_AuthRoute.register),
          onForgot: () => _go(_AuthRoute.forgot),
        );
      case _AuthRoute.register:
        return RegisterPage(
          authApi: widget.authApi,
          onRegistered: (email) {
            _pendingEmail = email;
            _go(_AuthRoute.verify);
          },
          onLogin: () => _go(_AuthRoute.login),
        );
      case _AuthRoute.verify:
        return VerifyEmailPage(
          authApi: widget.authApi,
          session: widget.session,
          email: _pendingEmail,
        );
      case _AuthRoute.forgot:
        return ForgotPasswordPage(
          authApi: widget.authApi,
          onCodeSent: (email) {
            _pendingEmail = email;
            _go(_AuthRoute.reset);
          },
        );
      case _AuthRoute.reset:
        return ResetPasswordPage(
            authApi: widget.authApi, email: _pendingEmail);
    }
  }
}
