import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../routes/app_routes.dart';
import 'api_service.dart';

const _channelId = 'lifecity_complaints';
const _channelName = 'Ocorrências';
const _channelDescription = 'Atualizações de status das suas ocorrências';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
  } catch (_) {
    // Firebase não configurado (ex.: google-services.json ausente)
  }
}

class PushService {
  PushService._();
  static final PushService instance = PushService._();

  FirebaseMessaging? _messaging;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  GlobalKey<NavigatorState>? _navigatorKey;
  bool _initialized = false;
  bool _tokenRefreshListening = false;
  bool _localNotificationsReady = false;

  static const _pushPrefKey = 'push_notifications_enabled';

  /// true quando Firebase/FCM foi inicializado com sucesso neste device.
  bool get isAvailable => _initialized;

  Future<void> initialize({GlobalKey<NavigatorState>? navigatorKey}) async {
    if (_initialized) return;
    _navigatorKey = navigatorKey;

    try {
      await Firebase.initializeApp().timeout(
        const Duration(seconds: 8),
        onTimeout: () => throw StateError('Firebase.initializeApp timeout'),
      );
      _messaging = FirebaseMessaging.instance;

      await _initLocalNotifications();

      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

      await _messaging!.requestPermission();
      FirebaseMessaging.onMessage.listen(_onForegroundMessage);
      FirebaseMessaging.onMessageOpenedApp.listen(_handleRemoteMessage);
      final initial = await _messaging!.getInitialMessage();
      if (initial != null) _handleRemoteMessage(initial);

      _initialized = true;
    } catch (e) {
      _messaging = null;
      debugPrint('[PushService] Firebase não configurado — push desabilitado: $e');
    }
  }

  Future<void> _initLocalNotifications() async {
    if (_localNotificationsReady) return;

    const androidSettings = AndroidInitializationSettings('@mipmap/launcher_icon');
    const iosSettings = DarwinInitializationSettings();
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (response) {
        _navigateToComplaint(response.payload);
      },
    );

    if (Platform.isAndroid) {
      final androidPlugin = _localNotifications.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      await androidPlugin?.createNotificationChannel(
        const AndroidNotificationChannel(
          _channelId,
          _channelName,
          description: _channelDescription,
          importance: Importance.high,
        ),
      );
    }

    _localNotificationsReady = true;
  }

  Future<void> _onForegroundMessage(RemoteMessage message) async {
    if (!_localNotificationsReady) return;

    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_pushPrefKey) == false) return;

    final notification = message.notification;
    final title = notification?.title ?? message.data['title'];
    final body = notification?.body ?? message.data['body'];
    if (title == null && body == null) return;

    final complaintId = message.data['complaint_id'];
    final notificationId = _notificationIdFor(complaintId);

    const androidDetails = AndroidNotificationDetails(
      _channelId,
      _channelName,
      channelDescription: _channelDescription,
      importance: Importance.high,
      priority: Priority.high,
      icon: '@mipmap/launcher_icon',
    );
    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    await _localNotifications.show(
      notificationId,
      title ?? 'LifeCity',
      body ?? '',
      const NotificationDetails(android: androidDetails, iOS: iosDetails),
      payload: complaintId,
    );
  }

  int _notificationIdFor(String? complaintId) {
    if (complaintId == null || complaintId.isEmpty) {
      return DateTime.now().millisecondsSinceEpoch.remainder(100000);
    }
    return complaintId.hashCode.abs().remainder(100000);
  }

  Future<void> syncTokenIfEnabled() async {
    if (!_initialized || _messaging == null) return;

    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_pushPrefKey) == false) return;

    try {
      final messaging = _messaging!;
      final token = await messaging.getToken();
      if (token == null) return;

      final api = ApiService();
      await api.post('/api/users/device-token', {
        'token': token,
        'platform': Platform.isIOS ? 'ios' : 'android',
      });

      if (!_tokenRefreshListening) {
        _tokenRefreshListening = true;
        messaging.onTokenRefresh.listen((newToken) async {
          try {
            await api.post('/api/users/device-token', {
              'token': newToken,
              'platform': Platform.isIOS ? 'ios' : 'android',
            });
          } catch (e) {
            debugPrint('[PushService] tokenRefresh: $e');
          }
        });
      }
    } catch (e) {
      debugPrint('[PushService] syncToken: $e');
    }
  }

  void _handleRemoteMessage(RemoteMessage message) {
    final complaintId = message.data['complaint_id'];
    final openChat = message.data['open_chat'] == 'true'
        || message.data['type'] == 'complaint_message';
    _navigateToComplaint(complaintId, openChat: openChat);
  }

  void _navigateToComplaint(String? complaintId, {bool openChat = false}) {
    if (complaintId == null || complaintId.isEmpty) return;
    final nav = _navigatorKey?.currentState;
    if (nav == null) return;

    nav.pushNamed(
      AppRoutes.complaintTrack,
      arguments: openChat
          ? {'complaintId': complaintId, 'openChat': true}
          : complaintId,
    );
  }

  static Future<bool> isPushEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_pushPrefKey) ?? true;
  }

  static Future<void> setPushEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_pushPrefKey, enabled);
  }
}
