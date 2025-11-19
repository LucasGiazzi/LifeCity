import 'package:flutter/material.dart';
import '../../../core/constants/constants.dart';
import './components/profile_menu_options.dart';
import 'package:provider/provider.dart';
import '../../core/state/auth_state.dart';


class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthState>();
    final userName = authState.currentUser?['name'] as String? ?? 'Usuário';
    final user = authState.currentUser;
    final photoUrl = user?['photo_url'] as String?;


    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            children: [
              // 🔹 Cabeçalho do perfil
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppDefaults.padding),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF00B37E), Color(0xFF00A36C)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 20),
                    CircleAvatar(
                      radius: 40,
                      backgroundColor: Colors.white,
                      backgroundImage: (photoUrl != null && photoUrl.isNotEmpty)
                          ? NetworkImage(photoUrl)
                          : null,
                      child: (photoUrl == null || photoUrl.isEmpty)
                          ? const Icon(Icons.person, size: 50, color: Colors.grey)
                          : null,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      userName,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                    const SizedBox(height: 10),
                  ],
                ),
              ),

              // 🔹 Menu de opções
              const ProfileMenuOptions(),

              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }
}
