import 'package:flutter/material.dart';

import '../../../core/constants/app_symbols.dart';
import '../../../core/constants/constants.dart';

class ProfileListTile extends StatelessWidget {
  const ProfileListTile({
    super.key,
    required this.onTap,
    required this.icon,
    required this.title,
  });

  final void Function() onTap;
  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    final iconColor = Theme.of(context).iconTheme.color ?? Colors.black;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppDefaults.borderRadius,
        child: Padding(
          padding: const EdgeInsets.all(8.0),
          child: Row(
            children: [
              Icon(icon, color: iconColor, size: 22),
              const SizedBox(width: 16),
              Text(
                title,
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const Spacer(),
              Icon(AppSymbols.chevronRight,
                  size: 16, color: iconColor.withValues(alpha: 0.5)),
            ],
          ),
        ),
      ),
    );
  }
}
