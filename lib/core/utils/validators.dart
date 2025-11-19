import 'package:form_field_validator/form_field_validator.dart';

class Validators {
  /// Email Validator
  static final email = EmailValidator(errorText: 'Insira um email válido');

  /// Password Validator
  static final password = MultiValidator([
    RequiredValidator(errorText: 'Digite sua senha'),
    MinLengthValidator(8, errorText: 'Sua senha deve ter pelo menos 8 dígitos'),
    PatternValidator(r'(?=.*?[#?!@$%^&*,.-])',
        errorText: 'Sua senha deve ter pelo menos um caractere especial')
  ]);

  /// Required Validator with Optional Field Name
  static RequiredValidator requiredWithFieldName(String? fieldName) =>
      RequiredValidator(errorText: '${fieldName ?? 'Field'} é obrigatório');

  /// Plain Required Validator
  static final required = RequiredValidator(errorText: 'Campo obrigatório');
}
