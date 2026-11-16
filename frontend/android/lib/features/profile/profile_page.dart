import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api_client.dart';
import '../../core/file_url.dart';
import '../../core/offline_cache.dart';
import '../../core/uploads_api.dart';
import '../../shared_ui.dart';
import 'profile_api.dart';

/// Profil saya: lihat + ubah data diri (nama, kontak, tempat/tgl lahir)
/// + ganti/hapus foto avatar (cermin web `ProfileEditor.svelte`).
///
/// Offline: profil terakhir tersimpan ditampilkan dengan spanduk
/// "data tersimpan" bila backend tak terjangkau.
class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key, required this.api});

  final ApiClient api;

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  static const _cacheKey = 'my_profile';

  Map<String, Object?>? _raw;
  bool _loading = true;
  String? _error;
  bool _saving = false;
  bool _uploading = false;
  String? _uploadError;
  bool _offline = false;
  DateTime? _cacheTime;

  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _birthPlace = TextEditingController();
  final _birthDate = TextEditingController();
  String? _gender;

  final _cache = OfflineCache();

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

  void _applyRaw(Map<String, Object?> raw) {
    _raw = raw;
    _name.text = '${raw['name'] ?? ''}';
    _phone.text = '${raw['phone'] ?? ''}';
    _birthPlace.text = '${raw['birthPlace'] ?? ''}';
    _birthDate.text = '${raw['birthDate'] ?? ''}';
    final g = raw['gender'];
    _gender = (g == 'L' || g == 'P') ? g as String : null;
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final raw = await ProfileApi(widget.api).raw();
      await _cache.saveJson(_cacheKey, raw);
      if (!mounted) return;
      setState(() {
        _applyRaw(raw);
        _offline = false;
        _cacheTime = null;
      });
    } on ApiException catch (e) {
      // Offline: tampilkan profil tersimpan bila ada (cermin cache katalog).
      final cached = await _cache.readJson(_cacheKey, OfflineCache.profileTtl);
      if (!mounted) return;
      final data = cached?.data;
      if (data is Map) {
        setState(() {
          _applyRaw(data.cast<String, Object?>());
          _offline = true;
          _cacheTime = cached!.savedAt;
        });
      } else {
        setState(() => _error = e.message);
      }
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

  /// Pilih foto dari galeri → validasi 2MB → unggah `kind: avatar` →
  /// tautkan via `PATCH /me/profile {avatarFileId}` (cermin web).
  Future<void> _pickAndUploadAvatar() async {
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      maxWidth: 1024,
      imageQuality: 85,
    );
    if (picked == null || !mounted) return;
    setState(() {
      _uploading = true;
      _uploadError = null;
    });
    try {
      final bytes = await picked.readAsBytes();
      final check = UploadsApi.validateAvatar(
        filename: picked.name,
        byteLength: bytes.length,
      );
      if (!check.ok) throw ApiException(check.message);
      final up = await UploadsApi(widget.api).uploadAvatar(
        filename: picked.name,
        bytes: bytes,
      );
      await ProfileApi(widget.api).update({'avatarFileId': up.id});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Foto profil diperbarui.')),
      );
      await _load();
    } on ApiException catch (e) {
      if (mounted) setState(() => _uploadError = e.message);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _removeAvatar() async {
    final yes = await confirmDialog(
      context,
      title: 'Hapus foto profil?',
      message: 'Foto profil akan dilepas dan kembali ke inisial nama.',
      confirmText: 'Hapus',
      danger: true,
    );
    if (yes != true || !mounted) return;
    setState(() {
      _uploading = true;
      _uploadError = null;
    });
    try {
      final raw = await ProfileApi(widget.api).removeAvatar();
      await _cache.saveJson(_cacheKey, raw);
      if (!mounted) return;
      setState(() => _applyRaw(raw));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Foto profil dihapus.')),
      );
    } on ApiException catch (e) {
      if (mounted) setState(() => _uploadError = e.message);
    } finally {
      if (mounted) setState(() => _uploading = false);
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
                    if (_offline) ...[
                      _offlineBanner(),
                      const SizedBox(height: 12),
                    ],
                    if (_error != null) ...[
                      AuthErrorInline(message: _error!),
                      const SizedBox(height: 12),
                    ],
                    _avatarSection(),
                    const SizedBox(height: 16),
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

  Widget _offlineBanner() {
    final when =
        _cacheTime == null ? '' : ' · diperbarui ${formatDateTime(_cacheTime!.toIso8601String())}';
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.secondaryContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_outlined),
          const SizedBox(width: 8),
          Expanded(
            child: Text('Offline — menampilkan data tersimpan$when.'),
          ),
        ],
      ),
    );
  }

  Widget _avatarSection() {
    final raw = _raw;
    final avatarPath = raw == null ? null : raw['avatarUrl'] as String?;
    final url = resolveAvatarUrl(avatarPath, widget.api.baseUrl);
    final name = raw == null ? '' : '${raw['name'] ?? ''}';
    final initial =
        name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              radius: 36,
              backgroundImage: url == null ? null : NetworkImage(url),
              onBackgroundImageError:
                  url == null
                      ? null
                      : (Object err, StackTrace? stack) {},
              child: url == null
                  ? Text(initial,
                      style: const TextStyle(
                          fontSize: 28, fontWeight: FontWeight.bold))
                  : null,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name,
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  const Text('JPG/PNG/WebP, maksimal 2MB.',
                      style: TextStyle(fontSize: 12)),
                  if (_uploadError != null) ...[
                    const SizedBox(height: 4),
                    Text(_uploadError!,
                        style: TextStyle(
                            fontSize: 12,
                            color: Theme.of(context).colorScheme.error)),
                  ],
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: [
                      FilledButton.tonalIcon(
                        onPressed: _uploading ? null : _pickAndUploadAvatar,
                        icon: _uploading
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2))
                            : const Icon(Icons.photo_camera, size: 18),
                        label: Text(
                            _uploading ? 'Mengunggah…' : 'Ganti foto'),
                      ),
                      if (avatarPath != null)
                        TextButton.icon(
                          onPressed: _uploading ? null : _removeAvatar,
                          icon: const Icon(Icons.delete_outline, size: 18),
                          label: const Text('Hapus'),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
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
