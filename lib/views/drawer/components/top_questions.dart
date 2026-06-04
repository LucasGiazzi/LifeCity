import 'package:flutter/material.dart';

import '../../../core/components/app_settings_tile.dart';
import '../../../core/constants/app_symbols.dart';
import '../../../core/constants/constants.dart';

class TopQuestions extends StatelessWidget {
  const TopQuestions({
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: AppDefaults.padding / 2),
        Text(
          'Top Questions',
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: Colors.black,
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: AppDefaults.padding / 2),
        AppSettingsListTile(
          label: 'How do I return my Items',
          trailing: const Icon(AppSymbols.chevronRight),
        ),
        AppSettingsListTile(
          label: 'How to use collection point?',
          trailing: const Icon(AppSymbols.chevronRight),
        ),
        AppSettingsListTile(
          label: 'What is Grocery?',
          trailing: const Icon(AppSymbols.chevronRight),
        ),
        AppSettingsListTile(
          label: 'How can i add new delivery address?',
          trailing: const Icon(AppSymbols.chevronRight),
        ),
        AppSettingsListTile(
          label: 'How can i avail Sticker Price?',
          trailing: const Icon(AppSymbols.chevronRight),
        ),
      ],
    );
  }
}
