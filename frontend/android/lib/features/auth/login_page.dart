import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/session.dart';
import 'auth_scaffold.dart';
import 'auth_widgets.dart';

/// Masuk dengan email + password (sama kontrak dengan web).
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
      await widget.session.login(email: _email.text, password: _password.text);
    } on ApiException catch (e) {
      setState(() => _error = friendlyAuthError(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Masuk',
      subtitle: 'Belajar mikrokredensial dimulai dari sini.',
      children: [
        if (_error != null) ...[
          AuthErrorBanner(message: _error!, onRetry: _submit),
          const SizedBox(height: 16),
        ],
        Form(
          key: _formKey,
          child: Column(
            children: [
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                decoration: const InputDecoration(
                  labelText: 'Email',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.email_outlined),
                ),
                validator: (v) =>
                    (v == null || !v.contains('@')) ? 'Email tidak valid.' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _password,
                obscureText: _obscure,
                autofillHints: const [AutofillHints.password],
                decoration: InputDecoration(
                  labelText: 'Kata sandi',
                  border: const OutlineInputBorder(),
                  prefixIcon: const Icon(Icons.lock_outline),
                  suffixIcon: IconButton(
                    tooltip: _obscure ? 'Tampilkan' : 'Sembunyikan',
                    icon: Icon(_obscure ? Icons.visibility : Icons.visibility_off),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Kata sandi wajib diisi.' : null,
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: widget.onForgot,
                  child: const Text('Lupa kata sandi?'),
                ),
              ),
              const SizedBox(height: 4),
              AnimatedBuilder(
                animation: widget.session,
                builder: (context, _) => AuthPrimaryButton(
                  label: 'Masuk',
                  busy: widget.session.busy,
                  onPressed: _submit,
                ),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: widget.onRegister,
                style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(48)),
                child: const Text('Belum punya akun? Daftar'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
