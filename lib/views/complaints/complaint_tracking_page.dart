import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import 'package:material_symbols_icons/symbols.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/municipal_complaint_status.dart';
import '../../core/services/complaint_service.dart';
import '../../core/state/auth_state.dart';
import '../../widgets/complaint_chat_section.dart';
import '../../widgets/complaint_timeline_citizen.dart';

class ComplaintTrackingPage extends StatefulWidget {
  final String complaintId;
  final bool openChat;

  const ComplaintTrackingPage({
    super.key,
    required this.complaintId,
    this.openChat = false,
  });

  @override
  State<ComplaintTrackingPage> createState() => _ComplaintTrackingPageState();
}

class _ComplaintTrackingPageState extends State<ComplaintTrackingPage> {
  final _service = ComplaintService();
  final _chatKey = GlobalKey<ComplaintChatSectionState>();
  final _scrollController = ScrollController();
  Map<String, dynamic>? _detail;
  List<Map<String, dynamic>> _events = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final detail = await _service.getComplaintById(widget.complaintId);
    final timeline = await _service.getComplaintTimeline(widget.complaintId);
    if (mounted) {
      setState(() {
        _detail = detail?['complaint'] as Map<String, dynamic>?;
        _events = timeline;
        _loading = false;
      });
      if (widget.openChat) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToChat());
      }
    }
  }

  void _scrollToChat() {
    _chatKey.currentState?.scrollToChat();
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeOut,
      );
    }
  }

  bool _isAuthor(bool isLoggedIn) {
    if (!isLoggedIn || _detail == null) return false;
    final auth = context.read<AuthState>();
    final createdBy = _detail!['created_by'] as String?;
    return createdBy != null && createdBy == auth.currentUser?['id'];
  }

  @override
  Widget build(BuildContext context) {
    final isLoggedIn = context.watch<AuthState>().isAuthenticated;
    final isAuthor = _isAuthor(isLoggedIn);

    return Scaffold(
      appBar: AppBar(
        title: Text('Acompanhar ocorrência', style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _detail == null
              ? Center(child: Text('Ocorrência não encontrada.', style: GoogleFonts.poppins()))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    children: [
                      _StatusHeader(detail: _detail!),
                      const SizedBox(height: 16),
                      if (_detail!['assigned_ops_team'] != null) ...[
                        _TeamCard(team: _detail!['assigned_ops_team'] as Map<String, dynamic>),
                        const SizedBox(height: 16),
                      ],
                      Text('Histórico', style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 8),
                      ComplaintTimelineCitizenWidget(events: _events),
                      const SizedBox(height: 16),
                      ComplaintChatSection(
                        key: _chatKey,
                        complaintId: widget.complaintId,
                        isAuthor: isAuthor,
                      ),
                    ],
                  ),
                ),
    );
  }
}

class _StatusHeader extends StatelessWidget {
  final Map<String, dynamic> detail;

  const _StatusHeader({required this.detail});

  @override
  Widget build(BuildContext context) {
    final status = detail['status'] as String? ?? 'pending';
    final entry = MunicipalComplaintStatus.entryFor(status);
    final slaState = detail['sla_state'] as String?;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: entry.$2.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: entry.$2.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(entry.$1, color: entry.$2),
              const SizedBox(width: 8),
              Text(entry.$3, style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w600, color: entry.$2)),
              if (slaState != null && slaState != 'ok') ...[
                const Spacer(),
                _SlaChip(state: slaState),
              ],
            ],
          ),
          const SizedBox(height: 8),
          Text(
            detail['description'] as String? ?? '',
            style: GoogleFonts.poppins(fontSize: 14),
          ),
        ],
      ),
    );
  }
}

class _SlaChip extends StatelessWidget {
  final String state;
  const _SlaChip({required this.state});

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (state) {
      'at_risk' => ('SLA em risco', Colors.orange),
      'breached' => ('SLA estourado', Colors.red),
      _ => ('SLA OK', Colors.green),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)),
      child: Text(label, style: GoogleFonts.poppins(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
    );
  }
}

class _TeamCard extends StatelessWidget {
  final Map<String, dynamic> team;
  const _TeamCard({required this.team});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            const Icon(Symbols.groups, color: AppColors.primary),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Equipe responsável', style: GoogleFonts.poppins(fontSize: 12, color: AppColors.placeholder)),
                  Text(team['name'] as String? ?? '', style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
