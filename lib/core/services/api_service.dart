import 'package:dio/dio.dart';

class ApiService {
  final Dio _dio;

  ApiService()
      : _dio = Dio(
          BaseOptions(
            baseUrl: 'http://10.0.2.2:3000', // seu backend local
            connectTimeout: const Duration(seconds: 10),
            receiveTimeout: const Duration(seconds: 10),
            headers: {
              'Content-Type': 'application/json',
            },
          ),
        ) {
    // Interceptor de log (opcional, pode remover em produção)
    _dio.interceptors.add(LogInterceptor(
      request: true,
      requestBody: true,
      responseBody: true,
      responseHeader: false,
      error: true,
      requestHeader: false,
    ));
  }

  // -----------------------------
  // MÉTODOS HTTP GENÉRICOS
  // -----------------------------

  Future<Response> get(String endpoint, {Map<String, dynamic>? params}) async {
    try {
      final response = await _dio.get(endpoint, queryParameters: params);
      return response;
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Response> post(String endpoint, dynamic data) async {
    try {
      final response = await _dio.post(endpoint, data: data);
      return response;
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Response> put(String endpoint, dynamic data) async {
    try {
      final response = await _dio.put(endpoint, data: data);
      return response;
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Response> delete(String endpoint, {Map<String, dynamic>? params}) async {
    try {
      final response = await _dio.delete(endpoint, queryParameters: params);
      return response;
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }
}

// ---------------------------------
// CLASSE DE ERROS PERSONALIZADOS
// ---------------------------------
class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final String? details;

  ApiException({
    required this.message,
    this.statusCode,
    this.details,
  });

  @override
  String toString() =>
      'ApiException: $message (statusCode: $statusCode, details: $details)';

  factory ApiException.fromDioError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
        return ApiException(message: 'Tempo de conexão esgotado.');
      case DioExceptionType.sendTimeout:
        return ApiException(message: 'Erro ao enviar dados para o servidor.');
      case DioExceptionType.receiveTimeout:
        return ApiException(message: 'Tempo de resposta do servidor esgotado.');
      case DioExceptionType.badResponse:
        final statusCode = error.response?.statusCode;
        final data = error.response?.data;
        String msg = 'Erro desconhecido no servidor.';

        if (statusCode != null) {
          if (statusCode >= 400 && statusCode < 500) {
            msg = 'Erro de requisição ($statusCode): ${data?['message'] ?? 'verifique os dados enviados.'}';
          } else if (statusCode >= 500) {
            msg = 'Erro interno do servidor ($statusCode).';
          }
        }

        return ApiException(
          message: msg,
          statusCode: statusCode,
          details: data.toString(),
        );
      case DioExceptionType.cancel:
        return ApiException(message: 'Requisição cancelada.');
      case DioExceptionType.unknown:
      default:
        return ApiException(
          message: 'Erro de conexão: ${error.message ?? 'verifique se o servidor está ativo.'}',
        );
    }
  }
}
