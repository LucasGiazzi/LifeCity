import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_symbols.dart';
import '../../core/routes/app_routes.dart';
import '../../core/services/auth_service.dart';

class ForgetPasswordPage extends StatelessWidget {
  const ForgetPasswordPage({super.key});

  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.of(context).size;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppColors.dark,
        body: Column(
          children: [
            SafeArea(
              bottom: false,
              child: Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: screen.width * 0.06,
                  vertical: screen.height * 0.015,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(AppSymbols.arrowBack,
                              color: Colors.white70, size: 16),
                          const SizedBox(width: 4),
                          Text(
                            'Voltar',
                            style: GoogleFonts.poppins(
                              color: Colors.white70,
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: screen.height * 0.025),
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                            color: AppColors.primary.withValues(alpha: 0.4)),
                      ),
                      child: const Icon(Symbols.lock_reset,
                          color: AppColors.primary, size: 26),
                    ),
                    SizedBox(height: screen.height * 0.015),
                    Text(
                      'Esqueceu sua\nsenha?',
                      style: GoogleFonts.poppins(
                        fontSize: screen.width * 0.07,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        height: 1.2,
                      ),
                    ),
                    SizedBox(height: screen.height * 0.006),
                    Text(
                      'Digite seu e-mail e enviaremos um código de verificação.',
                      style: GoogleFonts.poppins(
                        fontSize: screen.width * 0.035,
                        color: Colors.white54,
                      ),
                    ),
                    SizedBox(height: screen.height * 0.025),
                  ],
                ),
              ),
            ),
            Expanded(
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(28),
                    topRight: Radius.circular(28),
                  ),
                ),
                child: SingleChildScrollView(
                  padding: EdgeInsets.symmetric(
                    horizontal: screen.width * 0.06,
                    vertical: screen.height * 0.04,
                  ),
                  child: const _ForgotForm(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ForgotForm extends StatefulWidget {
  const _ForgotForm();

  @override
  State<_ForgotForm> createState() => _ForgotFormState();
}

class _ForgotFormState extends State<_ForgotForm> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isLoading = true;
      _error = null;
    });

    final result = await AuthService()
        .sendPasswordResetCode(_emailController.text.trim());

    if (!mounted) return;
    setState(() => _isLoading = false);

    if (result.success) {
      Navigator.pushNamed(
        context,
        AppRoutes.codeVerification,
        arguments: _emailController.text.trim(),
      );
    } else {
      setState(() => _error = result.error ?? 'Erro ao enviar código.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'E-mail',
            style: GoogleFonts.poppins(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.dark,
            ),
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _submit(),
            style: const TextStyle(color: Color(0xFF1A1A2E)),
            decoration: InputDecoration(
              hintText: 'seu@email.com',
              prefixIcon: const Icon(AppSymbols.email, size: 20),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide:
                    const BorderSide(color: AppColors.primary, width: 2),
              ),
              filled: true,
              fillColor: Colors.grey.shade50,
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'E-mail é obrigatório';
              if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(v)) {
                return 'E-mail inválido';
              }
              return null;
            },
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: GoogleFonts.poppins(color: Colors.red, fontSize: 13),
            ),
          ],
          const SizedBox(height: 28),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: _isLoading
                ? const Center(
                    child:
                        CircularProgressIndicator(color: AppColors.primary))
                : ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                      elevation: 0,
                    ),
                    onPressed: _submit,
                    child: Text(
                      'Enviar código',
                      style: GoogleFonts.poppins(
                          fontWeight: FontWeight.w600, fontSize: 15),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
