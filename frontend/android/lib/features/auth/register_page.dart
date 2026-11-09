import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/auth_api.dart';
import 'auth_scaffold.dart';
import 'auth_widgets.dart';

/// Daftar akun peserta (pendaftaran selalu peran student, K-01).
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
  bool _busy = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _username.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
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

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Daftar',
      subtitle: 'Satu akun untuk semua pelatihan.',
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
                controller: _name,
                decoration: const InputDecoration(
                    labelText: 'Nama lengkap', border: OutlineInputBorder()),
                validator: (v) =>
                    (v == null || v.trim().length < 2) ? 'Nama minimal 2 karakter.' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _username,
                decoration: const InputDecoration(
                    labelText: 'Username (huruf kecil, angka, titik)',
                    border: OutlineInputBorder()),
                validator: (v) =>
                    (v == null || v.trim().length < 3) ? 'Username minimal 3 karakter.' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                    labelText: 'Email', border: OutlineInputBorder()),
                validator: (v) =>
                    (v == null || !v.contains('@')) ? 'Email tidak valid.' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _password,
                obscureText: _obscure,
                decoration: InputDecoration(
                  labelText: 'Kata sandi (min. 8 karakter)',
                  border: const OutlineInputBorder(),
                  suffixIcon: IconButton(
                    icon: Icon(_obscure ? Icons.visibility : Icons.visibility_off),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
                validator: (v) =>
                    (v == null || v.length < 8) ? 'Minimal 8 karakter.' : null,
              ),
              const SizedBox(height: 16),
              AuthPrimaryButton(label: 'Kirim kode verifikasi', busy: _busy, onPressed: _submit),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: widget.onLogin,
                style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(48)),
                child: const Text('Sudah punya akun? Masuk'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
