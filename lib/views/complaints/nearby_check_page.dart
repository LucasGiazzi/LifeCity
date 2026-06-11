import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:material_symbols_icons/symbols.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_symbols.dart';
import '../../core/constants/municipal_complaint_status.dart';
import '../../core/models/complaint_model.dart';
import '../../core/routes/app_routes.dart';
import '../../core/services/complaint_service.dart';
import 'complaint_sheet.dart';

class NearbyCheckPage extends StatefulWidget {
  const NearbyCheckPage({super.key});

  @override
  State<NearbyCheckPage> createState() => _NearbyCheckPageState();
}

class _NearbyCheckPageState extends State<NearbyCheckPage> {
  final _service = ComplaintService();
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _items = [];
  double? _lat;
  double? _lng;
  bool _usedFallback = false;

  static const _fallbackLat = -22.9099;
  static const _fallbackLng = -47.0626;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      Position? position;
      if (permission == LocationPermission.always ||
          permission == LocationPermission.whileInUse) {
        position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 12),
          ),
        );
      }

      _lat = position?.latitude ?? _fallbackLat;
      _lng = position?.longitude ?? _fallbackLng;
      _usedFallback = position == null;

      final items = await _service.getNearby(lat: _lat!, lng: _lng!);
      if (mounted) {
        setState(() {
          _items = items;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Não foi possível verificar ocorrências próximas.';
          _loading = false;
        });
      }
    }
  }

  void _openCreate() async {
    final created = await Navigator.pushNamed(
      context,
      AppRoutes.createComplaint,
      arguments: {'latitude': _lat, 'longitude': _lng},
    );
    if (created == true && mounted) {
      Navigator.pop(context, true);
    }
  }

  void _openComplaint(Map<String, dynamic> item) {
    final complaint = ComplaintModel.fromJson({
      'id': item['id'],
      'description': item['description'],
      'type': item['type'],
      'status': item['status'],
      'likes_count': item['likes_count'] ?? 0,
      'comments_count': 0,
      'witness_count': item['witness_count'] ?? 0,
      'latitude': _lat,
      'longitude': _lng,
      'created_at': item['created_at'],
    });
    showComplaintSheet(context, complaint);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Verificar duplicatas',
          style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_usedFallback)
                  Container(
                    color: Colors.amber.shade50,
                    padding: const EdgeInsets.all(12),
                    child: Text(
                      'Usando localização aproximada. Ative o GPS para resultados mais precisos.',
                      style: GoogleFonts.poppins(fontSize: 12),
                    ),
                  ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(_error!, style: GoogleFonts.poppins(color: Colors.red)),
                  ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Text(
                    'Sua ocorrência já existe aqui?',
                    style: GoogleFonts.poppins(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Expanded(
                  child: _items.isEmpty
                      ? Center(
                          child: Text(
                            'Nenhuma ocorrência próxima encontrada.',
                            style: GoogleFonts.poppins(color: AppColors.placeholder),
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _items.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (_, i) => _NearbyCard(
                            item: _items[i],
                            onTap: () => _openComplaint(_items[i]),
                          ),
                        ),
                ),
              ],
            ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton(
            onPressed: _openCreate,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.primary,
              minimumSize: const Size.fromHeight(48),
            ),
            child: Text(
              'Não é nenhuma dessas',
              style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
            ),
          ),
        ),
      ),
    );
  }
}

class _NearbyCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final VoidCallback onTap;

  const _NearbyCard({required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final status = item['status'] as String? ?? 'pending';
    final entry = MunicipalComplaintStatus.entryFor(status);
    final distance = item['distance_m'] as int? ?? 0;
    final photoUrl = item['preview_photo_url'] as String?;

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      elevation: 1,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: SizedBox(
                  width: 72,
                  height: 72,
                  child: photoUrl != null
                      ? Image.network(photoUrl, fit: BoxFit.cover)
                      : ColoredBox(
                          color: Colors.grey.shade200,
                          child: const Icon(Symbols.image, color: Colors.grey),
                        ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item['description'] as String? ?? '',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(entry.$1, size: 14, color: entry.$2),
                        const SizedBox(width: 4),
                        Text(entry.$3, style: GoogleFonts.poppins(fontSize: 12, color: entry.$2)),
                        const Spacer(),
                        Text(
                          '${distance}m',
                          style: GoogleFonts.poppins(fontSize: 12, color: AppColors.placeholder),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
