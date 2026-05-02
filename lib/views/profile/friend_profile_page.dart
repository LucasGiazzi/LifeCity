import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/constants/app_colors.dart';
import '../../core/models/complaint_model.dart';
import '../../core/services/complaint_service.dart';
import '../complaints/complaint_sheet.dart';

class FriendProfilePage extends StatefulWidget {
  final String userId;
  final String userName;
  final String? photoUrl;

  const FriendProfilePage({
    super.key,
    required this.userId,
    required this.userName,
    this.photoUrl,
  });

  @override
  State<FriendProfilePage> createState() => _FriendProfilePageState();
}

class _FriendProfilePageState extends State<FriendProfilePage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final _complaintService = ComplaintService();

  List<ComplaintModel> _complaints = [];
  List<Map<String, dynamic>> _interactions = [];
  bool _isLoading = true;
  bool _isLoadingInteractions = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadComplaints();
    _tabController.addListener(() {
      if (_tabController.index == 1 &&
          _interactions.isEmpty &&
          !_isLoadingInteractions) {
        _loadInteractions();
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadComplaints() async {
    setState(() => _isLoading = true);
    try {
      final data = await _complaintService.getAllComplaints();
      if (mounted) {
        setState(() {
          _complaints = data
              .map((c) => ComplaintModel.fromJson(c))
              .where((c) => c.createdBy == widget.userId)
              .toList();
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _loadInteractions() async {
    setState(() => _isLoadingInteractions = true);
    try {
      final data = await _complaintService.getFriendInteractions(widget.userId);
      if (mounted) {
        setState(() {
          _interactions = data;
          _isLoadingInteractions = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingInteractions = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: NestedScrollView(
        headerSliverBuilder: (_, __) => [
          SliverToBoxAdapter(
            child: _FriendHeader(
              userName: widget.userName,
              photoUrl: widget.photoUrl,
              complaintCount: _complaints.length,
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
              labelStyle: GoogleFonts.poppins(
                  fontWeight: FontWeight.w600, fontSize: 13),
              unselectedLabelStyle: GoogleFonts.poppins(fontSize: 13),
              tabs: const [
                Tab(
                    text: 'Reclamações',
                    icon: Icon(Icons.report_problem_rounded, size: 18)),
                Tab(
                    text: 'Interações',
                    icon: Icon(Icons.favorite_border_rounded, size: 18)),
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
    if (_complaints.isEmpty) {
      return _EmptyState(
        icon: Icons.check_circle_outline_rounded,
        message: '${widget.userName} ainda não\nfez nenhuma reclamação',
      );
    }
    return RefreshIndicator(
      onRefresh: _loadComplaints,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _complaints.length,
        itemBuilder: (context, i) {
          final c = _complaints[i];
          return _ComplaintCard(
            complaint: c,
            onTap: () => showComplaintSheet(context, c),
          );
        },
      ),
    );
  }

  Widget _buildInteractionsList() {
    if (_isLoadingInteractions) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_interactions.isEmpty) {
      return _EmptyState(
        icon: Icons.favorite_border_rounded,
        message: '${widget.userName} ainda não\ncurtiu nem comentou nenhuma reclamação',
      );
    }
    return RefreshIndicator(
      onRefresh: _loadInteractions,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _interactions.length,
        itemBuilder: (context, i) => _InteractionCard(data: _interactions[i]),
      ),
    );
  }
}

// ─── Header ──────────────────────────────────────────────────────────────────

class _FriendHeader extends StatelessWidget {
  final String userName;
  final String? photoUrl;
  final int complaintCount;

  const _FriendHeader({
    required this.userName,
    this.photoUrl,
    required this.complaintCount,
  });

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
          padding: const EdgeInsets.fromLTRB(8, 8, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back_ios_new_rounded,
                    color: Colors.white, size: 20),
                onPressed: () => Navigator.pop(context),
              ),
              const SizedBox(height: 4),
              Padding(
                padding: const EdgeInsets.only(left: 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    CircleAvatar(
                      radius: 38,
                      backgroundColor: Colors.white,
                      child: (photoUrl != null && photoUrl!.isNotEmpty)
                          ? ClipOval(
                              child: CachedNetworkImage(
                                imageUrl: photoUrl!,
                                width: 76,
                                height: 76,
                                fit: BoxFit.cover,
                              ),
                            )
                          : const Icon(Icons.person,
                              size: 44, color: Colors.grey),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            userName,
                            style: GoogleFonts.poppins(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              const Icon(Icons.people_rounded,
                                  color: Colors.white70, size: 14),
                              const SizedBox(width: 4),
                              Text(
                                'Amigo',
                                style: GoogleFonts.poppins(
                                    color: Colors.white70, fontSize: 12),
                              ),
                              const SizedBox(width: 12),
                              const Icon(Icons.report_problem_rounded,
                                  color: Colors.white70, size: 14),
                              const SizedBox(width: 4),
                              Text(
                                '$complaintCount reclamação${complaintCount != 1 ? 'ões' : ''}',
                                style: GoogleFonts.poppins(
                                    color: Colors.white70, fontSize: 12),
                              ),
                            ],
                          ),
                        ],
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

// ─── Complaint Card ───────────────────────────────────────────────────────────

class _ComplaintCard extends StatelessWidget {
  final ComplaintModel complaint;
  final VoidCallback onTap;

  const _ComplaintCard({required this.complaint, required this.onTap});

  static const _catColors = <String, Color>{
    'infraestrutura': Colors.orange,
    'seguranca': Colors.red,
    'limpeza': Colors.teal,
    'transito': Colors.amber,
    'outros': Colors.grey,
  };

  static const _catIcons = <String, IconData>{
    'infraestrutura': Icons.construction,
    'seguranca': Icons.security,
    'limpeza': Icons.cleaning_services,
    'transito': Icons.traffic,
    'outros': Icons.report_problem,
  };

  @override
  Widget build(BuildContext context) {
    final type = complaint.type?.toLowerCase() ?? 'outros';
    final color = _catColors[type] ?? Colors.grey;
    final icon = _catIcons[type] ?? Icons.report_problem;
    final date =
        '${complaint.occurrenceDate.day.toString().padLeft(2, '0')}/${complaint.occurrenceDate.month.toString().padLeft(2, '0')}/${complaint.occurrenceDate.year}';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      complaint.description,
                      style: GoogleFonts.poppins(
                          fontWeight: FontWeight.w600, fontSize: 14),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (complaint.address != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        complaint.address!,
                        style: GoogleFonts.poppins(
                            fontSize: 12, color: AppColors.placeholder),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    const SizedBox(height: 2),
                    Text(date,
                        style: GoogleFonts.poppins(
                            fontSize: 11, color: AppColors.placeholder)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded,
                  color: AppColors.placeholder),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Interaction Card ─────────────────────────────────────────────────────────

class _InteractionCard extends StatelessWidget {
  final Map<String, dynamic> data;
  const _InteractionCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final isLike = data['type'] == 'like';
    final iconColor = isLike ? Colors.red : AppColors.primary;
    final icon =
        isLike ? Icons.favorite_rounded : Icons.chat_bubble_rounded;
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
                        isLike ? 'Curtiu uma reclamação' : 'Comentou em uma reclamação',
                        style: GoogleFonts.poppins(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: iconColor),
                      ),
                      if (createdAt != null)
                        Text(
                          _formatDate(createdAt),
                          style: GoogleFonts.poppins(
                              fontSize: 11, color: AppColors.placeholder),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              title,
              style: GoogleFonts.poppins(
                  fontSize: 13, fontWeight: FontWeight.w500),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            if (address != null) ...[
              const SizedBox(height: 2),
              Row(
                children: [
                  const Icon(Icons.location_on_outlined,
                      size: 13, color: AppColors.placeholder),
                  const SizedBox(width: 2),
                  Expanded(
                    child: Text(
                      address,
                      style: GoogleFonts.poppins(
                          fontSize: 11, color: AppColors.placeholder),
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
                  style: GoogleFonts.poppins(
                      fontSize: 12,
                      fontStyle: FontStyle.italic,
                      color: AppColors.placeholder),
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

// ─── Empty State ──────────────────────────────────────────────────────────────

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
          Text(
            message,
            style: GoogleFonts.poppins(
                color: AppColors.placeholder, fontSize: 15),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
