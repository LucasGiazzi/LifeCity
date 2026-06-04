import 'package:flutter/foundation.dart';

import '../services/category_service.dart';
import '../models/complaint_category_model.dart';

class CategoryState extends ChangeNotifier {
  final CategoryService _service = CategoryService();

  List<ComplaintCategoryModel> _categories = CategoryCatalog.defaults;
  Map<String, ComplaintCategoryModel> _bySlug = {
    for (final c in CategoryCatalog.defaults) c.slug: c,
  };
  bool _isLoading = false;
  String? _error;

  List<ComplaintCategoryModel> get categories => _categories;
  Map<String, ComplaintCategoryModel> get bySlug => _bySlug;
  bool get isLoading => _isLoading;
  String? get error => _error;

  ComplaintCategoryModel resolve(String? slug) =>
      CategoryCatalog.resolve(_bySlug, slug);

  Future<void> initialize() async {
    await load();
  }

  Future<void> load() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final remote = await _service.fetchCategories();
      if (remote.isNotEmpty) {
        _categories = List<ComplaintCategoryModel>.from(remote)
          ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
        _bySlug = {for (final c in _categories) c.slug: c};
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
