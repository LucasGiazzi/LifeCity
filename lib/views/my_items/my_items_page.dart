import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_defaults.dart';
import '../../core/models/event_model.dart';
import '../../core/models/complaint_model.dart';
import '../../core/services/event_service.dart';
import '../../core/services/complaint_service.dart';
import '../../core/state/auth_state.dart';

class MyItemsPage extends StatefulWidget {
  const MyItemsPage({super.key});

  @override
  State<MyItemsPage> createState() => _MyItemsPageState();
}

class _MyItemsPageState extends State<MyItemsPage> with SingleTickerProviderStateMixin {
  final EventService _eventService = EventService();
  final ComplaintService _complaintService = ComplaintService();
  
  List<EventModel> _myEvents = [];
  List<ComplaintModel> _myComplaints = [];
  bool _isLoading = true;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadMyItems();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadMyItems() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final authState = Provider.of<AuthState>(context, listen: false);
      final currentUser = authState.currentUser;
      
      if (currentUser == null || currentUser['id'] == null) {
        setState(() {
          _isLoading = false;
        });
        return;
      }

      final userId = currentUser['id'].toString();

      // Carregar eventos e reclamações
      final eventsData = await _eventService.getAllEvents();
      final complaintsData = await _complaintService.getAllComplaints();

      // Filtrar apenas os itens do usuário atual
      final myEvents = eventsData
          .map((e) => EventModel.fromJson(e))
          .where((e) => e.createdBy == userId)
          .toList();

      final myComplaints = complaintsData
          .map((c) => ComplaintModel.fromJson(c))
          .where((c) => c.createdBy == userId)
          .toList();

      if (mounted) {
        setState(() {
          _myEvents = myEvents;
          _myComplaints = myComplaints;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Erro ao carregar meus itens: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Meus Itens'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Eventos', icon: Icon(Icons.event)),
            Tab(text: 'Reclamações', icon: Icon(Icons.report_problem)),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildEventsList(),
                _buildComplaintsList(),
              ],
            ),
    );
  }

  Widget _buildEventsList() {
    if (_myEvents.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.event_busy, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'Você ainda não criou nenhum evento',
              style: TextStyle(color: Colors.grey[600], fontSize: 16),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadMyItems,
      child: ListView.builder(
        padding: const EdgeInsets.all(AppDefaults.padding),
        itemCount: _myEvents.length,
        itemBuilder: (context, index) {
          final event = _myEvents[index];
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: ListTile(
              contentPadding: const EdgeInsets.all(16),
              leading: CircleAvatar(
                backgroundColor: AppColors.primary.withOpacity(0.2),
                child: Icon(Icons.event, color: AppColors.primary),
              ),
              title: Text(
                event.description,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 4),
                  if (event.address != null)
                    Row(
                      children: [
                        const Icon(Icons.location_on, size: 14),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            event.address!,
                            style: const TextStyle(fontSize: 12),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.access_time, size: 14),
                      const SizedBox(width: 4),
                      Text(
                        _formatDateTime(event.startDate),
                        style: const TextStyle(fontSize: 12),
                      ),
                    ],
                  ),
                  if (event.category != null) ...[
                    const SizedBox(height: 4),
                    Chip(
                      label: Text(event.category!),
                      visualDensity: VisualDensity.compact,
                      padding: EdgeInsets.zero,
                    ),
                  ],
                ],
              ),
              trailing: IconButton(
                icon: const Icon(Icons.delete, color: Colors.red),
                onPressed: () => _showDeleteEventDialog(event),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildComplaintsList() {
    if (_myComplaints.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.report_problem, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'Você ainda não criou nenhuma reclamação',
              style: TextStyle(color: Colors.grey[600], fontSize: 16),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadMyItems,
      child: ListView.builder(
        padding: const EdgeInsets.all(AppDefaults.padding),
        itemCount: _myComplaints.length,
        itemBuilder: (context, index) {
          final complaint = _myComplaints[index];
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: ListTile(
              contentPadding: const EdgeInsets.all(16),
              leading: CircleAvatar(
                backgroundColor: Colors.red.withOpacity(0.2),
                child: const Icon(Icons.report_problem, color: Colors.red),
              ),
              title: Text(
                complaint.description,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 4),
                  if (complaint.address != null)
                    Row(
                      children: [
                        const Icon(Icons.location_on, size: 14),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            complaint.address!,
                            style: const TextStyle(fontSize: 12),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.calendar_today, size: 14),
                      const SizedBox(width: 4),
                      Text(
                        _formatDate(complaint.occurrenceDate),
                        style: const TextStyle(fontSize: 12),
                      ),
                    ],
                  ),
                  if (complaint.type != null) ...[
                    const SizedBox(height: 4),
                    Chip(
                      label: Text(complaint.type!),
                      visualDensity: VisualDensity.compact,
                      padding: EdgeInsets.zero,
                    ),
                  ],
                ],
              ),
              trailing: IconButton(
                icon: const Icon(Icons.delete, color: Colors.red),
                onPressed: () => _showDeleteComplaintDialog(complaint),
              ),
            ),
          );
        },
      ),
    );
  }

  void _showDeleteEventDialog(EventModel event) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirmar Exclusão'),
        content: const Text('Tem certeza que deseja excluir este evento?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              final success = await _eventService.deleteEvent(event.id);
              if (mounted) {
                if (success) {
                  await _loadMyItems();
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

  void _showDeleteComplaintDialog(ComplaintModel complaint) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirmar Exclusão'),
        content: const Text('Tem certeza que deseja excluir esta reclamação?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              final success = await _complaintService.deleteComplaint(complaint.id);
              if (mounted) {
                if (success) {
                  await _loadMyItems();
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

  String _formatDateTime(DateTime dateTime) {
    final day = dateTime.day.toString().padLeft(2, '0');
    final month = dateTime.month.toString().padLeft(2, '0');
    final year = dateTime.year;
    final hour = dateTime.hour.toString().padLeft(2, '0');
    final minute = dateTime.minute.toString().padLeft(2, '0');
    return '$day/$month/$year às $hour:$minute';
  }

  String _formatDate(DateTime date) {
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    final year = date.year;
    return '$day/$month/$year';
  }
}


