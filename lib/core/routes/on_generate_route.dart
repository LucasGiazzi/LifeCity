import 'package:flutter/cupertino.dart';

import '../../views/auth/forget_password_page.dart';
import '../../views/auth/intro_login_page.dart';
import '../../views/auth/login_or_signup_page.dart';
import '../../views/auth/login_page.dart';
import '../../views/auth/number_verification_page.dart';
import '../../views/auth/password_reset_page.dart';
import '../../views/auth/sign_up_page.dart';
import '../../views/drawer/about_us_page.dart';
import '../../views/drawer/contact_us_page.dart';
import '../../views/drawer/drawer_page.dart';
import '../../views/drawer/faq_page.dart';
import '../../views/drawer/help_page.dart';
import '../../views/drawer/terms_and_conditions_page.dart';
import '../../views/entrypoint/entrypoint_ui.dart';
import '../../views/events/create_event_page.dart';
import '../../views/complaints/create_complaint_page.dart';
import '../../views/onboarding/onboarding_page.dart';
import '../../views/profile/notification_page.dart';
import '../../views/profile/profile_edit_page.dart';
import '../../views/profile/settings/change_password_page.dart';
import '../../views/profile/settings/change_phone_number_page.dart';
import '../../views/profile/settings/language_settings_page.dart';
import '../../views/profile/settings/notifications_settings_page.dart';
import '../../views/profile/settings/settings_page.dart';
import 'app_routes.dart';
import 'unknown_page.dart';

class RouteGenerator {
  static Route? onGenerate(RouteSettings settings) {
    final route = settings.name;

    switch (route) {
      case AppRoutes.introLogin:
        return CupertinoPageRoute(builder: (_) => const IntroLoginPage());

      case AppRoutes.onboarding:
        return CupertinoPageRoute(builder: (_) => const OnboardingPage());

      case AppRoutes.entryPoint:
        return CupertinoPageRoute(builder: (_) => const EntryPointUI());

      case AppRoutes.createEvent:
        return CupertinoPageRoute(builder: (_) => const CreateEventPage());

      case AppRoutes.createComplaint:
        return CupertinoPageRoute(builder: (_) => const CreateComplaintPage());

      case AppRoutes.login:
        return CupertinoPageRoute(builder: (_) => const LoginPage());

      case AppRoutes.signup:
        return CupertinoPageRoute(builder: (_) => const SignUpPage());

      case AppRoutes.loginOrSignup:
        return CupertinoPageRoute(builder: (_) => const LoginOrSignUpPage());

      case AppRoutes.numberVerification:
        return CupertinoPageRoute(builder: (_) => const NumberVerificationPage());

      case AppRoutes.forgotPassword:
        return CupertinoPageRoute(builder: (_) => const ForgetPasswordPage());

      case AppRoutes.passwordReset:
        return CupertinoPageRoute(builder: (_) => const PasswordResetPage());

      case AppRoutes.profileEdit:
        return CupertinoPageRoute(builder: (_) => const ProfileEditPage());

      case AppRoutes.notifications:
        return CupertinoPageRoute(builder: (_) => const NotificationPage());

      case AppRoutes.settingsNotifications:
        return CupertinoPageRoute(builder: (_) => const NotificationSettingsPage());

      case AppRoutes.settings:
        return CupertinoPageRoute(builder: (_) => const SettingsPage());

      case AppRoutes.settingsLanguage:
        return CupertinoPageRoute(builder: (_) => const LanguageSettingsPage());

      case AppRoutes.changePassword:
        return CupertinoPageRoute(builder: (_) => const ChangePasswordPage());

      case AppRoutes.changePhoneNumber:
        return CupertinoPageRoute(builder: (_) => const ChangePhoneNumberPage());

      case AppRoutes.drawerPage:
        return CupertinoPageRoute(builder: (_) => const DrawerPage());

      case AppRoutes.aboutUs:
        return CupertinoPageRoute(builder: (_) => const AboutUsPage());

      case AppRoutes.termsAndConditions:
        return CupertinoPageRoute(builder: (_) => const TermsAndConditionsPage());

      case AppRoutes.faq:
        return CupertinoPageRoute(builder: (_) => const FAQPage());

      case AppRoutes.help:
        return CupertinoPageRoute(builder: (_) => const HelpPage());

      case AppRoutes.contactUs:
        return CupertinoPageRoute(builder: (_) => const ContactUsPage());

      default:
        return errorRoute();
    }
  }

  static Route? errorRoute() =>
      CupertinoPageRoute(builder: (_) => const UnknownPage());
}
