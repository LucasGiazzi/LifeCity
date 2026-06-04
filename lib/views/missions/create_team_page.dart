import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/components/app_back_button.dart';
import '../../core/constants/app_colors.dart';
import '../../core/routes/app_routes.dart';
import '../../core/services/mission_service.dart';

class CreateTeamPage extends StatefulWidget {
  const CreateTeamPage({super.key});

  @override
  State<CreateTeamPage> createState() => _CreateTeamPageState();
}

class _CreateTeamPageState extends State<CreateTeamPage> {
  final MissionService _service = MissionService();
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);

    final team = await _service.createTeam(_nameController.text.trim());

    if (!mounted) return;
    setState(() => _isLoading = false);

    if (team != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: const Text('Equipe criada! Convide seus amigos.'),
        backgroundColor: AppColors.primary,
      ));
      // Navega para o detalhe da equipe e remove esta página da pilha
      Navigator.pushReplacementNamed(context, AppRoutes.teamDetail,
          arguments: team.id);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Erro ao criar equipe. Tente novamente.'),
        backgroundColor: Colors.red,
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const AppBackButton(),
        title: Text('Nova equipe',
            style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Crie sua equipe e convide amigos para completar missões semanais juntos.',
                style: GoogleFonts.poppins(
                    fontSize: 13, color: AppColors.placeholder),
              ),
              const SizedBox(height: 28),
              Text('Nome da equipe',
                  style: GoogleFonts.poppins(
                      fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              TextFormField(
                controller: _nameController,
                autofocus: true,
                textCapitalization: TextCapitalization.words,
                decoration: InputDecoration(
                  hintText: 'Ex: Fiscais do Centro',
                  hintStyle: GoogleFonts.poppins(color: AppColors.placeholder),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 14),
                ),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) {
                    return 'Informe um nome para a equipe';
                  }
                  if (v.trim().length > 100) {
                    return 'Nome muito longo (máximo 100 caracteres)';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 8),
              Text(
                'Equipes podem ter de 2 a 7 membros. Você poderá convidar amigos após criar.',
                style: GoogleFonts.poppins(
                    fontSize: 11, color: AppColors.placeholder),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2),
                        )
                      : Text('Criar equipe',
                          style: GoogleFonts.poppins(
                              fontSize: 15,
                              color: Colors.white,
                              fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
