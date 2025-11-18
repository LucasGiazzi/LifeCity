import 'package:dio/dio.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  
  factory ApiService() {
    return _instance;
  }

  ApiService._internal()
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
    // Interceptor para adicionar token de autenticação
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        // Não adiciona Authorization em requisições de refreshToken
        if (_accessToken != null && !options.path.contains('/refreshToken')) {
          options.headers['Authorization'] = 'Bearer $_accessToken';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        // Se receber 403 (token expirado), tenta fazer refresh
        if (error.response?.statusCode == 403 && _refreshTokenCallback != null) {
          print('Token expirado');
          try {
            // Evita loop infinito: não faz refresh em requisições de refresh
            if (error.requestOptions.path == '/api/auth/refreshToken') {
              handler.next(error);
              return;
            }

            // Busca o refreshToken usando o callback
            final refreshToken = await _refreshTokenCallback?.call();
            if (refreshToken == null || refreshToken.isEmpty) {
              handler.next(error);
              return;
            }

            // Tenta fazer refresh do token
            try {
              final refreshResponse = await _dio.post(
                '/api/auth/refreshToken',
                data: {'refreshToken': refreshToken},
              );

              final newAccessToken = refreshResponse.data['accessToken'] as String?;
              if (newAccessToken != null && newAccessToken.isNotEmpty) {
                // Atualiza o token
                _accessToken = newAccessToken;
                
                // Chama o callback para atualizar o token no AuthState
                await _onTokenRefreshedCallback?.call(newAccessToken);

                // Atualiza o header da requisição original
                error.requestOptions.headers['Authorization'] = 'Bearer $newAccessToken';

                // Refaz a requisição original com o novo token
                final opts = Options(
                  method: error.requestOptions.method,
                  headers: error.requestOptions.headers,
                );
                final cloneReq = await _dio.request<dynamic>(
                  error.requestOptions.path,
                  options: opts,
                  data: error.requestOptions.data,
                  queryParameters: error.requestOptions.queryParameters,
                );
                handler.resolve(cloneReq);
                return;
              }
            } catch (refreshError) {
              // Se o refresh falhar, retorna o erro original
              handler.next(error);
              return;
            }
          } catch (e) {
            // Se houver algum erro, retorna o erro original
            handler.next(error);
            return;
          }
        }

        // Para outros erros, passa adiante normalmente
        handler.next(error);
      },
    ));

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

  final Dio _dio;
  String? _accessToken;
  
  // Callback para buscar o refreshToken
  Future<String?> Function()? _refreshTokenCallback;
  
  // Callback para notificar quando o token foi atualizado
  Future<void> Function(String newToken)? _onTokenRefreshedCallback;

  void setAccessToken(String? token) {
    _accessToken = token;
  }

  // Configura callback para buscar refreshToken
  void setRefreshTokenCallback(Future<String?> Function() callback) {
    _refreshTokenCallback = callback;
  }

  // Configura callback para notificar atualização do token
  void setOnTokenRefreshedCallback(Future<void> Function(String newToken) callback) {
    _onTokenRefreshedCallback = callback;
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

  Future<Response> postMultipart(String endpoint, FormData formData) async {
    try {
      final response = await _dio.post(
        endpoint,
        data: formData,
        options: Options(
          contentType: 'multipart/form-data',
        ),
      );
      return response;
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Response> putMultipart(String endpoint, FormData formData) async {
    try {
      final response = await _dio.put(
        endpoint,
        data: formData,
        options: Options(
          contentType: 'multipart/form-data',
        ),
      );
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
