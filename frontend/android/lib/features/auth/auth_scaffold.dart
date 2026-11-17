import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/session.dart';
import '../../theme/app_tokens.dart';
import '../../widgets/app_logo.dart';
import '../../widgets/auth_background.dart';

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
            body: AuthBackground(
              child: SafeArea(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      AppLogo(size: AppLogoSize.xl),
                      SizedBox(height: AppSpacing.xxl),
                      CircularProgressIndicator(),
                    ],
                  ),
                ),
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

/// Skeleton halaman auth ala mockup: logo halo + badge peran + kartu form
/// putih di atas latar akademik terang. Dipakai semua halaman auth.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    super.key,
    required this.title,
    required this.subtitle,
    required this.children,
    this.badge,
  });

  final String title;
  final String subtitle;
  final List<Widget> children;

  /// Chip peran di bawah brand (mis. "Akun Peserta & Akademisi").
  final String? badge;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AuthBackground.paper,
      body: AuthBackground(
        child: SafeArea(
          child: Column(
            children: [
              const SizedBox(height: AppSpacing.md),
              // Logo resmi dengan halo aksen (cermin mockup).
              Center(
                child: Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        AppColors.primary,
                        AppColors.primaryContainer,
                        Color(0xFFB2C9FE),
                      ],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.25),
                        blurRadius: 18,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white,
                    ),
                    child: ClipOval(
                      child: Image.asset(
                        AppLogo.imagePath,
                        width: 76,
                        height: 76,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              const Text('ARISTOTELES',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.5,
                      color: AppColors.primary)),
              const Text('Laboratorium Riset & Microcredential AI Terapan',
                  textAlign: TextAlign.center, style: AppText.small),
              if (badge != null) ...[
                const SizedBox(height: AppSpacing.md),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md,
                      vertical: AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    border:
                        Border.all(color: AppColors.primaryBorder),
                    borderRadius:
                        BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.primaryContainer,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Text(badge!.toUpperCase(),
                          style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.6,
                              color: AppColors.primary)),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
              Expanded(
                child: Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(AppRadius.xl),
                      topRight: Radius.circular(AppRadius.xl),
                    ),
                    border: Border.all(color: AppColors.border),
                    boxShadow: AppShadows.card,
                  ),
                  child: SingleChildScrollView(
                    padding: EdgeInsets.fromLTRB(
                      AppSpacing.xl,
                      AppSpacing.xl,
                      AppSpacing.xl,
                      AppSpacing.xl +
                          MediaQuery.of(context).padding.bottom +
                          AppSpacing.md,
                    ),
                    child: Center(
                      child: ConstrainedBox(
                        constraints:
                            const BoxConstraints(maxWidth: 420),
                        child: Column(
                          crossAxisAlignment:
                              CrossAxisAlignment.stretch,
                          children: [
                            Text(title,
                                textAlign: TextAlign.left,
                                style: AppText.display),
                            const SizedBox(height: AppSpacing.xs),
                            Text(subtitle, style: AppText.caption),
                            const SizedBox(height: AppSpacing.xl),
                            ...children,
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
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
