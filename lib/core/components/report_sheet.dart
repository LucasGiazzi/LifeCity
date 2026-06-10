import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../constants/app_colors.dart';
import '../constants/app_symbols.dart';
import '../services/report_service.dart';

// ─── Entry points ─────────────────────────────────────────────────────────────

void showReportComplaintSheet(BuildContext context, String complaintId) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _ReportSheet(
      targetType: 'complaint',
      targetId: complaintId,
      title: 'Denunciar publicação',
      reasons: _complaintReasons,
    ),
  );
}

void showReportUserSheet(BuildContext context, String userId, String userName) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _ReportSheet(
      targetType: 'user',
      targetId: userId,
      title: 'Denunciar $userName',
      reasons: _userReasons,
    ),
  );
}

// ─── Motivos ──────────────────────────────────────────────────────────────────

const _complaintReasons = [
  (value: 'false_info',      label: 'Informação falsa ou enganosa',  icon: AppSymbols.error),
  (value: 'wrong_location',  label: 'Localização incorreta',         icon: AppSymbols.locationOn),
  (value: 'offensive',       label: 'Conteúdo ofensivo',             icon: AppSymbols.warning),
  (value: 'spam',            label: 'Spam',                          icon: AppSymbols.close),
  (value: 'duplicate',       label: 'Duplicata',                     icon: Symbols.content_copy),
];

const _userReasons = [
  (value: 'abusive_behavior',         label: 'Comportamento abusivo',              icon: AppSymbols.warning),
  (value: 'fake_account',             label: 'Conta falsa ou suspeita',            icon: AppSymbols.person),
  (value: 'spam',                     label: 'Spam',                               icon: AppSymbols.close),
  (value: 'systematic_false_info',    label: 'Publicações falsas sistemáticas',    icon: AppSymbols.error),
];

// ─── Sheet widget ─────────────────────────────────────────────────────────────

class _ReportSheet extends StatefulWidget {
  final String targetType;
  final String targetId;
  final String title;
  final List<({String value, String label, IconData icon})> reasons;

  const _ReportSheet({
    required this.targetType,
    required this.targetId,
    required this.title,
    required this.reasons,
  });

  @override
  State<_ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends State<_ReportSheet> {
  String? _selected;
  bool _isLoading = false;
  final _service = ReportService();

  Future<void> _submit() async {
    if (_selected == null) return;
    setState(() => _isLoading = true);

    final result = await _service.submitReport(
      targetType: widget.targetType,
      targetId: widget.targetId,
      reason: _selected!,
    );

    if (!mounted) return;
    Navigator.pop(context);

    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(
        result.success
            ? 'Denúncia enviada. Obrigado por ajudar a manter a comunidade!'
            : (result.error ?? 'Erro ao enviar denúncia.'),
      ),
      backgroundColor: result.success ? AppColors.primary : Colors.red,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: AppColors.dark,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                const Icon(AppSymbols.flag, color: Colors.red, size: 22),
                const SizedBox(width: 10),
                Text(
                  widget.title,
                  style: GoogleFonts.poppins(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.white),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Selecione o motivo da denúncia',
              style: GoogleFonts.poppins(
                  fontSize: 13, color: Colors.white54),
            ),
            const SizedBox(height: 16),
            ...widget.reasons.map((r) => _ReasonTile(
                  reason: r,
                  selected: _selected == r.value,
                  onTap: () => setState(() => _selected = r.value),
                )),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: _isLoading
                  ? const Center(
                      child: CircularProgressIndicator(color: AppColors.primary))
                  : ElevatedButton(
                      onPressed: _selected != null ? _submit : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red,
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: Colors.grey.shade200,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14)),
                        elevation: 0,
                      ),
                      child: Text(
                        'Enviar denúncia',
                        style: GoogleFonts.poppins(
                            fontSize: 15, fontWeight: FontWeight.w600),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReasonTile extends StatelessWidget {
  final ({String value, String label, IconData icon}) reason;
  final bool selected;
  final VoidCallback onTap;

  const _ReasonTile({
    required this.reason,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: selected
              ? Colors.red.withValues(alpha: 0.15)
              : Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? Colors.red.shade300 : Colors.white.withValues(alpha: 0.1),
            width: 1.5,
          ),
        ),
        child: Row(
          children: [
            Icon(
              reason.icon,
              size: 20,
              color: selected ? Colors.red : Colors.white60,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                reason.label,
                style: GoogleFonts.poppins(
                  fontSize: 14,
                  fontWeight:
                      selected ? FontWeight.w600 : FontWeight.normal,
                  color: selected ? Colors.red.shade300 : Colors.white,
                ),
              ),
            ),
            if (selected)
              const Icon(AppSymbols.checkCircle,
                  color: Colors.red, size: 18, fill: 1.0),
          ],
        ),
      ),
    );
  }
}
