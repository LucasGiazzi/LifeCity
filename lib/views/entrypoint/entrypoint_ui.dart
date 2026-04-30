import 'dart:async';
import 'package:animations/animations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_defaults.dart';
import '../../core/models/complaint_model.dart';
import '../../core/routes/app_routes.dart';
import '../../core/services/complaint_service.dart';
import '../../core/state/filter_controller.dart';
import '../../core/state/filter_scope.dart';
import 'package:provider/provider.dart';
import '../../core/state/auth_state.dart';
import 'package:cached_network_image/cached_network_image.dart';

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

  void onBottomNavigationTap(int index) {
    setState(() => currentIndex = index);
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
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(height: MediaQuery.of(context).padding.top + 10),
                  const _FilterButtons(),
                ],
              ),
          ],
        ),
        floatingActionButton: Container(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const LinearGradient(
              colors: [Color(0xFF00C896), Color(0xFF009E76)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.4),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: FloatingActionButton(
            onPressed: () async {
              final result = await Navigator.pushNamed(context, AppRoutes.createComplaint);
              if (result == true && currentIndex == 0) {
                _mapBodyKey.currentState?.reload();
              }
            },
            backgroundColor: Colors.transparent,
            elevation: 0,
            child: const Icon(Icons.add_rounded, color: Colors.white, size: 30),
          ),
        ),
        floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
        bottomNavigationBar: AppBottomNavigationBar(
          currentIndex: currentIndex,
          onNavTap: onBottomNavigationTap,
        ),
      ),
    );
  }
}

/* ====================== FILTER BUTTONS ====================== */

class _FilterButtons extends StatelessWidget {
  const _FilterButtons();

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
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              for (final category in _categories)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: _FilterChip(
                    label: category['label'] as String,
                    icon: category['icon'] as IconData,
                    color: category['color'] as Color,
                    isSelected: filters.isSelected(category['key'] as String),
                    onTap: () => filters.toggle(category['key'] as String),
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
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeInOut,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? color : AppColors.dark.withValues(alpha: 0.80),
          borderRadius: BorderRadius.circular(20),
          border: isSelected
              ? Border.all(color: Colors.white.withValues(alpha: 0.3), width: 1)
              : null,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.15),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: isSelected ? Colors.white : Colors.white70, size: 16),
            const SizedBox(width: 6),
            Text(
              label,
              style: GoogleFonts.poppins(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                color: isSelected ? Colors.white : Colors.white70,
              ),
            ),
          ],
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
  LatLng _center = const LatLng(-22.9099, -47.0626);
  LatLng? _userLocation;
  StreamSubscription<Position>? _positionStream;

  final ComplaintService _complaintService = ComplaintService();
  List<ComplaintModel> _complaints = [];
  bool _isLoading = true;

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

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      if (mounted) {
        final loc = LatLng(position.latitude, position.longitude);
        setState(() {
          _userLocation = loc;
          _center = loc;
        });
        mapController.move(loc, 15);
      }
    } catch (_) {}

    _positionStream = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10,
      ),
    ).listen((position) {
      if (mounted) {
        setState(() => _userLocation = LatLng(position.latitude, position.longitude));
      }
    });
  }

  Future<void> _loadComplaints() async {
    if (!mounted) return;
    setState(() => _isLoading = true);
    try {
      final data = await _complaintService.getAllComplaints();
      final complaints = data
          .map((c) => ComplaintModel.fromJson(c))
          .where((c) => c.latitude != null && c.longitude != null)
          .toList();
      if (mounted) setState(() { _complaints = complaints; _isLoading = false; });
    } catch (e) {
      debugPrint('Erro ao carregar reclamações: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void reload() => _loadComplaints();

  @override
  Widget build(BuildContext context) {
    final filterController = FilterScope.of(context);
    final filters = filterController.selected;

    return ListenableBuilder(
      listenable: filterController,
      builder: (context, _) {
        List<Marker> markers = [];
        if (!_isLoading) {
          final visible = filters.isEmpty
              ? _complaints
              : _complaints.where((c) {
                  if (c.type == null) return false;
                  return filters.contains(c.type!.toLowerCase());
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

        return Scaffold(
          body: Stack(
            children: [
              FlutterMap(
                mapController: mapController,
                options: MapOptions(
                  initialCenter: _center,
                  initialZoom: 14,
                  interactionOptions: const InteractionOptions(
                    flags: InteractiveFlag.drag | InteractiveFlag.pinchZoom | InteractiveFlag.scrollWheelZoom,
                  ),
                ),
                children: [
                  TileLayer(
                    urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
                    subdomains: const ['a', 'b', 'c', 'd'],
                    userAgentPackageName: 'com.lifecity.app',
                    maxZoom: 19,
                  ),
                  // Círculo de precisão
                  if (_userLocation != null)
                    CircleLayer(circles: [
                      CircleMarker(
                        point: _userLocation!,
                        radius: 40,
                        useRadiusInMeter: true,
                        color: const Color(0x222196F3),
                        borderColor: const Color(0x552196F3),
                        borderStrokeWidth: 1,
                      ),
                    ]),
                  if (!_isLoading && markers.isNotEmpty) MarkerLayer(markers: markers),
                  // Ponto do usuário sempre por cima das reclamações
                  if (_userLocation != null)
                    MarkerLayer(markers: [
                      Marker(
                        point: _userLocation!,
                        width: 22,
                        height: 22,
                        child: const _UserLocationDot(),
                      ),
                    ]),
                  if (_isLoading) const Center(child: CircularProgressIndicator()),
                ],
              ),
              Positioned(
                bottom: 16,
                right: 16,
                child: FloatingActionButton.small(
                  heroTag: 'my_location',
                  onPressed: () {
                    final target = _userLocation ?? _center;
                    mapController.move(target, 16);
                  },
                  backgroundColor: Theme.of(context).cardColor,
                  child: Icon(Icons.my_location, color: Theme.of(context).textTheme.bodyLarge?.color),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _openComplaintSheet(ComplaintModel c) {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _ComplaintDetailSheet(complaint: c),
    );
  }
}

/* ====================== PINS ====================== */

class _ComplaintPin extends StatelessWidget {
  final String? type;
  const _ComplaintPin({this.type});

  static const List<Map<String, dynamic>> _categories = [
    {'key': 'infraestrutura', 'icon': Icons.construction, 'color': Colors.orange},
    {'key': 'seguranca', 'icon': Icons.security, 'color': Colors.red},
    {'key': 'limpeza', 'icon': Icons.cleaning_services, 'color': Colors.teal},
    {'key': 'transito', 'icon': Icons.traffic, 'color': Colors.amber},
    {'key': 'outros', 'icon': Icons.report_problem, 'color': Colors.grey},
  ];

  @override
  Widget build(BuildContext context) {
    final category = type == null
        ? {'icon': Icons.warning, 'color': Colors.red.shade700}
        : _categories.firstWhere((c) => c['key'] == type!.toLowerCase(), orElse: () => {'icon': Icons.warning, 'color': Colors.red.shade700});

    return Container(
      decoration: BoxDecoration(
        color: category['color'] as Color,
        shape: BoxShape.circle,
        boxShadow: const [BoxShadow(blurRadius: 6, color: Colors.black26)],
      ),
      child: Center(child: Icon(category['icon'] as IconData, color: Colors.white, size: 20)),
    );
  }
}

class _UserLocationDot extends StatelessWidget {
  const _UserLocationDot();

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
            blurRadius: 8,
            spreadRadius: 2,
          ),
        ],
      ),
    );
  }
}

class _ComplaintTypePill extends StatelessWidget {
  final String type;
  const _ComplaintTypePill({required this.type});

  @override
  Widget build(BuildContext context) {
    final icon = switch (type.toLowerCase()) {
      'infraestrutura' => Icons.construction,
      'seguranca' => Icons.security,
      'limpeza' => Icons.cleaning_services,
      'transito' => Icons.traffic,
      _ => Icons.warning,
    };
    final label = switch (type.toLowerCase()) {
      'infraestrutura' => 'Infraestrutura',
      'seguranca' => 'Segurança',
      'limpeza' => 'Limpeza',
      'transito' => 'Trânsito',
      _ => 'Outros',
    };
    return Chip(visualDensity: VisualDensity.compact, avatar: Icon(icon, size: 16), label: Text(label));
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
    setState(() => _isLoadingPhotos = true);
    try {
      final photos = await _complaintService.getPhotos(widget.complaint.id);
      if (mounted) setState(() { _photos = photos; _isLoadingPhotos = false; });
    } catch (_) {
      if (mounted) setState(() => _isLoadingPhotos = false);
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
          Text(widget.complaint.description, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          if (widget.complaint.type != null) ...[
            _ComplaintTypePill(type: widget.complaint.type!),
            const SizedBox(height: 8),
          ],
          if (widget.complaint.address != null) ...[
            Row(children: [
              const Icon(Icons.location_on, size: 16),
              const SizedBox(width: 4),
              Expanded(child: Text(widget.complaint.address!, style: const TextStyle(fontSize: 14))),
            ]),
            const SizedBox(height: 8),
          ],
          Row(children: [
            const Icon(Icons.calendar_today, size: 16),
            const SizedBox(width: 4),
            Text(_formatDate(widget.complaint.occurrenceDate), style: const TextStyle(fontSize: 14)),
          ]),
          if (widget.complaint.createdByName != null) ...[
            const SizedBox(height: 8),
            Row(children: [
              const Icon(Icons.person, size: 16),
              const SizedBox(width: 4),
              Text('Criado por: ${widget.complaint.createdByName}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
            ]),
          ],
          if (_isLoadingPhotos)
            const Padding(padding: EdgeInsets.symmetric(vertical: 16), child: Center(child: CircularProgressIndicator()))
          else if (_photos.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text('Fotos', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            SizedBox(
              height: 120,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: _photos.length,
                itemBuilder: (context, index) {
                  final url = _photos[index]['url'] as String?;
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
                        placeholder: (_, __) => Container(width: 120, height: 120, color: Colors.grey[300], child: const Center(child: CircularProgressIndicator())),
                        errorWidget: (_, __, ___) => Container(width: 120, height: 120, color: Colors.grey[300], child: const Icon(Icons.error)),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
          if (isOwner) ...[
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _showDeleteConfirmation(context),
                icon: const Icon(Icons.delete),
                label: const Text('Excluir Reclamação'),
                style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
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
      builder: (ctx) => AlertDialog(
        title: const Text('Confirmar Exclusão'),
        content: const Text('Tem certeza que deseja excluir esta reclamação? Esta ação não pode ser desfeita.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final success = await _complaintService.deleteComplaint(widget.complaint.id);
              if (mounted) {
                if (success) {
                  Navigator.pop(context);
                  if (context.mounted) context.findAncestorStateOfType<_MapBodyState>()?.reload();
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Reclamação excluída com sucesso'), backgroundColor: Colors.green));
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Erro ao excluir reclamação'), backgroundColor: Colors.red));
                }
              }
            },
            child: const Text('Excluir', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) =>
      '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
}
