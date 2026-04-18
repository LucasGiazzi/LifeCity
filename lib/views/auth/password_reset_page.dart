import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/constants/app_colors.dart';
import '../../core/routes/app_routes.dart';

class PasswordResetPage extends StatelessWidget {
  const PasswordResetPage({super.key});

  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.of(context).size;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFF1A1A2E),
        body: Column(
          children: [
            // ── Header dark ──
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
                    SizedBox(height: screen.height * 0.01),
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                            color: AppColors.primary.withValues(alpha: 0.4)),
                      ),
                      child: const Icon(Icons.lock_outline_rounded,
                          color: AppColors.primary, size: 26),
                    ),
                    SizedBox(height: screen.height * 0.015),
                    Text(
                      'Nova senha',
                      style: GoogleFonts.poppins(
                        fontSize: screen.width * 0.07,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        height: 1.2,
                      ),
                    ),
                    SizedBox(height: screen.height * 0.006),
                    Text(
                      'Crie uma nova senha segura para sua conta.',
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

            // ── Form ──
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
                    horizontal: MediaQuery.of(context).size.width * 0.06,
                    vertical: MediaQuery.of(context).size.height * 0.04,
                  ),
                  child: const _ResetForm(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ResetForm extends StatefulWidget {
  const _ResetForm();

  @override
  State<_ResetForm> createState() => _ResetFormState();
}

class _ResetFormState extends State<_ResetForm> {
  final _formKey = GlobalKey<FormState>();
  final _passController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _obscurePass = true;
  bool _obscureConfirm = true;

  @override
  void dispose() {
    _passController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  InputDecoration _fieldDecoration(String hint, IconData icon, {Widget? suffix}) =>
      InputDecoration(
        hintText: hint,
        prefixIcon: Icon(icon, size: 20),
        suffixIcon: suffix,
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
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        filled: true,
        fillColor: Colors.grey.shade50,
      );

  Text _label(String text) => Text(
        text,
        style: GoogleFonts.poppins(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: const Color(0xFF1A1A2E),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _label('Nova senha'),
          const SizedBox(height: 8),
          TextFormField(
            controller: _passController,
            obscureText: _obscurePass,
            textInputAction: TextInputAction.next,
            style: const TextStyle(color: Color(0xFF1A1A2E)),
            decoration: _fieldDecoration(
              '••••••••',
              Icons.lock_outline_rounded,
              suffix: IconButton(
                icon: Icon(_obscurePass ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20),
                onPressed: () => setState(() => _obscurePass = !_obscurePass),
              ),
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Senha é obrigatória';
              if (v.length < 6) return 'Mínimo 6 caracteres';
              return null;
            },
          ),
          const SizedBox(height: 20),
          _label('Confirmar senha'),
          const SizedBox(height: 8),
          TextFormField(
            controller: _confirmController,
            obscureText: _obscureConfirm,
            textInputAction: TextInputAction.done,
            style: const TextStyle(color: Color(0xFF1A1A2E)),
            decoration: _fieldDecoration(
              '••••••••',
              Icons.lock_outline_rounded,
              suffix: IconButton(
                icon: Icon(_obscureConfirm ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20),
                onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
              ),
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Confirme sua senha';
              if (v != _passController.text) return 'As senhas não coincidem';
              return null;
            },
          ),
          const SizedBox(height: 28),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
              onPressed: () {
                if (_formKey.currentState!.validate()) {
                  Navigator.pushNamedAndRemoveUntil(
                      context, AppRoutes.login, (r) => false);
                }
              },
              child: Text(
                'Redefinir senha',
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
