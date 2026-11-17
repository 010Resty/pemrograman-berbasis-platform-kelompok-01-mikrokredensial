import 'package:flutter/material.dart';

/// Design tokens ARISTOTELES — satu sumber kebenaran visual.
/// Biru primer #004AC6, tinta navy #0B1C30, netral gray, putih.
/// Semua warna/radius/spacing/tipe harus memakai token ini,
/// bukan hardcode `Color(0x...)` / `EdgeInsets` acak per file.
abstract final class AppColors {
  static const Color primary = Color(0xFF004AC6);
  static const Color primaryContainer = Color(0xFF2563EB);
  static const Color primarySoft = Color(0xFFE5EEFF);
  static const Color primaryBorder = Color(0xFFDCE9FF);
  static const Color focusBorder = Color(0xFF004AC6);

  static const Color ink = Color(0xFF0B1C30);
  static const Color inkSecondary = Color(0xFF434655);

  static const Color heroEnd = Color(0xFFEAF1FE);

  static const Color success = Color(0xFF059669);
  static const Color successSoft = Color(0xFFD1FAE6);

  static const Color warning = Color(0xFFD97706);
  static const Color warningSoft = Color(0xFFFEF3C7);

  static const Color info = Color(0xFF4F46E5);
  static const Color infoSoft = Color(0xFFE0E7FF);

  static const Color purple = Color(0xFF7C3AED);
  static const Color purpleSoft = Color(0xFFEDE9FE);

  static const Color rose = Color(0xFFE11D48);
  static const Color roseSoft = Color(0xFFFFE4E6);

  static Color get border => Colors.grey.shade300.withValues(alpha: 0.7);
  static Color get divider => Colors.grey.shade200;
  // Hex tetap agar bisa dipakai di `const TextStyle` (aksesibilitas:
  // abu minimal grey-700 untuk teks kecil).
  static const Color muted = Color(0xFF616161);
  static const Color mutedSoft = Color(0xFF757575);
}

abstract final class AppRadius {
  static const double xs = 8;
  static const double sm = 10;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double pill = 999;
}

abstract final class AppSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;
}

abstract final class AppText {
  static const TextStyle display = TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.3,
    color: AppColors.ink,
  );
  static const TextStyle title = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.2,
    color: AppColors.ink,
  );
  static const TextStyle section = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w700,
    color: AppColors.ink,
  );
  static const TextStyle body = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: AppColors.ink,
  );
  static const TextStyle bodyStrong = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: AppColors.ink,
  );
  static const TextStyle caption = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    color: AppColors.inkSecondary,
  );
  static const TextStyle small = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    color: AppColors.muted,
  );
  static const TextStyle badge = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w700,
    color: AppColors.primary,
  );
}

/// Shadow standar: kartu hampir flat + glow biru lembut untuk hero.
abstract final class AppShadows {
  static List<BoxShadow> get card => [
        BoxShadow(
          color: AppColors.primary.withValues(alpha: 0.04),
          blurRadius: 12,
          offset: const Offset(0, 2),
        ),
      ];
  static List<BoxShadow> get hero => [
        BoxShadow(
          color: AppColors.primary.withValues(alpha: 0.06),
          blurRadius: 12,
          offset: const Offset(0, 4),
        ),
      ];
  static List<BoxShadow> get topBar => [
        const BoxShadow(
          color: Color(0x0D000000),
          blurRadius: 4,
          offset: Offset(0, 1),
        ),
      ];
  static List<BoxShadow> get navUp => [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.06),
          blurRadius: 12,
          offset: const Offset(0, -4),
        ),
      ];
}
