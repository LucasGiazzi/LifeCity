import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/routes/on_generate_route.dart';
import 'core/state/auth_state.dart';
import 'core/themes/app_themes.dart';
import 'wrapper.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final authState = AuthState();
  // Inicializar o estado de autenticação (carregar tokens salvos)
  await authState.initialize();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: authState),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'eGrocery',
      theme: AppTheme.defaultTheme,
      home: const Wrapper(), // Define o Wrapper como a tela inicial
      onGenerateRoute: RouteGenerator.onGenerate,
    );
  }
}
