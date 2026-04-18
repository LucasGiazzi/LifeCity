import 'onboarding_model.dart';

class OnboardingData {
  static List<OnboardingModel> items = [
    OnboardingModel(
      imageUrl: 'assets/images/onboarding1.png',
      headline: 'Bem-vindo ao\nLifeCity',
      description: 'A rede social da sua cidade. Conecte-se com o que acontece perto de você.',
    ),
    OnboardingModel(
      imageUrl: 'assets/images/onboarding2.PNG',
      headline: 'Registre o que\nfaz falta',
      description: 'Buracos, iluminação, segurança — reporte problemas e ajude a sua cidade a melhorar.',
    ),
    OnboardingModel(
      imageUrl: 'assets/images/onboarding3.PNG',
      headline: 'Juntos pela\ncidade',
      description: 'Veja o que outros moradores estão reportando e ajude a prefeitura a priorizar o que mais importa.',
    ),
  ];
}
