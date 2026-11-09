import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api_client.dart';
import '../../core/auth_api.dart';
import '../../core/session.dart';
import 'auth_scaffold.dart';
import 'auth_widgets.dart';

/// Verifikasi OTP 6 digit → akun aktif + sesi langsung (tanpa login ulang).
class VerifyEmailPage extends StatefulWidget {
  const VerifyEmailPage(
      {super.key, required this.authApi, required this.session, required this.email});

  final AuthApi authApi;
  final SessionManager session;
  final String email;

  @override
  State<VerifyEmailPage> createState() => _VerifyEmailPageState();
}

class _VerifyEmailPageState extends State<VerifyEmailPage> {
  final _code = TextEditingController();
  bool _busy = false;
  String? _error;
  String? _info;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final code = _code.text.trim();
    if (code.length != 6) {
      setState(() => _error = 'Kode OTP 6 digit angka.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _info = null;
    });
    try {
      // Verifikasi sekaligus menerbitkan sesi di SessionManager.
      final payload =
          await widget.authApi.verifyEmail(email: widget.email, code: code);
      await widget.session.loginWithPayload(payload);
    } on ApiException catch (e) {
      setState(() => _error = friendlyAuthError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    setState(() {
      _busy = true;
      _error = null;
      _info = null;
    });
    try {
      await widget.authApi.resendVerification(widget.email);
      setState(() => _info = 'Kode baru dikirim. Periksa email Anda.');
    } on ApiException catch (e) {
      setState(() => _error = friendlyAuthError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Verifikasi Email',
      subtitle: 'Kode 6 digit dikirim ke ${widget.email}.',
      children: [
        if (_error != null) ...[
          AuthErrorBanner(message: _error!, onRetry: _submit),
          const SizedBox(height: 16),
        ],
        if (_info != null) ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.secondaryContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(_info!),
          ),
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
        const SizedBox(height: 16),
        AnimatedBuilder(
          animation: widget.session,
          builder: (context, _) => AuthPrimaryButton(
            label: 'Verifikasi & Masuk',
            busy: _busy || widget.session.busy,
            onPressed: _submit,
          ),
        ),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: _busy ? null : _resend,
          style:
              OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          child: const Text('Kirim ulang kode'),
        ),
      ],
    );
  }
}
