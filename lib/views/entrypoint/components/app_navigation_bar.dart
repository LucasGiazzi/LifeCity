import 'package:flutter/material.dart';

import '../../../core/constants/constants.dart';
import 'bottom_app_bar_item.dart';

class AppBottomNavigationBar extends StatelessWidget {
  const AppBottomNavigationBar({
    super.key,
    required this.currentIndex,
    required this.onNavTap,
  });

  final int currentIndex;
  final void Function(int) onNavTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              BottomAppBarItem(
                name: 'Mapa',
                iconLocation: AppIcons.home,
                isActive: currentIndex == 0,
                onTap: () => onNavTap(0),
              ),
              BottomAppBarItem(
                name: 'Amigos',
                iconLocation: AppIcons.userGroup,
                isActive: currentIndex == 1,
                onTap: () => onNavTap(1),
              ),

              // Espaço para o FAB
              const SizedBox(width: 56),

              BottomAppBarItem(
                name: 'Destaques',
                iconLocation: AppIcons.heart,
                isActive: currentIndex == 2,
                onTap: () => onNavTap(2),
              ),
              BottomAppBarItem(
                name: 'Missões',
                iconData: Icons.flag_rounded,
                isActive: currentIndex == 3,
                onTap: () => onNavTap(3),
              ),
              BottomAppBarItem(
                name: 'Perfil',
                iconLocation: AppIcons.profile,
                isActive: currentIndex == 4,
                onTap: () => onNavTap(4),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
