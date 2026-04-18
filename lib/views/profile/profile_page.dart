import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_colors.dart';
import '../../core/models/complaint_model.dart';
import '../../core/routes/app_routes.dart';
import '../../core/services/complaint_service.dart';
import '../../core/state/auth_state.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final ComplaintService _complaintService = ComplaintService();

  List<ComplaintModel> _myComplaints = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadMyComplaints();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadMyComplaints() async {
    setState(() => _isLoading = true);
    try {
      final authState = Provider.of<AuthState>(context, listen: false);
      final userId = authState.currentUser?['id']?.toString();
      if (userId == null) { setState(() => _isLoading = false); return; }

      final data = await _complaintService.getAllComplaints();
      if (mounted) {
        setState(() {
          _myComplaints = data
              .map((c) => ComplaintModel.fromJson(c))
              .where((c) => c.createdBy == userId)
              .toList();
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthState>();
    final userName = authState.currentUser?['name'] as String? ?? 'Usuário';
    final photoUrl = authState.currentUser?['photo_url'] as String?;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: NestedScrollView(
        headerSliverBuilder: (_, __) => [
          SliverToBoxAdapter(
            child: _ProfileHeader(userName: userName, photoUrl: photoUrl),
          ),
        ],
        body: Column(
          children: [
            TabBar(
              controller: _tabController,
              labelColor: AppColors.primary,
              unselectedLabelColor: AppColors.placeholder,
              indicatorColor: AppColors.primary,
              labelStyle: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 13),
              unselectedLabelStyle: GoogleFonts.poppins(fontSize: 13),
              tabs: const [
                Tab(text: 'Reclamações', icon: Icon(Icons.report_problem_rounded, size: 18)),
                Tab(text: 'Interações', icon: Icon(Icons.favorite_border_rounded, size: 18)),
              ],
            ),
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : TabBarView(
                      controller: _tabController,
                      children: [
                        _buildComplaintsList(),
                        _buildInteractionsList(),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildComplaintsList() {
    if (_myComplaints.isEmpty) {
      return _EmptyState(
        icon: Icons.check_circle_outline_rounded,
        message: 'Você ainda não criou nenhuma reclamação',
      );
    }
    return RefreshIndicator(
      onRefresh: _loadMyComplaints,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _myComplaints.length,
        itemBuilder: (context, i) {
          final c = _myComplaints[i];
          return _ActivityCard(
            icon: Icons.report_problem_rounded,
            iconColor: Colors.orange,
            title: c.description,
            subtitle: c.address,
            date: _formatDate(c.occurrenceDate),
            onDelete: () => _deleteComplaint(c),
          );
        },
      ),
    );
  }

  Widget _buildInteractionsList() {
    // Mock de interações — será substituído por dados reais quando o backend tiver likes/comentários
    final mockInteractions = [
      _MockInteraction(
        type: _InteractionType.like,
        complaintTitle: 'Buraco na Rua das Flores próximo ao número 42',
        date: DateTime.now().subtract(const Duration(days: 1)),
        address: 'Rua das Flores, 42 - Centro',
      ),
      _MockInteraction(
        type: _InteractionType.comment,
        complaintTitle: 'Iluminação pública apagada há semanas na Av. Brasil',
        date: DateTime.now().subtract(const Duration(days: 3)),
        address: 'Av. Brasil, 500 - Jardim América',
        comment: 'Já registrei isso com a prefeitura, mas sem resposta ainda.',
      ),
      _MockInteraction(
        type: _InteractionType.like,
        complaintTitle: 'Lixo acumulado no parque municipal',
        date: DateTime.now().subtract(const Duration(days: 5)),
        address: 'Parque Municipal - Vila Nova',
      ),
    ];

    return Column(
      children: [
        // Banner informativo
        Container(
          margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
          ),
          child: Row(
            children: [
              const Icon(Icons.info_outline_rounded, color: AppColors.primary, size: 18),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Sistema de interações em breve! Abaixo uma prévia.',
                  style: GoogleFonts.poppins(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w500),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: mockInteractions.length,
            itemBuilder: (context, i) {
              final interaction = mockInteractions[i];
              return _InteractionCard(interaction: interaction);
            },
          ),
        ),
      ],
    );
  }

  Future<void> _deleteComplaint(ComplaintModel complaint) async {
    if (await _confirmDelete() != true) return;
    final ok = await _complaintService.deleteComplaint(complaint.id);
    if (ok && mounted) {
      _loadMyComplaints();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Reclamação excluída'), backgroundColor: Colors.green),
      );
    }
  }

  Future<bool?> _confirmDelete() => showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Confirmar exclusão'),
          content: const Text('Esta ação não pode ser desfeita.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Excluir', style: TextStyle(color: Colors.red)),
            ),
          ],
        ),
      );

  String _formatDate(DateTime dt) =>
      '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
}

// ─── Header ───────────────────────────────────────────────────────

class _ProfileHeader extends StatelessWidget {
  final String userName;
  final String? photoUrl;
  const _ProfileHeader({required this.userName, this.photoUrl});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF00B37E), Color(0xFF00A36C)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 8, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Align(
                alignment: Alignment.topRight,
                child: IconButton(
                  icon: const Icon(Icons.settings_rounded, color: Colors.white, size: 24),
                  onPressed: () => Navigator.pushNamed(context, AppRoutes.settings),
                ),
              ),
              const SizedBox(height: 4),
              CircleAvatar(
                radius: 38,
                backgroundColor: Colors.white,
                backgroundImage: (photoUrl != null && photoUrl!.isNotEmpty) ? NetworkImage(photoUrl!) : null,
                child: (photoUrl == null || photoUrl!.isEmpty)
                    ? const Icon(Icons.person, size: 44, color: Colors.grey)
                    : null,
              ),
              const SizedBox(height: 12),
              Text(
                userName,
                style: GoogleFonts.poppins(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Cards de atividade ───────────────────────────────────────────

class _ActivityCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String? subtitle;
  final String date;
  final VoidCallback onDelete;

  const _ActivityCard({
    required this.icon,
    required this.iconColor,
    required this.title,
    this.subtitle,
    required this.date,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: iconColor, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 14), maxLines: 2, overflow: TextOverflow.ellipsis),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(subtitle!, style: GoogleFonts.poppins(fontSize: 12, color: AppColors.placeholder), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ],
                  const SizedBox(height: 2),
                  Text(date, style: GoogleFonts.poppins(fontSize: 11, color: AppColors.placeholder)),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.delete_outline_rounded, color: Colors.red, size: 20),
              onPressed: onDelete,
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Interações (mock) ────────────────────────────────────────────

enum _InteractionType { like, comment }

class _MockInteraction {
  final _InteractionType type;
  final String complaintTitle;
  final DateTime date;
  final String address;
  final String? comment;

  const _MockInteraction({
    required this.type,
    required this.complaintTitle,
    required this.date,
    required this.address,
    this.comment,
  });
}

class _InteractionCard extends StatelessWidget {
  final _MockInteraction interaction;
  const _InteractionCard({required this.interaction});

  @override
  Widget build(BuildContext context) {
    final isLike = interaction.type == _InteractionType.like;
    final iconColor = isLike ? Colors.red : AppColors.primary;
    final icon = isLike ? Icons.favorite_rounded : Icons.chat_bubble_rounded;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: iconColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, color: iconColor, size: 18),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isLike ? 'Você curtiu uma reclamação' : 'Você comentou em uma reclamação',
                        style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: iconColor),
                      ),
                      Text(
                        _formatDate(interaction.date),
                        style: GoogleFonts.poppins(fontSize: 11, color: AppColors.placeholder),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              interaction.complaintTitle,
              style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w500),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            Row(
              children: [
                const Icon(Icons.location_on_outlined, size: 13, color: AppColors.placeholder),
                const SizedBox(width: 2),
                Expanded(
                  child: Text(
                    interaction.address,
                    style: GoogleFonts.poppins(fontSize: 11, color: AppColors.placeholder),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            if (interaction.comment != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.07),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '"${interaction.comment}"',
                  style: GoogleFonts.poppins(fontSize: 12, fontStyle: FontStyle.italic, color: AppColors.placeholder),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime dt) {
    final diff = DateTime.now().difference(dt).inDays;
    if (diff == 0) return 'Hoje';
    if (diff == 1) return 'Ontem';
    return 'Há $diff dias';
  }
}

// ─── Empty state ──────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  final IconData icon;
  final String message;
  const _EmptyState({required this.icon, required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 64, color: AppColors.placeholder),
          const SizedBox(height: 16),
          Text(message, style: GoogleFonts.poppins(color: AppColors.placeholder, fontSize: 15), textAlign: TextAlign.center),
        ],
      ),
    );
  }
}
