import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_symbols.dart';
import '../../core/routes/app_routes.dart';
import '../../core/services/auth_service.dart';

class CodeVerificationPage extends StatelessWidget {
  final String email;
  const CodeVerificationPage({super.key, required this.email});

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
                      child: const Icon(Symbols.mark_email_read,
                          color: AppColors.primary, size: 26),
                    ),
                    SizedBox(height: screen.height * 0.015),
                    Text(
                      'Verifique seu\ne-mail',
                      style: GoogleFonts.poppins(
                        fontSize: screen.width * 0.07,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        height: 1.2,
                      ),
                    ),
                    SizedBox(height: screen.height * 0.006),
                    Text(
                      'Digite o código de 6 dígitos enviado para $email',
                      style: GoogleFonts.poppins(
                        fontSize: screen.width * 0.034,
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
                  child: _CodeForm(email: email),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CodeForm extends StatefulWidget {
  final String email;
  const _CodeForm({required this.email});

  @override
  State<_CodeForm> createState() => _CodeFormState();
}

class _CodeFormState extends State<_CodeForm> {
  final _formKey = GlobalKey<FormState>();
  final _codeController = TextEditingController();
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isLoading = true;
      _error = null;
    });

    final result = await AuthService().verifyResetCode(
      email: widget.email,
      code: _codeController.text.trim(),
    );

    if (!mounted) return;
    setState(() => _isLoading = false);

    if (result.success) {
      Navigator.pushNamed(
        context,
        AppRoutes.passwordReset,
        arguments: {
          'email': widget.email,
          'code': _codeController.text.trim(),
        },
      );
    } else {
      setState(() => _error = result.error ?? 'Código inválido ou expirado.');
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
            'Código de verificação',
            style: GoogleFonts.poppins(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.dark,
            ),
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: _codeController,
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.done,
            maxLength: 6,
            onFieldSubmitted: (_) => _submit(),
            textAlign: TextAlign.center,
            style: GoogleFonts.poppins(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              letterSpacing: 10,
              color: AppColors.dark,
            ),
            decoration: InputDecoration(
              hintText: '••••••',
              hintStyle: GoogleFonts.poppins(
                fontSize: 28,
                letterSpacing: 10,
                color: Colors.grey.shade400,
              ),
              counterText: '',
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
              if (v == null || v.isEmpty) return 'Código é obrigatório';
              if (v.length != 6) return 'O código tem 6 dígitos';
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
                      'Verificar código',
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
