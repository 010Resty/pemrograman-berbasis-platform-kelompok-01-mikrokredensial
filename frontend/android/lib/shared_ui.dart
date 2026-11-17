import 'package:flutter/material.dart';

import 'theme/app_tokens.dart';

/// Status umum: loading / error + coba lagi / kosong. Dipakai semua layar
/// agar tidak ada angka atau daftar palsu saat backend tidak terjangkau.
class StateViews {
  static Widget loading([String label = 'Memuat…']) => Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xxxl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(),
              const SizedBox(height: AppSpacing.md),
              Text(label, style: AppText.caption),
            ],
          ),
        ),
      );

  static Widget error(String message, VoidCallback onRetry) => Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xxl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                ),
                child: Icon(Icons.cloud_off_outlined,
                    size: 32, color: Colors.red.shade400),
              ),
              const SizedBox(height: AppSpacing.md),
              const Text('Gagal memuat', style: AppText.section),
              const SizedBox(height: AppSpacing.xs),
              Text(message,
                  textAlign: TextAlign.center, style: AppText.caption),
              const SizedBox(height: AppSpacing.lg),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Coba lagi'),
              ),
            ],
          ),
        ),
      );

  static Widget empty(String title, String subtitle,
          {IconData icon = Icons.inbox_outlined}) =>
      Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xxl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                ),
                child: Icon(icon,
                    size: 32, color: AppColors.primary),
              ),
              const SizedBox(height: AppSpacing.md),
              Text(title, style: AppText.section),
              const SizedBox(height: AppSpacing.xs),
              Text(subtitle,
                  textAlign: TextAlign.center, style: AppText.caption),
            ],
          ),
        ),
      );
}

/// Banner mode offline — dipakai semua layar ber-cache.
class OfflineChip extends StatelessWidget {
  const OfflineChip({super.key, this.label = 'Mode offline — data terakhir'});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md, vertical: AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.warningSoft,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_outlined,
              size: 18, color: AppColors.warning),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(label,
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.warning)),
          ),
        ],
      ),
    );
  }
}

/// Padding bawah aman untuk gesture-nav Android.
EdgeInsets pagePadding(BuildContext context, {double base = 16}) {
  final bottom = MediaQuery.of(context).padding.bottom;
  return EdgeInsets.fromLTRB(base, base, base, base + bottom + 8);
}

String formatIDR(num value) {
  final n = value.round();
  final s = n.toString();
  final buf = StringBuffer('Rp');
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write('.');
    buf.write(s[i]);
  }
  return buf.toString();
}

String formatDateTime(String? iso) {
  if (iso == null || iso.isEmpty) return '-';
  final d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return iso;
  const months = [
    '', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];
  final mo = (d.month >= 1 && d.month <= 12) ? months[d.month] : '${d.month}';
  String two(int v) => v.toString().padLeft(2, '0');
  return '${d.day} $mo ${d.year}, ${two(d.hour)}:${two(d.minute)}';
}

Future<bool?> confirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  String confirmText = 'Ya',
  String cancelText = 'Batal',
  bool danger = false,
}) {
  return showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: Text(cancelText),
        ),
        FilledButton(
          style: danger
              ? FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error)
              : null,
          onPressed: () => Navigator.of(ctx).pop(true),
          child: Text(confirmText),
        ),
      ],
    ),
  );
}
