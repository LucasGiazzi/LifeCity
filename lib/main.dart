import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'core/components/connectivity_banner.dart';
import 'core/routes/on_generate_route.dart';
import 'core/state/auth_state.dart';
import 'core/state/theme_provider.dart';
import 'core/themes/app_themes.dart';
import 'wrapper.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;

  final authState = AuthState();
  await authState.initialize();

  final themeProvider = ThemeProvider();
  await themeProvider.initialize();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: authState),
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
      title: 'LifeCity',
      theme: AppTheme.defaultTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeProvider.mode,
      builder: (context, child) => ConnectivityBanner(child: child!),
      home: const Wrapper(),
      onGenerateRoute: RouteGenerator.onGenerate,
    );
  }
}
