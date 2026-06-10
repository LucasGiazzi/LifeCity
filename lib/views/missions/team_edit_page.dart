import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/components/app_back_button.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_symbols.dart';
import '../../core/services/mission_service.dart';

class TeamEditPage extends StatefulWidget {
  final String teamId;
  final String initialName;
  final String? initialDescription;
  final String? initialPhotoUrl;

  const TeamEditPage({
    super.key,
    required this.teamId,
    required this.initialName,
    this.initialDescription,
    this.initialPhotoUrl,
  });

  @override
  State<TeamEditPage> createState() => _TeamEditPageState();
}

class _TeamEditPageState extends State<TeamEditPage> {
  final _formKey = GlobalKey<FormState>();
  final MissionService _service = MissionService();
  final ImagePicker _picker = ImagePicker();

  late final TextEditingController _nameController;
  late final TextEditingController _descriptionController;

  File? _selectedImage;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.initialName);
    _descriptionController =
        TextEditingController(text: widget.initialDescription ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Symbols.photo_camera),
              title: Text('Câmera', style: GoogleFonts.poppins()),
              onTap: () async {
                Navigator.pop(ctx);
                final img = await _picker.pickImage(
                  source: ImageSource.camera,
                  maxWidth: 800,
                  maxHeight: 800,
                  imageQuality: 85,
                );
                if (img != null && mounted) {
                  setState(() => _selectedImage = File(img.path));
                }
              },
            ),
            ListTile(
              leading: const Icon(Symbols.photo_library),
              title: Text('Galeria', style: GoogleFonts.poppins()),
              onTap: () async {
                Navigator.pop(ctx);
                final img = await _picker.pickImage(
                  source: ImageSource.gallery,
                  maxWidth: 800,
                  maxHeight: 800,
                  imageQuality: 85,
                );
                if (img != null && mounted) {
                  setState(() => _selectedImage = File(img.path));
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSaving = true);

    final updated = await _service.editTeam(
      widget.teamId,
      name: _nameController.text.trim(),
      description: _descriptionController.text.trim().isEmpty
          ? null
          : _descriptionController.text.trim(),
      photoPath: _selectedImage?.path,
    );

    if (!mounted) return;
    setState(() => _isSaving = false);

    if (updated != null) {
      Navigator.pop(context, updated);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Erro ao salvar. Tente novamente.'),
        backgroundColor: Colors.red,
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const AppBackButton(),
        title: Text('Editar Equipe',
            style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            // ── Foto ──────────────────────────────────────────────────────
            Center(
              child: GestureDetector(
                onTap: _pickImage,
                child: Stack(
                  children: [
                    CircleAvatar(
                      radius: 56,
                      backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                      backgroundImage: _selectedImage != null
                          ? FileImage(_selectedImage!)
                          : (widget.initialPhotoUrl != null
                              ? NetworkImage(widget.initialPhotoUrl!)
                              : null) as ImageProvider?,
                      child: (_selectedImage == null &&
                              widget.initialPhotoUrl == null)
                          ? const Icon(Symbols.groups,
                              size: 48, color: AppColors.primary)
                          : null,
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: const BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(AppSymbols.edit,
                            size: 16, color: Colors.white),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),

            // ── Nome ──────────────────────────────────────────────────────
            Text('Nome',
                style: GoogleFonts.poppins(
                    fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            TextFormField(
              controller: _nameController,
              textCapitalization: TextCapitalization.words,
              style: GoogleFonts.poppins(),
              decoration: InputDecoration(
                hintText: 'Nome da equipe',
                hintStyle: GoogleFonts.poppins(color: AppColors.placeholder),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 14),
              ),
              validator: (v) {
                if (v == null || v.trim().isEmpty) {
                  return 'O nome é obrigatório.';
                }
                if (v.trim().length > 100) {
                  return 'Máximo de 100 caracteres.';
                }
                return null;
              },
            ),
            const SizedBox(height: 24),

            // ── Descrição ─────────────────────────────────────────────────
            Text('Descrição',
                style: GoogleFonts.poppins(
                    fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            TextFormField(
              controller: _descriptionController,
              maxLines: 4,
              textCapitalization: TextCapitalization.sentences,
              style: GoogleFonts.poppins(),
              decoration: InputDecoration(
                hintText: 'Fale um pouco sobre a equipe (opcional)',
                hintStyle: GoogleFonts.poppins(color: AppColors.placeholder),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 14),
              ),
            ),
            const SizedBox(height: 40),

            // ── Salvar ────────────────────────────────────────────────────
            SizedBox(
              height: 52,
              child: FilledButton(
                onPressed: _isSaving ? null : _save,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                child: _isSaving
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : Text('Salvar',
                        style: GoogleFonts.poppins(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Colors.white)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
