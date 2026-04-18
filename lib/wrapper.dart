import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/state/auth_state.dart';
import 'views/entrypoint/entrypoint_ui.dart';
import 'views/onboarding/onboarding_page.dart';

class Wrapper extends StatelessWidget {
  const Wrapper({super.key});

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthState>();

    if (authState.isAuthenticated) {
      return const EntryPointUI();
    }
    return const OnboardingPage();
  }
}
