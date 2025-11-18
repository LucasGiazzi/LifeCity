import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:http/http.dart' as http;
import '../../core/components/app_back_button.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_defaults.dart';
import '../../core/services/event_service.dart';

class CreateEventPage extends StatefulWidget {
  const CreateEventPage({super.key});

  @override
  State<CreateEventPage> createState() => _CreateEventPageState();
}

class _CreateEventPageState extends State<CreateEventPage> {
  final _formKey = GlobalKey<FormState>();
  final _descriptionController = TextEditingController();
  final _addressController = TextEditingController();
  final _dateController = TextEditingController();
  final _timeController = TextEditingController();
  final _endDateController = TextEditingController();
  final _endTimeController = TextEditingController();
  
  final EventService _eventService = EventService();
  bool _isLoading = false;
  bool _isGeocoding = false;
  String? _selectedType;
  double? _latitude;
  double? _longitude;
  
  final List<Map<String, dynamic>> _eventTypes = [
    {'value': 'festas', 'label': 'Festas', 'icon': Icons.celebration},
    {'value': 'eventos', 'label': 'Eventos', 'icon': Icons.event},
    {'value': 'esportes', 'label': 'Esportes', 'icon': Icons.sports},
    {'value': 'educacao', 'label': 'Educação', 'icon': Icons.school},
  ];

  @override
  void dispose() {
    _descriptionController.dispose();
    _addressController.dispose();
    _dateController.dispose();
    _timeController.dispose();
    _endDateController.dispose();
    _endTimeController.dispose();
    super.dispose();
  }

  Future<void> _selectDate() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() {
        _dateController.text = "${picked.day}/${picked.month}/${picked.year}";
      });
    }
  }

  Future<void> _selectTime() async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
    );
    if (picked != null) {
      setState(() {
        _timeController.text = "${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}";
      });
    }
  }

  Future<void> _selectEndDate() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _dateController.text.isNotEmpty
          ? _parseDate(_dateController.text)
          : DateTime.now(),
      firstDate: _dateController.text.isNotEmpty
          ? _parseDate(_dateController.text)
          : DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() {
        _endDateController.text = "${picked.day}/${picked.month}/${picked.year}";
      });
    }
  }

  Future<void> _selectEndTime() async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
    );
    if (picked != null) {
      setState(() {
        _endTimeController.text = "${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}";
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
          content: Text('Não foi possível encontrar a localização. Você pode criar o evento sem coordenadas.'),
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
      // Validação de data e hora
      if (_dateController.text.isEmpty || _timeController.text.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Por favor, selecione data e hora')),
        );
        return;
      }

      setState(() {
        _isLoading = true;
      });

      try {
        // Combinar data e hora no formato ISO 8601 para o backend
        final dateTime = _parseDateTime(_dateController.text, _timeController.text);
        final startDate = dateTime.toIso8601String();

        // Data de fim (opcional)
        String? endDate;
        if (_endDateController.text.isNotEmpty && _endTimeController.text.isNotEmpty) {
          final endDateTime = _parseDateTime(_endDateController.text, _endTimeController.text);
          endDate = endDateTime.toIso8601String();
        }

        // Tentar geocoding se ainda não foi feito
        if (_latitude == null || _longitude == null) {
          await _geocodeAddress();
        }

        final result = await _eventService.createEvent(
          description: _descriptionController.text.trim(),
          startDate: startDate,
          address: _addressController.text.trim(),
          category: _selectedType,
          endDate: endDate,
          latitude: _latitude,
          longitude: _longitude,
        );

        setState(() {
          _isLoading = false;
        });

        if (result != null && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Evento criado com sucesso!'),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.of(context).pop(true); // Retorna true para indicar que evento foi criado
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Erro ao criar evento. Tente novamente.'),
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

  DateTime _parseDateTime(String dateStr, String timeStr) {
    // dateStr está no formato "dd/mm/yyyy"
    // timeStr está no formato "HH:mm"
    final dateParts = dateStr.split('/');
    final timeParts = timeStr.split(':');
    
    final day = int.parse(dateParts[0]);
    final month = int.parse(dateParts[1]);
    final year = int.parse(dateParts[2]);
    final hour = int.parse(timeParts[0]);
    final minute = int.parse(timeParts[1]);
    
    return DateTime(year, month, day, hour, minute);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.cardColor,
      appBar: AppBar(
        leading: const AppBackButton(),
        title: const Text('Criar Evento'),
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
                    hintText: 'Descreva o evento...',
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Por favor, insira uma descrição';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: AppDefaults.padding),

                /* <---- Categoria (Opcional) -----> */
                const Text("Categoria (Opcional)"),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _eventTypes.map((type) {
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
                      child: TextFormField(
                        controller: _addressController,
                        keyboardType: TextInputType.streetAddress,
                        textInputAction: TextInputAction.done,
                        onChanged: (_) {
                          // Resetar coordenadas quando o endereço mudar
                          setState(() {
                            _latitude = null;
                            _longitude = null;
                          });
                        },
                        decoration: const InputDecoration(
                          hintText: 'Ex: Rua Principal, 123 - Centro',
                          prefixIcon: Icon(Icons.location_on),
                        ),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Por favor, insira o endereço';
                          }
                          return null;
                        },
                      ),
                    ),
                    if (_addressController.text.isNotEmpty) ...[
                      const SizedBox(width: 8),
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
                        tooltip: 'Buscar localização',
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

                /* <---- Data e Hora -----> */
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text("Data"),
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
                        ],
                      ),
                    ),
                    const SizedBox(width: AppDefaults.padding),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text("Hora"),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _timeController,
                            readOnly: true,
                            onTap: _selectTime,
                            decoration: const InputDecoration(
                              hintText: 'Selecione a hora',
                              suffixIcon: Icon(Icons.access_time),
                            ),
                            validator: (value) {
                              if (value == null || value.isEmpty) {
                                return 'Selecione uma hora';
                              }
                              return null;
                            },
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppDefaults.padding),

                /* <---- Data e Hora de Fim (Opcional) -----> */
                const Text("Data e Hora de Fim (Opcional)"),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _endDateController,
                        readOnly: true,
                        onTap: _selectEndDate,
                        decoration: const InputDecoration(
                          hintText: 'Data fim',
                          suffixIcon: Icon(Icons.calendar_today),
                        ),
                      ),
                    ),
                    const SizedBox(width: AppDefaults.padding),
                    Expanded(
                      child: TextFormField(
                        controller: _endTimeController,
                        readOnly: true,
                        onTap: _selectEndTime,
                        decoration: const InputDecoration(
                          hintText: 'Hora fim',
                          suffixIcon: Icon(Icons.access_time),
                        ),
                      ),
                    ),
                  ],
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
                        : const Text('Criar Evento'),
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

