import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'core/components/connectivity_banner.dart';
import 'core/routes/on_generate_route.dart';
import 'core/services/location_service.dart';
import 'core/services/push_service.dart';
import 'core/state/category_state.dart';
import 'core/state/auth_state.dart';
import 'core/state/theme_provider.dart';
import 'core/themes/app_themes.dart';
import 'views/wrapper.dart';

final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: 'backend/.env');
  GoogleFonts.config.allowRuntimeFetching = true;

  await PushService.instance.initialize(navigatorKey: rootNavigatorKey);
  unawaited(LocationService.instance.init());

  final authState = AuthState();
  await authState.initialize();

  final categoryState = CategoryState();
  await categoryState.initialize();

  final themeProvider = ThemeProvider();
  await themeProvider.initialize();

  if (authState.isAuthenticated) {
    await PushService.instance.syncTokenIfEnabled();
  }

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: authState),
        ChangeNotifierProvider.value(value: categoryState),
        ChangeNotifierProvider.value(value: themeProvider),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      navigatorKey: rootNavigatorKey,
      title: 'LifeCity',
      theme: AppTheme.light(accent: themeProvider.accentColor),
      darkTheme: AppTheme.dark(accent: themeProvider.accentColor),
      themeMode: themeProvider.mode,
      builder: (context, child) => ConnectivityBanner(child: child!),
      home: const Wrapper(),
      onGenerateRoute: RouteGenerator.onGenerate,
    );
  }
}
