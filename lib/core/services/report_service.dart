import 'api_service.dart';

class ReportService {
  final _api = ApiService();

  Future<({bool success, String? error})> submitReport({
    required String targetType,
    required String targetId,
    required String reason,
    String? details,
  }) async {
    try {
      await _api.post('/api/reports', {
        'target_type': targetType,
        'target_id': targetId,
        'reason': reason,
        if (details != null && details.isNotEmpty) 'details': details,
      });
      return (success: true, error: null);
    } on ApiException catch (e) {
      if (e.statusCode == 409) {
        return (success: false, error: 'Você já denunciou este conteúdo.');
      }
      return (success: false, error: e.message);
    }
  }
}
