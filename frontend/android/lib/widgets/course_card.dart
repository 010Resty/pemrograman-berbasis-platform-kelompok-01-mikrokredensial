import 'package:flutter/material.dart';

import '../theme/app_tokens.dart';

/// Kartu kursus bersama (katalog, rekomendasi, promo, kursusku).
/// Semua teks dari server — tanpa rating/nama instruktur palsu.
class CourseCard extends StatelessWidget {
  const CourseCard({
    super.key,
    required this.title,
    this.categoryLabel,
    this.levelLabel,
    this.imageUrl,
    this.priceLabel,
    this.isFree = false,
    this.promoPriceLabel,
    this.progress,
    this.progressLabel,
    this.ctaLabel = 'Lihat Detail',
    this.onTap,
    this.onCta,
  });

  final String title;
  final String? categoryLabel;
  final String? levelLabel;
  final String? imageUrl;
  final String? priceLabel;
  final bool isFree;
  final String? promoPriceLabel;
  final double? progress;
  final String? progressLabel;
  final String ctaLabel;
  final VoidCallback? onTap;
  final VoidCallback? onCta;

  static const Color primary = AppColors.primary;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        side: BorderSide(color: AppColors.border),
      ),
      child: InkWell(
        onTap: onTap ?? onCta,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _thumb(),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (categoryLabel != null || levelLabel != null)
                          Wrap(
                            spacing: 8,
                            runSpacing: 4,
                            children: [
                              if (categoryLabel != null)
                                _chip(categoryLabel!, primary),
                              if (levelLabel != null)
                                _chip(levelLabel!, AppColors.muted,
                                    filled: false),
                            ],
                          ),
                        if (categoryLabel != null || levelLabel != null)
                          const SizedBox(height: AppSpacing.xs),
                        Text(title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.ink)),
                        if (priceLabel != null || isFree) ...[
                          const SizedBox(height: AppSpacing.xs),
                          Row(
                            children: [
                              Text(
                                isFree ? 'GRATIS' : priceLabel ?? '',
                                style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800,
                                    color: isFree
                                        ? AppColors.success
                                        : AppColors.ink),
                              ),
                              if (promoPriceLabel != null) ...[
                                const SizedBox(width: AppSpacing.sm),
                                Text(promoPriceLabel!,
                                    style: const TextStyle(
                                        fontSize: 12,
                                        decoration:
                                            TextDecoration.lineThrough,
                                        color: AppColors.mutedSoft)),
                              ],
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              if (progress != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(progressLabel ?? 'Progres',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.muted)),
                    Text('${(progress! * 100).round()}%',
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: primary)),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                  child: LinearProgressIndicator(
                    value: progress!.clamp(0.0, 1.0),
                    minHeight: 8,
                    backgroundColor: AppColors.primarySoft,
                    valueColor:
                        const AlwaysStoppedAnimation<Color>(primary),
                  ),
                ),
              ],
              if (onCta != null) ...[
                const SizedBox(height: AppSpacing.sm),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: onCta,
                    icon: const Icon(Icons.arrow_forward, size: 18),
                    label: Text(ctaLabel),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.md),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _thumb() {
    return Container(
      width: 72,
      height: 72,
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      clipBehavior: Clip.antiAlias,
      child: imageUrl == null
          ? const Icon(Icons.school_outlined,
              color: primary, size: 32)
          : Image.network(
              imageUrl!,
              fit: BoxFit.cover,
              cacheWidth: 144,
              cacheHeight: 144,
              loadingBuilder: (ctx, child, progress) => progress == null
                  ? child
                  : const Center(
                      child: SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
              errorBuilder: (BuildContext context, Object err,
                      StackTrace? stack) =>
                  const Icon(Icons.school_outlined,
                      color: primary, size: 32),
            ),
    );
  }

  Widget _chip(String label, Color color, {bool filled = true}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: filled ? AppColors.primarySoft : Colors.transparent,
        border: filled ? null : Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.xs),
      ),
      child: Text(label,
          style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700, color: color)),
    );
  }
}
