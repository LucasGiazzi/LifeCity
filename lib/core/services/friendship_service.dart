import 'api_service.dart';

class FriendshipService {
  final ApiService _api = ApiService();

  Future<List<Map<String, dynamic>>> discover() async {
    final response = await _api.get('/api/friendships/discover');
    final list = response.data['users'];
    if (list is List) {
      return List<Map<String, dynamic>>.from(list);
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> listIncoming() async {
    final response = await _api.get('/api/friendships/incoming');
    final list = response.data['requests'];
    if (list is List) {
      return List<Map<String, dynamic>>.from(list);
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> listOutgoing() async {
    final response = await _api.get('/api/friendships/outgoing');
    final list = response.data['requests'];
    if (list is List) {
      return List<Map<String, dynamic>>.from(list);
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> listFriends() async {
    final response = await _api.get('/api/friendships');
    final list = response.data['friends'];
    if (list is List) {
      return List<Map<String, dynamic>>.from(list);
    }
    return [];
  }

  Future<bool> sendRequest(String userId) async {
    await _api.post('/api/friendships/request', {'userId': userId});
    return true;
  }

  Future<bool> accept(int friendshipId) async {
    await _api.post('/api/friendships/$friendshipId/accept', {});
    return true;
  }

  Future<bool> reject(int friendshipId) async {
    await _api.post('/api/friendships/$friendshipId/reject', {});
    return true;
  }
}
