import 'package:flutter/material.dart';

import '../constants/app_symbols.dart';

class AppBackButton extends StatelessWidget {
  const AppBackButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(AppSymbols.arrowBack),
      onPressed: () => Navigator.pop(context),
    );
  }
}
