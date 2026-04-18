import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/constants/app_colors.dart';
import '../../core/routes/app_routes.dart';
import 'data/onboarding_data.dart';
import 'data/onboarding_model.dart';

class OnboardingPage extends StatefulWidget {
  const OnboardingPage({super.key});

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  int currentPage = 0;
  late PageController controller;
  final List<OnboardingModel> items = OnboardingData.items;

  @override
  void initState() {
    super.initState();
    controller = PageController();
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  void _nextPage() {
    if (currentPage < items.length - 1) {
      controller.nextPage(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOutCubic,
      );
    } else {
      _goToLogin();
    }
  }

  void _goToLogin() {
    Navigator.pushReplacementNamed(context, AppRoutes.introLogin);
  }

  @override
  Widget build(BuildContext context) {
    final isLast = currentPage == items.length - 1;

    return Scaffold(
      backgroundColor: AppColors.dark,
      body: Stack(
        children: [
          // Gradiente de fundo
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF1A1A2E), Color(0xFF0F2D20)],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
          ),

          SafeArea(
            child: Column(
              children: [
                // Botão "Pular" no topo
                Align(
                  alignment: Alignment.topRight,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    child: TextButton(
                      onPressed: _goToLogin,
                      child: Text(
                        'Pular',
                        style: GoogleFonts.poppins(
                          color: Colors.white54,
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
                ),

                // PageView de slides
                Expanded(
                  child: PageView.builder(
                    controller: controller,
                    itemCount: items.length,
                    onPageChanged: (i) => setState(() => currentPage = i),
                    itemBuilder: (context, index) =>
                        _OnboardingSlide(data: items[index]),
                  ),
                ),

                // Dots + botão
                Padding(
                  padding: const EdgeInsets.fromLTRB(32, 16, 32, 40),
                  child: Column(
                    children: [
                      // Dots indicadores
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(
                          items.length,
                          (i) => AnimatedContainer(
                            duration: const Duration(milliseconds: 300),
                            margin: const EdgeInsets.symmetric(horizontal: 4),
                            width: i == currentPage ? 28 : 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: i == currentPage
                                  ? AppColors.primary
                                  : Colors.white24,
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 32),

                      // Botão principal
                      SizedBox(
                        width: double.infinity,
                        height: 56,
                        child: ElevatedButton(
                          onPressed: _nextPage,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                            elevation: 0,
                          ),
                          child: AnimatedSwitcher(
                            duration: const Duration(milliseconds: 250),
                            child: Text(
                              isLast ? 'Começar' : 'Continuar',
                              key: ValueKey(isLast),
                              style: GoogleFonts.poppins(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OnboardingSlide extends StatelessWidget {
  final OnboardingModel data;

  const _OnboardingSlide({required this.data});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Imagem — usa o espaço disponível sem fixar altura
          Flexible(
            flex: 5,
            child: Center(
              child: AspectRatio(
                aspectRatio: 1,
                child: _buildImage(data.imageUrl),
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Headline bold e grande
          Text(
            data.headline,
            style: GoogleFonts.poppins(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              height: 1.2,
            ),
          ),
          const SizedBox(height: 12),

          // Descrição
          Text(
            data.description,
            style: GoogleFonts.poppins(
              fontSize: 14,
              fontWeight: FontWeight.w400,
              color: Colors.white60,
              height: 1.6,
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _buildImage(String path) {
    if (path.startsWith('http')) {
      return Image.network(path, fit: BoxFit.contain);
    }
    return Image.asset(path, fit: BoxFit.contain);
  }
}
