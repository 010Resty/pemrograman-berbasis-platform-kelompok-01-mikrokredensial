import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../shared_ui.dart';
import 'profile_api.dart';

/// Profil saya: lihat + ubah data diri (nama, kontak, tempat/tgl lahir).
class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key, required this.api});

  final ApiClient api;

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  Map<String, Object?>? _raw;
  bool _loading = true;
  String? _error;
  bool _saving = false;

  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _birthPlace = TextEditingController();
  final _birthDate = TextEditingController();
  String? _gender;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _birthPlace.dispose();
    _birthDate.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final raw = await ProfileApi(widget.api).raw();
      if (!mounted) return;
      setState(() {
        _raw = raw;
        _name.text = '${raw['name'] ?? ''}';
        _phone.text = '${raw['phone'] ?? ''}';
        _birthPlace.text = '${raw['birthPlace'] ?? ''}';
        _birthDate.text = '${raw['birthDate'] ?? ''}';
        final g = raw['gender'];
        _gender = (g == 'L' || g == 'P') ? g as String : null;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final body = <String, Object?>{
        'name': _name.text.trim(),
      };
      if (_phone.text.trim().isNotEmpty) {
        body['phone'] = _phone.text.trim();
      }
      if (_birthPlace.text.trim().isNotEmpty) {
        body['birthPlace'] = _birthPlace.text.trim();
      }
      if (_birthDate.text.trim().isNotEmpty) {
        body['birthDate'] = _birthDate.text.trim();
      }
      final gender = _gender;
      if (gender != null) body['gender'] = gender;
      await ProfileApi(widget.api).update(body);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profil tersimpan.')),
      );
      await _load();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profil Saya')),
      body: _loading
          ? StateViews.loading()
          : _error != null && _raw == null
              ? StateViews.error(_error!, _load)
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (_error != null) ...[
                      AuthErrorInline(message: _error!),
                      const SizedBox(height: 12),
                    ],
                    TextField(
                        controller: _name,
                        decoration: const InputDecoration(
                            labelText: 'Nama lengkap',
                            border: OutlineInputBorder())),
                    const SizedBox(height: 12),
                    TextField(
                        controller: _phone,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(
                            labelText: 'Telepon (opsional)',
                            border: OutlineInputBorder())),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _gender,
                      decoration: const InputDecoration(
                          labelText: 'Jenis kelamin (opsional)',
                          border: OutlineInputBorder()),
                      items: const [
                        DropdownMenuItem(value: 'L', child: Text('Laki-laki')),
                        DropdownMenuItem(value: 'P', child: Text('Perempuan')),
                      ],
                      onChanged: (v) => setState(() => _gender = v),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                        controller: _birthPlace,
                        decoration: const InputDecoration(
                            labelText: 'Tempat lahir (opsional)',
                            border: OutlineInputBorder())),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _birthDate,
                      readOnly: true,
                      decoration: const InputDecoration(
                          labelText: 'Tanggal lahir (opsional)',
                          border: OutlineInputBorder(),
                          suffixIcon: Icon(Icons.calendar_today)),
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          firstDate: DateTime(1950),
                          lastDate: DateTime.now(),
                          initialDate: DateTime.tryParse(_birthDate.text) ??
                              DateTime(2000),
                        );
                        if (picked != null) {
                          _birthDate.text =
                              '${picked.year.toString().padLeft(4, '0')}-'
                              '${picked.month.toString().padLeft(2, '0')}-'
                              '${picked.day.toString().padLeft(2, '0')}';
                        }
                      },
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _saving ? null : _save,
                      style: FilledButton.styleFrom(
                          minimumSize: const Size.fromHeight(52)),
                      child: Text(
                          _saving ? 'Menyimpan…' : 'Simpan perubahan'),
                    ),
                  ],
                ),
    );
  }
}

class AuthErrorInline extends StatelessWidget {
  const AuthErrorInline({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(message),
    );
  }
}
