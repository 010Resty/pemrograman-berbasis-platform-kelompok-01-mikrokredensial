import '../../core/api_client.dart';
import '../../core/models.dart';

class ProfileApi {
  ProfileApi(this._api);

  final ApiClient _api;

  Future<AppUser> fetch() {
    return _api.get<AppUser>(
      '/me/profile',
      (json) {
        final m = (json as Map?)?.cast<String, Object?>();
        // Respons profil lebih kaya; petakan ke AppUser + sisanya mentah.
        final full = m ?? {};
        return AppUser(
          id: (full['id'] is int)
              ? full['id'] as int
              : int.tryParse('${full['id'] ?? 0}') ?? 0,
          name: '${full['name'] ?? ''}',
          username: '${full['username'] ?? ''}',
          email: '${full['email'] ?? ''}',
          role: appRoleFromString(full['role'] as String?),
          avatarUrl: full['avatarUrl'] as String?,
        );
      },
    );
  }

  Future<Map<String, Object?>> raw() {
    return _api.get<Map<String, Object?>>(
      '/me/profile',
      (json) => (json as Map?)?.cast<String, Object?>() ?? {},
    );
  }

  Future<void> update(Map<String, Object?> input) async {
    await _api.patch<Object?>(
      '/me/profile',
      body: input,
      fromData: (_) => null,
    );
  }
}

class DiscountQuote {
  DiscountQuote({
    required this.code,
    required this.discountType,
    required this.discountValue,
    required this.discountAmount,
  });

  final String code;
  final String discountType;
  final int discountValue;
  final int discountAmount;

  factory DiscountQuote.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asInt(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return DiscountQuote(
      code: '${m['code'] ?? ''}',
      discountType: '${m['discountType'] ?? ''}',
      discountValue: asInt(m['discountValue']),
      discountAmount: asInt(m['discountAmount']),
    );
  }
}

class VoucherApi {
  VoucherApi(this._api);

  final ApiClient _api;

  /// Tukar voucher akses (personal/umum). Diskon tidak bisa ditukar di sini (K-03).
  Future<Map<String, Object?>> redeem({required String code, int? courseId}) {
    final body = <String, Object?>{
      'code': code.trim().toUpperCase(),
    };
    if (courseId != null) body['courseId'] = courseId;
    return _api.post<Map<String, Object?>>(
      '/vouchers/redeem',
      body: body,
      fromData: (json) => (json as Map?)?.cast<String, Object?>() ?? {},
    );
  }

  /// Validasi voucher DISKON tanpa menghanguskan (hangus saat pembayaran disetujui).
  Future<DiscountQuote> validateDiscount(
      {required String code, required int courseId}) {
    return _api.post<DiscountQuote>(
      '/vouchers/validate',
      body: {'code': code.trim().toUpperCase(), 'courseId': courseId},
      fromData: DiscountQuote.fromJson,
    );
  }
}

class CoursePromoQuote {
  CoursePromoQuote({
    required this.slug,
    required this.discountPercent,
    required this.discountAmount,
    required this.promoPrice,
  });

  final String slug;
  final int discountPercent;
  final int discountAmount;
  final int promoPrice;

  factory CoursePromoQuote.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asInt(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return CoursePromoQuote(
      slug: '${m['slug'] ?? ''}',
      discountPercent: asInt(m['discountPercent']),
      discountAmount: asInt(m['discountAmount']),
      promoPrice: asInt(m['promoPrice']),
    );
  }
}

class PromoApi {
  PromoApi(this._api);

  final ApiClient _api;

  Future<CoursePromoQuote?> courseQuote(int courseId) async {
    try {
      final data = await _api.get<Object?>(
        '/promos/course/$courseId',
        (json) => json,
      );
      if (data == null) return null;
      return CoursePromoQuote.fromJson(data);
    } on ApiException {
      return null;
    }
  }
}
