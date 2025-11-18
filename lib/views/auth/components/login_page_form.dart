import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';

import '../../../core/constants/constants.dart';
import '../../../core/routes/app_routes.dart';
import '../../../core/state/auth_state.dart';
import '../../../core/themes/app_themes.dart';
import '../../../core/utils/validators.dart';
import 'login_button.dart';

class LoginPageForm extends StatefulWidget {
  const LoginPageForm({super.key});

  @override
  State<LoginPageForm> createState() => _LoginPageFormState();
}

class _LoginPageFormState extends State<LoginPageForm> {
  final _key = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool isPasswordShown = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void onPassShowClicked() {
    setState(() {
      isPasswordShown = !isPasswordShown;
    });
  }

  Future<void> onLogin() async {
    final bool isFormOkay = _key.currentState?.validate() ?? false;
    if (!isFormOkay) {
      return;
    }

    final authState = Provider.of<AuthState>(context, listen: false);
    final success = await authState.login(
      _emailController.text.trim(),
      _passwordController.text.trim(),
    );

    if (success && mounted) {
      // Navega para EntryPointUI removendo todas as rotas anteriores
      Navigator.pushNamedAndRemoveUntil(
        context,
        AppRoutes.entryPoint,
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthState>(
      builder: (context, authState, child) {
        return Theme(
          data: AppTheme.defaultTheme.copyWith(
            inputDecorationTheme: AppTheme.secondaryInputDecorationTheme,
          ),
          child: Padding(
            padding: const EdgeInsets.all(AppDefaults.padding),
            child: Form(
              key: _key,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Email Field
                  const Text("E-mail"),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    validator: Validators.email.call,
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: AppDefaults.padding),

                  // Password Field
                  const Text("Senha"),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _passwordController,
                    validator: Validators.password.call,
                    onFieldSubmitted: (v) => onLogin(),
                    textInputAction: TextInputAction.done,
                    obscureText: !isPasswordShown,
                    decoration: InputDecoration(
                      suffixIcon: Material(
                        color: Colors.transparent,
                        child: IconButton(
                          onPressed: onPassShowClicked,
                          icon: SvgPicture.asset(
                            AppIcons.eye,
                            width: 24,
                          ),
                        ),
                      ),
                    ),
                  ),

                  // Forget Password
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () {
                        Navigator.pushNamed(context, AppRoutes.forgotPassword);
                      },
                      child: const Text('Esqueceu a senha?'),
                    ),
                  ),
                  const SizedBox(height: AppDefaults.padding / 2),

                  // Error Message
                  if (authState.errorMessage != null)
                    Text(
                      authState.errorMessage!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.red),
                    ),
                  const SizedBox(height: AppDefaults.padding / 2),

                  // Login Button
                  authState.isLoading
                      ? const Center(child: CircularProgressIndicator())
                      : LoginButton(onPressed: onLogin),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
