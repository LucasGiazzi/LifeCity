import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/constants/app_colors.dart';
import '../../core/models/complaint_model.dart';
import '../../core/services/complaint_service.dart';
import '../../core/state/auth_state.dart';

// ─── Public entry point ──────────────────────────────────────────────────────

void showComplaintSheet(
  BuildContext context,
  ComplaintModel complaint, {
  VoidCallback? onDeleted,
  VoidCallback? onEdited,
}) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => ComplaintSheet(
      complaint: complaint,
      onDeleted: onDeleted,
      onEdited: onEdited,
    ),
  );
}

// ─── Main sheet widget ───────────────────────────────────────────────────────

class ComplaintSheet extends StatefulWidget {
  final ComplaintModel complaint;
  final VoidCallback? onDeleted;
  final VoidCallback? onEdited;

  const ComplaintSheet({
    super.key,
    required this.complaint,
    this.onDeleted,
    this.onEdited,
  });

  @override
  State<ComplaintSheet> createState() => _ComplaintSheetState();
}

class _ComplaintSheetState extends State<ComplaintSheet> {
  static const _catMap = <String, (IconData, Color, String)>{
    'infraestrutura': (Icons.construction, Colors.orange, 'Infraestrutura'),
    'seguranca': (Icons.security, Colors.red, 'Segurança'),
    'limpeza': (Icons.cleaning_services, Colors.teal, 'Limpeza'),
    'transito': (Icons.traffic, Colors.amber, 'Trânsito'),
    'outros': (Icons.report_problem, Colors.grey, 'Outros'),
  };

  final _complaintService = ComplaintService();
  List<Map<String, dynamic>> _photos = [];
  List<Map<String, dynamic>> _comments = [];
  bool _loadingPhotos = true;
  bool _loadingComments = true;
  bool _submittingComment = false;
  int _likeCount = 0;
  bool _userLiked = false;
  bool _togglingLike = false;
  final _commentController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _likeCount = widget.complaint.likesCount;
    _loadPhotos();
    _loadComments();
    _loadLikeStatus();
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _loadPhotos() async {
    try {
      final photos = await _complaintService.getPhotos(widget.complaint.id);
      if (mounted) setState(() { _photos = photos; _loadingPhotos = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingPhotos = false);
    }
  }

  Future<void> _loadComments() async {
    try {
      final comments = await _complaintService.getComments(widget.complaint.id);
      if (mounted) setState(() { _comments = comments; _loadingComments = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingComments = false);
    }
  }

  Future<void> _submitComment() async {
    final text = _commentController.text.trim();
    if (text.isEmpty) return;
    setState(() => _submittingComment = true);
    final comment = await _complaintService.addComment(widget.complaint.id, text);
    if (!mounted) return;
    if (comment != null) {
      _commentController.clear();
      setState(() { _comments.add(comment); _submittingComment = false; });
    } else {
      setState(() => _submittingComment = false);
    }
  }

  Future<void> _loadLikeStatus() async {
    final data = await _complaintService.getLikeStatus(widget.complaint.id);
    if (!mounted || data == null) return;
    setState(() {
      _userLiked = data['liked'] == true;
      _likeCount = (data['count'] as int?) ?? _likeCount;
    });
  }

  Future<void> _toggleLike() async {
    if (_togglingLike) return;
    setState(() => _togglingLike = true);
    final data = await _complaintService.toggleLike(widget.complaint.id);
    if (!mounted) return;
    if (data != null) {
      setState(() {
        _userLiked = data['liked'] == true;
        _likeCount = (data['count'] as int?) ?? _likeCount;
      });
    }
    setState(() => _togglingLike = false);
  }

  void _openPhoto(String url) {
    showDialog(
      context: context,
      barrierColor: Colors.black87,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: EdgeInsets.zero,
        child: Stack(
          children: [
            GestureDetector(
              onTap: () => Navigator.pop(ctx),
              child: Container(color: Colors.transparent),
            ),
            Center(
              child: InteractiveViewer(
                minScale: 0.5,
                maxScale: 4,
                child: CachedNetworkImage(
                  imageUrl: url,
                  fit: BoxFit.contain,
                  placeholder: (c, s) => const CircularProgressIndicator(color: Colors.white),
                  errorWidget: (c, s, e) => const Icon(Icons.broken_image_outlined, color: Colors.white, size: 48),
                ),
              ),
            ),
            Positioned(
              top: MediaQuery.of(ctx).padding.top + 8,
              right: 12,
              child: GestureDetector(
                onTap: () => Navigator.pop(ctx),
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                  child: const Icon(Icons.close, color: Colors.white, size: 20),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openEdit(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _EditComplaintSheet(
        complaint: widget.complaint,
        onSaved: () {
          Navigator.of(context).pop(); // close detail sheet
          widget.onEdited?.call();
        },
      ),
    );
  }

  void _confirmDelete(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        title: const Text('Excluir reclamação', style: TextStyle(color: Colors.black87)),
        content: const Text('Esta ação não pode ser desfeita. Deseja continuar?', style: TextStyle(color: Colors.black54)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final nav = Navigator.of(context);
              final messenger = ScaffoldMessenger.of(context);
              final ok = await _complaintService.deleteComplaint(widget.complaint.id);
              if (!mounted) return;
              nav.pop();
              widget.onDeleted?.call();
              messenger.showSnackBar(SnackBar(
                content: Text(ok ? 'Reclamação excluída' : 'Erro ao excluir'),
                backgroundColor: ok ? Colors.green : Colors.red,
              ));
            },
            child: const Text('Excluir', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = Provider.of<AuthState>(context, listen: false);
    final isOwner = authState.currentUser != null &&
        widget.complaint.createdBy != null &&
        authState.currentUser!['id']?.toString() == widget.complaint.createdBy;
    final isLoggedIn = authState.currentUser != null;

    final catEntry = _catMap[widget.complaint.type?.toLowerCase()];
    final catColor = catEntry?.$2 ?? Colors.grey;
    final catIcon = catEntry?.$1 ?? Icons.warning;
    final firstPhotoUrl = !_loadingPhotos && _photos.isNotEmpty
        ? _photos.first['url'] as String?
        : null;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        minChildSize: 0.4,
        maxChildSize: 0.92,
        builder: (_, scrollController) => Container(
          decoration: BoxDecoration(
            color: Theme.of(context).scaffoldBackgroundColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  controller: scrollController,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _SheetCover(
                        catColor: catColor,
                        catIcon: catIcon,
                        type: widget.complaint.type,
                        firstPhotoUrl: firstPhotoUrl,
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Title row with edit button
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Text(
                                    widget.complaint.description,
                                    style: GoogleFonts.poppins(fontSize: 17, fontWeight: FontWeight.w600),
                                  ),
                                ),
                                if (isOwner)
                                  IconButton(
                                    icon: const Icon(Icons.edit_outlined, size: 20),
                                    color: AppColors.placeholder,
                                    onPressed: () => _openEdit(context),
                                    tooltip: 'Editar',
                                    visualDensity: VisualDensity.compact,
                                    padding: EdgeInsets.zero,
                                  ),
                              ],
                            ),
                            const SizedBox(height: 10),

                            // Criador
                            if (widget.complaint.createdByName != null)
                              _CreatorCard(
                                userId: widget.complaint.createdBy,
                                name: widget.complaint.createdByName!,
                                photoUrl: widget.complaint.createdByPhotoUrl,
                                currentUserId: authState.currentUser?['id']?.toString(),
                                onTap: () => Navigator.of(context, rootNavigator: true).pushNamed(
                                  '/friendProfile',
                                  arguments: {
                                    'userId': widget.complaint.createdBy ?? '',
                                    'userName': widget.complaint.createdByName!,
                                    'photoUrl': widget.complaint.createdByPhotoUrl,
                                  },
                                ),
                              ),

                            // Localização
                            if (widget.complaint.address != null)
                              _InfoRow(icon: Icons.location_on_outlined, text: widget.complaint.address!),
                            if (widget.complaint.latitude != null && widget.complaint.longitude != null)
                              _DirectionsButton(
                                lat: widget.complaint.latitude!,
                                lng: widget.complaint.longitude!,
                              ),

                            // Data (discreta)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Row(
                                children: [
                                  const Icon(Icons.calendar_today_outlined, size: 13, color: AppColors.placeholder),
                                  const SizedBox(width: 5),
                                  Text(
                                    _formatDate(widget.complaint.occurrenceDate),
                                    style: GoogleFonts.poppins(fontSize: 12, color: AppColors.placeholder),
                                  ),
                                ],
                              ),
                            ),

                            // Like button
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                GestureDetector(
                                  onTap: isLoggedIn ? _toggleLike : null,
                                  child: AnimatedContainer(
                                    duration: const Duration(milliseconds: 200),
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                    decoration: BoxDecoration(
                                      color: _userLiked
                                          ? Colors.red.withValues(alpha: 0.12)
                                          : Colors.grey.withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(20),
                                      border: Border.all(
                                        color: _userLiked ? Colors.red.shade300 : Colors.grey.shade300,
                                        width: 1,
                                      ),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        if (_togglingLike)
                                          const SizedBox(
                                            width: 16, height: 16,
                                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.red),
                                          )
                                        else
                                          Icon(
                                            _userLiked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                                            size: 18,
                                            color: _userLiked ? Colors.red : Colors.grey.shade500,
                                          ),
                                        const SizedBox(width: 6),
                                        Text(
                                          '$_likeCount ${_likeCount == 1 ? 'apoio' : 'apoios'}',
                                          style: GoogleFonts.poppins(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w500,
                                            color: _userLiked ? Colors.red : Colors.grey.shade600,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),

                            // Photos
                            if (!_loadingPhotos && _photos.isNotEmpty) ...[
                              const SizedBox(height: 16),
                              Text('Fotos', style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600)),
                              const SizedBox(height: 8),
                              SizedBox(
                                height: 110,
                                child: ListView.builder(
                                  scrollDirection: Axis.horizontal,
                                  itemCount: _photos.length,
                                  itemBuilder: (_, i) {
                                    final url = _photos[i]['url'] as String?;
                                    if (url == null) return const SizedBox.shrink();
                                    return Padding(
                                      padding: const EdgeInsets.only(right: 8),
                                      child: GestureDetector(
                                        onTap: () => _openPhoto(url),
                                        child: ClipRRect(
                                          borderRadius: BorderRadius.circular(10),
                                          child: CachedNetworkImage(
                                            imageUrl: url,
                                            width: 110,
                                            height: 110,
                                            fit: BoxFit.cover,
                                            placeholder: (c, s) => Container(
                                                width: 110, height: 110,
                                                color: Colors.grey[200],
                                                child: const Center(child: CircularProgressIndicator())),
                                            errorWidget: (c, s, e) => Container(
                                                width: 110, height: 110,
                                                color: Colors.grey[200],
                                                child: const Icon(Icons.broken_image_outlined)),
                                          ),
                                        ),
                                      ),
                                    );
                                  },
                                ),
                              ),
                            ],

                            // Comments
                            const SizedBox(height: 20),
                            const Divider(height: 1),
                            const SizedBox(height: 16),
                            Row(
                              children: [
                                Icon(Icons.chat_bubble_outline_rounded, size: 16, color: AppColors.placeholder),
                                const SizedBox(width: 6),
                                Text(
                                  'Comentários${_comments.isNotEmpty ? ' (${_comments.length})' : ''}',
                                  style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),

                            if (_loadingComments)
                              const Center(child: Padding(
                                padding: EdgeInsets.symmetric(vertical: 16),
                                child: CircularProgressIndicator(),
                              ))
                            else if (_comments.isEmpty)
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                child: Center(
                                  child: Text(
                                    'Nenhum comentário ainda.\nSeja o primeiro!',
                                    textAlign: TextAlign.center,
                                    style: GoogleFonts.poppins(fontSize: 13, color: AppColors.placeholder),
                                  ),
                                ),
                              )
                            else
                              for (final comment in _comments) _CommentItem(comment: comment, isLoggedIn: isLoggedIn),

                            // Delete
                            if (isOwner) ...[
                              const SizedBox(height: 16),
                              SizedBox(
                                width: double.infinity,
                                height: 48,
                                child: OutlinedButton.icon(
                                  onPressed: () => _confirmDelete(context),
                                  icon: const Icon(Icons.delete_outline, size: 18),
                                  label: const Text('Excluir reclamação'),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: Colors.red,
                                    side: const BorderSide(color: Colors.red),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  ),
                                ),
                              ),
                            ],
                            const SizedBox(height: 16),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              if (isLoggedIn)
                _CommentInputBar(
                  controller: _commentController,
                  isSubmitting: _submittingComment,
                  onSubmit: _submitComment,
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
}

// ─── Edit Sheet ──────────────────────────────────────────────────────────────

class _EditComplaintSheet extends StatefulWidget {
  final ComplaintModel complaint;
  final VoidCallback onSaved;

  const _EditComplaintSheet({required this.complaint, required this.onSaved});

  @override
  State<_EditComplaintSheet> createState() => _EditComplaintSheetState();
}

class _EditComplaintSheetState extends State<_EditComplaintSheet> {
  static const _categories = [
    ('infraestrutura', 'Infraestrutura', Icons.construction, Colors.orange),
    ('seguranca', 'Segurança', Icons.security, Colors.red),
    ('limpeza', 'Limpeza', Icons.cleaning_services, Colors.teal),
    ('transito', 'Trânsito', Icons.traffic, Colors.amber),
    ('outros', 'Outros', Icons.report_problem, Colors.grey),
  ];

  final _complaintService = ComplaintService();
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _descController;
  late final TextEditingController _addressController;
  late String? _selectedType;
  late DateTime _selectedDate;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _descController = TextEditingController(text: widget.complaint.description);
    _addressController = TextEditingController(text: widget.complaint.address ?? '');
    _selectedType = widget.complaint.type?.toLowerCase();
    _selectedDate = widget.complaint.occurrenceDate;
  }

  @override
  void dispose() {
    _descController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2000),
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _selectedDate = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);

    final dateStr =
        '${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}';

    final ok = await _complaintService.editComplaint(
      complaintId: widget.complaint.id,
      description: _descController.text.trim(),
      occurrenceDate: dateStr,
      type: _selectedType,
      address: _addressController.text.trim().isEmpty ? null : _addressController.text.trim(),
    );

    if (!mounted) return;
    setState(() => _saving = false);

    if (ok) {
      widget.onSaved();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Erro ao salvar'), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Handle
              Center(
                child: Container(
                  width: 40, height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              Text('Editar reclamação',
                  style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600)),
              const SizedBox(height: 16),

              // Descrição
              TextFormField(
                controller: _descController,
                minLines: 2,
                maxLines: 4,
                style: const TextStyle(color: Colors.black87),
                decoration: _inputDecoration('Descrição'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Campo obrigatório' : null,
              ),
              const SizedBox(height: 12),

              // Categoria
              DropdownButtonFormField<String>(
                initialValue: _selectedType,
                style: const TextStyle(color: Colors.black87),
                decoration: _inputDecoration('Categoria'),
                items: _categories
                    .map((c) => DropdownMenuItem(
                          value: c.$1,
                          child: Row(children: [
                            Icon(c.$3, size: 16, color: c.$4),
                            const SizedBox(width: 8),
                            Text(c.$2,
                                style: const TextStyle(color: Colors.black87)),
                          ]),
                        ))
                    .toList(),
                onChanged: (v) => setState(() => _selectedType = v),
              ),
              const SizedBox(height: 12),

              // Endereço
              TextFormField(
                controller: _addressController,
                style: const TextStyle(color: Colors.black87),
                decoration: _inputDecoration('Endereço (opcional)'),
              ),
              const SizedBox(height: 12),

              // Data
              GestureDetector(
                onTap: _pickDate,
                child: AbsorbPointer(
                  child: TextFormField(
                    style: const TextStyle(color: Colors.black87),
                    controller: TextEditingController(
                      text:
                          '${_selectedDate.day.toString().padLeft(2, '0')}/${_selectedDate.month.toString().padLeft(2, '0')}/${_selectedDate.year}',
                    ),
                    decoration: _inputDecoration('Data de ocorrência')
                        .copyWith(suffixIcon: const Icon(Icons.calendar_today_outlined, size: 18)),
                  ),
                ),
              ),
              const SizedBox(height: 20),

              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: _saving ? null : _save,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _saving
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : Text('Salvar', style: GoogleFonts.poppins(color: Colors.white, fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String label) => InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: Colors.grey.shade600),
        filled: true,
        fillColor: Colors.grey.shade100,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.primary, width: 1.5),
        ),
      );
}

// ─── Cover Header ────────────────────────────────────────────────────────────

class _SheetCover extends StatelessWidget {
  final Color catColor;
  final IconData catIcon;
  final String? type;
  final String? firstPhotoUrl;

  const _SheetCover({
    required this.catColor,
    required this.catIcon,
    this.type,
    this.firstPhotoUrl,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 180,
      width: double.infinity,
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (firstPhotoUrl != null)
              CachedNetworkImage(
                imageUrl: firstPhotoUrl!,
                fit: BoxFit.cover,
                placeholder: (_, __) => _CoverGradient(color: catColor, icon: catIcon),
                errorWidget: (_, __, ___) => _CoverGradient(color: catColor, icon: catIcon),
              )
            else
              _CoverGradient(color: catColor, icon: catIcon),
            if (firstPhotoUrl != null)
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Colors.black.withValues(alpha: 0.55)],
                  ),
                ),
              ),
            Positioned(
              top: 10, left: 0, right: 0,
              child: Center(
                child: Container(
                  width: 40, height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            ),
            if (type != null)
              Positioned(
                left: 16, bottom: 14,
                child: _TypePill(type: type!, bright: true),
              ),
          ],
        ),
      ),
    );
  }
}

class _CoverGradient extends StatelessWidget {
  final Color color;
  final IconData icon;
  const _CoverGradient({required this.color, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color.withValues(alpha: 0.85), color.withValues(alpha: 0.45)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(child: Icon(icon, size: 120, color: Colors.white.withValues(alpha: 0.15))),
    );
  }
}

// ─── Comment Input ───────────────────────────────────────────────────────────

class _CommentInputBar extends StatelessWidget {
  final TextEditingController controller;
  final bool isSubmitting;
  final VoidCallback onSubmit;

  const _CommentInputBar({required this.controller, required this.isSubmitting, required this.onSubmit});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        border: Border(top: BorderSide(color: Colors.grey.shade200)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                minLines: 1,
                maxLines: 3,
                textCapitalization: TextCapitalization.sentences,
                style: GoogleFonts.poppins(fontSize: 14, color: Colors.black87),
                decoration: InputDecoration(
                  hintText: 'Escreva um comentário...',
                  hintStyle: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade500),
                  filled: true,
                  fillColor: Colors.grey.shade200,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            if (isSubmitting)
              const SizedBox(width: 40, height: 40,
                  child: Padding(padding: EdgeInsets.all(8),
                      child: CircularProgressIndicator(strokeWidth: 2)))
            else
              Material(
                color: AppColors.primary,
                shape: const CircleBorder(),
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: onSubmit,
                  child: const SizedBox(width: 40, height: 40,
                      child: Icon(Icons.send_rounded, color: Colors.white, size: 18)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ─── Comment Item ────────────────────────────────────────────────────────────

class _CommentItem extends StatefulWidget {
  final Map<String, dynamic> comment;
  final bool isLoggedIn;
  const _CommentItem({required this.comment, required this.isLoggedIn});

  @override
  State<_CommentItem> createState() => _CommentItemState();
}

class _CommentItemState extends State<_CommentItem> {
  final _service = ComplaintService();
  late int _likeCount;
  late bool _liked;
  bool _toggling = false;

  @override
  void initState() {
    super.initState();
    _likeCount = (widget.comment['likes_count'] as int?) ?? 0;
    _liked = (widget.comment['liked_by_me'] as bool?) ?? false;
  }

  Future<void> _toggle() async {
    if (_toggling) return;
    setState(() => _toggling = true);
    final complaintId = widget.comment['complaint_id']?.toString() ?? '';
    final commentId = widget.comment['id']?.toString() ?? '';
    final data = await _service.toggleCommentLike(complaintId, commentId);
    if (!mounted) return;
    if (data != null) {
      setState(() {
        _liked = data['liked'] == true;
        _likeCount = (data['count'] as int?) ?? _likeCount;
      });
    }
    setState(() => _toggling = false);
  }

  @override
  Widget build(BuildContext context) {
    final userName = widget.comment['user_name'] as String? ?? 'Usuário';
    final text = widget.comment['text'] as String? ?? '';
    final photoUrl = widget.comment['user_photo'] as String?;
    final createdAt = widget.comment['created_at'] as String?;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: Colors.grey.shade200,
            backgroundImage: photoUrl != null && photoUrl.isNotEmpty
                ? CachedNetworkImageProvider(photoUrl)
                : null,
            child: photoUrl == null || photoUrl.isEmpty
                ? Icon(Icons.person, size: 18, color: Colors.grey.shade500)
                : null,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: GestureDetector(
              onDoubleTap: widget.isLoggedIn && !_liked ? _toggle : null,
              child: Container(
              padding: const EdgeInsets.fromLTRB(12, 10, 6, 8),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: const BorderRadius.only(
                  topRight: Radius.circular(14),
                  bottomLeft: Radius.circular(14),
                  bottomRight: Radius.circular(14),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(userName, style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(text, style: GoogleFonts.poppins(fontSize: 13)),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      if (createdAt != null)
                        Text(
                          _formatDate(createdAt),
                          style: GoogleFonts.poppins(fontSize: 10, color: AppColors.placeholder),
                        ),
                      const Spacer(),
                      // Like button
                      GestureDetector(
                        onTap: widget.isLoggedIn ? _toggle : null,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (_toggling)
                              const SizedBox(
                                width: 14, height: 14,
                                child: CircularProgressIndicator(strokeWidth: 1.5, color: Colors.red),
                              )
                            else
                              Icon(
                                _liked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                                size: 14,
                                color: _liked ? Colors.red : Colors.grey.shade400,
                              ),
                            if (_likeCount > 0) ...[
                              const SizedBox(width: 3),
                              Text(
                                '$_likeCount',
                                style: GoogleFonts.poppins(
                                  fontSize: 11,
                                  color: _liked ? Colors.red : Colors.grey.shade500,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 6),
                    ],
                  ),
                ],
              ),
            ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(String iso) {
    try {
      final d = DateTime.parse(iso).toLocal();
      return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
    } catch (_) {
      return '';
    }
  }
}

// ─── Type Pill ───────────────────────────────────────────────────────────────

class _TypePill extends StatelessWidget {
  final String type;
  final bool bright;
  const _TypePill({required this.type, this.bright = false});

  static const _map = {
    'infraestrutura': (Icons.construction, Colors.orange, 'Infraestrutura'),
    'seguranca': (Icons.security, Colors.red, 'Segurança'),
    'limpeza': (Icons.cleaning_services, Colors.teal, 'Limpeza'),
    'transito': (Icons.traffic, Colors.amber, 'Trânsito'),
    'outros': (Icons.report_problem, Colors.grey, 'Outros'),
  };

  @override
  Widget build(BuildContext context) {
    final entry = _map[type.toLowerCase()];
    final icon = entry?.$1 ?? Icons.category;
    final color = entry?.$2 ?? Colors.grey;
    final label = entry?.$3 ?? type;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bright ? Colors.white.withValues(alpha: 0.9) : color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 5),
          Text(label, style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: color)),
        ],
      ),
    );
  }
}

// ─── Directions Button ───────────────────────────────────────────────────────

class _DirectionsButton extends StatelessWidget {
  final double lat;
  final double lng;
  const _DirectionsButton({required this.lat, required this.lng});

  Future<void> _open() async {
    final uri = Platform.isIOS
        ? Uri.parse('https://maps.apple.com/?ll=$lat,$lng&dirflg=d')
        : Uri.parse('geo:$lat,$lng?q=$lat,$lng');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      final fallback = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng');
      await launchUrl(fallback, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GestureDetector(
        onTap: _open,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.navigation_rounded, size: 15, color: AppColors.primary),
              const SizedBox(width: 6),
              Text(
                'Como chegar',
                style: GoogleFonts.poppins(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Creator Card ────────────────────────────────────────────────────────────

class _CreatorCard extends StatelessWidget {
  final String? userId;
  final String name;
  final String? photoUrl;
  final String? currentUserId;
  final VoidCallback onTap;

  const _CreatorCard({
    required this.userId,
    required this.name,
    required this.photoUrl,
    required this.currentUserId,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isMe = userId != null && userId == currentUserId;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        decoration: BoxDecoration(
          color: Theme.of(context).brightness == Brightness.dark
              ? AppColors.darkSurface
              : AppColors.coloredBackground,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            onTap: isMe ? null : onTap,
            borderRadius: BorderRadius.circular(12),
            child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                  child: (photoUrl != null && photoUrl!.isNotEmpty)
                      ? ClipOval(
                          child: CachedNetworkImage(
                            imageUrl: photoUrl!,
                            width: 36,
                            height: 36,
                            fit: BoxFit.cover,
                          ),
                        )
                      : Text(
                          name[0].toUpperCase(),
                          style: GoogleFonts.poppins(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary,
                          ),
                        ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: GoogleFonts.poppins(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        isMe ? 'Você' : 'Autor da reclamação',
                        style: GoogleFonts.poppins(
                          fontSize: 11,
                          color: AppColors.placeholder,
                        ),
                      ),
                    ],
                  ),
                ),
                if (!isMe)
                  const Icon(Icons.chevron_right_rounded,
                      color: AppColors.placeholder, size: 18),
              ],
            ),
          ),
        ),
      ),
    ),
  );
  }
}

// ─── Info Row ────────────────────────────────────────────────────────────────

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String text;
  const _InfoRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: AppColors.placeholder),
          const SizedBox(width: 6),
          Expanded(
            child: Text(text,
                style: GoogleFonts.poppins(
                  fontSize: 13,
                  color: Theme.of(context).textTheme.bodyMedium?.color,
                )),
          ),
        ],
      ),
    );
  }
}
