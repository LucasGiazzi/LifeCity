import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/routes/app_routes.dart';
import '../../../core/state/auth_state.dart';
import '../../../core/state/theme_provider.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF1A1A2E) : Colors.white;
    final textColor = isDark ? Colors.white : AppColors.dark;
    final subtitleColor = isDark ? const Color(0xFF8B9BB4) : AppColors.placeholder;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Configurações',
          style: GoogleFonts.poppins(fontWeight: FontWeight.w700, fontSize: 18),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Aparência ──
          _SectionLabel('Aparência', subtitleColor),
          const SizedBox(height: 8),
          _SettingsCard(
            cardBg: cardBg,
            children: [
              _ThemeToggleTile(textColor: textColor, subtitleColor: subtitleColor),
            ],
          ),

          const SizedBox(height: 20),

          // ── Conta ──
          _SectionLabel('Conta', subtitleColor),
          const SizedBox(height: 8),
          _SettingsCard(
            cardBg: cardBg,
            children: [
              _NavTile(
                icon: Icons.person_outline_rounded,
                label: 'Editar perfil',
                textColor: textColor,
                onTap: () => Navigator.pushNamed(context, AppRoutes.profileEdit),
              ),
              _Divider(),
              _NavTile(
                icon: Icons.lock_outline_rounded,
                label: 'Alterar senha',
                textColor: textColor,
                onTap: () => Navigator.pushNamed(context, AppRoutes.changePassword),
              ),
              _Divider(),
              _NavTile(
                icon: Icons.phone_outlined,
                label: 'Alterar telefone',
                textColor: textColor,
                onTap: () => Navigator.pushNamed(context, AppRoutes.changePhoneNumber),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // ── Notificações ──
          _SectionLabel('Notificações', subtitleColor),
          const SizedBox(height: 8),
          _SettingsCard(
            cardBg: cardBg,
            children: [
              _NavTile(
                icon: Icons.notifications_outlined,
                label: 'Preferências de notificação',
                textColor: textColor,
                onTap: () => Navigator.pushNamed(context, AppRoutes.settingsNotifications),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // ── Sair ──
          _SettingsCard(
            cardBg: cardBg,
            children: [
              _NavTile(
                icon: Icons.logout_rounded,
                label: 'Sair',
                textColor: Colors.red,
                onTap: () async {
                  final auth = Provider.of<AuthState>(context, listen: false);
                  final nav = Navigator.of(context);
                  await auth.logout();
                  nav.pushNamedAndRemoveUntil(AppRoutes.login, (route) => false);
                },
              ),
            ],
          ),

          const SizedBox(height: 20),
        ],
      ),
    );
  }
}

// ── Widgets internos ─────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String text;
  final Color color;
  const _SectionLabel(this.text, this.color);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Text(
        text.toUpperCase(),
        style: GoogleFonts.poppins(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
          letterSpacing: 1.0,
        ),
      ),
    );
  }
}

class _SettingsCard extends StatelessWidget {
  final Color cardBg;
  final List<Widget> children;
  const _SettingsCard({required this.cardBg, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(children: children),
    );
  }
}

class _ThemeToggleTile extends StatelessWidget {
  final Color textColor;
  final Color subtitleColor;
  const _ThemeToggleTile({required this.textColor, required this.subtitleColor});

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              themeProvider.isDark ? Icons.dark_mode_rounded : Icons.light_mode_rounded,
              color: AppColors.primary,
              size: 20,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  themeProvider.isDark ? 'Modo escuro' : 'Modo claro',
                  style: GoogleFonts.poppins(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: textColor,
                  ),
                ),
                Text(
                  themeProvider.isDark
                      ? 'Toque para ativar o modo claro'
                      : 'Toque para ativar o modo escuro',
                  style: GoogleFonts.poppins(fontSize: 12, color: subtitleColor),
                ),
              ],
            ),
          ),
          Switch.adaptive(
            value: themeProvider.isDark,
            onChanged: (_) => themeProvider.toggle(),
            activeThumbColor: Colors.white,
            activeTrackColor: AppColors.primary,
          ),
        ],
      ),
    );
  }
}

class _NavTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color textColor;
  final VoidCallback onTap;
  const _NavTile({required this.icon, required this.label, required this.textColor, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: AppColors.primary, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                label,
                style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w500, color: textColor),
              ),
            ),
            Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.placeholder),
          ],
        ),
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return const Divider(height: 1, indent: 66, endIndent: 16);
  }
}
