class EventModel {
  final String id;
  final String description;
  final DateTime startDate;
  final DateTime? endDate;
  final String? category;
  final String? address;
  final double? latitude;
  final double? longitude;
  final DateTime createdAt;
  final String? createdByName;
  final String? createdByEmail;

  EventModel({
    required this.id,
    required this.description,
    required this.startDate,
    this.endDate,
    this.category,
    this.address,
    this.latitude,
    this.longitude,
    required this.createdAt,
    this.createdByName,
    this.createdByEmail,
  });

  factory EventModel.fromJson(Map<String, dynamic> json) {
    return EventModel(
      id: json['id'].toString(),
      description: json['description'] as String,
      startDate: DateTime.parse(json['start_date'] as String),
      endDate: json['end_date'] != null 
          ? DateTime.parse(json['end_date'] as String) 
          : null,
      category: json['category'] as String?,
      address: json['address'] as String?,
      latitude: json['latitude'] != null 
          ? double.tryParse(json['latitude'].toString()) 
          : null,
      longitude: json['longitude'] != null 
          ? double.tryParse(json['longitude'].toString()) 
          : null,
      createdAt: DateTime.parse(json['created_at'] as String),
      createdByName: json['created_by_name'] as String?,
      createdByEmail: json['created_by_email'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'description': description,
      'start_date': startDate.toIso8601String(),
      'end_date': endDate?.toIso8601String(),
      'category': category,
      'address': address,
      'latitude': latitude,
      'longitude': longitude,
      'created_at': createdAt.toIso8601String(),
      'created_by_name': createdByName,
      'created_by_email': createdByEmail,
    };
  }

  // Helper para obter cor baseada na categoria
  String get categoryType {
    switch (category?.toLowerCase()) {
      case 'festas':
        return 'festas';
      case 'eventos':
        return 'eventos';
      case 'esportes':
        return 'esportes';
      case 'educacao':
      case 'educação':
        return 'educacao';
      default:
        return 'eventos';
    }
  }
}

