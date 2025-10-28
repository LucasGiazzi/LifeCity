import 'package:animations/animations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_defaults.dart';
import '../../core/constants/app_icons.dart';
import '../../core/state/filter_controller.dart';
import '../../core/state/filter_scope.dart';

import '../menu/menu_page.dart';
import '../cart/cart_page.dart';
import '../save/save_page.dart';
import '../profile/profile_page.dart';
import 'components/app_navigation_bar.dart';

/// EntryPoint com bottom nav + filtro global
class EntryPointUI extends StatefulWidget {
  const EntryPointUI({super.key});

  @override
  State<EntryPointUI> createState() => _EntryPointUIState();
}

class _EntryPointUIState extends State<EntryPointUI> {
  int currentIndex = 0;
  late final FilterController _filters;

  @override
  void initState() {
    super.initState();
    _filters = FilterController();
  }

  @override
  void dispose() {
    _filters.dispose();
    super.dispose();
  }

  void onBottomNavigationTap(int index) {
    setState(() => currentIndex = index);
  }

  final List<Widget> pages = const [
    _MapBody(), // 0 - mapa
    MenuPage(), // 1 - filtro
    CartPage(isHomePage: true),
    SavePage(isHomePage: false),
    ProfilePage(),
  ];

  @override
  Widget build(BuildContext context) {
    return FilterScope(
      controller: _filters,
      child: Scaffold(
        body: PageTransitionSwitcher(
          duration: AppDefaults.duration,
          transitionBuilder: (child, primary, secondary) => SharedAxisTransition(
            animation: primary,
            secondaryAnimation: secondary,
            transitionType: SharedAxisTransitionType.horizontal,
            fillColor: AppColors.scaffoldBackground,
            child: child,
          ),
          child: pages[currentIndex],
        ),
        floatingActionButton: FloatingActionButton(
          onPressed: () => onBottomNavigationTap(2),
          backgroundColor: AppColors.primary,
          child: SvgPicture.asset(AppIcons.cart),
        ),
        floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
        bottomNavigationBar: AppBottomNavigationBar(
          currentIndex: currentIndex,
          onNavTap: onBottomNavigationTap,
        ),
      ),
    );
  }
}

/* ====================== MAP BODY ====================== */

class _MapBody extends StatefulWidget {
  const _MapBody({super.key});

  @override
  State<_MapBody> createState() => _MapBodyState();
}

class _MapBodyState extends State<_MapBody> {
  final mapController = MapController();
  final LatLng _center = const LatLng(-22.9099, -47.0626);

  final List<_Event> _events = const [
    _Event(
      id: '1',
      type: 'eventos',
      title: 'Evento Municipal - Feira Cultural',
      point: LatLng(-22.9093, -47.0645),
      likes: 42,
      comments: 10,
    ),
    _Event(
      id: '2',
      type: 'festas',
      title: 'Festa na Praça Central',
      point: LatLng(-22.9120, -47.0600),
      likes: 120,
      comments: 35,
    ),
    _Event(
      id: '3',
      type: 'esportes',
      title: 'Corrida de Rua LifeRun',
      point: LatLng(-22.9072, -47.0585),
      likes: 15,
      comments: 6,
    ),
    _Event(
      id: '4',
      type: 'educacao',
      title: 'Palestra: Cidadania e Sustentabilidade',
      point: LatLng(-22.9088, -47.0632),
      likes: 60,
      comments: 14,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final filters = FilterScope.of(context).selected;
    final visible = filters.isEmpty
        ? _events
        : _events.where((e) => filters.contains(e.type)).toList();

    return Scaffold(
      body: Stack(
        children: [
          // MAPA
          FlutterMap(
            mapController: mapController,
            options: MapOptions(initialCenter: _center, initialZoom: 14),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.lifecity.app',
              ),
              MarkerLayer(
                markers: visible.map((e) {
                  return Marker(
                    point: e.point,
                    width: 40,
                    height: 40,
                    child: GestureDetector(
                      onTap: () => _openEventSheet(e),
                      child: _Pin(type: e.type),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),

          // BARRA DE BUSCA
          Positioned(
            top: 16,
            left: 16,
            right: 16,
            child: Material(
              elevation: 2,
              borderRadius: BorderRadius.circular(12),
              child: TextField(
                onSubmitted: (q) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Buscar: $q')),
                  );
                },
                decoration: InputDecoration(
                  hintText: 'Buscar endereço ou evento',
                  prefixIcon: const Icon(Icons.search),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                  filled: true,
                ),
              ),
            ),
          ),

          // BOTÃO MINHA LOCALIZAÇÃO
          Positioned(
            bottom: 16,
            right: 16,
            child: FloatingActionButton.small(
              heroTag: 'my_location',
              onPressed: () => mapController.move(_center, 15),
              backgroundColor: Colors.white,
              child: const Icon(Icons.my_location, color: Colors.black87),
            ),
          ),
        ],
      ),
    );
  }

  void _openEventSheet(_Event e) {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(AppDefaults.padding),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(e.title,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Row(
              children: [
                _TypePill(type: e.type),
                const SizedBox(width: 12),
                const Icon(Icons.thumb_up_alt_outlined, size: 18),
                const SizedBox(width: 4),
                Text('${e.likes}'),
                const SizedBox(width: 12),
                const Icon(Icons.mode_comment_outlined, size: 18),
                const SizedBox(width: 4),
                Text('${e.comments}'),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/* ====================== HELPERS ====================== */

class _Event {
  final String id;
  final String type; // festas, eventos, esportes, etc
  final String title;
  final LatLng point;
  final int likes;
  final int comments;

  const _Event({
    required this.id,
    required this.type,
    required this.title,
    required this.point,
    required this.likes,
    required this.comments,
  });
}

class _Pin extends StatelessWidget {
  final String type;
  const _Pin({required this.type});

  @override
  Widget build(BuildContext context) {
    final Color c = switch (type) {
      'festas' => Colors.pink,
      'eventos' => Colors.blueAccent,
      'esportes' => Colors.green,
      'educacao' => Colors.orange,
      _ => Colors.grey,
    };
    return Container(
      decoration: BoxDecoration(
        color: c,
        shape: BoxShape.circle,
        boxShadow: const [BoxShadow(blurRadius: 6, color: Colors.black26)],
      ),
      child: const Center(
        child: Icon(Icons.place, color: Colors.white, size: 20),
      ),
    );
  }
}

class _TypePill extends StatelessWidget {
  final String type;
  const _TypePill({required this.type});

  @override
  Widget build(BuildContext context) {
    IconData icon = switch (type) {
      'festas' => Icons.celebration,
      'eventos' => Icons.event,
      'esportes' => Icons.sports,
      'educacao' => Icons.school,
      _ => Icons.category,
    };
    return Chip(
      visualDensity: VisualDensity.compact,
      avatar: Icon(icon, size: 16),
      label: Text(type),
    );
  }
}
