import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:material_symbols_icons/symbols.dart';

import '../core/constants/app_colors.dart';
import '../core/constants/app_symbols.dart';

class ComplaintTimelineCitizenWidget extends StatelessWidget {
  final List<Map<String, dynamic>> events;
  final bool loading;

  const ComplaintTimelineCitizenWidget({
    super.key,
    required this.events,
    this.loading = false,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (events.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Text(
          'Ainda não há atualizações públicas desta ocorrência.',
          style: GoogleFonts.poppins(color: AppColors.placeholder, fontSize: 14),
          textAlign: TextAlign.center,
        ),
      );
    }

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: events.length,
      itemBuilder: (context, i) {
        final ev = events[i];
        final isLast = i == events.length - 1;
        return _TimelineTile(event: ev, isLast: isLast);
      },
    );
  }
}

class _TimelineTile extends StatelessWidget {
  final Map<String, dynamic> event;
  final bool isLast;

  const _TimelineTile({required this.event, required this.isLast});

  IconData _iconFor(String? type) {
    switch (type) {
      case 'assignment':
        return Symbols.groups;
      case 'note':
        return Symbols.sticky_note_2;
      default:
        return Symbols.timeline;
    }
  }

  @override
  Widget build(BuildContext context) {
    final label = event['label'] as String? ?? '';
    final description = event['description'] as String? ?? '';
    final createdAt = event['created_at'] as String?;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(_iconFor(event['type'] as String?), size: 16, color: AppColors.primary),
              ),
              if (!isLast)
                Expanded(
                  child: Container(width: 2, color: Colors.grey.shade300),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 14)),
                  if (description.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(description, style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey.shade700)),
                  ],
                  if (createdAt != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      _formatDate(createdAt),
                      style: GoogleFonts.poppins(fontSize: 11, color: AppColors.placeholder),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(String iso) {
    final dt = DateTime.tryParse(iso);
    if (dt == null) return iso;
    return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year} '
        '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}
