import 'package:flutter/material.dart';

import '../theme/app_tokens.dart';

/// Baris aktivitas timeline (dipakai tab Aktivitas + ringkasan Beranda).
class ActivityTile extends StatelessWidget {
  const ActivityTile({
    super.key,
    required this.icon,
    required this.iconColor,
    required this.title,
    this.subtitle,
    this.timeLabel,
    this.trailing,
    this.accentLeft = false,
    this.onTap,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String? subtitle;
  final String? timeLabel;
  final Widget? trailing;
  final bool accentLeft;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        side: BorderSide(color: AppColors.border),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Container(
          decoration: accentLeft
              ? const BoxDecoration(
                  border: Border(
                    left: BorderSide(
                        color: AppColors.primary, width: 4),
                  ),
                )
              : null,
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                child: Icon(icon, color: iconColor, size: 20),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: AppText.caption),
                    if (subtitle != null)
                      Padding(
                        padding:
                            const EdgeInsets.only(top: AppSpacing.xs),
                        child: Text(subtitle!,
                            style: AppText.small),
                      ),
                  ],
                ),
              ),
              if (timeLabel != null)
                Padding(
                  padding:
                      const EdgeInsets.only(left: AppSpacing.sm),
                  child: Text(timeLabel!, style: AppText.small),
                ),
              if (trailing != null) ...[
                const SizedBox(width: AppSpacing.sm),
                trailing!,
              ],
            ],
          ),
        ),
      ),
    );
  }
}
