import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_defaults.dart';
import '../../core/routes/app_routes.dart';
import '../../core/services/geocoding_service.dart';
import '../../core/services/location_auth_service.dart';
import '../../core/state/auth_state.dart';

class LocationConfirmationPage extends StatefulWidget {
  const LocationConfirmationPage({super.key});

  @override
  State<LocationConfirmationPage> createState() => _LocationConfirmationPageState();
}

class _LocationConfirmationPageState extends State<LocationConfirmationPage> {
  final _addressController = TextEditingController();
  final _geocoding = GeocodingService();

  bool _isLoadingGps = false;
  bool _isReverseGeocoding = false;
  bool _isConfirming = false;
  String? _errorMessage;
  String? _unavailableMessage;

  ResolveLocationResult? _resolved;
  double? _latitude;
  double? _longitude;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _fetchLocation());
  }

  @override
  void dispose() {
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _fetchLocation() async {
    final authState = Provider.of<AuthState>(context, listen: false);

    setState(() {
      _isLoadingGps = true;
      _errorMessage = null;
      _unavailableMessage = null;
      _resolved = null;
    });

    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() {
          _errorMessage = 'Ative os serviços de localização do dispositivo.';
          _isLoadingGps = false;
        });
        return;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied) {
        setState(() {
          _errorMessage = 'Permissão de localização negada.';
          _isLoadingGps = false;
        });
        return;
      }
      if (permission == LocationPermission.deniedForever) {
        setState(() {
          _errorMessage =
              'Permissão negada permanentemente. Ative nas configurações do aparelho.';
          _isLoadingGps = false;
        });
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );

      if (!mounted) return;

      _latitude = position.latitude;
      _longitude = position.longitude;

      final result = await authState.resolveLocation(
        position.latitude,
        position.longitude,
      );

      if (!mounted) return;

      if (result == null) {
        setState(() {
          _errorMessage = authState.errorMessage ??
              'Não identificamos sua cidade. Verifique se a localização está ativa.';
          _isLoadingGps = false;
        });
        return;
      }

      setState(() {
        _resolved = result;
        _isLoadingGps = false;
      });

      await _fillAddressFromGps();
    } on LocationAuthException catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoadingGps = false;
        if (e.isNotAvailable) {
          _unavailableMessage = e.message;
        } else {
          _errorMessage = e.message;
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoadingGps = false;
        _errorMessage = 'Erro ao obter localização: $e';
      });
    }
  }

  Future<void> _fillAddressFromGps() async {
    if (_latitude == null || _longitude == null) return;

    setState(() => _isReverseGeocoding = true);
    final address = await _geocoding.reverseGeocode(_latitude!, _longitude!);
    if (!mounted) return;
    setState(() {
      if (address != null) {
        _addressController.text = address;
      }
      _isReverseGeocoding = false;
    });
  }

  Future<void> _confirm() async {
    final resolved = _resolved;
    if (resolved == null || _latitude == null || _longitude == null) return;

    final address = _addressController.text.trim();
    if (address.isEmpty) {
      setState(() => _errorMessage = 'Informe ou confirme seu endereço.');
      return;
    }

    setState(() {
      _isConfirming = true;
      _errorMessage = null;
    });

    final authState = Provider.of<AuthState>(context, listen: false);
    final ok = await authState.confirmLocation(
      cdMun: resolved.cdMun,
      address: address,
      latitude: _latitude!,
      longitude: _longitude!,
    );

    if (!mounted) return;

    setState(() => _isConfirming = false);

    if (ok) {
      Navigator.pushNamedAndRemoveUntil(
        context,
        AppRoutes.entryPoint,
        (route) => false,
      );
    } else {
      setState(() {
        _errorMessage = authState.errorMessage ?? 'Erro ao confirmar localização.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final municipio = _resolved?.municipio;
    final loading = _isLoadingGps || _isReverseGeocoding;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Confirmar localização'),
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppDefaults.padding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_unavailableMessage != null) ...[
                Icon(Icons.location_off_outlined, size: 64, color: Colors.grey[400]),
                const SizedBox(height: 16),
                Text(
                  'LifeCity não disponível na sua região',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.poppins(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _unavailableMessage!,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.poppins(color: AppColors.placeholder),
                ),
                const SizedBox(height: 24),
                OutlinedButton(
                  onPressed: _isLoadingGps ? null : _fetchLocation,
                  child: const Text('Tentar novamente'),
                ),
              ] else if (loading && municipio == null) ...[
                const SizedBox(height: 48),
                const Center(child: CircularProgressIndicator(color: AppColors.primary)),
                const SizedBox(height: 16),
                Text(
                  'Obtendo sua localização...',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.poppins(color: AppColors.placeholder),
                ),
              ] else if (municipio != null) ...[
                Text(
                  'Identificamos que você está em',
                  style: GoogleFonts.poppins(
                    fontSize: 15,
                    color: AppColors.placeholder,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  municipio,
                  style: GoogleFonts.poppins(
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
                if (_resolved?.siglaUf.isNotEmpty == true)
                  Text(
                    _resolved!.siglaUf,
                    style: GoogleFonts.poppins(color: AppColors.placeholder),
                  ),
                const SizedBox(height: 8),
                Text(
                  'Confirme sua localização para continuar',
                  style: GoogleFonts.poppins(fontSize: 14),
                ),
                const SizedBox(height: 24),
                TextFormField(
                  controller: _addressController,
                  maxLines: 3,
                  decoration: InputDecoration(
                    labelText: 'Endereço',
                    hintText: 'Rua, número, bairro...',
                    suffixIcon: _isReverseGeocoding
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          )
                        : null,
                  ),
                ),
                const SizedBox(height: 12),
                TextButton.icon(
                  onPressed: loading ? null : _fetchLocation,
                  icon: const Icon(Icons.my_location),
                  label: const Text('Atualizar localização'),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  height: 56,
                  child: ElevatedButton(
                    onPressed: _isConfirming ? null : _confirm,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: _isConfirming
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            'Confirmar localização',
                            style: GoogleFonts.poppins(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                  ),
                ),
              ] else if (_errorMessage != null) ...[
                Text(
                  _errorMessage!,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.poppins(color: Colors.red),
                ),
                const SizedBox(height: 16),
                OutlinedButton(
                  onPressed: _isLoadingGps ? null : _fetchLocation,
                  child: const Text('Tentar novamente'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
