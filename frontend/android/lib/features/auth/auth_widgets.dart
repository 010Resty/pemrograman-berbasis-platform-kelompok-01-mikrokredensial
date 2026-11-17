import 'package:flutter/material.dart';

import '../../theme/app_tokens.dart';

/// Kolom error jujur: tampilkan pesan backend apa adanya + tombol coba lagi.
class AuthErrorBanner extends StatelessWidget {
  const AuthErrorBanner({super.key, required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Colors.red.shade300),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline,
              size: 20, color: Colors.red),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: Text(message, style: AppText.body)),
          if (onRetry != null)
            IconButton(
              tooltip: 'Coba lagi',
              icon: const Icon(Icons.refresh, size: 20),
              onPressed: onRetry,
            ),
        ],
      ),
    );
  }
}

/// Dekorasi field auth bersama: radius melengkung, isian lembut,
/// border fokus biru. Satu tempat agar login/register/OTP konsisten.
InputDecoration authFieldDecoration({
  required String label,
  Widget? prefixIcon,
  Widget? suffixIcon,
  String? counterText,
}) {
  const radius = BorderRadius.all(Radius.circular(AppRadius.lg));
  OutlineInputBorder side(Color color, [double width = 1.2]) =>
      OutlineInputBorder(
          borderRadius: radius,
          borderSide: BorderSide(color: color, width: width));
  return InputDecoration(
    labelText: label,
    filled: true,
    fillColor: Colors.white,
    prefixIcon: prefixIcon,
    suffixIcon: suffixIcon,
    counterText: counterText,
    contentPadding:
        const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
    border: side(Colors.grey.shade300),
    enabledBorder: side(Colors.grey.shade300),
    focusedBorder: side(AppColors.focusBorder, 1.8),
    errorBorder: side(Colors.red.shade400),
    focusedErrorBorder: side(Colors.red.shade600, 1.8),
  );
}

/// Skor kekuatan kata sandi 0..4 murni-fungsi (mudah diuji):
/// +1 panjang ≥8, +1 huruf besar+kecil, +1 angka, +1 simbol.
int passwordStrengthScore(String value) {
  var score = 0;
  if (value.length >= 8) score++;
  if (RegExp(r'[A-Z]').hasMatch(value) && RegExp(r'[a-z]').hasMatch(value)) {
    score++;
  }
  if (RegExp(r'[0-9]').hasMatch(value)) score++;
  if (RegExp(r'[^A-Za-z0-9]').hasMatch(value)) score++;
  return score;
}

String passwordStrengthLabel(int score) => switch (score) {
      0 || 1 => 'Lemah',
      2 => 'Cukup',
      3 => 'Kuat',
      _ => 'Sangat kuat',
    };

/// Bilah 4 segmen + label kekuatan sandi (cermin mockup register).
class PasswordStrengthMeter extends StatelessWidget {
  const PasswordStrengthMeter({super.key, required this.password});

  final String password;

  @override
  Widget build(BuildContext context) {
    final score = passwordStrengthScore(password);
    const active = AppColors.primary;
    final idle = Colors.grey.shade300;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            for (var i = 0; i < 4; i++)
              Expanded(
                child: Container(
                  height: 6,
                  margin: EdgeInsets.only(
                      right: i < 3 ? AppSpacing.sm : 0),
                  decoration: BoxDecoration(
                    color: i < score ? active : idle,
                    borderRadius:
                        BorderRadius.circular(AppRadius.pill),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Kekuatan Sandi: ${passwordStrengthLabel(score)}',
          style: AppText.small,
        ),
      ],
    );
  }
}

/// Tombol utama dengan status sibuk bawaan.
class AuthPrimaryButton extends StatelessWidget {
  const AuthPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    required this.busy,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: busy ? null : onPressed,
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
      ),
      child: busy
          ? const SizedBox.square(
              dimension: 20,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
            )
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(label),
                const SizedBox(width: AppSpacing.sm),
                const Icon(Icons.arrow_forward, size: 18),
              ],
            ),
    );
  }
}
