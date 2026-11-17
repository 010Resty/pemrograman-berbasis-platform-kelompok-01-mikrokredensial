import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/auth_api.dart';
import '../../theme/app_tokens.dart';
import '../../widgets/google_g_icon.dart';
import 'auth_scaffold.dart';
import 'auth_widgets.dart';

/// Daftar akun peserta (pendaftaran selalu peran student, K-01).
/// Tampilan mengikuti mockup: kartu bento, meter kekuatan sandi,
/// konfirmasi sandi, persetujuan syarat, info undangan instruktur.
class RegisterPage extends StatefulWidget {
  const RegisterPage(
      {super.key, required this.authApi, required this.onRegistered, required this.onLogin});

  final AuthApi authApi;
  final void Function(String email) onRegistered;
  final VoidCallback onLogin;

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _username = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  bool _obscure = true;
  bool _obscureConfirm = true;
  bool _agree = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _username.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_agree) {
      setState(() => _error =
          'Centang persetujuan Syarat & Ketentuan dulu untuk mendaftar.');
      return;
    }
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.authApi.register(
        name: _name.text.trim(),
        username: _username.text.trim(),
        email: _email.text.trim(),
        password: _password.text,
      );
      if (mounted) widget.onRegistered(_email.text.trim());
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _ssoUnavailable() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
            'Daftar SSO kampus belum tersedia — isi formulir di bawah.'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      badge: 'Registrasi Peserta & Peneliti Mandiri',
      title: 'Daftar Akun Baru',
      subtitle:
          'Mulai perjalanan riset dan sertifikasi microcredential terakreditasi.',
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
                controller: _name,
                decoration: authFieldDecoration(
                  label: 'Nama Lengkap (Sesuai KTP / Ijazah)',
                  prefixIcon: const Icon(Icons.person_outlined),
                ),
                validator: (v) =>
                    (v == null || v.trim().length < 2) ? 'Nama minimal 2 karakter.' : null,
              ),
              const SizedBox(height: AppSpacing.xs),
              const Align(
                alignment: Alignment.centerLeft,
                child: Text('Untuk pencetakan sertifikat resmi ber-QR verification.',
                    style: AppText.small),
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _username,
                decoration: authFieldDecoration(
                  label: 'Username (huruf kecil, angka, titik)',
                  prefixIcon: const Icon(Icons.alternate_email_outlined),
                ),
                validator: (v) =>
                    (v == null || v.trim().length < 3) ? 'Username minimal 3 karakter.' : null,
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: authFieldDecoration(
                  label: 'Email Institusi / Pribadi',
                  prefixIcon: const Icon(Icons.mail_outlined),
                ),
                validator: (v) =>
                    (v == null || !v.contains('@')) ? 'Email tidak valid.' : null,
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _password,
                obscureText: _obscure,
                onChanged: (_) => setState(() {}),
                decoration: authFieldDecoration(
                  label: 'Kata Sandi (min. 8 karakter)',
                  prefixIcon: const Icon(Icons.lock_outlined),
                  suffixIcon: IconButton(
                    icon: Icon(_obscure ? Icons.visibility : Icons.visibility_off),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
                validator: (v) =>
                    (v == null || v.length < 8) ? 'Minimal 8 karakter.' : null,
              ),
              const SizedBox(height: AppSpacing.sm),
              PasswordStrengthMeter(password: _password.text),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _confirm,
                obscureText: _obscureConfirm,
                onChanged: (_) => setState(() {}),
                decoration: authFieldDecoration(
                  label: 'Konfirmasi Kata Sandi',
                  prefixIcon: const Icon(Icons.lock_reset_outlined),
                  suffixIcon: _confirm.text.isNotEmpty &&
                          _confirm.text == _password.text
                      ? const Icon(Icons.check_circle,
                          color: Colors.green)
                      : IconButton(
                          icon: Icon(_obscureConfirm
                              ? Icons.visibility
                              : Icons.visibility_off),
                          onPressed: () => setState(
                              () => _obscureConfirm = !_obscureConfirm),
                        ),
                ),
                validator: (v) => (v != _password.text)
                    ? 'Konfirmasi tidak sama dengan kata sandi.'
                    : null,
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Checkbox(
                    value: _agree,
                    activeColor: AppColors.primary,
                    onChanged: (v) => setState(() => _agree = v ?? false),
                  ),
                  const Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(top: AppSpacing.sm),
                      child: Text(
                        'Saya menyetujui Syarat & Ketentuan Riset serta Kebijakan Privasi platform ARISTOTELES.',
                        style: AppText.small,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              AuthPrimaryButton(
                  label: 'Buat Akun Peserta', busy: _busy, onPressed: _submit),
              const SizedBox(height: AppSpacing.lg),
              Row(
                children: [
                  Expanded(child: Divider(color: AppColors.divider)),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: AppSpacing.md),
                    child: Text('ATAU PILIHAN CEPAT',
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
                label: const Text('Daftar cepat menggunakan Google Mahasiswa'),
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
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.primarySoft.withValues(alpha: 0.6),
            border: Border.all(color: AppColors.primaryBorder),
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          child: const Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.info_outlined, size: 20, color: AppColors.primary),
              SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Catatan Pengajar: pendaftaran akun instruktur memerlukan token undangan resmi dari administrator.',
                  style: AppText.small,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('Sudah memiliki akun?',
                style: TextStyle(color: AppColors.muted, fontSize: 13)),
            TextButton(
              style: TextButton.styleFrom(
                minimumSize: const Size(64, 48),
              ),
              onPressed: widget.onLogin,
              child: const Text('Masuk di sini'),
            ),
          ],
        ),
        const Center(
          child: Text('© 2025 ARISTOTELES AI Laboratory',
              style: AppText.small),
        ),
      ],
    );
  }
}
