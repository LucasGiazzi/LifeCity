import 'dart:async';
import 'package:animations/animations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_defaults.dart';
import '../../core/models/complaint_model.dart';
import '../../core/routes/app_routes.dart';
import '../../core/services/complaint_service.dart';
import '../../core/state/filter_controller.dart';
import '../../core/state/filter_scope.dart';
import '../complaints/complaint_sheet.dart';
import '../menu/menu_page.dart';
import '../profile/profile_page.dart';
import 'components/app_navigation_bar.dart';

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

  List<Widget> get pages => [
    _MapBody(key: _mapBodyKey),
    const MenuPage(),
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
                fillColor: Theme.of(context).scaffoldBackgroundColor,
                child: child,
              ),
              child: pages[currentIndex],
            ),
            if (currentIndex == 0)
              Positioned(
                top: MediaQuery.of(context).padding.top + 12,
                left: 16,
                right: 16,
                child: const _FilterBar(),
              ),
          ],
        ),
        floatingActionButton: currentIndex == 0
            ? _GradientFab(
                onPressed: () async {
                  final result = await Navigator.pushNamed(
                      context, AppRoutes.createComplaint);
                  if (result == true) {
                    _mapBodyKey.currentState?.reload();
                  }
                },
              )
            : null,
        floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
        bottomNavigationBar: AppBottomNavigationBar(
          currentIndex: currentIndex,
          onNavTap: (i) => setState(() => currentIndex = i),
        ),
      ),
    );
  }
}

/* ====================== FAB COM GRADIENTE ====================== */

class _GradientFab extends StatelessWidget {
  final VoidCallback onPressed;
  const _GradientFab({required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          colors: [Color(0xFF00C896), Color(0xFF009E76)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.45),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onPressed,
          child: const Icon(Icons.add_rounded, color: Colors.white, size: 30),
        ),
      ),
    );
  }
}

/* ====================== BARRA DE FILTROS ====================== */

class _FilterBar extends StatelessWidget {
  const _FilterBar();

  static const List<Map<String, dynamic>> _categories = [
    {'key': 'infraestrutura', 'label': 'Infra', 'icon': Icons.construction, 'color': Colors.orange},
    {'key': 'seguranca', 'label': 'Segurança', 'icon': Icons.security, 'color': Colors.red},
    {'key': 'limpeza', 'label': 'Limpeza', 'icon': Icons.cleaning_services, 'color': Colors.teal},
    {'key': 'transito', 'label': 'Trânsito', 'icon': Icons.traffic, 'color': Colors.amber},
    {'key': 'outros', 'label': 'Outros', 'icon': Icons.report_problem, 'color': Colors.grey},
  ];

  @override
  Widget build(BuildContext context) {
    final filters = FilterScope.of(context);
    return ListenableBuilder(
      listenable: filters,
      builder: (context, _) {
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          clipBehavior: Clip.none,
          child: Row(
            children: [
              for (final cat in _categories)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: _FilterChip(
                    label: cat['label'] as String,
                    icon: cat['icon'] as IconData,
                    color: cat['color'] as Color,
                    isSelected: filters.isSelected(cat['key'] as String),
                    onTap: () => filters.toggle(cat['key'] as String),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final bool isSelected;
  final VoidCallback onTap;

  const _FilterChip({
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
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeInOut,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? color : Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.12),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
          border: isSelected
              ? null
              : Border.all(color: Colors.grey.shade200),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15,
                color: isSelected ? Colors.white : color),
            const SizedBox(width: 5),
            Text(
              label,
              style: GoogleFonts.poppins(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                color: isSelected ? Colors.white : Colors.grey[800],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/* ====================== MAPA ====================== */

enum _MapLayerKind { streets, satellite, terrain, dark }

extension on _MapLayerKind {
  String get label => switch (this) {
        _MapLayerKind.streets => 'Ruas',
        _MapLayerKind.satellite => 'Satélite',
        _MapLayerKind.terrain => 'Relevo',
        _MapLayerKind.dark => 'Escuro',
      };

  IconData get pickerIcon => switch (this) {
        _MapLayerKind.streets => Icons.map_rounded,
        _MapLayerKind.satellite => Icons.satellite_alt_rounded,
        _MapLayerKind.terrain => Icons.terrain_rounded,
        _MapLayerKind.dark => Icons.dark_mode_rounded,
      };
}

({String url, List<String> subdomains, int maxNative}) _tileSpec(_MapLayerKind k) {
  return switch (k) {
    _MapLayerKind.streets => (
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        subdomains: const ['a', 'b', 'c', 'd'],
        maxNative: 19,
      ),
    _MapLayerKind.satellite => (
        url:
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        subdomains: const <String>[],
        maxNative: 19,
      ),
    _MapLayerKind.terrain => (
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        subdomains: const ['a', 'b', 'c'],
        maxNative: 17,
      ),
    _MapLayerKind.dark => (
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        subdomains: const ['a', 'b', 'c', 'd'],
        maxNative: 19,
      ),
  };
}

class _MapBody extends StatefulWidget {
  const _MapBody({super.key});

  @override
  State<_MapBody> createState() => _MapBodyState();
}

class _MapBodyState extends State<_MapBody> {
  final _mapController = MapController();
  final _complaintService = ComplaintService();

  LatLng _center = const LatLng(-22.9099, -47.0626);
  LatLng? _userLocation;
  double? _accuracyMeters;
  StreamSubscription<Position>? _positionStream;

  List<ComplaintModel> _complaints = [];
  bool _isLoading = true;
  _MapLayerKind _mapLayer = _MapLayerKind.streets;

  @override
  void initState() {
    super.initState();
    _loadComplaints();
    _startLocationTracking();
  }

  @override
  void dispose() {
    _positionStream?.cancel();
    super.dispose();
  }

  Future<void> _startLocationTracking() async {
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return;
    }
    if (permission == LocationPermission.deniedForever) return;

    const settings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 5,
    );

    try {
      final pos = await Geolocator.getCurrentPosition(
          locationSettings: settings);
      if (mounted) {
        final loc = LatLng(pos.latitude, pos.longitude);
        setState(() {
          _userLocation = loc;
          _accuracyMeters = pos.accuracy;
          _center = loc;
        });
        _mapController.move(loc, 15);
      }
    } catch (_) {}

    _positionStream = Geolocator.getPositionStream(locationSettings: settings)
        .listen((pos) {
      if (mounted) {
        setState(() {
          _userLocation = LatLng(pos.latitude, pos.longitude);
          _accuracyMeters = pos.accuracy;
        });
      }
    });
  }

  Future<void> _loadComplaints() async {
    if (!mounted) return;
    setState(() => _isLoading = true);
    try {
      final data = await _complaintService.getAllComplaints();
      if (mounted) {
        setState(() {
          _complaints = data
              .map((c) => ComplaintModel.fromJson(c))
              .where((c) => c.latitude != null && c.longitude != null)
              .toList();
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Erro ao carregar reclamações: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void reload() => _loadComplaints();

  void _zoomBy(double delta) {
    final cam = _mapController.camera;
    final next = (cam.zoom + delta).clamp(2.0, 22.0);
    _mapController.move(cam.center, next);
  }

  void _openMapLayerSheet() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
              child: Text(
                'Camada do mapa',
                style: GoogleFonts.poppins(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            for (final kind in _MapLayerKind.values)
              ListTile(
                leading: Icon(kind.pickerIcon, color: AppColors.primary),
                title: Text(kind.label, style: GoogleFonts.poppins(fontSize: 15)),
                trailing: kind == _mapLayer
                    ? const Icon(Icons.check_rounded, color: AppColors.primary)
                    : null,
                onTap: () {
                  setState(() => _mapLayer = kind);
                  Navigator.pop(ctx);
                },
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filterController = FilterScope.of(context);

    return ListenableBuilder(
      listenable: filterController,
      builder: (context, _) {
        final filters = filterController.selected;
        final visible = filters.isEmpty
            ? _complaints
            : _complaints.where((c) {
                if (c.type == null) return false;
                return filters.contains(c.type!.toLowerCase());
              }).toList();

        final markers = visible.map((c) => Marker(
              point: LatLng(c.latitude!, c.longitude!),
              width: 44,
              height: 44,
              child: GestureDetector(
                onTap: () => _openSheet(c),
                child: _ComplaintPin(type: c.type),
              ),
            )).toList();

        final tileSpec = _tileSpec(_mapLayer);

        return Scaffold(
          body: Stack(
            children: [
              FlutterMap(
                mapController: _mapController,
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
                    key: ValueKey(_mapLayer),
                    urlTemplate: tileSpec.url,
                    subdomains: tileSpec.subdomains,
                    userAgentPackageName: 'com.lifecity.app',
                    maxNativeZoom: tileSpec.maxNative,
                  ),
                  // Círculo de precisão da localização
                  if (_userLocation != null && _accuracyMeters != null)
                    CircleLayer(circles: [
                      CircleMarker(
                        point: _userLocation!,
                        radius: _accuracyMeters!,
                        useRadiusInMeter: true,
                        color: const Color(0x222196F3),
                        borderColor: const Color(0x552196F3),
                        borderStrokeWidth: 1,
                      ),
                    ]),
                  if (!_isLoading && markers.isNotEmpty)
                    MarkerLayer(markers: markers),
                  // Ponto do usuário — sempre por cima dos pins
                  if (_userLocation != null)
                    MarkerLayer(markers: [
                      Marker(
                        point: _userLocation!,
                        width: 22,
                        height: 22,
                        child: const _UserDot(),
                      ),
                    ]),
                ],
              ),
              if (_isLoading)
                const Positioned.fill(
                  child: IgnorePointer(
                    child: Center(child: CircularProgressIndicator()),
                  ),
                ),
              // Camada, localização, zoom +/-
              Positioned(
                bottom: 30,
                right: 16,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _RoundMapControlButton(
                      tooltip: 'Camada do mapa',
                      onTap: _openMapLayerSheet,
                      child: Icon(
                        Icons.layers_rounded,
                        size: 22,
                        color: Theme.of(context).iconTheme.color,
                      ),
                    ),
                    const SizedBox(height: 10),
                    _LocationButton(
                      onTap: () {
                        final target = _userLocation ?? _center;
                        _mapController.move(target, 16);
                      },
                    ),
                    const SizedBox(height: 10),
                    _RoundMapControlButton(
                      tooltip: 'Aproximar',
                      onTap: () => _zoomBy(1),
                      child: Icon(
                        Icons.add_rounded,
                        size: 26,
                        color: Theme.of(context).iconTheme.color,
                      ),
                    ),
                    const SizedBox(height: 10),
                    _RoundMapControlButton(
                      tooltip: 'Afastar',
                      onTap: () => _zoomBy(-1),
                      child: Icon(
                        Icons.remove_rounded,
                        size: 26,
                        color: Theme.of(context).iconTheme.color,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _openSheet(ComplaintModel c) {
    showComplaintSheet(
      context,
      c,
      onDeleted: reload,
      onEdited: reload,
    );
  }
}

/* ====================== WIDGETS DO MAPA ====================== */

class _UserDot extends StatelessWidget {
  const _UserDot();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF2196F3),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF2196F3).withValues(alpha: 0.4),
            blurRadius: 10,
            spreadRadius: 2,
          ),
        ],
      ),
    );
  }
}

class _RoundMapControlButton extends StatelessWidget {
  final VoidCallback onTap;
  final Widget child;
  final String? tooltip;

  const _RoundMapControlButton({
    required this.onTap,
    required this.child,
    this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    final button = Material(
      color: Theme.of(context).cardColor,
      shape: const CircleBorder(),
      elevation: 4,
      shadowColor: Colors.black26,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(width: 44, height: 44, child: Center(child: child)),
      ),
    );
    if (tooltip == null || tooltip!.isEmpty) return button;
    return Tooltip(message: tooltip!, child: button);
  }
}

class _LocationButton extends StatelessWidget {
  final VoidCallback onTap;
  const _LocationButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'Minha localização',
      child: Material(
        color: Theme.of(context).cardColor,
        shape: const CircleBorder(),
        elevation: 4,
        shadowColor: Colors.black26,
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: const SizedBox(
            width: 44,
            height: 44,
            child: Icon(Icons.my_location_rounded, size: 22),
          ),
        ),
      ),
    );
  }
}

class _ComplaintPin extends StatelessWidget {
  final String? type;
  const _ComplaintPin({this.type});

  static const _cats = [
    {'key': 'infraestrutura', 'icon': Icons.construction, 'color': Colors.orange},
    {'key': 'seguranca', 'icon': Icons.security, 'color': Colors.red},
    {'key': 'limpeza', 'icon': Icons.cleaning_services, 'color': Colors.teal},
    {'key': 'transito', 'icon': Icons.traffic, 'color': Colors.amber},
    {'key': 'outros', 'icon': Icons.report_problem, 'color': Colors.grey},
  ];

  @override
  Widget build(BuildContext context) {
    final cat = type == null
        ? {'icon': Icons.warning, 'color': Colors.red}
        : _cats.firstWhere(
            (c) => c['key'] == type!.toLowerCase(),
            orElse: () => {'icon': Icons.warning, 'color': Colors.red},
          );

    final color = cat['color'] as Color;
    final icon = cat['icon'] as IconData;

    return Container(
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.45),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Center(child: Icon(icon, color: Colors.white, size: 20)),
    );
  }
}

