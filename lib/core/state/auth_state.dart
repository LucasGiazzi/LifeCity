import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../services/location_auth_service.dart';
import '../services/push_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AuthState extends ChangeNotifier {
  final AuthService _authService = AuthService();
  final ApiService _apiService = ApiService();
  final LocationAuthService _locationAuthService = LocationAuthService();
  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  String? _accessToken;
  String? get accessToken => _accessToken;

  String? _refreshToken;
  Map<String, dynamic>? _currentUser;
  Map<String, dynamic>? get currentUser => _currentUser;

  bool _keepLoggedIn = true;
  bool get keepLoggedIn => _keepLoggedIn;

  bool _hasSeenOnboarding = false;
  bool get hasSeenOnboarding => _hasSeenOnboarding;

  bool get isAuthenticated => _accessToken != null && _accessToken!.isNotEmpty;

  bool get needsLocationConfirmation {
    if (!isAuthenticated || _currentUser == null) return false;
    final confirmed = _currentUser!['address_confirmed_at'];
    return confirmed == null || (confirmed is String && confirmed.isEmpty);
  }

  Future<bool> login(String email, String password) async {
    setLoading(true);
    setErrorMessage(null);

    final userCredential = await _authService.signInWithEmailAndPassword(email, password);
    debugPrint('userCredential: $userCredential');

    setLoading(false);

    if (userCredential != null && userCredential['accessToken'] != null) {
      _accessToken = userCredential['accessToken'] as String;
      _refreshToken = userCredential['refreshToken'] as String?;
      _currentUser = userCredential['user'] as Map<String, dynamic>?;

      _apiService.setAccessToken(_accessToken);

      _apiService.setRefreshTokenCallback(() async => _refreshToken);
      _apiService.setOnTokenRefreshedCallback((newToken) async {
        _accessToken = newToken;
        _saveTokens();
        await loadUserData();
        notifyListeners();
      });

      await _saveTokens();
      await loadUserData();

      await PushService.instance.syncTokenIfEnabled();

      notifyListeners();
      return true;
    } else {
      setErrorMessage('E-mail ou senha inválidos. Tente novamente.');
      return false;
    }
  }

  Future<bool> signUp(
      {required String email, required String password, required String name, required String cpf, required String phone, required String cep}) async {
    setLoading(true);
    setErrorMessage(null);

    try {
      final registered = await _authService.signUp(
        email: email,
        password: password,
        name: name,
        cpf: cpf,
        phone: phone,
        cep: cep,
      );
      if (registered == null) {
        setErrorMessage('Não foi possível concluir o cadastro.');
        setLoading(false);
        return false;
      }

      final loggedIn = await login(email, password);
      setLoading(false);
      return loggedIn;
    } catch (e) {
      setErrorMessage('Ocorreu um erro durante o cadastro.');
      setLoading(false);
      return false;
    }
  }

  Future<ResolveLocationResult?> resolveLocation(double lat, double lng) async {
    setErrorMessage(null);
    try {
      return await _locationAuthService.resolveLocation(
        latitude: lat,
        longitude: lng,
      );
    } on LocationAuthException catch (e) {
      setErrorMessage(e.message);
      rethrow;
    } catch (e) {
      setErrorMessage('Erro ao identificar sua cidade.');
      return null;
    }
  }

  Future<bool> confirmLocation({
    required String cdMun,
    required String address,
    required double latitude,
    required double longitude,
  }) async {
    setErrorMessage(null);
    try {
      final result = await _locationAuthService.confirmLocation(
        cdMun: cdMun,
        address: address,
        latitude: latitude,
        longitude: longitude,
      );
      if (result != null) {
        await loadUserData();
        return true;
      }
      setErrorMessage('Erro ao confirmar localização.');
      return false;
    } on LocationAuthException catch (e) {
      setErrorMessage(e.message);
      return false;
    } catch (e) {
      setErrorMessage('Erro ao confirmar localização.');
      return false;
    }
  }

  Future<void> logout() async {
    await _authService.signOut(_refreshToken ?? '');
    _accessToken = null;
    _refreshToken = null;
    _currentUser = null;
    _apiService.setAccessToken(null);
    await _clearTokens();
    notifyListeners();
  }

  Future<void> setKeepLoggedIn(bool value) async {
    _keepLoggedIn = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('keepLoggedIn', value);
    if (!value) {
      await prefs.remove('accessToken');
      await prefs.remove('refreshToken');
    } else if (_accessToken != null) {
      await _saveTokens();
    }
    notifyListeners();
  }

  Future<void> markOnboardingAsSeen() async {
    _hasSeenOnboarding = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('hasSeenOnboarding', true);
    notifyListeners();
  }

  Future<void> initialize() async {
    await _loadTokens();

    // Callbacks must be set before loadUserData so token refresh works on startup
    _apiService.setRefreshTokenCallback(() async => _refreshToken);
    _apiService.setOnTokenRefreshedCallback((newToken) async {
      _accessToken = newToken;
      _saveTokens();
      await loadUserData();
      notifyListeners();
    });
    _apiService.setOnLogoutCallback(() async {
      await logout();
    });

    if (_accessToken != null) {
      _apiService.setAccessToken(_accessToken);
      await loadUserData();
      // If user data couldn't be fetched even after refresh attempts, clear session
      if (_currentUser == null) {
        await _clearTokens();
        _accessToken = null;
        _refreshToken = null;
      }
    }

    notifyListeners();
  }

  Future<void> loadUserData() async {
    if (_accessToken == null) return;

    final userData = await _authService.getMe();
    if (userData != null && userData['user'] != null) {
      _currentUser = userData['user'] as Map<String, dynamic>;
      notifyListeners();
    }
  }

  Future<bool> updateUser({
    String? name,
    String? cpf,
    String? phone,
    String? birthDate,
    String? photoPath,
  }) async {
    setLoading(true);
    setErrorMessage(null);

    try {
      final result = await _authService.editUser(
        name: name,
        cpf: cpf,
        phone: phone,
        birthDate: birthDate,
        photoPath: photoPath,
      );

      setLoading(false);

      if (result != null && result['user'] != null) {
        _currentUser = result['user'] as Map<String, dynamic>;
        notifyListeners();
        return true;
      } else {
        setErrorMessage('Erro ao atualizar dados do usuário.');
        return false;
      }
    } catch (e) {
      setLoading(false);
      setErrorMessage('Erro ao atualizar dados do usuário.');
      return false;
    }
  }

  Future<void> _saveTokens() async {
    if (!_keepLoggedIn) return;
    final prefs = await SharedPreferences.getInstance();
    if (_accessToken != null) {
      await prefs.setString('accessToken', _accessToken!);
    }
    if (_refreshToken != null) {
      await prefs.setString('refreshToken', _refreshToken!);
    }
  }

  Future<void> _loadTokens() async {
    final prefs = await SharedPreferences.getInstance();
    _keepLoggedIn = prefs.getBool('keepLoggedIn') ?? true;
    _hasSeenOnboarding = prefs.getBool('hasSeenOnboarding') ?? false;
    _accessToken = prefs.getString('accessToken');
    _refreshToken = prefs.getString('refreshToken');
  }

  Future<void> _clearTokens() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('accessToken');
    await prefs.remove('refreshToken');
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
