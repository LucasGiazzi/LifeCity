import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/svg.dart';
import 'package:mask_text_input_formatter/mask_text_input_formatter.dart';
import '../../../core/constants/constants.dart';
import '../../../core/utils/validators.dart';
import 'already_have_accout.dart';
import 'sign_up_button.dart';


final cpfFormatter = MaskTextInputFormatter(
  mask: '###.###.###-##',
  filter: {"#": RegExp(r'[0-9]')},
);

class SignUpForm extends StatelessWidget {
  const SignUpForm({
    super.key,
  });

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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text("Nome"),
          const SizedBox(height: 8),
          TextFormField(
            validator: Validators.requiredWithFieldName('Name').call,
            textInputAction: TextInputAction.next,
          ),
          const Text("CPF"),
          const SizedBox(height: 8),
          TextFormField(
            inputFormatters: [cpfFormatter],
            keyboardType: TextInputType.number,
            validator: (value) {
              if (value == null || value.isEmpty) {
                return Validators.requiredWithFieldName('CPF').call(value);
              }
              if (!RegExp(r'^\d{3}\.\d{3}\.\d{3}-\d{2}$').hasMatch(value)) {
                return 'CPF inválido';
              }
              return null;
            },
            textInputAction: TextInputAction.next,
          ),
          const Text("E-mail"),
          const SizedBox(height: 8),
          TextFormField(
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'E-mail é obrigatório';
              }
              // Validação simples de formato de e-mail
              if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value)) {
                return 'E-mail inválido';
              }
              return null;
            },
          ),


          const SizedBox(height: AppDefaults.padding),
          const Text("Telefone"),
          const SizedBox(height: 8),
          TextFormField(
            textInputAction: TextInputAction.next,
            validator: Validators.required.call,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          ),
          const SizedBox(height: AppDefaults.padding),
          const Text("Senha"),
          const SizedBox(height: 8),
          TextFormField(
            validator: Validators.required.call,
            textInputAction: TextInputAction.next,
            obscureText: true,
            decoration: InputDecoration(
              suffixIcon: Material(
                color: Colors.transparent,
                child: IconButton(
                  onPressed: () {},
                  icon: SvgPicture.asset(
                    AppIcons.eye,
                    width: 24,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: AppDefaults.padding),
          const Text("Confirmar senha"),
          const SizedBox(height: 8),
          TextFormField(
            validator: Validators.required.call,
            textInputAction: TextInputAction.next,
            obscureText: true,
            decoration: InputDecoration(
              suffixIcon: Material(
                color: Colors.transparent,
                child: IconButton(
                  onPressed: () {},
                  icon: SvgPicture.asset(
                    AppIcons.eye,
                    width: 24,
                  ),
                ),
              ),
            ),
          ),

          const SizedBox(height: AppDefaults.padding),
          const SignUpButton(),
          const AlreadyHaveAnAccount(),
          const SizedBox(height: AppDefaults.padding),
        ],
      ),
    );
  }
}
