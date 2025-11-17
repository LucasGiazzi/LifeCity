import 'package:flutter/foundation.dart';
import '../services/auth_service.dart';
import 'package:firebase_auth/firebase_auth.dart';

class AuthState extends ChangeNotifier {
  final AuthService _authService = AuthService();

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  Future<bool> login(String email, String password) async {
    setLoading(true);
    setErrorMessage(null);

    final userCredential = await _authService.signInWithEmailAndPassword(email, password);

    setLoading(false);

    if (userCredential != null) {
      return true;
    } else {
      setErrorMessage('E-mail ou senha inválidos. Tente novamente.');
      return false;
    }
  }

  Future<bool> signUp(
      {required String email, required String password, required String name, required String cpf, required String phone}) async {
    setLoading(true);
    setErrorMessage(null);

    try {
      final userCredential = await _authService.signUp(
        email: email,
        password: password,
        name: name,
        cpf: cpf,
        phone: phone,
      );
      setLoading(false);
      return userCredential != null;
    } catch (e) {
      if (e is FirebaseAuthException && e.code == 'email-already-in-use') {
        setErrorMessage('Este e-mail já está em uso.');
      } else {
        setErrorMessage('Ocorreu um erro durante o cadastro.');
      }
      setLoading(false);
      return false;
    }
  }
  
  /* Future<bool> loginWithGoogle() async {
    setLoading(true);
    setErrorMessage(null);

    final userCredential = await _authService.signInWithGoogle();

    setLoading(false);

    if (userCredential != null) {
      return true;
    } else {
      setErrorMessage('Falha ao fazer login com o Google.');
      return false;
    }
  } */

  Future<void> logout() async {
    await _authService.signOut();
  }

  void setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }

  void setErrorMessage(String? message) {
    _errorMessage = message;
    notifyListeners();
  }
}
