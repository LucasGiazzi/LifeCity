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
    return BottomAppBar(
      shape: const CircularNotchedRectangle(),
      notchMargin: AppDefaults.margin,
      color: AppColors.scaffoldBackground,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
          
          const Padding(
            padding: EdgeInsets.all(AppDefaults.padding * 2),
            child: SizedBox(width: AppDefaults.margin),
          ),

          BottomAppBarItem(
            name: 'Eventos',
            iconLocation: AppIcons.save,
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
    );
  }
}
