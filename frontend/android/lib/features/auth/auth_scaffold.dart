import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/session.dart';

/// Gerbang root: tanpa sesi valid, paksa ke Login (tanpa rute publik).
class SplashGate extends StatelessWidget {
  const SplashGate({
    super.key,
    required this.session,
    required this.onAuthenticated,
    required this.onUnauthenticated,
  });

  final SessionManager session;
  final Widget Function() onAuthenticated;
  final Widget Function() onUnauthenticated;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: session,
      builder: (context, _) {
        if (!session.ready) {
          return const Scaffold(
            body: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.school, size: 56),
                  SizedBox(height: 16),
                  Text('ARISTOTELES',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20)),
                  SizedBox(height: 16),
                  CircularProgressIndicator(),
                ],
              ),
            ),
          );
        }
        if (session.loggedIn) return onAuthenticated();
        return onUnauthenticated();
      },
    );
  }
}

/// Skeleton halaman auth (logo + judul + form).
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    super.key,
    required this.title,
    required this.subtitle,
    required this.children,
  });

  final String title;
  final String subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.school, size: 48),
                  const SizedBox(height: 12),
                  Text('ARISTOTELES',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 4),
                  Text(title,
                      textAlign: TextAlign.center,
                      style: Theme.of(context)
                          .textTheme
                          .headlineSmall
                          ?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text(subtitle,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 24),
                  ...children,
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Pesan galat backend yang ramah, termasuk kode EMAIL_UNVERIFIED.
String friendlyAuthError(ApiException e) {
  if (e.code == 'EMAIL_UNVERIFIED') {
    return 'Email belum diverifikasi. Masukkan kode OTP yang dikirim ke email Anda.';
  }
  return e.message;
}
