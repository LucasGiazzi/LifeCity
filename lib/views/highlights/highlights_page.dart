import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/constants/app_colors.dart';
import '../../core/models/complaint_model.dart';
import '../../core/services/complaint_service.dart';
import '../complaints/complaint_sheet.dart';

class HighlightsPage extends StatefulWidget {
  const HighlightsPage({super.key});

  @override
  State<HighlightsPage> createState() => _HighlightsPageState();
}

class _HighlightsPageState extends State<HighlightsPage> {
  final _service = ComplaintService();
  List<Map<String, dynamic>> _items = [];
  bool _isLoading = true;
  String _period = 'day';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final data = await _service.getHighlights(period: _period);
      if (mounted) {
        setState(() {
          _items = data;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _changePeriod(String p) {
    if (_period == p) return;
    setState(() => _period = p);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: Column(
        children: [
          _HighlightsHeader(period: _period, onPeriodChanged: _changePeriod),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _items.isEmpty
                    ? _EmptyState(period: _period)
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: ListView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                          itemCount: _items.length,
                          itemBuilder: (ctx, i) => _HighlightCard(
                            data: _items[i],
                            rank: i + 1,
                            onTap: () {
                              final complaint =
                                  ComplaintModel.fromJson(_items[i]);
                              showComplaintSheet(ctx, complaint);
                            },
                          ),
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

// ─── Header ──────────────────────────────────────────────────────────────────

class _HighlightsHeader extends StatelessWidget {
  final String period;
  final void Function(String) onPeriodChanged;

  const _HighlightsHeader({
    required this.period,
    required this.onPeriodChanged,
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
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.emoji_events_rounded,
                      color: Colors.white, size: 26),
                  const SizedBox(width: 10),
                  Text(
                    'Destaques',
                    style: GoogleFonts.poppins(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Reclamações com mais engajamento',
                style: GoogleFonts.poppins(
                    color: Colors.white70, fontSize: 13),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  _PeriodChip(
                    label: 'Hoje',
                    isSelected: period == 'day',
                    onTap: () => onPeriodChanged('day'),
                  ),
                  const SizedBox(width: 10),
                  _PeriodChip(
                    label: 'Esta semana',
                    isSelected: period == 'week',
                    onTap: () => onPeriodChanged('week'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PeriodChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _PeriodChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.white.withValues(alpha: 0.2),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: GoogleFonts.poppins(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: isSelected ? AppColors.primaryDark : Colors.white,
          ),
        ),
      ),
    );
  }
}

// ─── Card ─────────────────────────────────────────────────────────────────────

class _HighlightCard extends StatelessWidget {
  final Map<String, dynamic> data;
  final int rank;
  final VoidCallback onTap;

  const _HighlightCard({
    required this.data,
    required this.rank,
    required this.onTap,
  });

  static const _catColors = <String, Color>{
    'infraestrutura': Colors.orange,
    'seguranca': Colors.red,
    'limpeza': Colors.teal,
    'transito': Colors.amber,
    'outros': Colors.grey,
  };

  static const _catLabels = <String, String>{
    'infraestrutura': 'Infraestrutura',
    'seguranca': 'Segurança',
    'limpeza': 'Limpeza',
    'transito': 'Trânsito',
    'outros': 'Outros',
  };

  @override
  Widget build(BuildContext context) {
    final description = data['description'] as String? ?? '';
    final address = data['address'] as String?;
    final type = (data['type'] as String?)?.toLowerCase() ?? 'outros';
    final createdByName = data['created_by_name'] as String?;
    final photoUrl = data['photo_url'] as String?;
    final likes = (data['likes_count'] as num?)?.toInt() ?? 0;
    final comments = (data['comments_count'] as num?)?.toInt() ?? 0;

    final catColor = _catColors[type] ?? Colors.grey;
    final catLabel = _catLabels[type] ?? 'Outros';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: rank <= 3 ? 3 : 1,
      shadowColor: rank <= 3
          ? _rankColor(rank).withValues(alpha: 0.3)
          : Colors.black12,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: rank <= 3
            ? BorderSide(
                color: _rankColor(rank).withValues(alpha: 0.4), width: 1.5)
            : BorderSide.none,
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _RankBadge(rank: rank),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      description,
                      style: GoogleFonts.poppins(
                          fontSize: 14, fontWeight: FontWeight.w600),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (address != null) ...[
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          const Icon(Icons.location_on_outlined,
                              size: 12, color: AppColors.placeholder),
                          const SizedBox(width: 2),
                          Expanded(
                            child: Text(
                              address,
                              style: GoogleFonts.poppins(
                                  fontSize: 11,
                                  color: AppColors.placeholder),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: catColor.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            catLabel,
                            style: GoogleFonts.poppins(
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                              color: catColor,
                            ),
                          ),
                        ),
                        const Spacer(),
                        _EngagementRow(likes: likes, comments: comments),
                      ],
                    ),
                    if (createdByName != null) ...[
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          CircleAvatar(
                            radius: 10,
                            backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                            child: (photoUrl != null && photoUrl.isNotEmpty)
                                ? ClipOval(
                                    child: CachedNetworkImage(
                                      imageUrl: photoUrl,
                                      width: 20,
                                      height: 20,
                                      fit: BoxFit.cover,
                                    ),
                                  )
                                : const Icon(Icons.person,
                                    size: 12, color: AppColors.primary),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            createdByName,
                            style: GoogleFonts.poppins(
                                fontSize: 11,
                                color: AppColors.placeholder,
                                fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _rankColor(int rank) {
    return switch (rank) {
      1 => const Color(0xFFFFD700),
      2 => const Color(0xFFC0C0C0),
      3 => const Color(0xFFCD7F32),
      _ => AppColors.placeholder,
    };
  }
}

class _RankBadge extends StatelessWidget {
  final int rank;
  const _RankBadge({required this.rank});

  Color get _color => switch (rank) {
        1 => const Color(0xFFFFD700),
        2 => const Color(0xFFC0C0C0),
        3 => const Color(0xFFCD7F32),
        _ => AppColors.placeholder,
      };

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: _color.withValues(alpha: rank <= 3 ? 0.15 : 0.08),
        shape: BoxShape.circle,
      ),
      child: rank <= 3
          ? Icon(Icons.emoji_events_rounded, color: _color, size: 20)
          : Center(
              child: Text(
                '$rank',
                style: GoogleFonts.poppins(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.placeholder,
                ),
              ),
            ),
    );
  }
}

class _EngagementRow extends StatelessWidget {
  final int likes;
  final int comments;
  const _EngagementRow({required this.likes, required this.comments});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.favorite_rounded, size: 13, color: Colors.red),
        const SizedBox(width: 3),
        Text('$likes',
            style:
                GoogleFonts.poppins(fontSize: 12, color: AppColors.placeholder)),
        const SizedBox(width: 10),
        const Icon(Icons.chat_bubble_rounded,
            size: 13, color: AppColors.primary),
        const SizedBox(width: 3),
        Text('$comments',
            style: GoogleFonts.poppins(
                fontSize: 12, color: AppColors.placeholder)),
      ],
    );
  }
}

// ─── Empty State ──────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  final String period;
  const _EmptyState({required this.period});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.emoji_events_outlined,
              size: 64, color: AppColors.placeholder),
          const SizedBox(height: 16),
          Text(
            period == 'day'
                ? 'Nenhum destaque hoje ainda.\nSeja o primeiro a engajar!'
                : 'Nenhum destaque esta semana.',
            style: GoogleFonts.poppins(
                color: AppColors.placeholder, fontSize: 15),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
