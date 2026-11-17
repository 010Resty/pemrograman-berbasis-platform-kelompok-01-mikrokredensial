import 'package:flutter/material.dart';

import '../theme/app_tokens.dart';
import 'app_logo.dart';

/// TopAppBar ala mockup peserta: logo + judul + bell + avatar.
/// Bell/lonceng dan avatar memicu [onBell]/[onAvatar] (pindah tab).
class AppTopBar extends StatelessWidget {
  const AppTopBar({
    super.key,
    required this.title,
    required this.subtitle,
    this.avatarUrl,
    this.userInitial = '?',
    this.showBellDot = false,
    this.onBell,
    this.onAvatar,
    this.onLogout,
  });

  final String title;
  final String subtitle;
  final String? avatarUrl;
  final String userInitial;
  final bool showBellDot;
  final VoidCallback? onBell;
  final VoidCallback? onAvatar;

  /// Bila diisi, tampil ikon Keluar di ujung kanan (dipakai portal
  /// instruktur/admin yang tidak punya tab Profil).
  final VoidCallback? onLogout;

  static const Color primary = AppColors.primary;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      height: 64,
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: AppShadows.topBar,
        border: Border(bottom: BorderSide(color: AppColors.divider)),
      ),
      child: Row(
        children: [
          const AppLogo(size: AppLogoSize.sm, showText: false),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                        color: primary)),
                Text(subtitle.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 11,
                        letterSpacing: 1.2,
                        fontWeight: FontWeight.w600,
                        color: AppColors.muted)),
              ],
            ),
          ),
          Stack(
            children: [
              IconButton(
                tooltip: 'Notifikasi',
                icon: const Icon(Icons.notifications_outlined,
                    color: AppColors.inkSecondary),
                onPressed: onBell,
              ),
              if (showBellDot)
                const Positioned(
                  right: 14,
                  top: 14,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                        color: primary, shape: BoxShape.circle),
                    child: SizedBox.square(dimension: 8),
                  ),
                ),
            ],
          ),
          const SizedBox(width: AppSpacing.xs),
          InkWell(
            onTap: onAvatar,
            borderRadius: BorderRadius.circular(AppRadius.pill),
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: CircleAvatar(
                radius: 16,
                backgroundColor: AppColors.primarySoft,
                backgroundImage: avatarUrl == null
                    ? null
                    : ResizeImage(NetworkImage(avatarUrl!),
                        width: 64, height: 64),
                onBackgroundImageError: avatarUrl == null
                    ? null
                    : (Object err, StackTrace? stack) {},
                child: avatarUrl == null
                    ? Text(userInitial,
                        style: const TextStyle(
                            fontWeight: FontWeight.bold, color: primary))
                    : null,
              ),
            ),
          ),
          if (onLogout != null)
            IconButton(
              tooltip: 'Keluar',
              icon: const Icon(Icons.logout,
                  color: AppColors.inkSecondary),
              onPressed: onLogout,
            ),
        ],
      ),
    );
  }
}
