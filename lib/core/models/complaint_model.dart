class ComplaintModel {
  final String id;
  final String description;
  final DateTime occurrenceDate;
  final String? type;
  final String? address;
  final double? latitude;
  final double? longitude;
  final DateTime createdAt;
  final String? createdBy;
  final String? createdByName;
  final String? createdByEmail;
  final String? createdByPhotoUrl;
  final int likesCount;

  ComplaintModel({
    required this.id,
    required this.description,
    required this.occurrenceDate,
    this.type,
    this.address,
    this.latitude,
    this.longitude,
    required this.createdAt,
    this.createdBy,
    this.createdByName,
    this.createdByEmail,
    this.createdByPhotoUrl,
    this.likesCount = 0,
  });

  factory ComplaintModel.fromJson(Map<String, dynamic> json) {
    return ComplaintModel(
      id: json['id'].toString(),
      description: json['description'] as String,
      occurrenceDate: DateTime.parse(json['occurrence_date'] as String),
      type: json['type'] as String?,
      address: json['address'] as String?,
      latitude: json['latitude'] != null 
          ? double.tryParse(json['latitude'].toString()) 
          : null,
      longitude: json['longitude'] != null 
          ? double.tryParse(json['longitude'].toString()) 
          : null,
      createdAt: DateTime.parse(json['created_at'] as String),
      createdBy: json['created_by']?.toString(),
      createdByName: json['created_by_name'] as String?,
      createdByEmail: json['created_by_email'] as String?,
      createdByPhotoUrl: json['created_by_photo_url'] as String?,
      likesCount: json['likes_count'] != null
          ? int.tryParse(json['likes_count'].toString()) ?? 0
          : 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'description': description,
      'occurrence_date': occurrenceDate.toIso8601String().split('T')[0], // Apenas data, sem hora
      'type': type,
      'address': address,
      'latitude': latitude,
      'longitude': longitude,
      'created_at': createdAt.toIso8601String(),
      'created_by': createdBy,
      'created_by_name': createdByName,
      'created_by_email': createdByEmail,
    };
  }
}

