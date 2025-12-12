import 'package:animations/animations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_defaults.dart';
import '../../core/models/event_model.dart';
import '../../core/models/complaint_model.dart';
import '../../core/routes/app_routes.dart';
import '../../core/services/event_service.dart';
import '../../core/services/complaint_service.dart';
import '../../core/state/filter_controller.dart';
import '../../core/state/filter_scope.dart';
import 'package:provider/provider.dart';
import '../../core/state/auth_state.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../menu/menu_page.dart';
import '../cart/cart_page.dart';
import '../profile/profile_page.dart';
import '../my_items/my_items_page.dart';
import 'components/app_navigation_bar.dart';

enum MapViewType { events, complaints }

/// EntryPoint com bottom nav + filtro global
class EntryPointUI extends StatefulWidget {
  const EntryPointUI({super.key});

  @override
  State<EntryPointUI> createState() => _EntryPointUIState();
}

class _EntryPointUIState extends State<EntryPointUI> {
  int currentIndex = 0;
  MapViewType _currentViewType = MapViewType.events;
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

  void _onViewTypeChanged(MapViewType type) {
    setState(() {
      _currentViewType = type;
      // Limpar filtros ao alternar entre Eventos e Reclamações
      _filters.clear();
    });
    // Recarregar dados quando alternar visualização
    _mapBodyKey.currentState?.reloadData(type);
  }

  List<Widget> get pages => [
    _MapBody(
      key: _mapBodyKey,
      viewType: _currentViewType,
    ), // 0 - mapa
    const MenuPage(), // 1 - filtro
    const CartPage(isHomePage: true),
    const MyItemsPage(), // 3 - meus eventos e reclamações
    const ProfilePage(),
  ];

  @override
  Widget build(BuildContext context) {
    return FilterScope(
      controller: _filters,
      child: Scaffold(
        body: Stack(
          children: [
            PageTransitionSwitcher(
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
            // Botões de alternância Eventos/Reclamações e Filtros (apenas na tela do mapa)
            if (currentIndex == 0)
              Column(
                children: [
                  SizedBox(height: MediaQuery.of(context).padding.top + 8),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: _ViewTypeToggle(
                      currentType: _currentViewType,
                      onTypeChanged: _onViewTypeChanged,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: _FilterButtons(viewType: _currentViewType),
                  ),
                ],
              ),
          ],
        ),
        floatingActionButton: FloatingActionButton(
          onPressed: () async {
            // Navegar para o formulário apropriado baseado na visualização ativa
            final route = _currentViewType == MapViewType.events
                ? AppRoutes.createEvent
                : AppRoutes.createComplaint;
            
            final result = await Navigator.pushNamed(context, route);
            // Se um item foi criado, recarregar a lista no mapa
            if (result == true && currentIndex == 0) {
              _mapBodyKey.currentState?.reloadData(_currentViewType);
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

/* ====================== VIEW TYPE TOGGLE ====================== */

class _ViewTypeToggle extends StatelessWidget {
  final MapViewType currentType;
  final Function(MapViewType) onTypeChanged;

  const _ViewTypeToggle({
    required this.currentType,
    required this.onTypeChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 4,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _ToggleButton(
              label: 'Eventos',
              isActive: currentType == MapViewType.events,
              onTap: () => onTypeChanged(MapViewType.events),
            ),
            _ToggleButton(
              label: 'Reclamações',
              isActive: currentType == MapViewType.complaints,
              onTap: () => onTypeChanged(MapViewType.complaints),
            ),
          ],
        ),
      ),
    );
  }
}

class _ToggleButton extends StatelessWidget {
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _ToggleButton({
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        decoration: BoxDecoration(
          color: isActive ? AppColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isActive ? Colors.white : Colors.grey[700],
            fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
            fontSize: 14,
          ),
        ),
      ),
    );
  }
}

/* ====================== FILTER BUTTONS ====================== */

class _FilterButtons extends StatelessWidget {
  final MapViewType viewType;

  const _FilterButtons({required this.viewType});

  // Categorias de eventos
  static const List<Map<String, dynamic>> _eventCategories = [
    {'key': 'festas', 'label': 'Festas', 'icon': Icons.celebration, 'color': Colors.pink},
    {'key': 'eventos', 'label': 'Eventos', 'icon': Icons.event, 'color': Colors.blueAccent},
    {'key': 'esportes', 'label': 'Esportes', 'icon': Icons.sports_soccer, 'color': Colors.green},
    {'key': 'educacao', 'label': 'Educação', 'icon': Icons.school, 'color': Colors.orange},
    {'key': 'cultura', 'label': 'Cultura', 'icon': Icons.music_note, 'color': Colors.purple},
    {'key': 'saude', 'label': 'Saúde', 'icon': Icons.local_hospital, 'color': Colors.red},
  ];

  // Categorias de reclamações
  static const List<Map<String, dynamic>> _complaintCategories = [
    {'key': 'infraestrutura', 'label': 'Infra', 'icon': Icons.construction, 'color': Colors.orange},
    {'key': 'seguranca', 'label': 'Segurança', 'icon': Icons.security, 'color': Colors.red},
    {'key': 'limpeza', 'label': 'Limpeza', 'icon': Icons.cleaning_services, 'color': Colors.teal},
    {'key': 'transito', 'label': 'Trânsito', 'icon': Icons.traffic, 'color': Colors.amber},
    {'key': 'outros', 'label': 'Outros', 'icon': Icons.report_problem, 'color': Colors.grey},
  ];

  @override
  Widget build(BuildContext context) {
    final filters = FilterScope.of(context);
    final categories = viewType == MapViewType.events 
        ? _eventCategories 
        : _complaintCategories;

    // Usar AnimatedBuilder para reagir a mudanças no FilterController
    return ListenableBuilder(
      listenable: filters,
      builder: (context, _) {

    return Material(
      elevation: 4,
      borderRadius: BorderRadius.circular(12),
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final category in categories)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: _CircularFilterButton(
                    filterKey: category['key'] as String,
                    label: category['label'] as String,
                    icon: category['icon'] as IconData,
                    color: category['color'] as Color,
                    isSelected: filters.isSelected(category['key'] as String),
                    onTap: () => filters.toggle(category['key'] as String),
                  ),
                ),
            ],
          ),
        ),
      ),
      );
      },
    );
  }
}

class _CircularFilterButton extends StatelessWidget {
  final String filterKey;
  final String label;
  final IconData icon;
  final Color color;
  final bool isSelected;
  final VoidCallback onTap;

  const _CircularFilterButton({
    required this.filterKey,
    required this.label,
    required this.icon,
    required this.color,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: isSelected ? color : color.withOpacity(0.2),
              shape: BoxShape.circle,
              border: Border.all(
                color: isSelected ? color : Colors.grey[300]!,
                width: isSelected ? 2 : 1,
              ),
            ),
            child: Icon(
              icon,
              color: isSelected ? Colors.white : color,
              size: 24,
            ),
          ),
          const SizedBox(height: 4),
          SizedBox(
            width: 60,
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11,
                color: isSelected ? color : Colors.grey[700],
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

/* ====================== MAP BODY ====================== */

class _MapBody extends StatefulWidget {
  final MapViewType viewType;
  
  const _MapBody({
    super.key,
    required this.viewType,
  });

  @override
  State<_MapBody> createState() => _MapBodyState();
}

class _MapBodyState extends State<_MapBody> {
  final mapController = MapController();
  LatLng _center = const LatLng(-22.9099, -47.0626); // Centro padrão (Campinas)
  final EventService _eventService = EventService();
  final ComplaintService _complaintService = ComplaintService();

  List<EventModel> _events = [];
  List<ComplaintModel> _complaints = [];
  bool _isLoading = true;
  bool _isGettingLocation = false;
  MapViewType _currentViewType = MapViewType.events;

  @override
  void initState() {
    super.initState();
    _currentViewType = widget.viewType;
    _loadData(_currentViewType);
  }

  @override
  void didUpdateWidget(_MapBody oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.viewType != widget.viewType) {
      _currentViewType = widget.viewType;
      _loadData(_currentViewType);
    }
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
          .where((e) => e.latitude != null && e.longitude != null)
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

  Future<void> _loadComplaints() async {
    if (!mounted) return;
    
    setState(() {
      _isLoading = true;
    });

    try {
      final complaintsData = await _complaintService.getAllComplaints();
      final complaints = complaintsData
          .map((c) => ComplaintModel.fromJson(c))
          .where((c) => c.latitude != null && c.longitude != null)
          .toList();

      if (mounted) {
        setState(() {
          _complaints = complaints;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Erro ao carregar reclamações: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _loadData(MapViewType type) async {
    if (type == MapViewType.events) {
      await _loadEvents();
    } else {
      await _loadComplaints();
    }
  }

  void reloadData(MapViewType type) {
    _currentViewType = type;
    _loadData(type);
  }

  void reloadEvents() {
    _loadEvents();
  }

  Future<void> _getCurrentLocation() async {
    setState(() {
      _isGettingLocation = true;
    });

    try {
      // Verificar permissões
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Serviços de localização estão desabilitados.'),
              backgroundColor: Colors.orange,
            ),
          );
        }
        setState(() {
          _isGettingLocation = false;
        });
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Permissão de localização negada.'),
                backgroundColor: Colors.orange,
              ),
            );
          }
          setState(() {
            _isGettingLocation = false;
          });
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Permissão de localização negada permanentemente. Ative nas configurações.'),
              backgroundColor: Colors.red,
            ),
          );
        }
        setState(() {
          _isGettingLocation = false;
        });
        return;
      }

      // Obter localização atual
      Position position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );

      if (mounted) {
        setState(() {
          _center = LatLng(position.latitude, position.longitude);
          _isGettingLocation = false;
        });

        // Mover o mapa para a localização atual
        mapController.move(_center, 15);

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Localização atualizada!'),
            backgroundColor: Colors.green,
            duration: Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      setState(() {
        _isGettingLocation = false;
      });
      debugPrint('Erro ao obter localização: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erro ao obter localização: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final filterController = FilterScope.of(context);
    final filters = filterController.selected;
    
    // Usar ListenableBuilder para reagir a mudanças nos filtros
    return ListenableBuilder(
      listenable: filterController,
      builder: (context, _) {
        // Determinar marcadores baseado no tipo de visualização
        List<Marker> markers = [];
        if (!_isLoading) {
          if (_currentViewType == MapViewType.events) {
            final visible = filters.isEmpty
                ? _events
                : _events.where((e) => e.category != null && filters.contains(e.categoryType)).toList();
            
            markers = visible.map((e) {
              return Marker(
                point: LatLng(e.latitude!, e.longitude!),
                width: 40,
                height: 40,
                child: GestureDetector(
                  onTap: () => _openEventSheet(e),
                  child: _EventPin(category: e.categoryType),
                ),
              );
            }).toList();
          } else {
            // Reclamações com filtros
            final visible = filters.isEmpty
                ? _complaints
                : _complaints.where((c) {
                    if (c.type == null) return false;
                    // Normalizar o tipo para lowercase para comparar com as chaves do filtro
                    final normalizedType = c.type!.toLowerCase();
                    return filters.contains(normalizedType);
                  }).toList();
            
            markers = visible.map((c) {
              return Marker(
                point: LatLng(c.latitude!, c.longitude!),
                width: 40,
                height: 40,
                child: GestureDetector(
                  onTap: () => _openComplaintSheet(c),
                  child: _ComplaintPin(type: c.type),
                ),
              );
            }).toList();
          }
        }

        return Scaffold(
      body: Stack(
        children: [
          // MAPA
          FlutterMap(
            mapController: mapController,
            options: MapOptions(
              initialCenter: _center, 
              initialZoom: 14,
              interactionOptions: const InteractionOptions(
                flags: InteractiveFlag.drag |
                      InteractiveFlag.pinchZoom |
                      InteractiveFlag.scrollWheelZoom,
              ),
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.lifecity.app',
              ),
              if (!_isLoading && markers.isNotEmpty)
                MarkerLayer(markers: markers),
              if (_isLoading)
                const Center(
                  child: CircularProgressIndicator(),
                ),
            ],
          ),

          // BARRA DE BUSCA
          /* Positioned(
            top: 16,
            left: 16,
            right: 16,
            child: Material(
              elevation: 2,
              borderRadius: BorderRadius.circular(12),
              child: TextField(
                onSubmitted: (q) {
                  // TODO: Implementar busca de endereço ou evento
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
          ), */

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
      },
    );
  }

  void _openEventSheet(EventModel e) {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _EventDetailSheet(event: e),
    );
  }

  void _openComplaintSheet(ComplaintModel c) {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _ComplaintDetailSheet(complaint: c),
    );
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

class _ComplaintPin extends StatelessWidget {
  final String? type;
  const _ComplaintPin({this.type});

  // Usar as mesmas categorias definidas em _FilterButtons para garantir consistência
  static const List<Map<String, dynamic>> _complaintCategories = [
    {'key': 'infraestrutura', 'icon': Icons.construction, 'color': Colors.orange},
    {'key': 'seguranca', 'icon': Icons.security, 'color': Colors.red},
    {'key': 'limpeza', 'icon': Icons.cleaning_services, 'color': Colors.teal},
    {'key': 'transito', 'icon': Icons.traffic, 'color': Colors.amber},
    {'key': 'outros', 'icon': Icons.report_problem, 'color': Colors.grey},
  ];

  @override
  Widget build(BuildContext context) {
    if (type == null) {
      return Container(
        decoration: BoxDecoration(
          color: Colors.red.shade700,
          shape: BoxShape.circle,
          boxShadow: const [BoxShadow(blurRadius: 6, color: Colors.black26)],
        ),
        child: const Center(
          child: Icon(Icons.warning, color: Colors.white, size: 20),
        ),
      );
    }

    // Buscar a categoria correspondente
    final normalizedType = type!.toLowerCase();
    final category = _complaintCategories.firstWhere(
      (cat) => cat['key'] == normalizedType,
      orElse: () => {'icon': Icons.warning, 'color': Colors.red.shade700},
    );

    final Color pinColor = category['color'] as Color;
    final IconData pinIcon = category['icon'] as IconData;

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

class _ComplaintTypePill extends StatelessWidget {
  final String type;
  const _ComplaintTypePill({required this.type});

  @override
  Widget build(BuildContext context) {
    IconData icon = switch (type.toLowerCase()) {
      'infraestrutura' => Icons.construction,
      'seguranca' => Icons.security,
      'limpeza' => Icons.cleaning_services,
      'transito' => Icons.traffic,
      'outros' => Icons.report_problem,
      _ => Icons.warning,
    };
    
    String label = switch (type.toLowerCase()) {
      'infraestrutura' => 'Infraestrutura',
      'seguranca' => 'Segurança',
      'limpeza' => 'Limpeza',
      'transito' => 'Trânsito',
      'outros' => 'Outros',
      _ => type,
    };
    
    return Chip(
      visualDensity: VisualDensity.compact,
      avatar: Icon(icon, size: 16),
      label: Text(label),
    );
  }
}

/* ====================== COMPLAINT DETAIL SHEET ====================== */

class _ComplaintDetailSheet extends StatefulWidget {
  final ComplaintModel complaint;

  const _ComplaintDetailSheet({required this.complaint});

  @override
  State<_ComplaintDetailSheet> createState() => _ComplaintDetailSheetState();
}

class _ComplaintDetailSheetState extends State<_ComplaintDetailSheet> {
  final ComplaintService _complaintService = ComplaintService();
  List<Map<String, dynamic>> _photos = [];
  bool _isLoadingPhotos = true;

  @override
  void initState() {
    super.initState();
    _loadPhotos();
  }

  Future<void> _loadPhotos() async {
    setState(() {
      _isLoadingPhotos = true;
    });

    try {
      final photos = await _complaintService.getPhotos(widget.complaint.id);
      if (mounted) {
        setState(() {
          _photos = photos;
          _isLoadingPhotos = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoadingPhotos = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = Provider.of<AuthState>(context, listen: false);
    final currentUser = authState.currentUser;
    final isOwner = currentUser != null && 
                    widget.complaint.createdBy != null &&
                    currentUser['id']?.toString() == widget.complaint.createdBy;

    return Padding(
      padding: const EdgeInsets.all(AppDefaults.padding),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.complaint.description,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          if (widget.complaint.type != null) ...[
            _ComplaintTypePill(type: widget.complaint.type!),
            const SizedBox(height: 8),
          ],
          if (widget.complaint.address != null) ...[
            Row(
              children: [
                const Icon(Icons.location_on, size: 16),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    widget.complaint.address!,
                    style: const TextStyle(fontSize: 14),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
          ],
          Row(
            children: [
              const Icon(Icons.calendar_today, size: 16),
              const SizedBox(width: 4),
              Text(
                _formatDate(widget.complaint.occurrenceDate),
                style: const TextStyle(fontSize: 14),
              ),
            ],
          ),
          if (widget.complaint.createdByName != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.person, size: 16),
                const SizedBox(width: 4),
                Text(
                  'Criado por: ${widget.complaint.createdByName}',
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
          ],
          // Galeria de fotos
          if (_isLoadingPhotos)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_photos.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text(
              'Fotos',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 120,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: _photos.length,
                itemBuilder: (context, index) {
                  final photo = _photos[index];
                  final url = photo['url'] as String?;
                  if (url == null) return const SizedBox.shrink();
                  
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: CachedNetworkImage(
                        imageUrl: url,
                        width: 120,
                        height: 120,
                        fit: BoxFit.cover,
                        placeholder: (context, url) => Container(
                          width: 120,
                          height: 120,
                          color: Colors.grey[300],
                          child: const Center(child: CircularProgressIndicator()),
                        ),
                        errorWidget: (context, url, error) => Container(
                          width: 120,
                          height: 120,
                          color: Colors.grey[300],
                          child: const Icon(Icons.error),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
          // Botão de exclusão (apenas para dono)
          if (isOwner) ...[
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _showDeleteConfirmation(context),
                icon: const Icon(Icons.delete),
                label: const Text('Excluir Reclamação'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red,
                  foregroundColor: Colors.white,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _showDeleteConfirmation(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirmar Exclusão'),
        content: const Text('Tem certeza que deseja excluir esta reclamação? Esta ação não pode ser desfeita.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context); // Fecha o diálogo
              final success = await _complaintService.deleteComplaint(widget.complaint.id);
              if (mounted) {
                if (success) {
                  Navigator.pop(context); // Fecha o bottom sheet
                  // Recarregar dados no mapa
                  if (context.mounted) {
                    final mapBodyState = context.findAncestorStateOfType<_MapBodyState>();
                    mapBodyState?.reloadData(MapViewType.complaints);
                  }
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Reclamação excluída com sucesso'),
                      backgroundColor: Colors.green,
                    ),
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Erro ao excluir reclamação'),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              }
            },
            child: const Text('Excluir', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    final year = date.year;
    return '$day/$month/$year';
  }
}

/* ====================== EVENT DETAIL SHEET ====================== */

class _EventDetailSheet extends StatelessWidget {
  final EventModel event;

  const _EventDetailSheet({required this.event});

  @override
  Widget build(BuildContext context) {
    final authState = Provider.of<AuthState>(context, listen: false);
    final currentUser = authState.currentUser;
    final isOwner = currentUser != null && 
                    event.createdBy != null &&
                    currentUser['id']?.toString() == event.createdBy;

    return Padding(
      padding: const EdgeInsets.all(AppDefaults.padding),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            event.description,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          if (event.category != null) ...[
            _TypePill(type: event.categoryType),
            const SizedBox(height: 8),
          ],
          if (event.address != null) ...[
            Row(
              children: [
                const Icon(Icons.location_on, size: 16),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    event.address!,
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
                _formatDateTime(event.startDate),
                style: const TextStyle(fontSize: 14),
              ),
            ],
          ),
          if (event.endDate != null) ...[
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.event_busy, size: 16),
                const SizedBox(width: 4),
                Text(
                  'Até ${_formatDateTime(event.endDate!)}',
                  style: const TextStyle(fontSize: 14),
                ),
              ],
            ),
          ],
          if (event.createdByName != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.person, size: 16),
                const SizedBox(width: 4),
                Text(
                  'Criado por: ${event.createdByName}',
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
          ],
          // Botão de exclusão (apenas para dono)
          if (isOwner) ...[
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _showDeleteConfirmation(context),
                icon: const Icon(Icons.delete),
                label: const Text('Excluir Evento'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red,
                  foregroundColor: Colors.white,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _showDeleteConfirmation(BuildContext context) {
    final eventService = EventService();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirmar Exclusão'),
        content: const Text('Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context); // Fecha o diálogo
              final success = await eventService.deleteEvent(event.id);
              if (context.mounted) {
                if (success) {
                  Navigator.pop(context); // Fecha o bottom sheet
                  // Recarregar dados no mapa
                  if (context.mounted) {
                    final mapBodyState = context.findAncestorStateOfType<_MapBodyState>();
                    mapBodyState?.reloadData(MapViewType.events);
                  }
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Evento excluído com sucesso'),
                      backgroundColor: Colors.green,
                    ),
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Erro ao excluir evento'),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              }
            },
            child: const Text('Excluir', style: TextStyle(color: Colors.red)),
          ),
        ],
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
