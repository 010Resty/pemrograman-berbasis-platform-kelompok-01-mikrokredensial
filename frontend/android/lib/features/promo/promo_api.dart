import '../../core/api_client.dart';

/// Kampanye promo (cermin kontrak web `PromoCampaign`).
class PromoCourse {
  PromoCourse({
    required this.courseId,
    required this.title,
    this.image,
    this.priceLabel = '',
    this.priceNominal = 0,
    this.discountPercent,
    this.promoPrice,
    this.badgeLabel,
    this.promoEndsAt,
    this.patunganPrice,
  });

  final int courseId;
  final String title;
  final String? image;
  final String priceLabel;
  final int priceNominal;
  final int? discountPercent;
  final int? promoPrice;
  final String? badgeLabel;
  final String? promoEndsAt;
  final int? patunganPrice;

  factory PromoCourse.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asInt(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    int? asIntN(Object? v) =>
        v == null ? null : (v is int ? v : int.tryParse('$v'));
    return PromoCourse(
      courseId: asInt(m['courseId']),
      title: '${m['title'] ?? ''}',
      image: m['image'] as String?,
      priceLabel: '${m['priceLabel'] ?? ''}',
      priceNominal: asInt(m['priceNominal']),
      discountPercent: asIntN(m['discountPercent']),
      promoPrice: asIntN(m['promoPrice']),
      badgeLabel: m['badgeLabel'] as String?,
      promoEndsAt: m['promoEndsAt'] as String?,
      patunganPrice: asIntN(m['patunganPrice']),
    );
  }

  Map<String, Object?> toJson() => {
        'courseId': courseId,
        'title': title,
        'image': image,
        'priceLabel': priceLabel,
        'priceNominal': priceNominal,
        'discountPercent': discountPercent,
        'promoPrice': promoPrice,
        'badgeLabel': badgeLabel,
        'promoEndsAt': promoEndsAt,
        'patunganPrice': patunganPrice,
      };
}

class PromoCampaign {
  PromoCampaign({
    required this.slug,
    required this.title,
    this.badgeLabel,
    this.coverImage,
    this.type = 'kurasi',
    this.discountPercent,
    this.startsAt,
    this.endsAt,
    required this.courses,
  });

  final String slug;
  final String title;
  final String? badgeLabel;
  final String? coverImage;
  final String type;
  final int? discountPercent;
  final String? startsAt;
  final String? endsAt;
  final List<PromoCourse> courses;

  String get typeLabel {
    switch (type) {
      case 'diskon':
        return 'Diskon';
      case 'patungan':
        return 'Patungan';
      default:
        return 'Kurasi';
    }
  }

  Map<String, Object?> toJson() => {
        'slug': slug,
        'title': title,
        'badgeLabel': badgeLabel,
        'coverImage': coverImage,
        'type': type,
        'discountPercent': discountPercent,
        'startsAt': startsAt,
        'endsAt': endsAt,
        'courses': courses.map((c) => c.toJson()).toList(),
      };

  factory PromoCampaign.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    final rawCourses = m['courses'];
    return PromoCampaign(
      slug: '${m['slug'] ?? ''}',
      title: '${m['title'] ?? ''}',
      badgeLabel: m['badgeLabel'] as String?,
      coverImage: m['coverImage'] as String?,
      type: '${m['type'] ?? 'kurasi'}',
      discountPercent: m['discountPercent'] is int
          ? m['discountPercent'] as int
          : int.tryParse('${m['discountPercent'] ?? ''}'),
      startsAt: m['startsAt'] as String?,
      endsAt: m['endsAt'] as String?,
      courses: rawCourses is List
          ? rawCourses.map(PromoCourse.fromJson).toList()
          : const [],
    );
  }
}

class PromoApi {
  PromoApi(this._api);

  final ApiClient _api;

  /// Daftar kampanye aktif (publik).
  Future<List<PromoCampaign>> list() async {
    try {
      final data = await _api.get<List<Object?>>(
        '/promos',
        (json) => apiList(json),
      );
      return data.map(PromoCampaign.fromJson).toList();
    } on ApiException {
      return [];
    }
  }

  /// Detail kampanye + kursus (publik; 404 bila kedaluwarsa/draft).
  Future<PromoCampaign?> detail(String slug) async {
    try {
      final data = await _api.get<Object?>(
        '/promos/${Uri.encodeComponent(slug)}',
        (json) => json,
      );
      if (data == null) return null;
      return PromoCampaign.fromJson(data);
    } on ApiException {
      return null;
    }
  }
}
