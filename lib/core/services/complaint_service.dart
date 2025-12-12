import 'dart:io';
import 'package:dio/dio.dart';
import 'api_service.dart';

class ComplaintService {
  final ApiService _api = ApiService();

  Future<Map<String, dynamic>?> createComplaint({
    required String description,
    required String occurrenceDate,
    required String address,
    String? type,
    double? latitude,
    double? longitude,
    List<File>? photos,
  }) async {
    try {
      FormData formData = FormData.fromMap({
        'description': description,
        'occurrence_date': occurrenceDate,
        'address': address,
        if (type != null && type.isNotEmpty) 'type': type,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
      });

      // Adicionar fotos se houver
      if (photos != null && photos.isNotEmpty) {
        formData.files.addAll(
          photos.asMap().entries.map((entry) {
            final index = entry.key;
            final photo = entry.value;
            return MapEntry(
              'photos',
              MultipartFile.fromFileSync(
                photo.path,
                filename: 'photo_$index.jpg',
              ),
            );
          }),
        );
      }

      final response = await _api.postMultipart('/api/complaints/create', formData);
      return response.data;
    } on ApiException catch (e) {
      print('Erro ao criar reclamação: ${e.message}');
      return null;
    }
  }

  Future<List<Map<String, dynamic>>> getAllComplaints() async {
    try {
      final response = await _api.get('/api/complaints');
      if (response.data != null && response.data['complaints'] != null) {
        return List<Map<String, dynamic>>.from(response.data['complaints']);
      }
      return [];
    } on ApiException catch (e) {
      print('Erro ao buscar reclamações: ${e.message}');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getPhotos(String complaintId) async {
    try {
      final response = await _api.get('/api/complaints/$complaintId/photos');
      if (response.data != null && response.data['photos'] != null) {
        return List<Map<String, dynamic>>.from(response.data['photos']);
      }
      return [];
    } on ApiException catch (e) {
      print('Erro ao buscar fotos da reclamação: ${e.message}');
      return [];
    }
  }

  Future<bool> deleteComplaint(String complaintId) async {
    try {
      await _api.delete('/api/complaints/$complaintId');
      return true;
    } on ApiException catch (e) {
      print('Erro ao excluir reclamação: ${e.message}');
      return false;
    }
  }
}

