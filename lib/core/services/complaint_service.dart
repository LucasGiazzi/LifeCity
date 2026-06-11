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
    FormData formData = FormData.fromMap({
      'description': description,
      'occurrence_date': occurrenceDate,
      'address': address,
      if (type != null && type.isNotEmpty) 'type': type,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
    });

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

  Future<Map<String, dynamic>?> getLikeStatus(String complaintId) async {
    try {
      final response = await _api.get('/api/complaints/$complaintId/likes');
      return Map<String, dynamic>.from(response.data);
    } on ApiException {
      return null;
    }
  }

  Future<Map<String, dynamic>?> toggleLike(String complaintId) async {
    try {
      final response =
          await _api.post('/api/complaints/$complaintId/like', {});
      return Map<String, dynamic>.from(response.data);
    } on ApiException {
      return null;
    }
  }

  Future<bool> editComplaint({
    required String complaintId,
    required String description,
    required String occurrenceDate,
    String? type,
    String? address,
  }) async {
    try {
      await _api.put('/api/complaints/$complaintId', {
        'description': description,
        'occurrence_date': occurrenceDate,
        if (type != null) 'type': type,
        if (address != null) 'address': address,
      });
      return true;
    } on ApiException catch (e) {
      print('Erro ao editar reclamação: ${e.message}');
      return false;
    }
  }

  Future<List<Map<String, dynamic>>> getComments(String complaintId) async {
    try {
      final response = await _api.get('/api/complaints/$complaintId/comments');
      if (response.data != null && response.data['comments'] != null) {
        return List<Map<String, dynamic>>.from(response.data['comments']);
      }
      return [];
    } on ApiException catch (e) {
      print('Erro ao buscar comentários: ${e.message}');
      return [];
    }
  }

  Future<Map<String, dynamic>?> addComment(
      String complaintId, String text) async {
    try {
      final response = await _api
          .post('/api/complaints/$complaintId/comments', {'text': text});
      if (response.data != null && response.data['comment'] != null) {
        return Map<String, dynamic>.from(response.data['comment']);
      }
      return null;
    } on ApiException catch (e) {
      print('Erro ao adicionar comentário: ${e.message}');
      return null;
    }
  }

  Future<Map<String, dynamic>?> toggleCommentLike(String complaintId, String commentId) async {
    try {
      final response = await _api.post(
        '/api/complaints/$complaintId/comments/$commentId/like', {},
      );
      return Map<String, dynamic>.from(response.data);
    } on ApiException {
      return null;
    }
  }

  Future<List<Map<String, dynamic>>> getFriendInteractions(String userId) async {
    try {
      final response = await _api.get('/api/complaints/users/$userId/interactions');
      if (response.data != null && response.data['interactions'] != null) {
        return List<Map<String, dynamic>>.from(response.data['interactions']);
      }
      return [];
    } on ApiException catch (e) {
      print('Erro ao buscar interações do amigo: ${e.message}');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getMyInteractions() async {
    try {
      final response = await _api.get('/api/complaints/me/interactions');
      if (response.data != null && response.data['interactions'] != null) {
        return List<Map<String, dynamic>>.from(response.data['interactions']);
      }
      return [];
    } on ApiException catch (e) {
      print('Erro ao buscar interações: ${e.message}');
      return [];
    }
  }

  Future<Map<String, dynamic>?> getUserXp(String userId) async {
    try {
      final response = await _api.get('/api/complaints/users/$userId/xp');
      return Map<String, dynamic>.from(response.data);
    } on ApiException {
      return null;
    }
  }

  Future<Map<String, dynamic>?> getMyXp() async {
    try {
      final response = await _api.get('/api/complaints/me/xp');
      return Map<String, dynamic>.from(response.data);
    } on ApiException {
      return null;
    }
  }

  Future<List<Map<String, dynamic>>> getHighlights({String period = 'day'}) async {
    try {
      final response = await _api.get('/api/complaints/highlights', params: {'period': period});
      if (response.data != null && response.data['complaints'] != null) {
        return List<Map<String, dynamic>>.from(response.data['complaints']);
      }
      return [];
    } on ApiException catch (e) {
      print('Erro ao buscar destaques: ${e.message}');
      return [];
    }
  }

  Future<Map<String, dynamic>?> getWitnessStatus(String complaintId) async {
    try {
      final response = await _api.get('/api/complaints/$complaintId/witness');
      return Map<String, dynamic>.from(response.data);
    } on ApiException {
      return null;
    }
  }

  Future<Map<String, dynamic>?> toggleWitness(String complaintId) async {
    try {
      final response = await _api.post('/api/complaints/$complaintId/witness', {});
      return Map<String, dynamic>.from(response.data);
    } on ApiException {
      return null;
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

  Future<List<Map<String, dynamic>>> getNearby({
    required double lat,
    required double lng,
    int? radiusM,
    int? limit,
  }) async {
    try {
      final response = await _api.get('/api/complaints/nearby', params: {
        'lat': lat,
        'lng': lng,
        if (radiusM != null) 'radius_m': radiusM,
        if (limit != null) 'limit': limit,
      });
      if (response.data != null && response.data['items'] != null) {
        return List<Map<String, dynamic>>.from(response.data['items']);
      }
      return [];
    } on ApiException catch (e) {
      print('Erro ao buscar nearby: ${e.message}');
      return [];
    }
  }

  Future<Map<String, dynamic>?> getComplaintById(String complaintId) async {
    try {
      final response = await _api.get('/api/complaints/$complaintId');
      return Map<String, dynamic>.from(response.data as Map);
    } on ApiException catch (e) {
      print('Erro ao buscar detalhe: ${e.message}');
      return null;
    }
  }

  Future<List<Map<String, dynamic>>> getComplaintTimeline(String complaintId) async {
    try {
      final response = await _api.get('/api/complaints/$complaintId/timeline');
      if (response.data != null && response.data['events'] != null) {
        return List<Map<String, dynamic>>.from(response.data['events']);
      }
      return [];
    } on ApiException catch (e) {
      print('Erro ao buscar timeline: ${e.message}');
      return [];
    }
  }

  Future<Map<String, dynamic>?> getWatch(String complaintId) async {
    try {
      final response = await _api.get('/api/complaints/$complaintId/watch');
      return Map<String, dynamic>.from(response.data);
    } on ApiException {
      return null;
    }
  }

  Future<Map<String, dynamic>?> patchWatch(
    String complaintId, {
    String? level,
    bool? muted,
  }) async {
    try {
      final response = await _api.patch('/api/complaints/$complaintId/watch', {
        if (level != null) 'level': level,
        if (muted != null) 'muted': muted,
      });
      return Map<String, dynamic>.from(response.data);
    } on ApiException {
      return null;
    }
  }

  Future<bool> deleteWatch(String complaintId) async {
    try {
      await _api.delete('/api/complaints/$complaintId/watch');
      return true;
    } on ApiException {
      return false;
    }
  }

  Future<List<Map<String, dynamic>>> getComplaintMessages(String complaintId) async {
    try {
      final response = await _api.get('/api/complaints/$complaintId/messages');
      if (response.data != null && response.data['messages'] != null) {
        return List<Map<String, dynamic>>.from(response.data['messages']);
      }
      return [];
    } on ApiException catch (e) {
      print('Erro ao buscar mensagens: ${e.message}');
      return [];
    }
  }

  Future<Map<String, dynamic>?> sendComplaintMessage(
    String complaintId,
    String body,
  ) async {
    try {
      final response = await _api.post('/api/complaints/$complaintId/messages', {
        'body': body,
      });
      if (response.data != null && response.data['message'] != null) {
        return Map<String, dynamic>.from(response.data['message']);
      }
      return null;
    } on ApiException catch (e) {
      print('Erro ao enviar mensagem: ${e.message}');
      return null;
    }
  }

  Future<void> markComplaintMessagesRead(String complaintId) async {
    try {
      await _api.patch('/api/complaints/$complaintId/messages/read', {});
    } on ApiException {
      // silencioso
    }
  }
}

