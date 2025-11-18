import 'package:animations/animations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_defaults.dart';
import '../../core/models/event_model.dart';
import '../../core/routes/app_routes.dart';
import '../../core/services/event_service.dart';
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
  final GlobalKey<_MapBodyState> _mapBodyKey = GlobalKey<_MapBodyState>();

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

  List<Widget> get pages => [
    _MapBody(key: _mapBodyKey), // 0 - mapa
    const MenuPage(), // 1 - filtro
    const CartPage(isHomePage: true),
    const SavePage(isHomePage: false),
    const ProfilePage(),
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
          onPressed: () async {
            final result = await Navigator.pushNamed(context, AppRoutes.createEvent);
            // Se um evento foi criado, recarregar a lista no mapa
            if (result == true && currentIndex == 0) {
              // Recarregar eventos do mapa
              _mapBodyKey.currentState?.reloadEvents();
            }
          },
          backgroundColor: AppColors.primary,
          child: const Icon(Icons.add, color: Colors.white, size: 32),
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
  final EventService _eventService = EventService();

  List<EventModel> _events = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadEvents();
  }

  Future<void> _loadEvents() async {
    if (!mounted) return;
    
    setState(() {
      _isLoading = true;
    });

    try {
      final eventsData = await _eventService.getAllEvents();
      final events = eventsData
          .map((e) => EventModel.fromJson(e))
          .where((e) => e.latitude != null && e.longitude != null) // Apenas eventos com coordenadas
          .toList();

      if (mounted) {
        setState(() {
          _events = events;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Erro ao carregar eventos: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void reloadEvents() {
    _loadEvents();
  }

  @override
  Widget build(BuildContext context) {
    final filters = FilterScope.of(context).selected;
    final visible = filters.isEmpty
        ? _events
        : _events.where((e) => e.category != null && filters.contains(e.categoryType)).toList();

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
              if (!_isLoading)
                MarkerLayer(
                  markers: visible.map((e) {
                    return Marker(
                      point: LatLng(e.latitude!, e.longitude!),
                      width: 40,
                      height: 40,
                      child: GestureDetector(
                        onTap: () => _openEventSheet(e),
                        child: _EventPin(category: e.categoryType),
                      ),
                    );
                  }).toList(),
                ),
              if (_isLoading)
                const Center(
                  child: CircularProgressIndicator(),
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

  void _openEventSheet(EventModel e) {
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
            Text(
              e.description,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            if (e.category != null) ...[
              _TypePill(type: e.categoryType),
              const SizedBox(height: 8),
            ],
            if (e.address != null) ...[
              Row(
                children: [
                  const Icon(Icons.location_on, size: 16),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      e.address!,
                      style: const TextStyle(fontSize: 14),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
            ],
            Row(
              children: [
                const Icon(Icons.access_time, size: 16),
                const SizedBox(width: 4),
                Text(
                  _formatDateTime(e.startDate),
                  style: const TextStyle(fontSize: 14),
                ),
              ],
            ),
            if (e.endDate != null) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.event_busy, size: 16),
                  const SizedBox(width: 4),
                  Text(
                    'Até ${_formatDateTime(e.endDate!)}',
                    style: const TextStyle(fontSize: 14),
                  ),
                ],
              ),
            ],
            if (e.createdByName != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.person, size: 16),
                  const SizedBox(width: 4),
                  Text(
                    'Criado por: ${e.createdByName}',
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatDateTime(DateTime dateTime) {
    final day = dateTime.day.toString().padLeft(2, '0');
    final month = dateTime.month.toString().padLeft(2, '0');
    final year = dateTime.year;
    final hour = dateTime.hour.toString().padLeft(2, '0');
    final minute = dateTime.minute.toString().padLeft(2, '0');
    return '$day/$month/$year às $hour:$minute';
  }
}

/* ====================== HELPERS ====================== */

class _EventPin extends StatelessWidget {
  final String category;
  const _EventPin({required this.category});

  @override
  Widget build(BuildContext context) {
    final Color pinColor = switch (category) {
      'festas' => Colors.pink,
      'eventos' => Colors.blueAccent,
      'esportes' => Colors.green,
      'educacao' => Colors.orange,
      _ => Colors.grey,
    };

    final IconData pinIcon = switch (category) {
      'festas' => Icons.celebration,
      'eventos' => Icons.event,
      'esportes' => Icons.sports_soccer,
      'educacao' => Icons.school,
      _ => Icons.place,
    };

    return Container(
      decoration: BoxDecoration(
        color: pinColor,
        shape: BoxShape.circle,
        boxShadow: const [BoxShadow(blurRadius: 6, color: Colors.black26)],
      ),
      child: Center(
        child: Icon(pinIcon, color: Colors.white, size: 20),
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
