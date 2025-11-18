import 'api_service.dart';

class EventService {
  final ApiService _api = ApiService();

  Future<Map<String, dynamic>?> createEvent({
    required String description,
    required String startDate,
    required String address,
    String? category,
    String? endDate,
    double? latitude,
    double? longitude,
  }) async {
    try {
      final response = await _api.post('/api/events/create', {
        'description': description,
        'start_date': startDate,
        'address': address,
        if (category != null && category.isNotEmpty) 'category': category,
        if (endDate != null && endDate.isNotEmpty) 'end_date': endDate,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
      });
      return response.data;
    } on ApiException catch (e) {
      print('Erro ao criar evento: ${e.message}');
      return null;
    }
  }

  Future<List<Map<String, dynamic>>> getAllEvents() async {
    try {
      final response = await _api.get('/api/events');
      if (response.data != null && response.data['events'] != null) {
        return List<Map<String, dynamic>>.from(response.data['events']);
      }
      return [];
    } on ApiException catch (e) {
      print('Erro ao buscar eventos: ${e.message}');
      return [];
    }
  }
}

