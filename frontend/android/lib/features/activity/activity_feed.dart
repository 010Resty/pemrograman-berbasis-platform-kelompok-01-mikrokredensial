import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../certificate/certificate_api.dart';
import '../payment/payment_api.dart';

/// Satu baris timeline aktivitas (sumber real: pembayaran + sertifikat).
class ActivityItem {
  ActivityItem({
    required this.kind,
    required this.title,
    this.subtitle,
    this.time,
    this.courseId,
    this.certificateId,
    this.highlight = false,
  });

  /// 'pending' | 'rejected' | 'verified' | 'certificate'
  final String kind;
  final String title;
  final String? subtitle;
  final DateTime? time;
  final int? courseId;
  final int? certificateId;
  final bool highlight;

  IconData get icon {
    switch (kind) {
      case 'rejected':
        return Icons.cancel_outlined;
      case 'verified':
        return Icons.verified_outlined;
      case 'certificate':
        return Icons.workspace_premium_outlined;
      default:
        return Icons.hourglass_top_outlined;
    }
  }

  Color get color {
    switch (kind) {
      case 'rejected':
        return Colors.red;
      case 'verified':
      case 'certificate':
        return Colors.green;
      default:
        return Colors.amber.shade800;
    }
  }

  Map<String, Object?> toJson() => {
        'kind': kind,
        'title': title,
        'subtitle': subtitle,
        'time': time?.toIso8601String(),
        'courseId': courseId,
        'certificateId': certificateId,
        'highlight': highlight,
      };

  factory ActivityItem.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int? asIntN(Object? v) =>
        v is int ? v : (v == null ? null : int.tryParse('$v'));
    DateTime? asDate(Object? v) =>
        v is String ? DateTime.tryParse(v) : null;
    return ActivityItem(
      kind: '${m['kind'] ?? 'pending'}',
      title: '${m['title'] ?? ''}',
      subtitle: m['subtitle'] as String?,
      time: asDate(m['time']),
      courseId: asIntN(m['courseId']),
      certificateId: asIntN(m['certificateId']),
      highlight: m['highlight'] == true,
    );
  }
}

/// Bangun feed aktivitas dari endpoint yang ada (tanpa endpoint feed khusus).
/// Diurutkan terbaru dulu; entri tanpa tanggal valid ditaruh paling akhir.
Future<List<ActivityItem>> loadActivityFeed(ApiClient api,
    {int paymentLimit = 50}) async {
  final pay = PaymentApi(api);
  final certs = await CertificateApi(api).mine();
  PaymentList mine;
  try {
    mine = await pay.mineList(limit: paymentLimit);
  } on ApiException {
    mine = PaymentList(items: [], total: 0);
  }

  final out = <ActivityItem>[];
  for (final p in mine.items) {
    final when = DateTime.tryParse(
        p.verifiedAt ?? p.createdAt ?? '');
    switch (p.status) {
      case 'diverifikasi':
        out.add(ActivityItem(
          kind: 'verified',
          title: 'Pembayaran terverifikasi',
          subtitle:
              '${p.courseTitle ?? 'Kursus'} · ${p.invoice}',
          time: when,
          courseId: p.courseId,
        ));
      case 'ditolak':
        out.add(ActivityItem(
          kind: 'rejected',
          title: 'Pembayaran ditolak',
          subtitle:
              '${p.courseTitle ?? 'Kursus'}${p.rejectReason != null ? ' · ${p.rejectReason}' : ''}',
          time: when,
          courseId: p.courseId,
        ));
      default:
        out.add(ActivityItem(
          kind: 'pending',
          title: 'Menunggu verifikasi pembayaran',
          subtitle:
              '${p.courseTitle ?? 'Kursus'} · ${p.invoice}',
          time: when,
          courseId: p.courseId,
          highlight: true,
        ));
    }
  }
  for (final c in certs.where((c) => c.status == 'issued')) {
    out.add(ActivityItem(
      kind: 'certificate',
      title: 'Sertifikat terbit',
      subtitle: '${c.courseTitle} · ${c.code}',
      time: DateTime.tryParse(c.issuedAt),
      certificateId: c.id,
    ));
  }
  out.sort((a, b) {
    final at = a.time;
    final bt = b.time;
    if (at == null && bt == null) return 0;
    if (at == null) return 1;
    if (bt == null) return -1;
    return bt.compareTo(at);
  });
  return out;
}

/// Label grup timeline: Hari ini / Kemarin / Sebelumnya.
String activityGroupLabel(DateTime? time) {
  if (time == null) return 'Sebelumnya';
  final now = DateTime.now();
  final day = DateTime(time.year, time.month, time.day);
  final today = DateTime(now.year, now.month, now.day);
  final diff = today.difference(day).inDays;
  if (diff <= 0) return 'Hari ini';
  if (diff == 1) return 'Kemarin';
  return 'Sebelumnya';
}

/// Label jam ringkas, cth "09:15 WIB" atau "2 hari lalu" untuk yang lama.
String activityTimeLabel(DateTime? time) {
  if (time == null) return '';
  final now = DateTime.now();
  final diff = now.difference(time);
  if (diff.inMinutes < 1) return 'baru saja';
  if (diff.inHours < 1) return '${diff.inMinutes} mnt lalu';
  if (diff.inDays < 1) {
    final h = time.hour.toString().padLeft(2, '0');
    final m = time.minute.toString().padLeft(2, '0');
    return '$h:$m WIB';
  }
  if (diff.inDays == 1) return 'Kemarin';
  return '${diff.inDays} hari lalu';
}
