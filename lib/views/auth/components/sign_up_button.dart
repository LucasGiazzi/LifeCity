import 'package:flutter/material.dart';

import '../../../core/constants/app_symbols.dart';
import '../../../core/constants/constants.dart';

class SignUpButton extends StatelessWidget {
  const SignUpButton({super.key, this.onPressed});

  final void Function()? onPressed;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppDefaults.padding * 2),
      child: Row(
        children: [
          Text(
            'Registrar',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const Spacer(),
          ElevatedButton(
            onPressed: onPressed,
            style: ElevatedButton.styleFrom(elevation: 1),
            child: const Icon(AppSymbols.arrowForward, color: Colors.white),
          ),
        ],
      ),
    );
  }
}
