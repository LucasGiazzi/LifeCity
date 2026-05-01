import 'package:flutter/material.dart';

import '../../core/components/app_back_button.dart';
import '../../core/constants/app_defaults.dart';
import '../../core/routes/app_routes.dart';
import '../../core/components/app_settings_tile.dart';

class DrawerPage extends StatelessWidget {
  const DrawerPage({super.key});

  static const _chevron = Icon(Icons.arrow_forward_ios_rounded, size: 14);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const AppBackButton(),
        title: const Text('Menu'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(AppDefaults.padding),
        child: Column(
          children: [
            AppSettingsListTile(label: 'Invite Friend', trailing: _chevron),
            AppSettingsListTile(
              label: 'About Us',
              trailing: _chevron,
              onTap: () => Navigator.pushNamed(context, AppRoutes.aboutUs),
            ),
            AppSettingsListTile(
              label: 'FAQs',
              trailing: _chevron,
              onTap: () => Navigator.pushNamed(context, AppRoutes.faq),
            ),
            AppSettingsListTile(
              label: 'Terms & Conditions',
              trailing: _chevron,
              onTap: () => Navigator.pushNamed(context, AppRoutes.termsAndConditions),
            ),
            AppSettingsListTile(
              label: 'Help Center',
              trailing: _chevron,
              onTap: () => Navigator.pushNamed(context, AppRoutes.help),
            ),
            AppSettingsListTile(label: 'Rate This App', trailing: _chevron),
            AppSettingsListTile(label: 'Privacy Policy', trailing: _chevron),
            AppSettingsListTile(
              label: 'Contact Us',
              trailing: _chevron,
              onTap: () => Navigator.pushNamed(context, AppRoutes.contactUs),
            ),
            const SizedBox(height: AppDefaults.padding * 3),
            AppSettingsListTile(
              label: 'Logout',
              trailing: _chevron,
              onTap: () => Navigator.pushNamed(context, AppRoutes.introLogin),
            ),
          ],
        ),
      ),
    );
  }
}
