import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:http/http.dart' as http;
import 'package:geolocator/geolocator.dart';
import '../../core/components/app_back_button.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_defaults.dart';
import '../../core/services/complaint_service.dart';

class CreateComplaintPage extends StatefulWidget {
  const CreateComplaintPage({super.key});

  @override
  State<CreateComplaintPage> createState() => _CreateComplaintPageState();
}

class _CreateComplaintPageState extends State<CreateComplaintPage> {
  final _formKey = GlobalKey<FormState>();
  final _descriptionController = TextEditingController();
  final _addressController = TextEditingController();
  final _dateController = TextEditingController();
  
  final ComplaintService _complaintService = ComplaintService();
  bool _isLoading = false;
  bool _isGeocoding = false;
  bool _isGettingLocation = false;
  bool _isReverseGeocoding = false;
  String? _selectedType;
  double? _latitude;
  double? _longitude;
  
  // Autocomplete
  final FocusNode _addressFocusNode = FocusNode();
  final LayerLink _layerLink = LayerLink();
  List<Map<String, dynamic>> _addressSuggestions = [];
  OverlayEntry? _overlayEntry;
  Timer? _debounceTimer;
  
  final List<Map<String, dynamic>> _complaintTypes = [
    {'value': 'infraestrutura', 'label': 'Infraestrutura', 'icon': Icons.construction},
    {'value': 'seguranca', 'label': 'Segurança', 'icon': Icons.security},
    {'value': 'limpeza', 'label': 'Limpeza', 'icon': Icons.cleaning_services},
    {'value': 'transito', 'label': 'Trânsito', 'icon': Icons.traffic},
    {'value': 'outros', 'label': 'Outros', 'icon': Icons.report_problem},
  ];

  @override
  void initState() {
    super.initState();
    _addressController.addListener(_onAddressChanged);
    _addressFocusNode.addListener(_onAddressFocusChanged);
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _addressController.dispose();
    _dateController.dispose();
    _addressFocusNode.dispose();
    _debounceTimer?.cancel();
    _removeOverlay();
    super.dispose();
  }

  void _onAddressChanged() {
    _debounceTimer?.cancel();
    final query = _addressController.text.trim();
    if (query.length >= 3 && _addressFocusNode.hasFocus) {
      // Debounce de 500ms para evitar muitas requisições
      _debounceTimer = Timer(const Duration(milliseconds: 500), () {
        _searchAddresses(query);
      });
    } else {
      _hideSuggestions();
    }
  }

  void _onAddressFocusChanged() {
    if (!_addressFocusNode.hasFocus) {
      // Delay para permitir clique na sugestão
      Future.delayed(const Duration(milliseconds: 200), () {
        _hideSuggestions();
      });
    }
  }

  Future<void> _selectDate() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() {
        _dateController.text = "${picked.day}/${picked.month}/${picked.year}";
      });
    }
  }

  DateTime _parseDate(String dateStr) {
    final dateParts = dateStr.split('/');
    final day = int.parse(dateParts[0]);
    final month = int.parse(dateParts[1]);
    final year = int.parse(dateParts[2]);
    return DateTime(year, month, day);
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

      setState(() {
        _latitude = position.latitude;
        _longitude = position.longitude;
        _isGettingLocation = false;
      });

      // Fazer reverse geocoding para obter o endereço
      await _reverseGeocode(position.latitude, position.longitude);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Localização obtida com sucesso!'),
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

  Future<void> _reverseGeocode(double lat, double lon) async {
    setState(() {
      _isReverseGeocoding = true;
    });

    try {
      // Reverse geocoding usando Nominatim (gratuito)
      final url = 'https://nominatim.openstreetmap.org/reverse?lat=$lat&lon=$lon&format=json&addressdetails=1';
      
      final response = await http.get(
        Uri.parse(url),
        headers: {'User-Agent': 'LifeCityApp/1.0'},
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['display_name'] != null) {
          final address = data['display_name'] as String;
          setState(() {
            _addressController.text = address;
            _isReverseGeocoding = false;
          });
          return;
        }
      }
      
      setState(() {
        _isReverseGeocoding = false;
      });
    } catch (e) {
      setState(() {
        _isReverseGeocoding = false;
      });
      debugPrint('Erro ao fazer reverse geocoding: $e');
      // Não é crítico, apenas não preenche o endereço
    }
  }

  Future<void> _searchAddresses(String query) async {
    if (query.length < 3) {
      _hideSuggestions();
      return;
    }

    try {
      // Buscar endereços usando Nominatim Search API (gratuito)
      final encodedQuery = Uri.encodeComponent(query + ', Campinas, SP, Brasil');
      final url = 'https://nominatim.openstreetmap.org/search?q=$encodedQuery&format=json&limit=5&addressdetails=1';
      
      final response = await http.get(
        Uri.parse(url),
        headers: {'User-Agent': 'LifeCityApp/1.0'},
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        setState(() {
          _addressSuggestions = data.map((item) => {
            'display_name': item['display_name'] as String? ?? '',
            'lat': item['lat'] as String? ?? '',
            'lon': item['lon'] as String? ?? '',
          }).toList();
        });
        _showAddressSuggestions();
      }
    } catch (e) {
      debugPrint('Erro ao buscar endereços: $e');
      _hideSuggestions();
    }
  }

  void _showAddressSuggestions() {
    _removeOverlay();
    
    if (_addressSuggestions.isEmpty || !_addressFocusNode.hasFocus) {
      return;
    }

    _overlayEntry = OverlayEntry(
      builder: (context) {
        final screenWidth = MediaQuery.of(context).size.width;
        return Positioned(
          width: screenWidth - 64, // Margem de 32 de cada lado
          child: CompositedTransformFollower(
            link: _layerLink,
            showWhenUnlinked: false,
            offset: const Offset(0, 48),
            child: Material(
              elevation: 4,
              borderRadius: BorderRadius.circular(8),
              child: Container(
                constraints: const BoxConstraints(maxHeight: 200),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: ListView.builder(
                  shrinkWrap: true,
                  padding: EdgeInsets.zero,
                  itemCount: _addressSuggestions.length,
                  itemBuilder: (context, index) {
                    final suggestion = _addressSuggestions[index];
                    return InkWell(
                      onTap: () {
                        _selectAddress(suggestion);
                      },
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                        child: Text(
                          suggestion['display_name'] as String,
                          style: const TextStyle(fontSize: 14),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        );
      },
    );

    Overlay.of(context).insert(_overlayEntry!);
  }

  void _selectAddress(Map<String, dynamic> suggestion) {
    final address = suggestion['display_name'] as String;
    final lat = double.tryParse(suggestion['lat'] as String? ?? '');
    final lon = double.tryParse(suggestion['lon'] as String? ?? '');
    
    setState(() {
      _addressController.text = address;
      if (lat != null && lon != null) {
        _latitude = lat;
        _longitude = lon;
      }
    });
    
    _addressFocusNode.unfocus();
    _hideSuggestions();
  }

  void _hideSuggestions() {
    _removeOverlay();
  }

  void _removeOverlay() {
    _overlayEntry?.remove();
    _overlayEntry = null;
  }

  Future<void> _geocodeAddress() async {
    if (_addressController.text.trim().isEmpty) {
      return;
    }

    setState(() {
      _isGeocoding = true;
    });

    try {
      // Usando Nominatim (OpenStreetMap) para geocoding gratuito
      final address = Uri.encodeComponent(_addressController.text.trim() + ', Campinas, SP, Brasil');
      final url = 'https://nominatim.openstreetmap.org/search?q=$address&format=json&limit=1';
      
      final response = await http.get(
        Uri.parse(url),
        headers: {'User-Agent': 'LifeCityApp/1.0'},
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        if (data.isNotEmpty) {
          final lat = double.tryParse(data[0]['lat'] ?? '');
          final lon = double.tryParse(data[0]['lon'] ?? '');
          if (lat != null && lon != null) {
            setState(() {
              _latitude = lat;
              _longitude = lon;
              _isGeocoding = false;
            });
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Localização encontrada!'),
                backgroundColor: Colors.green,
                duration: Duration(seconds: 2),
              ),
            );
            return;
          }
        }
      }
      
      setState(() {
        _isGeocoding = false;
      });
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não foi possível encontrar a localização. Você pode criar a reclamação sem coordenadas.'),
          backgroundColor: Colors.orange,
          duration: Duration(seconds: 3),
        ),
      );
    } catch (e) {
      setState(() {
        _isGeocoding = false;
      });
      debugPrint('Erro ao fazer geocoding: $e');
      // Não bloqueia o envio, apenas avisa
    }
  }

  Future<void> _onSubmit() async {
    if (_formKey.currentState?.validate() ?? false) {
      // Validação de data
      if (_dateController.text.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Por favor, selecione a data de ocorrência')),
        );
        return;
      }

      setState(() {
        _isLoading = true;
      });

      try {
        // Converter data para formato YYYY-MM-DD
        final date = _parseDate(_dateController.text);
        final occurrenceDate = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

        // Tentar geocoding se ainda não foi feito
        if (_latitude == null || _longitude == null) {
          await _geocodeAddress();
        }

        final result = await _complaintService.createComplaint(
          description: _descriptionController.text.trim(),
          occurrenceDate: occurrenceDate,
          address: _addressController.text.trim(),
          type: _selectedType,
          latitude: _latitude,
          longitude: _longitude,
        );

        setState(() {
          _isLoading = false;
        });

        if (result != null && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Reclamação criada com sucesso!'),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.of(context).pop(true); // Retorna true para indicar que reclamação foi criada
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Erro ao criar reclamação. Tente novamente.'),
                backgroundColor: Colors.red,
              ),
            );
          }
        }
      } catch (e) {
        setState(() {
          _isLoading = false;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Erro: ${e.toString()}'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.cardColor,
      appBar: AppBar(
        leading: const AppBackButton(),
        title: const Text('Criar Reclamação'),
      ),
      body: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Container(
            margin: const EdgeInsets.all(AppDefaults.padding),
            padding: const EdgeInsets.symmetric(
              horizontal: AppDefaults.padding,
              vertical: AppDefaults.padding * 2,
            ),
            decoration: BoxDecoration(
              color: AppColors.scaffoldBackground,
              borderRadius: AppDefaults.borderRadius,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                /* <---- Descrição -----> */
                const Text("Descrição"),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _descriptionController,
                  keyboardType: TextInputType.multiline,
                  maxLines: 4,
                  textInputAction: TextInputAction.newline,
                  decoration: const InputDecoration(
                    hintText: 'Descreva a reclamação...',
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Por favor, insira uma descrição';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: AppDefaults.padding),

                /* <---- Tipo (Opcional) -----> */
                const Text("Tipo (Opcional)"),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _complaintTypes.map((type) {
                    final isSelected = _selectedType == type['value'];
                    return ChoiceChip(
                      label: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(type['icon'] as IconData, size: 18),
                          const SizedBox(width: 4),
                          Text(type['label'] as String),
                        ],
                      ),
                      selected: isSelected,
                      onSelected: (selected) {
                        setState(() {
                          _selectedType = selected ? type['value'] as String : null;
                        });
                      },
                      selectedColor: AppColors.primary.withOpacity(0.2),
                      checkmarkColor: AppColors.primary,
                    );
                  }).toList(),
                ),
                const SizedBox(height: AppDefaults.padding),

                const Text("Endereço"),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: CompositedTransformTarget(
                        link: _layerLink,
                        child: TextFormField(
                          controller: _addressController,
                          focusNode: _addressFocusNode,
                          keyboardType: TextInputType.streetAddress,
                          textInputAction: TextInputAction.done,
                          onChanged: (_) {
                            // Resetar coordenadas quando o endereço mudar manualmente
                            if (!_isReverseGeocoding) {
                              setState(() {
                                _latitude = null;
                                _longitude = null;
                              });
                            }
                          },
                          decoration: InputDecoration(
                            hintText: 'Digite o endereço (autocomplete ativo)',
                            prefixIcon: const Icon(Icons.location_on),
                            suffixIcon: _isReverseGeocoding
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: Padding(
                                      padding: EdgeInsets.all(12.0),
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    ),
                                  )
                                : null,
                          ),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Por favor, insira o endereço';
                            }
                            return null;
                          },
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Botão "Buscar minha localização"
                    Tooltip(
                      message: 'Buscar minha localização',
                      child: IconButton(
                        icon: _isGettingLocation
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.my_location),
                        color: AppColors.primary,
                        onPressed: _isGettingLocation ? null : _getCurrentLocation,
                      ),
                    ),
                    // Botão buscar por endereço
                    if (_addressController.text.isNotEmpty) ...[
                      const SizedBox(width: 4),
                      IconButton(
                        icon: _isGeocoding
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Icon(
                                _latitude != null && _longitude != null
                                    ? Icons.check_circle
                                    : Icons.search,
                                color: _latitude != null && _longitude != null
                                    ? Colors.green
                                    : AppColors.primary,
                              ),
                        onPressed: _isGeocoding ? null : _geocodeAddress,
                        tooltip: 'Buscar localização pelo endereço',
                      ),
                    ],
                  ],
                ),
                if (_latitude != null && _longitude != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      'Localização encontrada: ${_latitude!.toStringAsFixed(6)}, ${_longitude!.toStringAsFixed(6)}',
                      style: const TextStyle(fontSize: 12, color: Colors.green),
                    ),
                  ),
                const SizedBox(height: AppDefaults.padding * 2),

                /* <---- Data de Ocorrência -----> */
                const Text("Data de Ocorrência"),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _dateController,
                  readOnly: true,
                  onTap: _selectDate,
                  decoration: const InputDecoration(
                    hintText: 'Selecione a data',
                    suffixIcon: Icon(Icons.calendar_today),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Selecione uma data';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: AppDefaults.padding * 2),

                /* <---- Botão Salvar -----> */
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _onSubmit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      disabledBackgroundColor: Colors.grey,
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          )
                        : const Text('Criar Reclamação'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

