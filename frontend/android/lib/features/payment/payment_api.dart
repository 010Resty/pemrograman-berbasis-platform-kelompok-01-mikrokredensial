import '../../core/api_client.dart';

class MyPayment {
  MyPayment({
    required this.id,
    required this.invoice,
    required this.courseId,
    required this.courseTitle,
    required this.status,
    required this.amountExpected,
    this.amountPaid,
    this.rejectReason,
    this.createdAt,
    this.verifiedAt,
    this.voucherCode,
    this.promoSlug,
  });

  final int id;
  final String invoice;
  final int courseId;
  final String? courseTitle;
  final String status;
  final int amountExpected;
  final int? amountPaid;
  final String? rejectReason;
  final String? createdAt;
  final String? verifiedAt;
  final String? voucherCode;
  final String? promoSlug;

  bool get isPending => status == 'menunggu';
  bool get isRejected => status == 'ditolak';
  bool get isVerified => status == 'diverifikasi';

  factory MyPayment.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asInt(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    int? asIntN(Object? v) =>
        v == null ? null : (v is int ? v : int.tryParse('$v'));
    return MyPayment(
      id: asInt(m['id']),
      invoice: '${m['invoice'] ?? ''}',
      courseId: asInt(m['courseId']),
      courseTitle: m['courseTitle'] as String?,
      status: '${m['status'] ?? ''}',
      amountExpected: asInt(m['amountExpected']),
      amountPaid: asIntN(m['amountPaid']),
      rejectReason: m['rejectReason'] as String?,
      createdAt: m['createdAt'] as String?,
      verifiedAt: m['verifiedAt'] as String?,
      voucherCode: m['voucherCode'] as String?,
      promoSlug: m['promoSlug'] as String?,
    );
  }
}

class PaymentList {
  PaymentList({required this.items, required this.total});

  final List<MyPayment> items;
  final int total;

  factory PaymentList.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    final items = m['items'];
    int asInt(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return PaymentList(
      items: items is List ? items.map(MyPayment.fromJson).toList() : [],
      total: asInt(m['total']),
    );
  }
}

class PaymentApi {
  PaymentApi(this._api);

  final ApiClient _api;

  Future<MyPayment> create(int courseId, {String? voucherCode}) {
    final body = <String, Object?>{};
    if (voucherCode != null && voucherCode.isNotEmpty) {
      body['voucherCode'] = voucherCode;
    }
    return _api.post<MyPayment>(
      '/courses/$courseId/payments',
      body: body,
      fromData: MyPayment.fromJson,
    );
  }

  Future<MyPayment?> mine(int courseId) async {
    try {
      final data = await _api.get<Object?>(
        '/me/payments?courseId=$courseId',
        (json) => json,
      );
      if (data == null) return null;
      return MyPayment.fromJson(data);
    } on ApiException {
      return null;
    }
  }

  /// Daftar milik sendiri untuk bell/notifikasi (tanpa courseId).
  Future<PaymentList> mineList({String? status, int limit = 20}) async {
    final q = StringBuffer('?limit=$limit');
    if (status != null) q.write('&status=$status');
    try {
      final data = await _api.get<Object?>(
        '/me/payments$q',
        (json) => json,
      );
      return PaymentList.fromJson(data);
    } on ApiException {
      return PaymentList(items: [], total: 0);
    }
  }

  Future<MyPayment> attachProof(int paymentId, int proofFileId) {
    return _api.patch<MyPayment>(
      '/payments/$paymentId/proof',
      body: {'proofFileId': proofFileId},
      fromData: MyPayment.fromJson,
    );
  }
}
