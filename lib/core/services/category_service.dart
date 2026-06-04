import 'api_service.dart';
import '../models/complaint_category_model.dart';

class CategoryService {
  final ApiService _api = ApiService();

  Future<List<ComplaintCategoryModel>> fetchCategories() async {
    final response = await _api.get('/api/categories');
    final data = response.data;
    if (data is! Map<String, dynamic>) return [];

    final raw = data['categories'];
    if (raw is! List) return [];

    return raw
        .whereType<Map<String, dynamic>>()
        .map(ComplaintCategoryModel.fromJson)
        .toList();
  }
}
