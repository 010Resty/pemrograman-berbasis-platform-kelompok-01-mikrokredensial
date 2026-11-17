import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Ikon "G" Google multicolor (digambar manual agar tanpa dependensi baru).
class GoogleGIcon extends StatelessWidget {
  const GoogleGIcon({super.key, this.size = 18});

  final double size;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size.square(size),
      painter: _GoogleGPainter(),
    );
  }
}

class _GoogleGPainter extends CustomPainter {
  static const _blue = Color(0xFF4285F4);
  static const _green = Color(0xFF34A853);
  static const _yellow = Color(0xFFFBBC05);
  static const _red = Color(0xFFEA4335);

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 24;
    canvas.save();
    canvas.scale(s);
    const stroke = 3.6;
    final c = const Offset(12, 12);

    void arc(Color color, double startDeg, double sweepDeg) {
      canvas.drawArc(
        Rect.fromCircle(center: c, radius: 8.2),
        startDeg * math.pi / 180,
        sweepDeg * math.pi / 180,
        false,
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..strokeCap = StrokeCap.butt,
      );
    }

    // Urutan lapis: biru (mayoritas) → hijau → kuning sebagai dasar.
    arc(_blue, -58, 236);
    arc(_green, 178, 100);
    arc(_yellow, 278, 24);

    // Bilah merah horizontal (khas "G" Google).
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(12, 10.2, 8.6, 3.6),
        const Radius.circular(1.8),
      ),
      Paint()..color = _red,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
