import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/routes/app_routes.dart';
import '../../../core/state/auth_state.dart';
import '../../../core/utils/validators.dart';

class LoginPageForm extends StatefulWidget {
  const LoginPageForm({super.key});

  @override
  State<LoginPageForm> createState() => _LoginPageFormState();
}

class _LoginPageFormState extends State<LoginPageForm> {
  final _key = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isPasswordObscured = true;
  bool _keepLoggedIn = true;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _keepLoggedIn = Provider.of<AuthState>(context, listen: false).keepLoggedIn;
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> onLogin() async {
    final bool isFormOkay = _key.currentState?.validate() ?? false;
    if (!isFormOkay) return;

    final authState = Provider.of<AuthState>(context, listen: false);
    final success = await authState.login(
      _emailController.text.trim(),
      _passwordController.text.trim(),
    );

    if (success && mounted) {
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
      builder: (context, authState, _) {
        return Form(
          key: _key,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // E-mail
              TextFormField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                validator: Validators.email.call,
                textInputAction: TextInputAction.next,
                style: GoogleFonts.poppins(fontSize: 15, color: const Color(0xFF1A1A2E)),
                decoration: InputDecoration(
                  hintText: 'E-mail',
                  prefixIcon: const Icon(Icons.email_outlined,
                      color: AppColors.placeholder, size: 20),
                ),
              ),
              const SizedBox(height: 14),

              // Senha
              TextFormField(
                controller: _passwordController,
                validator: Validators.password.call,
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => onLogin(),
                obscureText: _isPasswordObscured,
                style: GoogleFonts.poppins(fontSize: 15, color: const Color(0xFF1A1A2E)),
                decoration: InputDecoration(
                  hintText: 'Senha',
                  prefixIcon: const Icon(Icons.lock_outline_rounded,
                      color: AppColors.placeholder, size: 20),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _isPasswordObscured
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                      color: AppColors.placeholder,
                      size: 20,
                    ),
                    onPressed: () =>
                        setState(() => _isPasswordObscured = !_isPasswordObscured),
                  ),
                ),
              ),

              // Esqueceu a senha + Manter logado
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      SizedBox(
                        width: 24,
                        height: 24,
                        child: Checkbox(
                          value: _keepLoggedIn,
                          activeColor: AppColors.primary,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(4)),
                          onChanged: (val) {
                            final v = val ?? true;
                            setState(() => _keepLoggedIn = v);
                            Provider.of<AuthState>(context, listen: false)
                                .setKeepLoggedIn(v);
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: () {
                          final v = !_keepLoggedIn;
                          setState(() => _keepLoggedIn = v);
                          Provider.of<AuthState>(context, listen: false)
                              .setKeepLoggedIn(v);
                        },
                        child: Text(
                          'Manter logado',
                          style: GoogleFonts.poppins(
                            fontSize: 13,
                            color: const Color(0xFF1A1A2E),
                          ),
                        ),
                      ),
                    ],
                  ),
                  TextButton(
                    onPressed: () =>
                        Navigator.pushNamed(context, AppRoutes.forgotPassword),
                    child: Text(
                      'Esqueceu a senha?',
                      style: GoogleFonts.poppins(
                        color: AppColors.primary,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),

              // Erro
              if (authState.errorMessage != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(
                    authState.errorMessage!,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.poppins(color: Colors.red, fontSize: 13),
                  ),
                ),

              const SizedBox(height: 4),

              // Botão entrar
              SizedBox(
                height: 56,
                child: authState.isLoading
                    ? const Center(
                        child: CircularProgressIndicator(color: AppColors.primary))
                    : ElevatedButton(
                        onPressed: onLogin,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16)),
                          elevation: 0,
                        ),
                        child: Text(
                          'Entrar',
                          style: GoogleFonts.poppins(
                              fontSize: 16, fontWeight: FontWeight.w600),
                        ),
                      ),
              ),

              const SizedBox(height: 24),

              // Criar conta
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Ainda não tem conta?',
                    style: GoogleFonts.poppins(
                        color: AppColors.placeholder, fontSize: 14),
                  ),
                  TextButton(
                    onPressed: () =>
                        Navigator.pushNamed(context, AppRoutes.signup),
                    child: Text(
                      'Criar conta',
                      style: GoogleFonts.poppins(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ],
              ),

              // TODO: remover antes de produção
              const SizedBox(height: 8),
              SizedBox(
                height: 48,
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.pushNamedAndRemoveUntil(
                    context,
                    AppRoutes.entryPoint,
                    (route) => false,
                  ),
                  icon: const Icon(Icons.visibility_outlined, size: 18),
                  label: Text(
                    'Explorar visual (sem login)',
                    style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w500),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.placeholder,
                    side: const BorderSide(color: AppColors.gray),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
