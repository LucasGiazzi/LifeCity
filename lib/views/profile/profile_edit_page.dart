import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/components/network_image.dart';
import '../../core/constants/app_colors.dart';
import '../../core/state/auth_state.dart';

class ProfileEditPage extends StatefulWidget {
  const ProfileEditPage({super.key});

  @override
  State<ProfileEditPage> createState() => _ProfileEditPageState();
}

class _ProfileEditPageState extends State<ProfileEditPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _cpfController = TextEditingController();
  final _birthDateController = TextEditingController();

  File? _selectedImage;
  final ImagePicker _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  void _loadUserData() {
    final authState = Provider.of<AuthState>(context, listen: false);
    // Limpa erro de operações anteriores
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) authState.setErrorMessage(null);
    });

    final user = authState.currentUser;
    if (user != null) {
      _nameController.text = user['name'] as String? ?? '';

      final rawPhone = user['phone'] as String? ?? '';
      _phoneController.text = _applyPhoneMask(rawPhone.replaceAll(RegExp(r'\D'), ''));

      final rawCpf = user['cpf'] as String? ?? '';
      _cpfController.text = _applyCpfMask(rawCpf.replaceAll(RegExp(r'\D'), ''));

      if (user['birth_date'] != null) {
        try {
          final date = DateTime.parse(user['birth_date'] as String);
          _birthDateController.text = DateFormat('dd/MM/yyyy').format(date);
        } catch (_) {}
      }
    }
  }

  String _applyPhoneMask(String digits) {
    final buf = StringBuffer();
    for (int i = 0; i < digits.length && i < 11; i++) {
      if (i == 0) buf.write('(');
      if (i == 2) buf.write(') ');
      if (digits.length == 11 && i == 7) buf.write('-');
      if (digits.length <= 10 && i == 6) buf.write('-');
      buf.write(digits[i]);
    }
    return buf.toString();
  }

  String _applyCpfMask(String digits) {
    final buf = StringBuffer();
    for (int i = 0; i < digits.length && i < 11; i++) {
      if (i == 3 || i == 6) buf.write('.');
      if (i == 9) buf.write('-');
      buf.write(digits[i]);
    }
    return buf.toString();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _cpfController.dispose();
    _birthDateController.dispose();
    super.dispose();
  }

  Future<void> _pickImage({required ImageSource source}) async {
    try {
      final XFile? image = await _picker.pickImage(
        source: source,
        maxWidth: 800,
        maxHeight: 800,
        imageQuality: 85,
      );
      if (image != null) setState(() => _selectedImage = File(image.path));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao selecionar imagem: $e')),
        );
      }
    }
  }

  void _showImagePicker() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined),
                title: Text('Galeria', style: GoogleFonts.poppins()),
                onTap: () {
                  Navigator.pop(context);
                  _pickImage(source: ImageSource.gallery);
                },
              ),
              ListTile(
                leading: const Icon(Icons.camera_alt_outlined),
                title: Text('Câmera', style: GoogleFonts.poppins()),
                onTap: () {
                  Navigator.pop(context);
                  _pickImage(source: ImageSource.camera);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _selectBirthDate() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _birthDateController.text.isNotEmpty
          ? DateFormat('dd/MM/yyyy').parse(_birthDateController.text)
          : DateTime.now().subtract(const Duration(days: 365 * 18)),
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() =>
          _birthDateController.text = DateFormat('dd/MM/yyyy').format(picked));
    }
  }

  Future<void> _saveProfile() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final authState = Provider.of<AuthState>(context, listen: false);

    String? birthDateISO;
    if (_birthDateController.text.isNotEmpty) {
      try {
        final date = DateFormat('dd/MM/yyyy').parse(_birthDateController.text);
        birthDateISO = date.toIso8601String().split('T')[0];
      } catch (_) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Data de nascimento inválida')),
        );
        return;
      }
    }

    final phoneDigits = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    final cpfDigits = _cpfController.text.replaceAll(RegExp(r'\D'), '');

    final success = await authState.updateUser(
      name: _nameController.text.trim().isNotEmpty
          ? _nameController.text.trim()
          : null,
      phone: phoneDigits.isNotEmpty ? phoneDigits : null,
      cpf: cpfDigits.isNotEmpty ? cpfDigits : null,
      birthDate: birthDateISO,
      photoPath: _selectedImage?.path,
    );

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Perfil atualizado com sucesso!'),
          backgroundColor: AppColors.primary,
        ),
      );
      Navigator.of(context).pop();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(authState.errorMessage ?? 'Erro ao atualizar perfil'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthState>();
    final user = authState.currentUser;
    final String? photoUrl = user?['photo_url'] as String?;
    final screen = MediaQuery.of(context).size;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppColors.dark,
        body: Column(
          children: [
            // ── Header dark ──
            SafeArea(
              bottom: false,
              child: Padding(
                padding: EdgeInsets.only(
                  left: 20,
                  right: 20,
                  top: screen.height * 0.015,
                  bottom: screen.height * 0.01,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.arrow_back_ios_new_rounded,
                              color: Colors.white70, size: 16),
                          const SizedBox(width: 4),
                          Text(
                            'Voltar',
                            style: GoogleFonts.poppins(
                              color: Colors.white70,
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: screen.height * 0.02),

                    // Avatar centralizado no header
                    Center(
                      child: Stack(
                        children: [
                          Container(
                            width: 96,
                            height: 96,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                  color: AppColors.primary.withValues(alpha: 0.6),
                                  width: 2.5),
                            ),
                            child: ClipOval(
                              child: _selectedImage != null
                                  ? Image.file(_selectedImage!, fit: BoxFit.cover)
                                  : photoUrl != null && photoUrl.isNotEmpty
                                      ? NetworkImageWithLoader(photoUrl)
                                      : Container(
                                          color: AppColors.primary
                                              .withValues(alpha: 0.15),
                                          child: const Icon(Icons.person_rounded,
                                              size: 50, color: AppColors.primary),
                                        ),
                            ),
                          ),
                          Positioned(
                            bottom: 0,
                            right: 0,
                            child: GestureDetector(
                              onTap: _showImagePicker,
                              child: Container(
                                width: 30,
                                height: 30,
                                decoration: BoxDecoration(
                                  color: AppColors.primary,
                                  shape: BoxShape.circle,
                                  border:
                                      Border.all(color: Colors.white, width: 2),
                                ),
                                child: const Icon(Icons.camera_alt_rounded,
                                    color: Colors.white, size: 15),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: screen.height * 0.015),

                    Center(
                      child: Text(
                        user?['name'] as String? ?? 'Editar perfil',
                        style: GoogleFonts.poppins(
                          fontSize: screen.width * 0.055,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    Center(
                      child: Text(
                        'Atualize suas informações pessoais',
                        style: GoogleFonts.poppins(
                          fontSize: screen.width * 0.033,
                          color: Colors.white54,
                        ),
                      ),
                    ),
                    SizedBox(height: screen.height * 0.02),
                  ],
                ),
              ),
            ),

            // ── Form branco ──
            Expanded(
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(28),
                    topRight: Radius.circular(28),
                  ),
                ),
                child: Theme(
                  data: ThemeData.light().copyWith(
                    colorScheme: ThemeData.light()
                        .colorScheme
                        .copyWith(primary: AppColors.primary),
                    inputDecorationTheme: InputDecorationTheme(
                      fillColor: const Color(0xFFF5F5F5),
                      filled: true,
                      floatingLabelBehavior: FloatingLabelBehavior.never,
                      hintStyle: const TextStyle(
                          color: Color(0xFF9E9E9E), fontSize: 14),
                      border: OutlineInputBorder(
                          borderSide: BorderSide.none,
                          borderRadius: BorderRadius.circular(12)),
                      enabledBorder: OutlineInputBorder(
                          borderSide: BorderSide.none,
                          borderRadius: BorderRadius.circular(12)),
                      focusedBorder: OutlineInputBorder(
                          borderSide: const BorderSide(
                              color: AppColors.primary, width: 1.5),
                          borderRadius: BorderRadius.circular(12)),
                      errorBorder: OutlineInputBorder(
                          borderSide:
                              const BorderSide(color: Colors.red, width: 1.5),
                          borderRadius: BorderRadius.circular(12)),
                      focusedErrorBorder: OutlineInputBorder(
                          borderSide:
                              const BorderSide(color: Colors.red, width: 1.5),
                          borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 14),
                    ),
                  ),
                  child: SingleChildScrollView(
                    padding: EdgeInsets.symmetric(
                      horizontal: screen.width * 0.06,
                      vertical: screen.height * 0.03,
                    ),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _FieldLabel('Nome completo'),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _nameController,
                            textInputAction: TextInputAction.next,
                            style: GoogleFonts.poppins(
                                fontSize: 15, color: AppColors.dark),
                            decoration: const InputDecoration(
                              hintText: 'Seu nome completo',
                              prefixIcon: Icon(Icons.person_outline_rounded,
                                  color: AppColors.placeholder, size: 20),
                            ),
                            validator: (v) => (v == null || v.trim().isEmpty)
                                ? 'Informe o nome'
                                : null,
                          ),
                          const SizedBox(height: 20),

                          _FieldLabel('Telefone'),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _phoneController,
                            keyboardType: TextInputType.phone,
                            textInputAction: TextInputAction.next,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                              _PhoneFormatter(),
                            ],
                            style: GoogleFonts.poppins(
                                fontSize: 15, color: AppColors.dark),
                            decoration: const InputDecoration(
                              hintText: '(XX) XXXXX-XXXX',
                              prefixIcon: Icon(Icons.phone_outlined,
                                  color: AppColors.placeholder, size: 20),
                            ),
                          ),
                          const SizedBox(height: 20),

                          _FieldLabel('CPF'),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _cpfController,
                            keyboardType: TextInputType.number,
                            textInputAction: TextInputAction.next,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                              _CpfFormatter(),
                            ],
                            style: GoogleFonts.poppins(
                                fontSize: 15, color: AppColors.dark),
                            decoration: const InputDecoration(
                              hintText: '000.000.000-00',
                              prefixIcon: Icon(Icons.badge_outlined,
                                  color: AppColors.placeholder, size: 20),
                            ),
                          ),
                          const SizedBox(height: 20),

                          _FieldLabel('Data de nascimento'),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _birthDateController,
                            readOnly: true,
                            onTap: _selectBirthDate,
                            style: GoogleFonts.poppins(
                                fontSize: 15, color: AppColors.dark),
                            decoration: const InputDecoration(
                              hintText: 'dd/mm/aaaa',
                              prefixIcon: Icon(Icons.cake_outlined,
                                  color: AppColors.placeholder, size: 20),
                              suffixIcon: Icon(Icons.calendar_today_outlined,
                                  color: AppColors.placeholder, size: 18),
                            ),
                          ),

                          if (authState.errorMessage != null) ...[
                            const SizedBox(height: 16),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: Colors.red.shade50,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                    color: Colors.red.shade200, width: 1),
                              ),
                              child: Row(
                                children: [
                                  Icon(Icons.error_outline,
                                      color: Colors.red.shade600, size: 18),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      authState.errorMessage!,
                                      style: GoogleFonts.poppins(
                                          color: Colors.red.shade700,
                                          fontSize: 13),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],

                          const SizedBox(height: 32),

                          SizedBox(
                            height: 56,
                            child: authState.isLoading
                                ? const Center(
                                    child: CircularProgressIndicator(
                                        color: AppColors.primary))
                                : ElevatedButton(
                                    onPressed: _saveProfile,
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppColors.primary,
                                      foregroundColor: Colors.white,
                                      shape: RoundedRectangleBorder(
                                          borderRadius:
                                              BorderRadius.circular(16)),
                                      elevation: 0,
                                    ),
                                    child: Text(
                                      'Salvar alterações',
                                      style: GoogleFonts.poppins(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w600),
                                    ),
                                  ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: GoogleFonts.poppins(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: AppColors.dark,
      ),
    );
  }
}

class _PhoneFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue old, TextEditingValue next) {
    final digits = next.text.replaceAll(RegExp(r'\D'), '');
    final buf = StringBuffer();
    for (int i = 0; i < digits.length && i < 11; i++) {
      if (i == 0) buf.write('(');
      if (i == 2) buf.write(') ');
      if (digits.length == 11 && i == 7) buf.write('-');
      if (digits.length <= 10 && i == 6) buf.write('-');
      buf.write(digits[i]);
    }
    final s = buf.toString();
    return TextEditingValue(
        text: s, selection: TextSelection.collapsed(offset: s.length));
  }
}

class _CpfFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue old, TextEditingValue next) {
    final digits = next.text.replaceAll(RegExp(r'\D'), '');
    final buf = StringBuffer();
    for (int i = 0; i < digits.length && i < 11; i++) {
      if (i == 3 || i == 6) buf.write('.');
      if (i == 9) buf.write('-');
      buf.write(digits[i]);
    }
    final s = buf.toString();
    return TextEditingValue(
        text: s, selection: TextSelection.collapsed(offset: s.length));
  }
}
