import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../constants/app_colors.dart';
import '../constants/app_defaults.dart';

class AppTheme {
  static ThemeData get defaultTheme {
    final poppins = GoogleFonts.poppinsTextTheme().copyWith(
      bodyLarge: GoogleFonts.poppins(color: AppColors.dark),
      bodyMedium: GoogleFonts.poppins(color: AppColors.placeholder),
      titleLarge: GoogleFonts.poppins(fontWeight: FontWeight.w700, color: AppColors.dark),
      titleMedium: GoogleFonts.poppins(fontWeight: FontWeight.w600, color: AppColors.dark),
      headlineLarge: GoogleFonts.poppins(fontWeight: FontWeight.w800, color: AppColors.dark),
      headlineMedium: GoogleFonts.poppins(fontWeight: FontWeight.w700, color: AppColors.dark),
    );

    return ThemeData(
      colorSchemeSeed: AppColors.primary,
      textTheme: poppins,
      scaffoldBackgroundColor: AppColors.scaffoldBackground,
      brightness: Brightness.light,
      appBarTheme: AppBarTheme(
        elevation: 0,
        backgroundColor: AppColors.scaffoldBackground,
        iconTheme: const IconThemeData(color: AppColors.dark),
        titleTextStyle: GoogleFonts.poppins(
          color: AppColors.dark,
          fontWeight: FontWeight.w700,
          fontSize: 18,
        ),
        systemOverlayStyle: const SystemUiOverlayStyle(
          statusBarBrightness: Brightness.light,
          statusBarIconBrightness: Brightness.dark,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(
            vertical: AppDefaults.padding,
            horizontal: AppDefaults.padding * 2,
          ),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(
            vertical: AppDefaults.padding,
            horizontal: AppDefaults.padding * 2,
          ),
          elevation: 0,
          side: const BorderSide(color: AppColors.primary, width: 1.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          textStyle: GoogleFonts.poppins(fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: defaultInputDecorationTheme,
      tabBarTheme: TabBarThemeData(
        labelColor: AppColors.primary,
        unselectedLabelColor: AppColors.placeholder,
        labelPadding: const EdgeInsets.all(AppDefaults.padding),
        indicatorSize: TabBarIndicatorSize.label,
        labelStyle: GoogleFonts.poppins(fontWeight: FontWeight.w700),
        unselectedLabelStyle: GoogleFonts.poppins(fontWeight: FontWeight.w600),
        indicator: const UnderlineTabIndicator(
          borderSide: BorderSide(color: AppColors.primary, width: 2.5),
        ),
      ),
      sliderTheme: const SliderThemeData(
        showValueIndicator: ShowValueIndicator.onDrag,
        thumbColor: Colors.white,
      ),
    );
  }

  static InputDecorationTheme get defaultInputDecorationTheme => InputDecorationTheme(
    fillColor: AppColors.textInputBackground,
    filled: true,
    floatingLabelBehavior: FloatingLabelBehavior.never,
    hintStyle: GoogleFonts.poppins(color: AppColors.placeholder, fontSize: 14),
    border: OutlineInputBorder(
      borderSide: BorderSide.none,
      borderRadius: BorderRadius.circular(12),
    ),
    enabledBorder: OutlineInputBorder(
      borderSide: BorderSide.none,
      borderRadius: BorderRadius.circular(12),
    ),
    focusedBorder: OutlineInputBorder(
      borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      borderRadius: BorderRadius.circular(12),
    ),
    suffixIconColor: AppColors.placeholder,
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
  );

  static InputDecorationTheme get secondaryInputDecorationTheme =>
      defaultInputDecorationTheme;

  // ── DARK THEME ──────────────────────────────────────────────────
  static ThemeData get darkTheme {
    final poppinsDark = GoogleFonts.poppinsTextTheme().copyWith(
      bodyLarge: GoogleFonts.poppins(color: Colors.white),
      bodyMedium: GoogleFonts.poppins(color: const Color(0xFF8B9BB4)),
      titleLarge: GoogleFonts.poppins(fontWeight: FontWeight.w700, color: Colors.white),
      titleMedium: GoogleFonts.poppins(fontWeight: FontWeight.w600, color: Colors.white),
      headlineLarge: GoogleFonts.poppins(fontWeight: FontWeight.w800, color: Colors.white),
      headlineMedium: GoogleFonts.poppins(fontWeight: FontWeight.w700, color: Colors.white),
    );

    return ThemeData(
      colorSchemeSeed: AppColors.primary,
      textTheme: poppinsDark,
      scaffoldBackgroundColor: const Color(0xFF0F0F1A),
      brightness: Brightness.dark,
      appBarTheme: AppBarTheme(
        elevation: 0,
        backgroundColor: const Color(0xFF1A1A2E),
        iconTheme: const IconThemeData(color: Colors.white),
        titleTextStyle: GoogleFonts.poppins(
          color: Colors.white,
          fontWeight: FontWeight.w700,
          fontSize: 18,
        ),
      ),
      cardColor: const Color(0xFF1A1A2E),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(
            vertical: AppDefaults.padding,
            horizontal: AppDefaults.padding * 2,
          ),
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: Colors.white,
          side: const BorderSide(color: AppColors.primary, width: 1.5),
          padding: const EdgeInsets.symmetric(
            vertical: AppDefaults.padding,
            horizontal: AppDefaults.padding * 2,
          ),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          textStyle: GoogleFonts.poppins(fontWeight: FontWeight.w600),
          foregroundColor: AppColors.primary,
        ),
      ),
      inputDecorationTheme: _darkInputTheme,
      tabBarTheme: TabBarThemeData(
        labelColor: AppColors.primary,
        unselectedLabelColor: const Color(0xFF8B9BB4),
        labelStyle: GoogleFonts.poppins(fontWeight: FontWeight.w700),
        unselectedLabelStyle: GoogleFonts.poppins(fontWeight: FontWeight.w600),
        indicator: const UnderlineTabIndicator(
          borderSide: BorderSide(color: AppColors.primary, width: 2.5),
        ),
      ),
    );
  }

  static InputDecorationTheme get _darkInputTheme => InputDecorationTheme(
    fillColor: const Color(0xFF16213E),
    filled: true,
    floatingLabelBehavior: FloatingLabelBehavior.never,
    hintStyle: GoogleFonts.poppins(color: const Color(0xFF8B9BB4), fontSize: 14),
    border: OutlineInputBorder(
      borderSide: BorderSide.none,
      borderRadius: BorderRadius.circular(12),
    ),
    enabledBorder: OutlineInputBorder(
      borderSide: BorderSide.none,
      borderRadius: BorderRadius.circular(12),
    ),
    focusedBorder: OutlineInputBorder(
      borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      borderRadius: BorderRadius.circular(12),
    ),
    suffixIconColor: const Color(0xFF8B9BB4),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
  );

  static InputDecorationTheme get otpInputDecorationTheme => InputDecorationTheme(
    floatingLabelBehavior: FloatingLabelBehavior.never,
    border: OutlineInputBorder(
      borderSide: const BorderSide(width: 1.5, color: AppColors.gray),
      borderRadius: BorderRadius.circular(12),
    ),
    enabledBorder: OutlineInputBorder(
      borderSide: const BorderSide(width: 1.5, color: AppColors.gray),
      borderRadius: BorderRadius.circular(12),
    ),
    focusedBorder: OutlineInputBorder(
      borderSide: const BorderSide(width: 1.5, color: AppColors.primary),
      borderRadius: BorderRadius.circular(12),
    ),
  );
}
