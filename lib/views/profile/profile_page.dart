import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_colors.dart';
import '../../core/models/achievement_model.dart';
import '../../core/models/complaint_model.dart';
import '../../core/routes/app_routes.dart';
import '../../core/services/achievement_service.dart';
import '../../core/services/complaint_service.dart';
import '../../core/services/notification_service.dart';
import '../../core/state/auth_state.dart';
import '../complaints/complaint_card.dart';
import '../complaints/complaint_sheet.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final ComplaintService _complaintService = ComplaintService();
  final AchievementService _achievementService = AchievementService();
  final NotificationService _notificationService = NotificationService();

  List<ComplaintModel> _myComplaints = [];
  List<Map<String, dynamic>> _myInteractions = [];
  List<AchievementModel> _myAchievements = [];
  Map<String, dynamic>? _xpData;
  int _unreadNotifications = 0;
  bool _isLoading = true;
  bool _isLoadingInteractions = false;
  bool _isLoadingAchievements = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadMyComplaints();
    _loadXp();
    _loadUnreadNotifications();
    _tabController.addListener(() {
      if (_tabController.index == 1 && _myInteractions.isEmpty && !_isLoadingInteractions) {
        _loadMyInteractions();
      }
      if (_tabController.index == 2 && _myAchievements.isEmpty && !_isLoadingAchievements) {
        _loadAchievements();
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadXp() async {
    final data = await _complaintService.getMyXp();
    if (mounted && data != null) setState(() => _xpData = data);
  }

  Future<void> _loadUnreadNotifications() async {
    final count = await _notificationService.getUnreadCount();
    if (mounted) setState(() => _unreadNotifications = count);
  }

  Future<void> _loadAchievements() async {
    setState(() => _isLoadingAchievements = true);
    final data = await _achievementService.getMyAchievements();
    if (mounted) setState(() { _myAchievements = data; _isLoadingAchievements = false; });
  }

  Future<void> _loadMyInteractions() async {
    setState(() => _isLoadingInteractions = true);
    try {
      final data = await _complaintService.getMyInteractions();
      if (mounted) setState(() { _myInteractions = data; _isLoadingInteractions = false; });
    } catch (_) {
      if (mounted) setState(() => _isLoadingInteractions = false);
    }
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
            child: _ProfileHeader(
              userName: userName,
              photoUrl: photoUrl,
              xpData: _xpData,
              unreadNotifications: _unreadNotifications,
              onNotificationsTap: () async {
                await Navigator.pushNamed(context, AppRoutes.notifications);
                _loadUnreadNotifications();
              },
            ),
          ),
        ],
        body: Column(
          children: [
            TabBar(
              controller: _tabController,
              labelColor: AppColors.primary,
              unselectedLabelColor: AppColors.placeholder,
              indicatorColor: AppColors.primary,
              labelStyle: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 12),
              unselectedLabelStyle: GoogleFonts.poppins(fontSize: 12),
              tabs: const [
                Tab(text: 'Reclamações', icon: Icon(Icons.report_problem_rounded, size: 18)),
                Tab(text: 'Interações', icon: Icon(Icons.favorite_border_rounded, size: 18)),
                Tab(text: 'Conquistas', icon: Icon(Icons.emoji_events_rounded, size: 18)),
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
                        _buildAchievementsList(),
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
          return ComplaintCard(
            complaint: c,
            onTap: () => showComplaintSheet(
              context,
              c,
              onDeleted: _loadMyComplaints,
              onEdited: _loadMyComplaints,
            ),
            onDelete: () => _deleteComplaint(c),
          );
        },
      ),
    );
  }

  Widget _buildInteractionsList() {
    if (_isLoadingInteractions) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_myInteractions.isEmpty) {
      return _EmptyState(
        icon: Icons.favorite_border_rounded,
        message: 'Você ainda não curtiu\nnem comentou nenhuma reclamação',
      );
    }
    return RefreshIndicator(
      onRefresh: _loadMyInteractions,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _myInteractions.length,
        itemBuilder: (context, i) => _InteractionCard(data: _myInteractions[i]),
      ),
    );
  }

  Widget _buildAchievementsList() {
    if (_isLoadingAchievements) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_myAchievements.isEmpty) {
      return _EmptyState(
        icon: Icons.emoji_events_outlined,
        message: 'Nenhuma conquista desbloqueada ainda\nComece criando sua primeira reclamação!',
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _myAchievements.length,
      itemBuilder: (context, i) => _AchievementCard(achievement: _myAchievements[i]),
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
          backgroundColor: Colors.white,
          title: const Text('Confirmar exclusão', style: TextStyle(color: Colors.black87)),
          content: const Text('Esta ação não pode ser desfeita.', style: TextStyle(color: Colors.black54)),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Excluir', style: TextStyle(color: Colors.red)),
            ),
          ],
        ),
      );

}

// ─── Achievement card ─────────────────────────────────────────────

class _AchievementCard extends StatelessWidget {
  final AchievementModel achievement;
  const _AchievementCard({required this.achievement});

  static const _triggerLabels = <String, String>{
    'complaint_created': 'Reclamações criadas',
    'likes_received': 'Curtidas recebidas',
    'comments_received': 'Comentários recebidos',
  };

  @override
  Widget build(BuildContext context) {
    final label = _triggerLabels[achievement.triggerType] ?? '';
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: Colors.amber.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.emoji_events_rounded, color: Colors.amber, size: 26),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    achievement.name,
                    style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  if (achievement.description != null)
                    Text(
                      achievement.description!,
                      style: GoogleFonts.poppins(fontSize: 11, color: AppColors.placeholder),
                    ),
                  if (label.isNotEmpty)
                    Text(
                      '$label: ${achievement.triggerCount}',
                      style: GoogleFonts.poppins(fontSize: 11, color: AppColors.placeholder),
                    ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.amber.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '+${achievement.xpReward} XP',
                style: GoogleFonts.poppins(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Colors.amber.shade700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Header ───────────────────────────────────────────────────────

class _ProfileHeader extends StatelessWidget {
  final String userName;
  final String? photoUrl;
  final Map<String, dynamic>? xpData;
  final int unreadNotifications;
  final VoidCallback? onNotificationsTap;

  const _ProfileHeader({
    required this.userName,
    this.photoUrl,
    this.xpData,
    this.unreadNotifications = 0,
    this.onNotificationsTap,
  });

  static const _levelIcons = <int, IconData>{
    1: Icons.home_rounded,
    2: Icons.people_rounded,
    3: Icons.shield_rounded,
    4: Icons.campaign_rounded,
    5: Icons.star_rounded,
  };

  @override
  Widget build(BuildContext context) {
    final xp = (xpData?['xp'] as num?)?.toInt() ?? 0;
    final level = (xpData?['level'] as num?)?.toInt() ?? 1;
    final levelName = xpData?['name'] as String? ?? 'Morador';
    final currentMin = (xpData?['currentMin'] as num?)?.toInt() ?? 0;
    final nextMin = (xpData?['nextMin'] as num?)?.toInt();
    final icon = _levelIcons[level] ?? Icons.person_rounded;

    final progress = nextMin != null && nextMin > currentMin
        ? ((xp - currentMin) / (nextMin - currentMin)).clamp(0.0, 1.0)
        : 1.0;

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
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.notifications_rounded, color: Colors.white, size: 24),
                        onPressed: onNotificationsTap,
                      ),
                      if (unreadNotifications > 0)
                        Positioned(
                          right: 6,
                          top: 6,
                          child: Container(
                            padding: const EdgeInsets.all(3),
                            decoration: const BoxDecoration(
                              color: Colors.redAccent,
                              shape: BoxShape.circle,
                            ),
                            constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                            child: Text(
                              unreadNotifications > 9 ? '9+' : '$unreadNotifications',
                              style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.settings_rounded, color: Colors.white, size: 24),
                    onPressed: () => Navigator.pushNamed(context, AppRoutes.settings),
                  ),
                ],
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
              const SizedBox(height: 8),

              // Badge de nível
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(icon, color: Colors.white, size: 14),
                    const SizedBox(width: 5),
                    Text(
                      'Nível $level — $levelName',
                      style: GoogleFonts.poppins(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),

              // Barra de progresso
              Padding(
                padding: const EdgeInsets.only(right: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '$xp XP',
                          style: GoogleFonts.poppins(color: Colors.white70, fontSize: 11),
                        ),
                        Text(
                          nextMin != null ? '$nextMin XP' : 'Nível máximo!',
                          style: GoogleFonts.poppins(color: Colors.white70, fontSize: 11),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 6,
                        backgroundColor: Colors.white.withValues(alpha: 0.25),
                        valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
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

// ─── Interações (dados reais) ─────────────────────────────────────

class _InteractionCard extends StatelessWidget {
  final Map<String, dynamic> data;
  const _InteractionCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final isLike = data['type'] == 'like';
    final iconColor = isLike ? Colors.red : AppColors.primary;
    final icon = isLike ? Icons.favorite_rounded : Icons.chat_bubble_rounded;
    final title = data['description'] as String? ?? '';
    final address = data['address'] as String?;
    final commentText = data['comment_text'] as String?;
    final createdAt = data['created_at'] as String?;

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
                      if (createdAt != null)
                        Text(
                          _formatDate(createdAt),
                          style: GoogleFonts.poppins(fontSize: 11, color: AppColors.placeholder),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              title,
              style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w500),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            if (address != null) ...[
              const SizedBox(height: 2),
              Row(
                children: [
                  const Icon(Icons.location_on_outlined, size: 13, color: AppColors.placeholder),
                  const SizedBox(width: 2),
                  Expanded(
                    child: Text(
                      address,
                      style: GoogleFonts.poppins(fontSize: 11, color: AppColors.placeholder),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
            if (commentText != null && commentText.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.07),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '"$commentText"',
                  style: GoogleFonts.poppins(fontSize: 12, fontStyle: FontStyle.italic, color: AppColors.placeholder),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      final diff = DateTime.now().difference(dt).inDays;
      if (diff == 0) return 'Hoje';
      if (diff == 1) return 'Ontem';
      return 'Há $diff dias';
    } catch (_) {
      return '';
    }
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
