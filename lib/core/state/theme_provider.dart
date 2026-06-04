import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum AppAccent {
  forest('Floresta', Color(0xFF00C896)),
  ocean('Oceano', Color(0xFF0EA5E9)),
  amber('Âmbar', Color(0xFFF59E0B)),
  coral('Coral', Color(0xFFFF6B6B)),
  violet('Violeta', Color(0xFF8B5CF6));

  const AppAccent(this.label, this.color);
  final String label;
  final Color color;
}

class ThemeProvider extends ChangeNotifier {
  static const _themeKey = 'theme_mode';
  static const _accentKey = 'accent_color';

  ThemeMode _mode = ThemeMode.light;
  AppAccent _accent = AppAccent.forest;

  ThemeMode get mode => _mode;
  AppAccent get accent => _accent;
  bool get isDark => _mode == ThemeMode.dark;
  Color get accentColor => _accent.color;

  Future<void> initialize() async {
    final prefs = await SharedPreferences.getInstance();
    _mode = prefs.getString(_themeKey) == 'dark' ? ThemeMode.dark : ThemeMode.light;
    final saved = prefs.getString(_accentKey);
    _accent = AppAccent.values.firstWhere(
      (a) => a.name == saved,
      orElse: () => AppAccent.forest,
    );
    notifyListeners();
  }

  Future<void> toggle() async {
    _mode = isDark ? ThemeMode.light : ThemeMode.dark;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_themeKey, isDark ? 'dark' : 'light');
  }

  Future<void> setAccent(AppAccent accent) async {
    _accent = accent;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_accentKey, accent.name);
  }
}
