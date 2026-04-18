import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mask_text_input_formatter/mask_text_input_formatter.dart';
import 'package:provider/provider.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/routes/app_routes.dart';
import '../../../core/state/auth_state.dart';
import '../../../core/utils/validators.dart';

final cpfFormatter = MaskTextInputFormatter(
  mask: '###.###.###-##',
  filter: {"#": RegExp(r'[0-9]')},
);

final phoneFormatter = MaskTextInputFormatter(
  mask: '(##) #####-####',
  filter: {"#": RegExp(r'[0-9]')},
);

class SignUpForm extends StatefulWidget {
  const SignUpForm({super.key});

  @override
  State<SignUpForm> createState() => _SignUpFormState();
}

class _SignUpFormState extends State<SignUpForm> {
  final _formKey = GlobalKey<FormState>();

  final _nameController = TextEditingController();
  final _cpfController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _isPasswordObscured = true;
  bool _isConfirmPasswordObscured = true;

  @override
  void dispose() {
    _nameController.dispose();
    _cpfController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _signUp() async {
    Provider.of<AuthState>(context, listen: false).setErrorMessage(null);

    final isFormValid = _formKey.currentState?.validate() ?? false;
    if (!isFormValid) return;

    final authState = Provider.of<AuthState>(context, listen: false);
    final success = await authState.signUp(
      email: _emailController.text.trim(),
      password: _passwordController.text.trim(),
      name: _nameController.text.trim(),
      cpf: _cpfController.text,
      phone: _phoneController.text,
    );

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Cadastro realizado!', style: GoogleFonts.poppins()),
          backgroundColor: AppColors.primary,
        ),
      );
      Navigator.pushNamedAndRemoveUntil(context, AppRoutes.login, (route) => false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Dados pessoais ──
          _SectionLabel('Dados pessoais'),
          const SizedBox(height: 12),
          _Field(
            controller: _nameController,
            hint: 'Nome completo',
            icon: Icons.person_outline_rounded,
            validator: Validators.requiredWithFieldName('Nome').call,
            action: TextInputAction.next,
          ),
          const SizedBox(height: 12),
          _Field(
            controller: _cpfController,
            hint: 'CPF',
            icon: Icons.badge_outlined,
            keyboardType: TextInputType.number,
            formatters: [cpfFormatter],
            validator: (value) {
              if (value == null || value.isEmpty) return 'CPF é obrigatório';
              if (value.length != 14) return 'CPF inválido';
              return null;
            },
            action: TextInputAction.next,
          ),
          const SizedBox(height: 12),
          _Field(
            controller: _phoneController,
            hint: 'Telefone',
            icon: Icons.phone_outlined,
            keyboardType: TextInputType.phone,
            formatters: [phoneFormatter],
            validator: Validators.required.call,
            action: TextInputAction.next,
          ),

          const SizedBox(height: 28),

          // ── Acesso ──
          _SectionLabel('Dados de acesso'),
          const SizedBox(height: 12),
          _Field(
            controller: _emailController,
            hint: 'E-mail',
            icon: Icons.email_outlined,
            keyboardType: TextInputType.emailAddress,
            validator: Validators.email.call,
            action: TextInputAction.next,
          ),
          const SizedBox(height: 12),
          _PasswordField(
            controller: _passwordController,
            hint: 'Senha',
            isObscured: _isPasswordObscured,
            onToggle: () => setState(() => _isPasswordObscured = !_isPasswordObscured),
            validator: Validators.password.call,
            action: TextInputAction.next,
          ),
          const SizedBox(height: 12),
          _PasswordField(
            controller: _confirmPasswordController,
            hint: 'Confirmar senha',
            isObscured: _isConfirmPasswordObscured,
            onToggle: () => setState(() => _isConfirmPasswordObscured = !_isConfirmPasswordObscured),
            validator: (value) {
              if (value == null || value.isEmpty) return 'Confirmação obrigatória';
              if (value != _passwordController.text) return 'As senhas não coincidem';
              return null;
            },
            action: TextInputAction.done,
            onSubmitted: (_) => _signUp(),
          ),

          const SizedBox(height: 16),

          // Mensagem de erro
          Consumer<AuthState>(
            builder: (context, auth, _) => auth.errorMessage != null
                ? Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      auth.errorMessage!,
                      textAlign: TextAlign.center,
                      style: GoogleFonts.poppins(color: Colors.red, fontSize: 13),
                    ),
                  )
                : const SizedBox.shrink(),
          ),

          // Botão principal
          Consumer<AuthState>(
            builder: (context, auth, _) => SizedBox(
              height: 56,
              child: auth.isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                  : ElevatedButton(
                      onPressed: _signUp,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        elevation: 0,
                      ),
                      child: Text(
                        'Criar conta',
                        style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600),
                      ),
                    ),
            ),
          ),

          const SizedBox(height: 20),

          // Link login
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'Já tem uma conta?',
                style: GoogleFonts.poppins(color: AppColors.placeholder, fontSize: 14),
              ),
              TextButton(
                onPressed: () => Navigator.pushNamed(context, AppRoutes.login),
                child: Text(
                  'Entrar',
                  style: GoogleFonts.poppins(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Widgets internos ──────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: GoogleFonts.poppins(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: AppColors.placeholder,
        letterSpacing: 0.8,
      ),
    );
  }
}

class _Field extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final TextInputType? keyboardType;
  final List<dynamic> formatters;
  final String? Function(String?)? validator;
  final TextInputAction? action;

  const _Field({
    required this.controller,
    required this.hint,
    required this.icon,
    this.keyboardType,
    this.formatters = const [],
    this.validator,
    this.action,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      inputFormatters: formatters.cast(),
      validator: validator,
      textInputAction: action,
      style: GoogleFonts.poppins(fontSize: 15, color: AppColors.dark),
      decoration: InputDecoration(
        hintText: hint,
        prefixIcon: Icon(icon, color: AppColors.placeholder, size: 20),
      ),
    );
  }
}

class _PasswordField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final bool isObscured;
  final VoidCallback onToggle;
  final String? Function(String?)? validator;
  final TextInputAction? action;
  final void Function(String)? onSubmitted;

  const _PasswordField({
    required this.controller,
    required this.hint,
    required this.isObscured,
    required this.onToggle,
    this.validator,
    this.action,
    this.onSubmitted,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: isObscured,
      validator: validator,
      textInputAction: action,
      onFieldSubmitted: onSubmitted,
      style: GoogleFonts.poppins(fontSize: 15, color: AppColors.dark),
      decoration: InputDecoration(
        hintText: hint,
        prefixIcon: const Icon(Icons.lock_outline_rounded, color: AppColors.placeholder, size: 20),
        suffixIcon: IconButton(
          icon: Icon(
            isObscured ? Icons.visibility_outlined : Icons.visibility_off_outlined,
            color: AppColors.placeholder,
            size: 20,
          ),
          onPressed: onToggle,
        ),
      ),
    );
  }
}
