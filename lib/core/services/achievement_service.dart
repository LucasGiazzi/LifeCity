import '../models/achievement_model.dart';
import 'api_service.dart';

class AchievementService {
  final ApiService _api = ApiService();

  Future<List<AchievementModel>> getCatalog() async {
    try {
      final response = await _api.get('/api/achievements');
      final list = response.data['achievements'] as List? ?? [];
      return list.map((e) => AchievementModel.fromJson(e as Map<String, dynamic>)).toList();
    } on ApiException catch (e) {
      print('Erro ao buscar catálogo de conquistas: ${e.message}');
      return [];
    }
  }

  Future<List<AchievementModel>> getMyAchievements() async {
    try {
      final response = await _api.get('/api/achievements/me');
      final list = response.data['achievements'] as List? ?? [];
      return list.map((e) => AchievementModel.fromJson(e as Map<String, dynamic>)).toList();
    } on ApiException catch (e) {
      print('Erro ao buscar conquistas: ${e.message}');
      return [];
    }
  }

  Future<List<AchievementModel>> getUserFeatured(String userId) async {
    try {
      final response = await _api.get('/api/achievements/users/$userId');
      final list = response.data['achievements'] as List? ?? [];
      return list.map((e) => AchievementModel.fromJson(e as Map<String, dynamic>)).toList();
    } on ApiException catch (e) {
      print('Erro ao buscar conquistas do usuário: ${e.message}');
      return [];
    }
  }

  Future<bool> setFeatured(List<String> achievementIds) async {
    try {
      await _api.patch('/api/achievements/me/featured', {'achievement_ids': achievementIds});
      return true;
    } on ApiException catch (e) {
      print('Erro ao definir conquistas em destaque: ${e.message}');
      return false;
    }
  }
}
