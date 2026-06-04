import 'package:flutter/material.dart';

import '../../../core/constants/constants.dart';

class SignUpPageHeader extends StatelessWidget {
  const SignUpPageHeader({
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SizedBox(
          width: MediaQuery.of(context).size.width * 0.3,
          child: const AspectRatio(
            aspectRatio: 1 / 1,
            child: Image(
              image: AssetImage('assets/images/onboarding1.png'),
              fit: BoxFit.contain,
            ),
          ),
        ),
        Text(
          'Registre-se',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
                color: AppColors.primary,
              ),
        ),
      ],
    );
  }
}
