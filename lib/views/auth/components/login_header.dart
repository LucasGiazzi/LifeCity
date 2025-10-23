import 'package:flutter/material.dart';

import '../../../core/components/network_image.dart';
import '../../../core/constants/constants.dart';

class LoginPageHeader extends StatelessWidget {
  const LoginPageHeader({
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
              fit: BoxFit.contain)
          ),
        ),
        /* Text(
          'Life City',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
                color: AppColors.primary,
              ),
        ) */
      ],
    );
  }
}
