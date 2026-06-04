import 'package:flutter/material.dart';

class ComplaintCategoryModel {
  final String id;
  final String slug;
  final String name;
  final String shortName;
  final String colorHex;
  final String iconKey;
  final String? description;
  final int sortOrder;

  const ComplaintCategoryModel({
    required this.id,
    required this.slug,
    required this.name,
    required this.shortName,
    required this.colorHex,
    required this.iconKey,
    this.description,
    required this.sortOrder,
  });

  Color get color => CategoryCatalog.colorFromHex(colorHex);

  IconData get icon => CategoryCatalog.iconFromKey(iconKey);

  factory ComplaintCategoryModel.fromJson(Map<String, dynamic> json) {
    return ComplaintCategoryModel(
      id: json['id'] as String,
      slug: json['slug'] as String,
      name: json['name'] as String,
      shortName: (json['shortName'] ?? json['short_name'] ?? json['name']) as String,
      colorHex: (json['colorHex'] ?? json['color_hex']) as String,
      iconKey: (json['iconKey'] ?? json['icon_key'] ?? 'category') as String,
      description: json['description'] as String?,
      sortOrder: (json['sortOrder'] ?? json['sort_order'] ?? 0) as int,
    );
  }
}

/// Catálogo compartilhado: ícones, cores e fallbacks locais.
class CategoryCatalog {
  CategoryCatalog._();

  static const List<ComplaintCategoryModel> defaults = [
    ComplaintCategoryModel(
      id: 'local-infraestrutura',
      slug: 'infraestrutura',
      name: 'Infraestrutura',
      shortName: 'Infra',
      colorHex: '#FF9800',
      iconKey: 'construction',
      sortOrder: 10,
    ),
    ComplaintCategoryModel(
      id: 'local-seguranca',
      slug: 'seguranca',
      name: 'Segurança',
      shortName: 'Segurança',
      colorHex: '#F44336',
      iconKey: 'security',
      sortOrder: 20,
    ),
    ComplaintCategoryModel(
      id: 'local-limpeza',
      slug: 'limpeza',
      name: 'Limpeza',
      shortName: 'Limpeza',
      colorHex: '#009688',
      iconKey: 'cleaning_services',
      sortOrder: 30,
    ),
    ComplaintCategoryModel(
      id: 'local-transito',
      slug: 'transito',
      name: 'Trânsito',
      shortName: 'Trânsito',
      colorHex: '#FFC107',
      iconKey: 'traffic',
      sortOrder: 40,
    ),
    ComplaintCategoryModel(
      id: 'local-outros',
      slug: 'outros',
      name: 'Outros',
      shortName: 'Outros',
      colorHex: '#9E9E9E',
      iconKey: 'report_problem',
      sortOrder: 50,
    ),
  ];

  static Color colorFromHex(String hex) {
    final normalized = hex.replaceAll('#', '');
    if (normalized.length != 6) return Colors.grey;
    return Color(int.parse('FF$normalized', radix: 16));
  }

  static IconData iconFromKey(String key) {
    switch (key) {
      case 'construction':
        return Icons.construction;
      case 'security':
        return Icons.security;
      case 'cleaning_services':
        return Icons.cleaning_services;
      case 'traffic':
        return Icons.traffic;
      case 'report_problem':
        return Icons.report_problem;
      default:
        return Icons.category;
    }
  }

  static ComplaintCategoryModel resolve(
    Map<String, ComplaintCategoryModel> bySlug,
    String? slug,
  ) {
    if (slug == null || slug.trim().isEmpty) {
      return bySlug['outros'] ?? defaults.last;
    }
    return bySlug[slug.toLowerCase()] ??
        bySlug['outros'] ??
        defaults.last;
  }
}
