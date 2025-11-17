import 'package:dio/dio.dart';
import 'api_service.dart';

class AuthService {
  final ApiService _api = ApiService();

  Future<Map<String, dynamic>?> signInWithEmailAndPassword(
      String email, String password) async {
    try {
      final response = await _api.post('/api/auth/login', {
        'email': email,
        'password': password,
      });
      return response.data;
    } on ApiException catch (e) {
      print('Erro login: ${e.message}');
      return null;
    }
  }

  Future<Map<String, dynamic>?> signUp({
    required String email,
    required String password,
    required String name,
    required String cpf,
    required String phone,
  }) async {
    try {
      final response = await _api.post('/api/auth/register', {
        'email': email,
        'password': password,
        'name': name,
        'cpf': cpf,
        'phone': phone,
      });

      return response.data;
    } on ApiException catch (e) {
      print('Erro register: ${e.message}');
      return null;
    }
  }

  Future<bool> editUser({
    required String token,
    String? name,
    String? cpf,
    String? phone,
  }) async {
    try {
      final response = await _api.put(
        '/api/auth/editUser',
        {
          'name': name,
          'cpf': cpf,
          'phone': phone,
        },
      );

      return response.statusCode == 200;
    } on ApiException catch (e) {
      print('Erro editUser: ${e.message}');
      return false;
    }
  }

  Future<void> signOut() async {
    try {
      await _api.post('/api/auth/logout', {});
    } catch (_) {
      // opcional: sem erro
    }
  }
}
