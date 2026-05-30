import 'package:flutter/material.dart';

import '../../../core/components/app_settings_tile.dart';
import '../../../core/constants/app_symbols.dart';
import '../../../core/constants/constants.dart';

class HelpTopics extends StatelessWidget {
  const HelpTopics({
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: AppDefaults.padding),
        Text(
          'Topics',
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: Colors.black,
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: AppDefaults.padding / 2),
        AppSettingsListTile(
          label: 'My Account',
          trailing: const Icon(AppSymbols.chevronRight),
        ),
        AppSettingsListTile(
          label: 'Payment and Wallet',
          trailing: const Icon(AppSymbols.chevronRight),
        ),
        AppSettingsListTile(
          label: 'Shipping & Delivery',
          trailing: const Icon(AppSymbols.chevronRight),
        ),
        AppSettingsListTile(
          label: 'Vouchers & Promotions',
          trailing: const Icon(AppSymbols.chevronRight),
        ),
        AppSettingsListTile(
          label: 'Ordering',
          trailing: const Icon(AppSymbols.chevronRight),
        ),
      ],
    );
  }
}
