import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/svg.dart';
import 'package:mask_text_input_formatter/mask_text_input_formatter.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/constants.dart';
import '../../../core/routes/app_routes.dart';
import '../../../core/state/auth_state.dart';
import '../../../core/utils/validators.dart';
import 'already_have_accout.dart';
import 'sign_up_button.dart';

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
    // Clear any previous errors
    Provider.of<AuthState>(context, listen: false).setErrorMessage(null);

    final isFormValid = _formKey.currentState?.validate() ?? false;
    if (!isFormValid) {
      return;
    }

    final authState = Provider.of<AuthState>(context, listen: false);
    debugPrint('email: ${_emailController.text.trim()}');
    debugPrint('password: ${_passwordController.text.trim()}');
    debugPrint('name: ${_nameController.text.trim()}');
    debugPrint('cpf: ${_cpfController.text}');
    debugPrint('phone: ${_phoneController.text}');
    final success = await authState.signUp(
      email: _emailController.text.trim(),
      password: _passwordController.text.trim(),
      name: _nameController.text.trim(),
      cpf: _cpfController.text,
      phone: _phoneController.text,
    );

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cadastro realizado com sucesso!')),
      );
      Navigator.pushNamedAndRemoveUntil(context, AppRoutes.login, (route) => false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(AppDefaults.margin),
      padding: const EdgeInsets.all(AppDefaults.padding),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: AppDefaults.boxShadow,
        borderRadius: AppDefaults.borderRadius,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text("Nome"),
            const SizedBox(height: 8),
            TextFormField(
              controller: _nameController,
              validator: Validators.requiredWithFieldName('Nome').call,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: AppDefaults.padding),
            const Text("CPF"),
            const SizedBox(height: 8),
            TextFormField(
              controller: _cpfController,
              inputFormatters: [cpfFormatter],
              keyboardType: TextInputType.number,
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'CPF é obrigatório';
                }
                if (value.length != 14) {
                  return 'CPF inválido';
                }
                return null;
              },
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: AppDefaults.padding),
            const Text("E-mail"),
            const SizedBox(height: 8),
            TextFormField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              validator: Validators.email.call,
            ),
            const SizedBox(height: AppDefaults.padding),
            const Text("Telefone"),
            const SizedBox(height: 8),
            TextFormField(
              controller: _phoneController,
              inputFormatters: [phoneFormatter],
              textInputAction: TextInputAction.next,
              validator: Validators.required.call,
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: AppDefaults.padding),
            const Text("Senha"),
            const SizedBox(height: 8),
            TextFormField(
              controller: _passwordController,
              validator: Validators.password.call,
              textInputAction: TextInputAction.next,
              obscureText: _isPasswordObscured,
              decoration: InputDecoration(
                suffixIcon: Material(
                  color: Colors.transparent,
                  child: IconButton(
                    onPressed: () => setState(() => _isPasswordObscured = !_isPasswordObscured),
                    icon: SvgPicture.asset(AppIcons.eye, width: 24),
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppDefaults.padding),
            const Text("Confirmar senha"),
            const SizedBox(height: 8),
            TextFormField(
              controller: _confirmPasswordController,
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Confirmação de senha é obrigatória';
                }
                if (value != _passwordController.text) {
                  return 'As senhas não coincidem';
                }
                return null;
              },
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _signUp(),
              obscureText: _isConfirmPasswordObscured,
              decoration: InputDecoration(
                suffixIcon: Material(
                  color: Colors.transparent,
                  child: IconButton(
                    onPressed: () => setState(() => _isConfirmPasswordObscured = !_isConfirmPasswordObscured),
                    icon: SvgPicture.asset(AppIcons.eye, width: 24),
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppDefaults.padding),
            Consumer<AuthState>(
              builder: (context, authState, child) {
                if (authState.errorMessage != null) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8.0),
                    child: Text(
                      authState.errorMessage!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.red),
                    ),
                  );
                }
                return const SizedBox.shrink();
              },
            ),
            Consumer<AuthState>(
              builder: (context, authState, child) {
                return authState.isLoading
                    ? const Center(child: CircularProgressIndicator())
                    : SignUpButton(onPressed: _signUp);
              },
            ),
            const AlreadyHaveAnAccount(),
            const SizedBox(height: AppDefaults.padding),
          ],
        ),
      ),
    );
  }
}
