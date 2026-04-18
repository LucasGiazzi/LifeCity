import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import 'components/sign_up_form.dart';

class SignUpPage extends StatelessWidget {
  const SignUpPage({super.key});

  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.of(context).size;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFF1A1A2E),
        body: Column(
          children: [
            // ── Header compacto ──
            SafeArea(
              bottom: false,
              child: Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: screen.width * 0.06,
                  vertical: screen.height * 0.015,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Botão voltar
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

                    Text(
                      'Criar sua conta',
                      style: GoogleFonts.poppins(
                        fontSize: screen.width * 0.07,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        height: 1.1,
                      ),
                    ),
                    SizedBox(height: screen.height * 0.006),
                    Text(
                      'Preencha os dados abaixo para começar.',
                      style: GoogleFonts.poppins(
                        fontSize: screen.width * 0.035,
                        color: Colors.white54,
                      ),
                    ),
                    SizedBox(height: screen.height * 0.025),
                  ],
                ),
              ),
            ),

            // ── Área do formulário ──
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
                    colorScheme: ThemeData.light().colorScheme.copyWith(primary: const Color(0xFF00C896)),
                    inputDecorationTheme: InputDecorationTheme(
                      fillColor: const Color(0xFFF5F5F5),
                      filled: true,
                      floatingLabelBehavior: FloatingLabelBehavior.never,
                      hintStyle: const TextStyle(color: Color(0xFF9E9E9E), fontSize: 14),
                      border: OutlineInputBorder(borderSide: BorderSide.none, borderRadius: BorderRadius.circular(12)),
                      enabledBorder: OutlineInputBorder(borderSide: BorderSide.none, borderRadius: BorderRadius.circular(12)),
                      focusedBorder: OutlineInputBorder(borderSide: const BorderSide(color: Color(0xFF00C896), width: 1.5), borderRadius: BorderRadius.circular(12)),
                      suffixIconColor: const Color(0xFF9E9E9E),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    ),
                  ),
                  child: SingleChildScrollView(
                    padding: EdgeInsets.symmetric(
                      horizontal: screen.width * 0.06,
                      vertical: screen.height * 0.03,
                    ),
                    child: const SignUpForm(),
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
