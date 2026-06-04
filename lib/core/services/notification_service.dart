import '../models/notification_model.dart';
import 'api_service.dart';

class NotificationService {
  final ApiService _api = ApiService();

  Future<List<NotificationModel>> getNotifications() async {
    try {
      final response = await _api.get('/api/notifications');
      final list = response.data['notifications'] as List? ?? [];
      return list.map((e) => NotificationModel.fromJson(e as Map<String, dynamic>)).toList();
    } on ApiException catch (e) {
      print('Erro ao buscar notificações: ${e.message}');
      return [];
    }
  }

  Future<int> getUnreadCount() async {
    try {
      final response = await _api.get('/api/notifications/unread-count');
      return (response.data['count'] as num?)?.toInt() ?? 0;
    } on ApiException catch (e) {
      print('Erro ao buscar contagem de notificações: ${e.message}');
      return 0;
    }
  }

  Future<void> markRead(String id) async {
    try {
      await _api.patch('/api/notifications/$id/read', {});
    } on ApiException catch (e) {
      print('Erro ao marcar notificação: ${e.message}');
    }
  }

  Future<void> markAllRead() async {
    try {
      await _api.patch('/api/notifications/read-all', {});
    } on ApiException catch (e) {
      print('Erro ao marcar todas as notificações: ${e.message}');
    }
  }
}
