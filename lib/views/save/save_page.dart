import 'package:flutter/material.dart';
import '../../core/state/filter_scope.dart';

class SavePage extends StatelessWidget {
  const SavePage({super.key, required this.isHomePage});
  final bool isHomePage;

  @override
  Widget build(BuildContext context) {
    final selected = FilterScope.of(context).selected;

    final all = const [
      {'type': 'festas', 'title': 'Festa de Inverno'},
      {'type': 'esportes', 'title': 'Campeonato de Vôlei'},
      {'type': 'educacao', 'title': 'Palestra sobre Sustentabilidade'},
      {'type': 'eventos', 'title': 'Feira Municipal de Inovação'},
    ];

    final filtered =
        selected.isEmpty ? all : all.where((e) => selected.contains(e['type'])).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Feed')),
      body: ListView.builder(
        itemCount: filtered.length,
        itemBuilder: (_, i) => ListTile(
          leading: const Icon(Icons.event),
          title: Text(filtered[i]['title']!),
          subtitle: Text(filtered[i]['type']!),
        ),
      ),
    );
  }
}
