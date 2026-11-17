import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api_client.dart';
import '../../core/auth_api.dart';
import '../../core/file_url.dart';
import '../../core/offline_cache.dart';
import '../../core/uploads_api.dart';
import '../../shared_ui.dart';
import '../../theme/app_tokens.dart';
import '../auth/password_pages.dart';
import '../certificate/certificate_api.dart';
import '../learning/enrollment_api.dart';
import '../learning/progress_api.dart';
import 'profile_api.dart';

/// Profil saya ala mockup: hero + metrik + data diri + kata sandi + keluar.
/// Tanpa NIM/universitas/nilai/2FA/transkrip/bahasa/bantuan
/// (tidak ada endpoint backend-nya).
class ProfilePage extends StatefulWidget {
  const ProfilePage({
    super.key,
    required this.api,
    this.showAppBar = true,
    this.onLogout,
    this.onLogoutAll,
  });

  final ApiClient api;

  /// False bila dipakai sebagai tab (header global sudah ada).
  final bool showAppBar;

  /// Keluar perangkat ini / semua perangkat (tombol hanya tampil bila ada).
  final Future<void> Function()? onLogout;
  final Future<void> Function()? onLogoutAll;

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
  int _activeCourses = 0;
  int _certCount = 0;
  String _progressLabel = '-';

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
      final extra = await Future.wait([
        EnrollmentApi(widget.api).mine().catchError((_) => <MyEnrollment>[]),
        ProgressApi(widget.api).summary(),
        CertificateApi(widget.api)
            .mine()
            .catchError((_) => <MyCertificate>[]),
      ]);
      if (!mounted) return;
      final enrolls = extra[0] as List<MyEnrollment>;
      final summary = extra[1] as ProgressSummary;
      final certs = extra[2] as List<MyCertificate>;
      setState(() {
        _applyRaw(raw);
        _activeCourses =
            enrolls.where((e) => e.isActive).length;
        _certCount =
            certs.where((c) => c.status == 'issued').length;
        _progressLabel =
            '${summary.completedMaterials}/${summary.totalMaterials} materi';
        _offline = false;
        _cacheTime = null;
      });
    } on ApiException catch (e) {
      final cached =
          await _cache.readJson(_cacheKey, OfflineCache.profileTtl);
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

  void _openPasswordReset() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ForgotPasswordPage(
          authApi: AuthApi(widget.api),
          onCodeSent: (email) {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ResetPasswordPage(
                  authApi: AuthApi(widget.api),
                  email: email,
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Future<void> _confirmLogout(bool all) async {
    final action = all ? widget.onLogoutAll : widget.onLogout;
    if (action == null) return;
    final yes = await confirmDialog(
      context,
      title: all ? 'Keluar semua perangkat?' : 'Keluar aplikasi?',
      message: all
          ? 'Semua sesi (HP, tablet, browser lain) akan dicabut dan harus masuk ulang.'
          : 'Sesi di perangkat ini akan dihapus.',
      confirmText: all ? 'Ya, semua' : 'Keluar',
      danger: all,
    );
    if (yes == true) await action();
  }

  @override
  Widget build(BuildContext context) {
    final body = _loading
        ? StateViews.loading()
        : _error != null && _raw == null
            ? StateViews.error(_error!, _load)
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  padding: EdgeInsets.fromLTRB(
                    AppSpacing.md,
                    AppSpacing.md,
                    AppSpacing.md,
                    AppSpacing.md +
                        MediaQuery.of(context).padding.bottom +
                        AppSpacing.sm,
                  ),
                  children: [
                    _heroCard(),
                    const SizedBox(height: AppSpacing.lg),
                    _sectionTitle('Pengaturan Akun & Keamanan',
                        'Kelola data dan akses akun Anda.'),
                    const SizedBox(height: AppSpacing.sm),
                    _menuCard([
                      _menuRow(
                        icon: Icons.person_outlined,
                        title: 'Informasi Data Pribadi',
                        subtitle: _name.text.isEmpty
                            ? 'Lengkapi nama, kontak, dan tanggal lahir.'
                            : _name.text,
                        trailing: _chip('Tervalidasi'),
                        onTap: null,
                      ),
                      _menuRow(
                        icon: Icons.lock_outlined,
                        title: 'Kata Sandi',
                        subtitle: 'Ubah via kode OTP email.',
                        onTap: _openPasswordReset,
                      ),
                    ]),
                    const SizedBox(height: AppSpacing.lg),
                    _sectionTitle('Data Pribadi', null),
                    const SizedBox(height: AppSpacing.sm),
                    _editCard(),
                    if (widget.onLogout != null) ...[
                      const SizedBox(height: AppSpacing.lg),
                      OutlinedButton.icon(
                        onPressed: () => _confirmLogout(false),
                        icon: const Icon(Icons.logout,
                            color: Colors.red),
                        label: const Text('Keluar dari Akun',
                            style: TextStyle(color: Colors.red)),
                        style: OutlinedButton.styleFrom(
                          minimumSize:
                              const Size.fromHeight(48),
                          side: BorderSide(
                              color: Colors.red.shade200),
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppRadius.md),
                          ),
                        ),
                      ),
                      if (widget.onLogoutAll != null) ...[
                        const SizedBox(height: AppSpacing.sm),
                        TextButton.icon(
                          style: TextButton.styleFrom(
                            minimumSize: const Size(64, 48),
                          ),
                          onPressed: () => _confirmLogout(true),
                          icon: const Icon(Icons.logout,
                              size: 18, color: Colors.red),
                          label: const Text(
                              'Keluar dari semua perangkat',
                              style: TextStyle(color: Colors.red)),
                        ),
                      ],
                    ],
                    const SizedBox(height: AppSpacing.lg),
                    const Center(
                      child: Text(
                          'ARISTOTELES • Platform Mikrokredensial',
                          style: AppText.small),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],
                ),
              );
    if (widget.showAppBar) {
      return Scaffold(
        appBar: AppBar(title: const Text('Profil Saya')),
        body: body,
      );
    }
    return body;
  }

  Widget _sectionTitle(String title, String? subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: AppText.section),
        if (subtitle != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.xs),
            child: Text(subtitle, style: AppText.small),
          ),
      ],
    );
  }

  Widget _heroCard() {
    final raw = _raw;
    final avatarPath =
        raw == null ? null : raw['avatarUrl'] as String?;
    final url =
        resolveAvatarUrl(avatarPath, widget.api.baseUrl);
    final name = raw == null ? '' : '${raw['name'] ?? ''}';
    final email = raw == null ? '' : '${raw['email'] ?? ''}';
    final initial =
        name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Colors.white, AppColors.heroEnd],
        ),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.hero,
      ),
      child: Stack(
        children: [
          const Positioned(
            right: -30,
            bottom: -30,
            child: _ProfileGlow(),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              children: [
                Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Stack(
                  children: [
                    Container(
                      width: 72,
                      height: 72,
                      padding: const EdgeInsets.all(2),
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            AppColors.primary,
                            Color(0xFFB2C6FE)
                          ],
                        ),
                        shape: BoxShape.circle,
                      ),
                      child: CircleAvatar(
                        backgroundColor: Colors.white,
                        backgroundImage: url == null
                            ? null
                            // R5: decode secukupnya (2x ukuran tampil).
                            : ResizeImage(NetworkImage(url),
                                width: 144, height: 144),
                        onBackgroundImageError: url == null
                            ? null
                            : (Object err, StackTrace? stack) {},
                        child: url == null
                            ? Text(initial,
                                style: const TextStyle(
                                    fontSize: 28,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.primary))
                            : null,
                      ),
                    ),
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: InkWell(
                        onTap:
                            _uploading ? null : _pickAndUploadAvatar,
                        borderRadius:
                            BorderRadius.circular(AppRadius.pill),
                        child: Padding(
                          padding:
                              const EdgeInsets.all(AppSpacing.md),
                          child: Container(
                            width: 24,
                            height: 24,
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              shape: BoxShape.circle,
                              border: Border.all(
                                  color: Colors.white, width: 2),
                            ),
                            child: _uploading
                                ? const SizedBox(
                                    width: 12,
                                    height: 12,
                                    child:
                                        CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Icon(Icons.photo_camera,
                                    size: 13,
                                    color: Colors.white),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.sm,
                            vertical: AppSpacing.xs),
                        decoration: BoxDecoration(
                          border: Border.all(
                              color: AppColors.primaryContainer
                                  .withValues(alpha: 0.3)),
                          borderRadius:
                              BorderRadius.circular(AppRadius.pill),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Icon(Icons.verified,
                                size: 12,
                                color: AppColors.primary),
                            SizedBox(width: AppSpacing.xs),
                            Text('PESERTA AKTIF MICROCREDENTIAL',
                                style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.primary)),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(name.isEmpty ? '-' : name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold)),
                      Text(email,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.muted)),
                      if (avatarPath != null)
                        TextButton.icon(
                          onPressed:
                              _uploading ? null : _removeAvatar,
                          icon: const Icon(Icons.delete_outline,
                              size: 14),
                          label: const Text('Hapus foto',
                              style: TextStyle(fontSize: 12)),
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.sm),
                            minimumSize: const Size(64, 48),
                          ),
                        ),
                      if (_uploadError != null)
                        Text(_uploadError!,
                            style: const TextStyle(
                                fontSize: 12, color: AppColors.rose)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                _metric(_activeCourses.toString(), 'Kursus\nBerjalan',
                    AppColors.primary),
                const SizedBox(width: AppSpacing.sm),
                _metric('$_certCount', 'Sertifikat\nResmi',
                    AppColors.primaryContainer),
                const SizedBox(width: AppSpacing.sm),
                _metric(_progressLabel, 'Modul\nSelesai',
                    AppColors.primaryContainer),
              ],
            ),
          ],
        ),
      ),
      ],
    ));

  }

  Widget _metric(String value, String label, Color color) {
    return Expanded(
      child: Container(
        padding:
            const EdgeInsets.symmetric(vertical: AppSpacing.md),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: AppColors.divider),
          borderRadius: BorderRadius.circular(AppRadius.sm),
        ),
        child: Column(
          children: [
            Text(value,
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: color)),
            const SizedBox(height: AppSpacing.xs),
            Text(label,
                textAlign: TextAlign.center,
                style: AppText.small),
          ],
        ),
      ),
    );
  }

  Widget _menuCard(List<Widget> rows) {
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        side: BorderSide(color: AppColors.border),
      ),
      child: Column(children: rows),
    );
  }

  Widget _menuRow({
    required IconData icon,
    required String title,
    String? subtitle,
    Widget trailing = const SizedBox.shrink(),
    VoidCallback? onTap,
  }) {
    final row = Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            child: Icon(icon,
                size: 20, color: AppColors.primary),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600)),
                if (subtitle != null)
                  Text(subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.small),
              ],
            ),
          ),
          trailing,
          if (onTap != null)
            const Icon(Icons.chevron_right,
                color: AppColors.muted),
        ],
      ),
    );
    if (onTap == null) return row;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: row,
    );
  }

  Widget _chip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(label,
          style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.primary)),
    );
  }

  Widget _editCard() {
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        side: BorderSide(color: AppColors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_offline) ...[
              _offlineBanner(),
              const SizedBox(height: AppSpacing.md),
            ],
            if (_error != null) ...[
              AuthErrorInline(message: _error!),
              const SizedBox(height: AppSpacing.md),
            ],
            TextField(
              controller: _name,
              decoration: authField(context, 'Nama lengkap'),
            ),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration:
                  authField(context, 'Telepon (opsional)'),
            ),
            const SizedBox(height: AppSpacing.md),
            DropdownButtonFormField<String>(
              initialValue: _gender,
              decoration:
                  authField(context, 'Jenis kelamin (opsional)'),
              items: const [
                DropdownMenuItem(
                    value: 'L', child: Text('Laki-laki')),
                DropdownMenuItem(
                    value: 'P', child: Text('Perempuan')),
              ],
              onChanged: (v) => setState(() => _gender = v),
            ),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _birthPlace,
              decoration:
                  authField(context, 'Tempat lahir (opsional)'),
            ),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _birthDate,
              readOnly: true,
              decoration: authField(context,
                  'Tanggal lahir (opsional)',
                  suffix: const Icon(Icons.calendar_today)),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  firstDate: DateTime(1950),
                  lastDate: DateTime.now(),
                  initialDate:
                      DateTime.tryParse(_birthDate.text) ??
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
            const SizedBox(height: AppSpacing.lg),
            FilledButton(
              onPressed: _saving ? null : _save,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
              ),
              child:
                  Text(_saving ? 'Menyimpan…' : 'Simpan perubahan'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _offlineBanner() {
    final when = _cacheTime == null
        ? ''
        : ' · diperbarui ${formatDateTime(_cacheTime!.toIso8601String())}';
    return OfflineChip(
      label: 'Offline — menampilkan data tersimpan$when.',
    );
  }
}

/// Dekorasi field profil: sama bahasa visual dengan layar auth.
InputDecoration authField(BuildContext context, String label,
    {Widget? suffix}) {
  const radius = BorderRadius.all(Radius.circular(AppRadius.md));
  OutlineInputBorder side(Color color, [double width = 1.2]) =>
      OutlineInputBorder(
          borderRadius: radius,
          borderSide: BorderSide(color: color, width: width));
  return InputDecoration(
    labelText: label,
    filled: true,
    fillColor: Colors.white,
    suffixIcon: suffix,
    contentPadding:
        const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
    border: side(AppColors.border),
    enabledBorder: side(AppColors.border),
    focusedBorder: side(AppColors.focusBorder, 1.8),
  );
}

class AuthErrorInline extends StatelessWidget {
  const AuthErrorInline({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Colors.red.shade300),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Text(message,
          style: const TextStyle(fontSize: 12, color: AppColors.rose)),
    );
  }
}

/// Bercak lembut dekoratif untuk hero profil (D2: kesan hidup).
class _ProfileGlow extends StatelessWidget {
  const _ProfileGlow();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 120,
      height: 120,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.primaryContainer.withValues(alpha: 0.10),
      ),
    );
  }
}
