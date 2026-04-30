import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../constants/constants.dart';

class AppBackButton extends StatelessWidget {
  /// Custom Back labelLarge with a custom ICON for this app
  const AppBackButton({
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final iconColor = Theme.of(context).appBarTheme.iconTheme?.color
        ?? Theme.of(context).iconTheme.color
        ?? Colors.black;
    return IconButton(
      icon: SvgPicture.asset(
        AppIcons.arrowBackward,
        colorFilter: ColorFilter.mode(iconColor, BlendMode.srcIn),
      ),
      onPressed: () => Navigator.pop(context),
    );
  }
}
