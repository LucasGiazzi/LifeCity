import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/services/auth_service.dart';

class ChangePasswordPage extends StatefulWidget {
  const ChangePasswordPage({super.key});

  @override
  State<ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends State<ChangePasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();

  bool _currentObscured = true;
  bool _newObscured = true;
  bool _confirmObscured = true;
  bool _isLoading = false;
  String? _errorMessage;

  final _authService = AuthService();

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final success = await _authService.changePassword(
      currentPassword: _currentController.text,
      newPassword: _newController.text,
    );

    if (!mounted) return;

    setState(() => _isLoading = false);

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Senha alterada com sucesso!'),
          backgroundColor: AppColors.primary,
        ),
      );
      Navigator.pop(context);
    } else {
      setState(() => _errorMessage = 'Senha atual incorreta. Tente novamente.');
    }
  }

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
                padding: EdgeInsets.only(
                  left: screen.width * 0.06,
                  right: screen.width * 0.06,
                  top: screen.height * 0.015,
                  bottom: screen.height * 0.015,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.arrow_back_ios_new_rounded,
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
                    SizedBox(height: screen.height * 0.02),
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
                      'Alterar senha',
                      style: GoogleFonts.poppins(
                        fontSize: screen.width * 0.07,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        height: 1.1,
                      ),
                    ),
                    SizedBox(height: screen.height * 0.006),
                    Text(
                      'Crie uma senha forte com pelo menos 8 caracteres.',
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

            // ── Form branco ──
            Expanded(
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(28),
                    topRight: Radius.circular(28),
                  ),
                ),
                child: Theme(
                  data: ThemeData.light().copyWith(
                    colorScheme: ThemeData.light()
                        .colorScheme
                        .copyWith(primary: AppColors.primary),
                    inputDecorationTheme: InputDecorationTheme(
                      fillColor: const Color(0xFFF5F5F5),
                      filled: true,
                      floatingLabelBehavior: FloatingLabelBehavior.never,
                      hintStyle: const TextStyle(
                          color: Color(0xFF9E9E9E), fontSize: 14),
                      border: OutlineInputBorder(
                          borderSide: BorderSide.none,
                          borderRadius: BorderRadius.circular(12)),
                      enabledBorder: OutlineInputBorder(
                          borderSide: BorderSide.none,
                          borderRadius: BorderRadius.circular(12)),
                      focusedBorder: OutlineInputBorder(
                          borderSide: const BorderSide(
                              color: AppColors.primary, width: 1.5),
                          borderRadius: BorderRadius.circular(12)),
                      errorBorder: OutlineInputBorder(
                          borderSide:
                              const BorderSide(color: Colors.red, width: 1.5),
                          borderRadius: BorderRadius.circular(12)),
                      focusedErrorBorder: OutlineInputBorder(
                          borderSide:
                              const BorderSide(color: Colors.red, width: 1.5),
                          borderRadius: BorderRadius.circular(12)),
                      suffixIconColor: const Color(0xFF9E9E9E),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 14),
                    ),
                  ),
                  child: SingleChildScrollView(
                    padding: EdgeInsets.symmetric(
                      horizontal: screen.width * 0.06,
                      vertical: screen.height * 0.035,
                    ),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _FieldLabel('Senha atual'),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _currentController,
                            obscureText: _currentObscured,
                            textInputAction: TextInputAction.next,
                            style: GoogleFonts.poppins(
                                fontSize: 15,
                                color: const Color(0xFF1A1A2E)),
                            decoration: InputDecoration(
                              hintText: 'Digite sua senha atual',
                              prefixIcon: const Icon(Icons.lock_outline_rounded,
                                  color: AppColors.placeholder, size: 20),
                              suffixIcon: _EyeToggle(
                                obscured: _currentObscured,
                                onToggle: () => setState(
                                    () => _currentObscured = !_currentObscured),
                              ),
                            ),
                            validator: (v) {
                              if (v == null || v.isEmpty) {
                                return 'Informe a senha atual';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 20),

                          _FieldLabel('Nova senha'),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _newController,
                            obscureText: _newObscured,
                            textInputAction: TextInputAction.next,
                            style: GoogleFonts.poppins(
                                fontSize: 15,
                                color: const Color(0xFF1A1A2E)),
                            decoration: InputDecoration(
                              hintText: 'Mínimo 8 caracteres',
                              prefixIcon: const Icon(
                                  Icons.lock_reset_rounded,
                                  color: AppColors.placeholder,
                                  size: 20),
                              suffixIcon: _EyeToggle(
                                obscured: _newObscured,
                                onToggle: () => setState(
                                    () => _newObscured = !_newObscured),
                              ),
                            ),
                            validator: (v) {
                              if (v == null || v.isEmpty) {
                                return 'Informe a nova senha';
                              }
                              if (v.length < 8) {
                                return 'A senha deve ter pelo menos 8 caracteres';
                              }
                              if (v == _currentController.text) {
                                return 'A nova senha não pode ser igual à atual';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 20),

                          _FieldLabel('Confirmar nova senha'),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _confirmController,
                            obscureText: _confirmObscured,
                            textInputAction: TextInputAction.done,
                            onFieldSubmitted: (_) => _submit(),
                            style: GoogleFonts.poppins(
                                fontSize: 15,
                                color: const Color(0xFF1A1A2E)),
                            decoration: InputDecoration(
                              hintText: 'Repita a nova senha',
                              prefixIcon: const Icon(Icons.check_circle_outline,
                                  color: AppColors.placeholder, size: 20),
                              suffixIcon: _EyeToggle(
                                obscured: _confirmObscured,
                                onToggle: () => setState(() =>
                                    _confirmObscured = !_confirmObscured),
                              ),
                            ),
                            validator: (v) {
                              if (v == null || v.isEmpty) {
                                return 'Confirme a nova senha';
                              }
                              if (v != _newController.text) {
                                return 'As senhas não coincidem';
                              }
                              return null;
                            },
                          ),

                          if (_errorMessage != null) ...[
                            const SizedBox(height: 16),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: Colors.red.shade50,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                    color: Colors.red.shade200, width: 1),
                              ),
                              child: Row(
                                children: [
                                  Icon(Icons.error_outline,
                                      color: Colors.red.shade600, size: 18),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _errorMessage!,
                                      style: GoogleFonts.poppins(
                                        color: Colors.red.shade700,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],

                          const SizedBox(height: 32),

                          SizedBox(
                            height: 56,
                            child: _isLoading
                                ? const Center(
                                    child: CircularProgressIndicator(
                                        color: AppColors.primary))
                                : ElevatedButton(
                                    onPressed: _submit,
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppColors.primary,
                                      foregroundColor: Colors.white,
                                      shape: RoundedRectangleBorder(
                                          borderRadius:
                                              BorderRadius.circular(16)),
                                      elevation: 0,
                                    ),
                                    child: Text(
                                      'Salvar nova senha',
                                      style: GoogleFonts.poppins(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w600),
                                    ),
                                  ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: GoogleFonts.poppins(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: const Color(0xFF1A1A2E),
      ),
    );
  }
}

class _EyeToggle extends StatelessWidget {
  final bool obscured;
  final VoidCallback onToggle;
  const _EyeToggle({required this.obscured, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: Icon(
        obscured ? Icons.visibility_outlined : Icons.visibility_off_outlined,
        color: AppColors.placeholder,
        size: 20,
      ),
      onPressed: onToggle,
    );
  }
}
