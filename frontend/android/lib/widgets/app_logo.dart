import 'package:flutter/material.dart';

import '../theme/app_tokens.dart';

/// Logo ARISTOTELES + wordmark (cermin web `Logo.svelte`).
///
/// Aset: `assets/logo/aristoteleslogo.png` (disalin dari
/// `frontend/web/src/lib/assets/logo/` — tiap platform membundel
/// asetnya sendiri). Ukuran mengikuti skala web
/// (sm/md/lg/xl = 32/40/48/64dp ≈ w-8/10/12/16).
class AppLogo extends StatelessWidget {
  const AppLogo({
    super.key,
    this.size = AppLogoSize.md,
    this.showText = true,
    this.onDark = false,
  });

  final AppLogoSize size;
  final bool showText;
  final bool onDark;

  static const String imagePath = 'assets/logo/aristoteleslogo.png';
  static const String uniraPath = 'assets/logo/unira.jpeg';

  double get _diameter => switch (size) {
        AppLogoSize.sm => 32,
        AppLogoSize.md => 40,
        AppLogoSize.lg => 48,
        AppLogoSize.xl => 64,
      };

  @override
  Widget build(BuildContext context) {
    final titleColor = onDark ? Colors.white : AppColors.ink;
    final subColor = onDark ? AppColors.primaryBorder : AppColors.muted;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: _diameter,
          height: _diameter,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            boxShadow: AppShadows.card,
          ),
          child: ClipOval(
            child: Image.asset(
              imagePath,
              width: _diameter,
              height: _diameter,
              fit: BoxFit.cover,
              errorBuilder: (BuildContext context, Object err, StackTrace? stack) => CircleAvatar(
                radius: _diameter / 2,
                child: Text('A',
                    style: TextStyle(
                        fontSize: _diameter * 0.45,
                        fontWeight: FontWeight.bold)),
              ),
            ),
          ),
        ),
        if (showText) ...[
          const SizedBox(width: AppSpacing.md),
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Aristoteles',
                  style: TextStyle(
                      fontSize: _diameter * 0.42,
                      fontWeight: FontWeight.bold,
                      letterSpacing: -0.5,
                      color: titleColor)),
              Text('Platform Mikrokredensial',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: subColor)),
            ],
          ),
        ],
      ],
    );
  }
}

enum AppLogoSize { sm, md, lg, xl }
