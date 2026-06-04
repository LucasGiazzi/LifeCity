import 'api_service.dart';

class ResolveLocationResult {
  final String cdMun;
  final String municipio;
  final String siglaUf;
  final bool tenantActive;

  ResolveLocationResult({
    required this.cdMun,
    required this.municipio,
    required this.siglaUf,
    required this.tenantActive,
  });

  factory ResolveLocationResult.fromJson(Map<String, dynamic> json) {
    return ResolveLocationResult(
      cdMun: json['cd_mun'] as String,
      municipio: json['municipio'] as String,
      siglaUf: json['sigla_uf'] as String? ?? '',
      tenantActive: json['tenantActive'] as bool? ?? false,
    );
  }
}

class LocationAuthService {
  final ApiService _api = ApiService();

  Future<ResolveLocationResult?> resolveLocation({
    required double latitude,
    required double longitude,
  }) async {
    try {
      final response = await _api.post('/api/auth/resolve-location', {
        'latitude': latitude,
        'longitude': longitude,
      });
      return ResolveLocationResult.fromJson(
        response.data as Map<String, dynamic>,
      );
    } on ApiException catch (e) {
      throw LocationAuthException(e.message, statusCode: e.statusCode);
    }
  }

  Future<Map<String, dynamic>?> confirmLocation({
    required String cdMun,
    required String address,
    required double latitude,
    required double longitude,
  }) async {
    try {
      final response = await _api.post('/api/auth/confirm-location', {
        'cd_mun': cdMun,
        'address': address,
        'latitude': latitude,
        'longitude': longitude,
      });
      return response.data as Map<String, dynamic>?;
    } on ApiException catch (e) {
      throw LocationAuthException(e.message, statusCode: e.statusCode);
    }
  }
}

class LocationAuthException implements Exception {
  final String message;
  final int? statusCode;

  LocationAuthException(this.message, {this.statusCode});

  bool get isNotAvailable => statusCode == 403;
  bool get isNotFound => statusCode == 404;
}
