import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/constants/app_colors.dart';
import '../../core/models/complaint_model.dart';

class ComplaintCard extends StatelessWidget {
  final ComplaintModel complaint;
  final VoidCallback? onTap;
  final VoidCallback? onDelete;
  final int? rank;

  const ComplaintCard({
    super.key,
    required this.complaint,
    this.onTap,
    this.onDelete,
    this.rank,
  });

  static const _catColors = <String, Color>{
    'infraestrutura': Colors.orange,
    'seguranca':      Colors.red,
    'limpeza':        Colors.teal,
    'transito':       Colors.amber,
    'outros':         Colors.grey,
  };

  static const _catLabels = <String, String>{
    'infraestrutura': 'Infraestrutura',
    'seguranca':      'Segurança',
    'limpeza':        'Limpeza',
    'transito':       'Trânsito',
    'outros':         'Outros',
  };

  static const _catIcons = <String, IconData>{
    'infraestrutura': Icons.construction_rounded,
    'seguranca':      Icons.security_rounded,
    'limpeza':        Icons.cleaning_services_rounded,
    'transito':       Icons.traffic_rounded,
    'outros':         Icons.report_problem_rounded,
  };

  static const _statusMap = <String, (IconData, Color, String)>{
    'pending':     (Icons.radio_button_unchecked, Colors.orange, 'Aberta'),
    'in_progress': (Icons.autorenew_rounded,      Colors.blue,   'Em andamento'),
    'resolved':    (Icons.check_circle_outline,   Colors.green,  'Resolvida'),
  };

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'agora';
    if (diff.inMinutes < 60) return 'há ${diff.inMinutes}min';
    if (diff.inHours < 24) return 'há ${diff.inHours}h';
    if (diff.inDays < 7) return 'há ${diff.inDays}d';
    return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final type = complaint.type?.toLowerCase() ?? 'outros';
    final catColor = _catColors[type] ?? Colors.grey;
    final catLabel = _catLabels[type] ?? 'Outros';
    final catIcon = _catIcons[type] ?? Icons.report_problem_rounded;
    final (statusIcon, statusColor, statusLabel) = _statusMap[complaint.status] ?? _statusMap['pending']!;

    // Cores alinhadas com o tema do projeto
    final cardBg = isDark ? AppColors.darkSurface : Colors.white;
    final titleColor = Theme.of(context).textTheme.titleMedium?.color;
    final authorColor = Theme.of(context).textTheme.bodyLarge?.color;
    final dividerColor = isDark ? Colors.white.withValues(alpha: 0.08) : AppColors.separator;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border(left: BorderSide(color: catColor, width: 4)),
        boxShadow: isDark
            ? []
            : [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 6, offset: const Offset(0, 2))],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Top row: rank + category + status + delete ──
                Row(
                  children: [
                    if (rank != null) ...[
                      _RankBadge(rank: rank!),
                      const SizedBox(width: 8),
                    ],
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: catColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(catIcon, size: 11, color: catColor),
                          const SizedBox(width: 4),
                          Text(catLabel,
                              style: GoogleFonts.poppins(
                                  fontSize: 11, fontWeight: FontWeight.w600, color: catColor)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(statusIcon, size: 10, color: statusColor),
                          const SizedBox(width: 3),
                          Text(statusLabel,
                              style: GoogleFonts.poppins(
                                  fontSize: 10, fontWeight: FontWeight.w600, color: statusColor)),
                        ],
                      ),
                    ),
                    const Spacer(),
                    if (onDelete != null)
                      GestureDetector(
                        onTap: onDelete,
                        child: Padding(
                          padding: const EdgeInsets.only(left: 8),
                          child: Icon(Icons.delete_outline_rounded,
                              size: 18, color: Colors.red.shade400),
                        ),
                      ),
                  ],
                ),

                const SizedBox(height: 10),

                // ── Description ──
                Text(
                  complaint.description,
                  style: GoogleFonts.poppins(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: titleColor,
                      height: 1.4),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),

                // ── Address ──
                if (complaint.address != null) ...[
                  const SizedBox(height: 5),
                  Row(
                    children: [
                      const Icon(Icons.location_on_outlined, size: 13, color: AppColors.placeholder),
                      const SizedBox(width: 3),
                      Expanded(
                        child: Text(
                          complaint.address!,
                          style: GoogleFonts.poppins(fontSize: 12, color: AppColors.placeholder),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],

                const SizedBox(height: 12),
                Divider(height: 1, thickness: 1, color: dividerColor),
                const SizedBox(height: 10),

                // ── Author + date ──
                Row(
                  children: [
                    CircleAvatar(
                      radius: 13,
                      backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                      backgroundImage: (complaint.createdByPhotoUrl?.isNotEmpty ?? false)
                          ? CachedNetworkImageProvider(complaint.createdByPhotoUrl!)
                          : null,
                      child: (complaint.createdByPhotoUrl == null || complaint.createdByPhotoUrl!.isEmpty)
                          ? Icon(Icons.person_rounded, size: 14, color: AppColors.primary)
                          : null,
                    ),
                    const SizedBox(width: 7),
                    Expanded(
                      child: Text(
                        complaint.createdByName ?? 'Usuário',
                        style: GoogleFonts.poppins(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: authorColor),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      _timeAgo(complaint.createdAt),
                      style: GoogleFonts.poppins(fontSize: 11, color: AppColors.placeholder),
                    ),
                  ],
                ),

                const SizedBox(height: 10),

                // ── Engagement row ──
                Row(
                  children: [
                    _EngagementItem(
                      icon: Icons.favorite_rounded,
                      count: complaint.likesCount,
                      color: Colors.red.shade400,
                    ),
                    const SizedBox(width: 14),
                    _EngagementItem(
                      icon: Icons.visibility_rounded,
                      count: complaint.witnessCount,
                      color: Colors.blue.shade400,
                      label: 'vi isso',
                    ),
                    const SizedBox(width: 14),
                    _EngagementItem(
                      icon: Icons.chat_bubble_rounded,
                      count: complaint.commentsCount,
                      color: AppColors.primary,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Rank Badge ──────────────────────────────────────────────────────────────

class _RankBadge extends StatelessWidget {
  final int rank;
  const _RankBadge({required this.rank});

  Color get _color {
    if (rank == 1) return const Color(0xFFFFD700);
    if (rank == 2) return const Color(0xFFC0C0C0);
    if (rank == 3) return const Color(0xFFCD7F32);
    return AppColors.placeholder;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 26,
      height: 26,
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.15),
        shape: BoxShape.circle,
        border: Border.all(color: _color.withValues(alpha: 0.5), width: 1.5),
      ),
      alignment: Alignment.center,
      child: Text(
        '#$rank',
        style: GoogleFonts.poppins(fontSize: 9, fontWeight: FontWeight.w700, color: _color),
      ),
    );
  }
}

// ─── Engagement Item ─────────────────────────────────────────────────────────

class _EngagementItem extends StatelessWidget {
  final IconData icon;
  final int count;
  final Color color;
  final String? label;

  const _EngagementItem({
    required this.icon,
    required this.count,
    required this.color,
    this.label,
  });

  @override
  Widget build(BuildContext context) {
    final text = label != null ? '$count $label' : '$count';
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 4),
        Text(text,
            style: GoogleFonts.poppins(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: AppColors.placeholder)),
      ],
    );
  }
}
