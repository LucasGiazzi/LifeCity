import '../../../core/constants/app_images.dart';
import 'onboarding_model.dart';

class OnboardingData {
  static List<OnboardingModel> items = [
    OnboardingModel(
      imageUrl: AppImages.onboarding1,
      headline: 'Bem vindo ao LifeCity',
      description: 'In aliquip aute exercitation ut et nisi ut mollit...',
    ),
    OnboardingModel(
      imageUrl: AppImages.onboarding2,
      headline: 'Aqui você se conecta!',
      description:
          'In aliquip aute exercitation ut et nisi ut mollit. Deserunt dolor elit pariatur aute .',
    ),
    OnboardingModel(
      imageUrl: AppImages.onboarding3,
      headline: 'Conheça sua cidade!',
      description:
          'In aliquip aute exercitation ut et nisi ut mollit. Deserunt dolor elit pariatur aute .',
    ),
  ];
}
