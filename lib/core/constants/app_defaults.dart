import 'package:flutter/material.dart';

class AppDefaults {
  // Spacing scale (4px base)
  static const double s1 = 4.0;
  static const double s2 = 8.0;
  static const double s3 = 12.0;
  static const double s4 = 16.0;
  static const double s5 = 20.0;
  static const double s6 = 24.0;
  static const double s8 = 32.0;
  static const double s10 = 40.0;
  static const double s12 = 48.0;

  // Radius scale
  static const double radiusSm = 8.0;
  static const double radiusMd = 12.0;
  static const double radiusLg = 16.0;
  static const double radiusXl = 20.0;
  static const double radiusFull = 100.0;

  // Backwards-compatible aliases
  static const double radius = 15;
  static const double margin = 15;
  static const double padding = 15;

  static BorderRadius get borderRadius => BorderRadius.circular(radius);
  static BorderRadius get borderRadiusSm => BorderRadius.circular(radiusSm);
  static BorderRadius get borderRadiusLg => BorderRadius.circular(radiusLg);

  static BorderRadius get bottomSheetRadius => const BorderRadius.only(
    topLeft: Radius.circular(radiusXl),
    topRight: Radius.circular(radiusXl),
  );

  static BorderRadius get topSheetRadius => const BorderRadius.only(
    bottomLeft: Radius.circular(radiusXl),
    bottomRight: Radius.circular(radiusXl),
  );

  // Shadow system
  static List<BoxShadow> get shadowSm => [
    BoxShadow(blurRadius: 8, spreadRadius: 0, offset: const Offset(0, 1), color: Colors.black.withValues(alpha: 0.04)),
  ];

  static List<BoxShadow> get shadowMd => [
    BoxShadow(blurRadius: 16, spreadRadius: 0, offset: const Offset(0, 4), color: Colors.black.withValues(alpha: 0.06)),
    BoxShadow(blurRadius: 4, spreadRadius: 0, offset: const Offset(0, 1), color: Colors.black.withValues(alpha: 0.03)),
  ];

  static List<BoxShadow> get shadowLg => [
    BoxShadow(blurRadius: 32, spreadRadius: 0, offset: const Offset(0, 8), color: Colors.black.withValues(alpha: 0.08)),
    BoxShadow(blurRadius: 8, spreadRadius: 0, offset: const Offset(0, 2), color: Colors.black.withValues(alpha: 0.04)),
  ];

  // Backwards-compatible alias
  static List<BoxShadow> get boxShadow => shadowMd;

  static const Duration duration = Duration(milliseconds: 200);
  static const Duration durationSlow = Duration(milliseconds: 350);
}
