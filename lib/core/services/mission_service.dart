import '../models/mission_model.dart';
import 'api_service.dart';

class MissionService {
  final ApiService _api = ApiService();

  Future<({UserMissionModel? daily, UserMissionModel? weekly})> getMyMissions() async {
    try {
      final response = await _api.get('/api/missions');
      final data = response.data as Map<String, dynamic>;
      return (
        daily: data['daily'] != null
            ? UserMissionModel.fromJson(data['daily'] as Map<String, dynamic>)
            : null,
        weekly: data['weekly'] != null
            ? UserMissionModel.fromJson(data['weekly'] as Map<String, dynamic>)
            : null,
      );
    } on ApiException catch (e) {
      print('Erro ao listar missões: ${e.message}');
      return (daily: null, weekly: null);
    }
  }

  Future<List<TeamModel>> getTeams() async {
    try {
      final response = await _api.get('/api/missions/teams');
      final list = response.data['teams'] as List? ?? [];
      return list
          .map((e) => TeamModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } on ApiException catch (e) {
      print('Erro ao listar equipes: ${e.message}');
      return [];
    }
  }

  Future<TeamModel?> createTeam(String name) async {
    try {
      final response = await _api.post('/api/missions/teams', {'name': name});
      final data = response.data['team'] as Map<String, dynamic>?;
      return data != null ? TeamModel.fromJson(data) : null;
    } on ApiException catch (e) {
      print('Erro ao criar equipe: ${e.message}');
      return null;
    }
  }

  Future<TeamModel?> getTeamById(String id) async {
    try {
      final response = await _api.get('/api/missions/teams/$id');
      final data = response.data as Map<String, dynamic>;
      final team = data['team'] as Map<String, dynamic>;
      final members = data['members'] as List? ?? [];
      return TeamModel.fromJson({...team, 'members': members});
    } on ApiException catch (e) {
      print('Erro ao buscar equipe: ${e.message}');
      return null;
    }
  }

  Future<bool> inviteToTeam(String teamId, String userId) async {
    try {
      await _api.post('/api/missions/teams/$teamId/invite', {'user_id': userId});
      return true;
    } on ApiException catch (e) {
      print('Erro ao convidar: ${e.message}');
      return false;
    }
  }

  Future<bool> acceptTeamInvite(String teamId) async {
    try {
      await _api.post('/api/missions/teams/$teamId/accept', {});
      return true;
    } on ApiException catch (e) {
      print('Erro ao aceitar convite: ${e.message}');
      return false;
    }
  }

  Future<bool> rejectTeamInvite(String teamId) async {
    try {
      await _api.post('/api/missions/teams/$teamId/reject', {});
      return true;
    } on ApiException catch (e) {
      print('Erro ao recusar convite: ${e.message}');
      return false;
    }
  }
}
