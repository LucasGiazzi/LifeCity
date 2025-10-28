import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../../core/components/network_image.dart';
import '../../../core/constants/constants.dart';

class CategoryTile extends StatelessWidget {
  const CategoryTile({
    super.key,
    required this.imageLink,
    required this.label,
    this.backgroundColor,
    required this.onTap,
  });

  final String imageLink;
  final String label;
  final Color? backgroundColor;
  final VoidCallback onTap;

  bool get _isNetwork =>
      imageLink.startsWith('http') || imageLink.startsWith('https');

  bool get _isSvg => imageLink.toLowerCase().endsWith('.svg');

  @override
  Widget build(BuildContext context) {
    final Widget imageWidget = _isNetwork
        ? NetworkImageWithLoader(imageLink, fit: BoxFit.contain)
        : (_isSvg
            ? SvgPicture.asset(imageLink, fit: BoxFit.contain)
            : Image.asset(imageLink, fit: BoxFit.contain));

    return Material(
      color: AppColors.scaffoldBackground,
      child: InkWell(
        borderRadius: AppDefaults.borderRadius,
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(AppDefaults.padding),
              decoration: BoxDecoration(
                color: backgroundColor ?? AppColors.textInputBackground,
                shape: BoxShape.circle,
              ),
              child: SizedBox(width: 36, child: imageWidget),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: Theme.of(context)
                  .textTheme
                  .bodyLarge
                  ?.copyWith(fontWeight: FontWeight.w500),
              maxLines: 1,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
