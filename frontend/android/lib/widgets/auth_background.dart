import 'package:flutter/material.dart';

import '../theme/app_tokens.dart';

/// Latar akademik terang (cermin mockup login/register):
/// dasar #F8F9FF + mesh gradien biru + lapisan titik + bercak ambient.
/// Tanpa dependensi baru — murni [CustomPainter].
class AuthBackground extends StatelessWidget {
  const AuthBackground({super.key, required this.child});

  final Widget child;

  static const Color paper = Color(0xFFFFFFFF);
  static Color get primary => AppColors.primary;
  static Color get primaryContainer => AppColors.primaryContainer;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: paper,
      child: Stack(
        children: [
          const Positioned.fill(
            child: CustomPaint(painter: _AcademicPainter()),
          ),
          child,
        ],
      ),
    );
  }
}

class _AcademicPainter extends CustomPainter {
  const _AcademicPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // Mesh gradien: lingkaran biru sangat lembut.
    void glow(Offset c, double r, Color color, double opacity) {
      final paint = Paint()
        ..shader = RadialGradient(
          colors: [
            color.withValues(alpha: opacity),
            color.withValues(alpha: 0),
          ],
        ).createShader(Rect.fromCircle(center: c, radius: r));
      canvas.drawCircle(c, r, paint);
    }

    glow(Offset(w * 0.5, -h * 0.04), w * 0.55, AppColors.primaryContainer, 0.10);
    glow(Offset(-w * 0.12, h * 0.18), w * 0.30, AppColors.primaryContainer, 0.07);
    glow(Offset(w * 1.05, h * 0.22), w * 0.32, AppColors.primaryBorder, 0.25);
    glow(Offset(w * 0.5, h * 0.72), w * 0.45, AppColors.primaryBorder, 0.12);
    glow(Offset(w * 0.9, h * 1.02), w * 0.35, AppColors.primaryContainer, 0.06);

    // Lapisan titik konstelasi (grid 18px, titik 1px).
    final dot = Paint()..color = AppColors.primary.withValues(alpha: 0.10);
    const step = 18.0;
    for (double y = step / 2; y < h; y += step) {
      for (double x = step / 2; x < w; x += step) {
        canvas.drawCircle(Offset(x, y), 1, dot);
      }
    }

    // Bercak kecil pemanis.
    final speck = Paint()
      ..color = AppColors.primary.withValues(alpha: 0.18);
    canvas.drawCircle(Offset(w * 0.14, h * 0.09), 4, speck);
    canvas.drawCircle(Offset(w * 0.86, h * 0.13), 3, speck);
    canvas.drawCircle(Offset(w * 0.08, h * 0.42), 3, speck);
    canvas.drawCircle(Offset(w * 0.92, h * 0.48), 4, speck);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
