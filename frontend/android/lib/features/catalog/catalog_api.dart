import '../../core/api_client.dart';

/// Katalog publik + tree kurikulum (cermin web `lib/api/courses.ts`).
class PublicCourse {
  PublicCourse({
    required this.id,
    required this.title,
    this.description,
    this.category,
    this.level = 'Pemula',
    this.image,
    this.priceLabel = '',
    this.priceNominal = 0,
    this.period = 'ongoing',
  });

  final int id;
  final String title;
  final String? description;
  final String? category;
  final String level;
  final String? image;
  final String priceLabel;
  final int priceNominal;
  final String period;

  bool get isFree => priceNominal <= 0;

  factory PublicCourse.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int asInt(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return PublicCourse(
      id: asInt(m['id']),
      title: '${m['title'] ?? ''}',
      description: m['description'] as String?,
      category: m['category'] as String?,
      level: '${m['level'] ?? 'Pemula'}',
      image: m['image'] as String?,
      priceLabel: '${m['priceLabel'] ?? ''}',
      priceNominal: asInt(m['priceNominal']),
      period: '${m['period'] ?? 'ongoing'}',
    );
  }
}

class CourseDetail extends PublicCourse {
  CourseDetail({
    required super.id,
    required super.title,
    super.description,
    super.category,
    super.level = 'Pemula',
    super.image,
    super.priceLabel = '',
    super.priceNominal = 0,
    super.period = 'ongoing',
  });

  factory CourseDetail.fromJson(Object? json) =>
      CourseDetail.fromJsonCourse(PublicCourse.fromJson(json));

  factory CourseDetail.fromJsonCourse(PublicCourse c) => CourseDetail(
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        level: c.level,
        image: c.image,
        priceLabel: c.priceLabel,
        priceNominal: c.priceNominal,
        period: c.period,
      );
}

class TreeMaterial {
  TreeMaterial({required this.id, required this.title, required this.type});

  final String id;
  final String title;
  final String type;

  factory TreeMaterial.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    return TreeMaterial(
      id: '${m['id'] ?? ''}',
      title: '${m['title'] ?? ''}',
      type: '${m['type'] ?? 'materi'}',
    );
  }
}

class TreeSub {
  TreeSub({required this.id, required this.title, required this.materials});

  final String id;
  final String title;
  final List<TreeMaterial> materials;

  factory TreeSub.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    final mats = m['materials'];
    return TreeSub(
      id: '${m['id'] ?? ''}',
      title: '${m['title'] ?? ''}',
      materials: mats is List ? mats.map(TreeMaterial.fromJson).toList() : [],
    );
  }
}

class TreeModule {
  TreeModule({required this.id, required this.title, required this.subModules});

  final String id;
  final String title;
  final List<TreeSub> subModules;

  factory TreeModule.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    final subs = m['subModules'] ?? m['sub_modules'] ?? m['subs'];
    final direct = m['materials'];
    final List<TreeSub> list =
        subs is List ? subs.map(TreeSub.fromJson).toList() : [];
    if (list.isEmpty && direct is List) {
      list.add(TreeSub(
          id: '${m['id']}-direct',
          title: 'Materi langsung',
          materials: direct.map(TreeMaterial.fromJson).toList()));
    }
    return TreeModule(
      id: '${m['id'] ?? ''}',
      title: '${m['title'] ?? ''}',
      subModules: list,
    );
  }
}

class MaterialDetail {
  MaterialDetail({
    required this.id,
    required this.title,
    required this.type,
    this.content,
    this.duration,
    this.passScore,
    this.updatedAt,
  });

  final int id;
  final String title;
  final String type;
  final String? content;
  final String? duration;
  final int? passScore;
  final String? updatedAt;

  factory MaterialDetail.fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, Object?>() ?? {};
    int? asInt(Object? v) =>
        v == null ? null : (v is int ? v : int.tryParse('$v'));
    int asId(Object? v) => v is int ? v : int.tryParse('$v') ?? 0;
    return MaterialDetail(
      id: asId(m['id']),
      title: '${m['title'] ?? ''}',
      type: '${m['type'] ?? 'materi'}',
      content: m['content'] as String?,
      duration: m['duration'] as String?,
      passScore: asInt(m['passScore']),
      updatedAt: m['updatedAt'] as String?,
    );
  }
}

class CatalogApi {
  CatalogApi(this._api);

  final ApiClient _api;

  Future<List<PublicCourse>> list({String? q}) async {
    final query = q == null || q.trim().isEmpty
        ? '?limit=100'
        : '?limit=100&q=${Uri.encodeQueryComponent(q.trim())}';
    final data = await _api.get<List<Object?>>(
      '/courses$query',
      (json) {
        if (json is List) return apiList(json);
        final m = (json as Map?)?.cast<String, Object?>();
        return apiList(m?['courses']);
      },
    );
    return data.map(PublicCourse.fromJson).toList();
  }

  Future<CourseDetail> detail(int id) async {
    final data = await _api.get<Object?>(
      '/courses/$id',
      (json) => json,
    );
    final m = (data as Map?)?.cast<String, Object?>();
    final detail = (m?['detail'] ?? m?['course'] ?? data);
    return CourseDetail.fromJson(detail);
  }

  Future<List<TreeModule>> tree(int courseId) async {
    Future<List<Object?>> getList(String path, String key) async {
      return _api.get<List<Object?>>(
        path,
        (json) => apiList(json, key),
      );
    }

    final modules = await getList('/courses/$courseId/modules', 'modules');
    final out = <TreeModule>[];
    for (final mod in modules) {
      final mm = (mod as Map?)?.cast<String, Object?>() ?? {};
      final mid = mm['id'];
      final subs = await getList('/modules/$mid/submodules', 'submodules');
      final subList = <TreeSub>[];
      for (final s in subs) {
        final sm = (s as Map?)?.cast<String, Object?>() ?? {};
        final mats = await getList('/submodules/${sm['id']}/materials', 'materials');
        subList.add(TreeSub(
          id: '${sm['id'] ?? ''}',
          title: '${sm['title'] ?? ''}',
          materials: mats.map(TreeMaterial.fromJson).toList(),
        ));
      }
      out.add(TreeModule(
        id: '$mid',
        title: '${mm['title'] ?? ''}',
        subModules: subList,
      ));
    }
    return out;
  }

  Future<MaterialDetail> material(int id) {
    return _api.get<MaterialDetail>(
      '/materials/$id',
      MaterialDetail.fromJson,
    );
  }
}
