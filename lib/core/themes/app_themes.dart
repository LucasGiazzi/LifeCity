import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../constants/app_colors.dart';
import '../constants/app_defaults.dart';

class AppTheme {
  static ThemeData light({Color accent = AppColors.primary}) {
    final text = _textTheme(isDark: false);
    return ThemeData(
      colorSchemeSeed: accent,
      textTheme: text,
      scaffoldBackgroundColor: AppColors.scaffoldBackground,
      brightness: Brightness.light,
      appBarTheme: AppBarTheme(
        elevation: 0,
        backgroundColor: AppColors.scaffoldBackground,
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
        titleTextStyle: GoogleFonts.syne(
          color: AppColors.textPrimary,
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
          backgroundColor: accent,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(
            vertical: AppDefaults.padding,
            horizontal: AppDefaults.padding * 2,
          ),
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(
            vertical: AppDefaults.padding,
            horizontal: AppDefaults.padding * 2,
          ),
          elevation: 0,
          side: BorderSide(color: accent, width: 1.5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          textStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: _lightInputTheme,
      tabBarTheme: TabBarThemeData(
        labelColor: accent,
        unselectedLabelColor: AppColors.placeholder,
        labelPadding: const EdgeInsets.all(AppDefaults.padding),
        indicatorSize: TabBarIndicatorSize.label,
        labelStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w700),
        unselectedLabelStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w600),
        indicator: UnderlineTabIndicator(
          borderSide: BorderSide(color: accent, width: 2.5),
        ),
      ),
      sliderTheme: const SliderThemeData(
        showValueIndicator: ShowValueIndicator.onDrag,
        thumbColor: Colors.white,
      ),
    );
  }

  static ThemeData dark({Color accent = AppColors.primary}) {
    final text = _textTheme(isDark: true);
    return ThemeData(
      colorSchemeSeed: accent,
      textTheme: text,
      scaffoldBackgroundColor: const Color(0xFF060E09),
      brightness: Brightness.dark,
      cardColor: AppColors.dark,
      appBarTheme: AppBarTheme(
        elevation: 0,
        backgroundColor: AppColors.dark,
        iconTheme: const IconThemeData(color: Colors.white),
        titleTextStyle: GoogleFonts.syne(
          color: Colors.white,
          fontWeight: FontWeight.w700,
          fontSize: 18,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: accent,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(
            vertical: AppDefaults.padding,
            horizontal: AppDefaults.padding * 2,
          ),
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: Colors.white,
          side: BorderSide(color: accent, width: 1.5),
          padding: const EdgeInsets.symmetric(
            vertical: AppDefaults.padding,
            horizontal: AppDefaults.padding * 2,
          ),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          textStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w600),
          foregroundColor: accent,
        ),
      ),
      inputDecorationTheme: _darkInputTheme,
      tabBarTheme: TabBarThemeData(
        labelColor: accent,
        unselectedLabelColor: AppColors.placeholder,
        labelStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w700),
        unselectedLabelStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w600),
        indicator: UnderlineTabIndicator(
          borderSide: BorderSide(color: accent, width: 2.5),
        ),
      ),
    );
  }

  // Backwards-compatible aliases
  static ThemeData get defaultTheme => light();
  static ThemeData get darkTheme => dark();

  // ── TEXT THEME ──────────────────────────────────────────────────────────────

  static TextTheme _textTheme({required bool isDark}) {
    final text = isDark ? Colors.white : AppColors.textPrimary;
    const muted = AppColors.placeholder;

    return TextTheme(
      // Display — Syne: urban, geometric, authoritative
      displayLarge:  GoogleFonts.syne(fontSize: 48, fontWeight: FontWeight.w700, color: text, letterSpacing: -1.5, height: 1.1),
      displayMedium: GoogleFonts.syne(fontSize: 40, fontWeight: FontWeight.w700, color: text, letterSpacing: -1.0, height: 1.1),
      displaySmall:  GoogleFonts.syne(fontSize: 32, fontWeight: FontWeight.w600, color: text, letterSpacing: -0.5, height: 1.15),

      // Headline — Syne
      headlineLarge:  GoogleFonts.syne(fontSize: 28, fontWeight: FontWeight.w700, color: text, letterSpacing: -0.3),
      headlineMedium: GoogleFonts.syne(fontSize: 22, fontWeight: FontWeight.w700, color: text),
      headlineSmall:  GoogleFonts.syne(fontSize: 18, fontWeight: FontWeight.w600, color: text),

      // Title — DM Sans: clean, readable, personality
      titleLarge:  GoogleFonts.dmSans(fontSize: 17, fontWeight: FontWeight.w600, color: text),
      titleMedium: GoogleFonts.dmSans(fontSize: 15, fontWeight: FontWeight.w600, color: text),
      titleSmall:  GoogleFonts.dmSans(fontSize: 13, fontWeight: FontWeight.w600, color: text),

      // Body — DM Sans
      bodyLarge:  GoogleFonts.dmSans(fontSize: 15, fontWeight: FontWeight.w400, color: text),
      bodyMedium: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w400, color: muted),
      bodySmall:  GoogleFonts.dmSans(fontSize: 12, fontWeight: FontWeight.w400, color: muted),

      // Label — DM Sans: buttons, chips, badges
      labelLarge:  GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w600, color: text),
      labelMedium: GoogleFonts.dmSans(fontSize: 12, fontWeight: FontWeight.w500, color: text),
      labelSmall:  GoogleFonts.dmSans(fontSize: 11, fontWeight: FontWeight.w500, color: muted),
    );
  }

  // ── INPUT THEMES ─────────────────────────────────────────────────────────────

  static InputDecorationTheme get _lightInputTheme => InputDecorationTheme(
    fillColor: AppColors.textInputBackground,
    filled: true,
    floatingLabelBehavior: FloatingLabelBehavior.never,
    hintStyle: GoogleFonts.dmSans(color: AppColors.placeholder, fontSize: 14),
    border: OutlineInputBorder(borderSide: BorderSide.none, borderRadius: BorderRadius.circular(12)),
    enabledBorder: OutlineInputBorder(borderSide: BorderSide.none, borderRadius: BorderRadius.circular(12)),
    focusedBorder: OutlineInputBorder(
      borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      borderRadius: BorderRadius.circular(12),
    ),
    suffixIconColor: AppColors.placeholder,
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
  );

  static InputDecorationTheme get _darkInputTheme => InputDecorationTheme(
    fillColor: AppColors.darkSurface,
    filled: true,
    floatingLabelBehavior: FloatingLabelBehavior.never,
    hintStyle: GoogleFonts.dmSans(color: AppColors.placeholder, fontSize: 14),
    border: OutlineInputBorder(borderSide: BorderSide.none, borderRadius: BorderRadius.circular(12)),
    enabledBorder: OutlineInputBorder(borderSide: BorderSide.none, borderRadius: BorderRadius.circular(12)),
    focusedBorder: OutlineInputBorder(
      borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      borderRadius: BorderRadius.circular(12),
    ),
    suffixIconColor: AppColors.placeholder,
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
  );

  static InputDecorationTheme get defaultInputDecorationTheme => _lightInputTheme;

  static InputDecorationTheme get secondaryInputDecorationTheme => _lightInputTheme;

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
