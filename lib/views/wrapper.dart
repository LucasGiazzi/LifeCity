import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/routes/app_routes.dart';
import '../core/state/auth_state.dart';

class Wrapper extends StatefulWidget {
  const Wrapper({super.key});

  @override
  State<Wrapper> createState() => _WrapperState();
}

class _WrapperState extends State<Wrapper> with SingleTickerProviderStateMixin {
  late final AnimationController _fadeController;
  late final Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();

    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fadeAnimation = CurvedAnimation(parent: _fadeController, curve: Curves.easeIn);
    _fadeController.forward();

    _navigate();
  }

  @override
  void dispose() {
    _fadeController.dispose();
    super.dispose();
  }

  Future<void> _navigate() async {
    await Future.delayed(const Duration(milliseconds: 3000));
    if (!mounted) return;

    final auth = context.read<AuthState>();
    final route = auth.isAuthenticated
        ? AppRoutes.entryPoint
        : auth.hasSeenOnboarding
            ? AppRoutes.introLogin
            : AppRoutes.onboarding;

    Navigator.pushReplacementNamed(context, route);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          // Logo centralizada
          Center(
            child: FadeTransition(
              opacity: _fadeAnimation,
              child: Image.asset(
                'assets/images/onboarding1.png',
                width: 220,
              ),
            ),
          ),

          // Capivara animada no canto inferior direito
          Positioned(
            bottom: 24,
            right: 16,
            child: Image.asset(
              'assets/images/gif_loading.webp',
              width: 110,
            ),
          ),
        ],
      ),
    );
  }
}
