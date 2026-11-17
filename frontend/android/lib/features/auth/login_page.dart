import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/session.dart';
import '../../theme/app_tokens.dart';
import '../../widgets/google_g_icon.dart';
import 'auth_scaffold.dart';
import 'auth_widgets.dart';

/// Masuk dengan email + password (sama kontrak dengan web).
/// Tampilan mengikuti mockup: badge peran, kartu form putih, CTA panah,
/// SSO (segera hadir — jujur, tanpa sukses palsu), tautan daftar, footnote.
class LoginPage extends StatefulWidget {
  const LoginPage(
      {super.key, required this.session, required this.onRegister, required this.onForgot});

  final SessionManager session;
  final VoidCallback onRegister;
  final VoidCallback onForgot;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  bool _rememberMe = true;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _error = null);
    try {
      await widget.session.login(
        email: _email.text,
        password: _password.text,
        rememberMe: _rememberMe,
      );
    } on ApiException catch (e) {
      setState(() => _error = friendlyAuthError(e));
    }
  }

  void _ssoUnavailable() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
            'Masuk SSO kampus belum tersedia — gunakan email & kata sandi.'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      badge: 'Akun Peserta & Akademisi',
      title: 'Selamat Datang Kembali',
      subtitle: 'Masuk untuk melanjutkan riset dan pembelajaran Anda',
      children: [
        if (_error != null) ...[
          AuthErrorBanner(message: _error!, onRetry: _submit),
          const SizedBox(height: AppSpacing.lg),
        ],
        Form(
          key: _formKey,
          child: Column(
            children: [
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                decoration: authFieldDecoration(
                  label: 'Email Universitas / Pribadi',
                  prefixIcon: const Icon(Icons.mail_outlined),
                ),
                validator: (v) =>
                    (v == null || !v.contains('@')) ? 'Email tidak valid.' : null,
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _password,
                obscureText: _obscure,
                autofillHints: const [AutofillHints.password],
                decoration: authFieldDecoration(
                  label: 'Kata Sandi',
                  prefixIcon: const Icon(Icons.lock_outlined),
                  suffixIcon: IconButton(
                    tooltip: _obscure ? 'Tampilkan' : 'Sembunyikan',
                    icon: Icon(_obscure ? Icons.visibility : Icons.visibility_off),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Kata sandi wajib diisi.' : null,
              ),
              Row(
                children: [
                  Checkbox(
                    value: _rememberMe,
                    activeColor: AppColors.primary,
                    onChanged: (v) =>
                        setState(() => _rememberMe = v ?? true),
                  ),
                  const Text('Ingat Saya'),
                  const Spacer(),
                  TextButton(
                    style: TextButton.styleFrom(
                      minimumSize: const Size(64, 48),
                    ),
                    onPressed: widget.onForgot,
                    child: const Text('Lupa Kata Sandi?'),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              AnimatedBuilder(
                animation: widget.session,
                builder: (context, _) => AuthPrimaryButton(
                  label: 'Masuk ke Akun',
                  busy: widget.session.busy,
                  onPressed: _submit,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Expanded(child: Divider(color: AppColors.divider)),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: AppSpacing.md),
                    child: Text('ATAU MASUK DENGAN SSO KAMPUS',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.8,
                            color: AppColors.muted)),
                  ),
                  Expanded(child: Divider(color: AppColors.divider)),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              OutlinedButton.icon(
                onPressed: _ssoUnavailable,
                icon: const GoogleGIcon(size: 18),
                label: const Text('Masuk dengan Akun Google Kampus'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  foregroundColor: Colors.black87,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              OutlinedButton.icon(
                onPressed: _ssoUnavailable,
                icon: const Icon(Icons.account_balance_outlined,
                    color: AppColors.primary),
                label: const Text('SSO Universitas Terintegrasi'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  foregroundColor: Colors.black87,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('Belum memiliki akun?',
                style: TextStyle(color: AppColors.muted, fontSize: 13)),
            TextButton(
              style: TextButton.styleFrom(
                minimumSize: const Size(64, 48),
              ),
              onPressed: widget.onRegister,
              child: const Text('Daftar Sekarang'),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.verified_user_outlined,
                size: 14, color: AppColors.primary),
            SizedBox(width: AppSpacing.xs),
            Text('Koneksi Terenkripsi 256-bit SSL',
                style: TextStyle(color: AppColors.muted, fontSize: 12)),
          ],
        ),
      ],
    );
  }
}
