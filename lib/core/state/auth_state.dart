import 'package:flutter/foundation.dart';
import '../services/auth_service.dart';

class AuthState extends ChangeNotifier {
  final AuthService _authService = AuthService();

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  Future<bool> login(String email, String password) async {
    _setLoading(true);
    _setErrorMessage(null);

    final userCredential = await _authService.signInWithEmailAndPassword(email, password);

    _setLoading(false);

    if (userCredential != null) {
      return true;
    } else {
      _setErrorMessage('E-mail ou senha inválidos. Tente novamente.');
      return false;
    }
  }

  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }

  void _setErrorMessage(String? message) {
    _errorMessage = message;
    notifyListeners();
  }
}
