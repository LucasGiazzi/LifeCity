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

  Future<Map<String, dynamic>?> getMe() async {
    try {
      final response = await _api.get('/api/auth/me');
      return response.data;
    } on ApiException catch (e) {
      print('Erro getMe: ${e.message}');
      return null;
    }
  }

  Future<Map<String, dynamic>?> editUser({
    String? name,
    String? cpf,
    String? phone,
    String? birthDate,
    String? photoPath,
  }) async {
    try {
      FormData formData = FormData.fromMap({
        if (name != null) 'name': name,
        if (cpf != null) 'cpf': cpf,
        if (phone != null) 'phone': phone,
        if (birthDate != null) 'birthDate': birthDate,
        if (photoPath != null)
          'pfp': await MultipartFile.fromFile(
            photoPath,
            filename: 'profile_photo.jpg',
          ),
      });

      final response = await _api.putMultipart('/api/auth/editUser', formData);
      return response.data;
    } on ApiException catch (e) {
      print('Erro editUser: ${e.message}');
      return null;
    }
  }

  Future<String?> refreshToken(String refreshToken) async {
    try {
      final response = await _api.post('/api/auth/refreshToken', {
        'refreshToken': refreshToken,
      });
      return response.data['accessToken'] as String?;
    } on ApiException catch (e) {
      print('Erro refreshToken: ${e.message}');
      return null;
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
