import 'package:flutter/material.dart';
import 'components/intro_page_body_area.dart';

class IntroLoginPage extends StatelessWidget {
  const IntroLoginPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: Image.asset(
              'assets/images/capivas-na-city.png',
              fit: BoxFit.contain, 
            ),
          ),
          const IntroPageBodyArea(),
        ],
      ),
    );
  }
}
