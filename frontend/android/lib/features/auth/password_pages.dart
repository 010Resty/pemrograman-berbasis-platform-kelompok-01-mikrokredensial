import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api_client.dart';
import '../../core/auth_api.dart';
import 'auth_scaffold.dart';
import 'auth_widgets.dart';

/// Lupa kata sandi: minta kode (respons selalu generik anti-enumerasi),
/// lalu verifikasi kode + kata sandi baru di layar berikutnya.
class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage(
      {super.key, required this.authApi, required this.onCodeSent});

  final AuthApi authApi;
  final void Function(String email) onCodeSent;

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  final _email = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _email.text.trim();
    if (!email.contains('@')) {
      setState(() => _error = 'Email tidak valid.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.authApi.forgotPassword(email);
      if (mounted) widget.onCodeSent(email);
    } on ApiException catch (e) {
      setState(() => _error = friendlyAuthError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Lupa Kata Sandi',
      subtitle: 'Masukkan email akun Anda.',
      children: [
        if (_error != null) ...[
          AuthErrorBanner(message: _error!, onRetry: _submit),
          const SizedBox(height: 16),
        ],
        TextField(
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(
            labelText: 'Email',
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.email_outlined),
          ),
        ),
        const SizedBox(height: 16),
        AuthPrimaryButton(
            label: 'Kirim kode reset', busy: _busy, onPressed: _submit),
      ],
    );
  }
}

/// Buat kata sandi baru: kode OTP + kata sandi (verifikasi dulu, baru reset).
class ResetPasswordPage extends StatefulWidget {
  const ResetPasswordPage({super.key, required this.authApi, required this.email});

  final AuthApi authApi;
  final String email;

  @override
  State<ResetPasswordPage> createState() => _ResetPasswordPageState();
}

class _ResetPasswordPageState extends State<ResetPasswordPage> {
  final _code = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _done = false;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_code.text.trim().length != 6) {
      setState(() => _error = 'Kode OTP 6 digit angka.');
      return;
    }
    if (_password.text.length < 8) {
      setState(() => _error = 'Kata sandi minimal 8 karakter.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      // Gerbang layar password-baru: kode salah tidak boleh lanjut.
      await widget.authApi.verifyResetCode(
          email: widget.email, code: _code.text.trim());
      await widget.authApi.resetPassword(
        email: widget.email,
        code: _code.text.trim(),
        newPassword: _password.text,
      );
      setState(() => _done = true);
    } on ApiException catch (_) {
      // Pesan generik yang sama agar tidak membocorkan status (kontrak backend).
      setState(() => _error = 'Kode salah atau kedaluwarsa.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Kata Sandi Baru',
      subtitle: 'Kode dikirim ke ${widget.email}.',
      children: [
        if (_done)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.secondaryContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Text(
                'Kata sandi berhasil diganti. Masuk dengan kata sandi baru.'),
          )
        else ...[
          if (_error != null) ...[
            AuthErrorBanner(message: _error!, onRetry: _submit),
            const SizedBox(height: 16),
          ],
          TextField(
            controller: _code,
            keyboardType: TextInputType.number,
            maxLength: 6,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: const InputDecoration(
              labelText: 'Kode OTP',
              border: OutlineInputBorder(),
              counterText: '',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _password,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: 'Kata sandi baru (min. 8 karakter)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          AuthPrimaryButton(
              label: 'Ganti kata sandi', busy: _busy, onPressed: _submit),
        ],
      ],
    );
  }
}
