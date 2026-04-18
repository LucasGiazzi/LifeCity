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
      headline: 'Conheça sua\ncidade',
      description: 'Eventos, festas, esportes e cultura. Tudo o que rola na sua região, no mapa.',
    ),
  ];
}
