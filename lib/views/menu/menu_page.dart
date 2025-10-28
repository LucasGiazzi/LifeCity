import 'package:flutter/material.dart';
import '../../core/constants/constants.dart';
import '../../core/state/filter_scope.dart';
import 'components/category_tile.dart';

class MenuPage extends StatelessWidget {
  const MenuPage({super.key});

  // Categorias disponíveis
  static const _items = <({String key, String label, String asset, bool primary})>[
    (key: 'eventos',   label: 'Eventos',   asset: 'assets/icons/celebration.png', primary: false),
    (key: 'festas',    label: 'Festas',    asset: 'assets/icons/dance.png',       primary: false),
    (key: 'encontros', label: 'Encontros', asset: 'assets/icons/agreement.png',   primary: false),
    (key: 'cultura',   label: 'Cultura',   asset: 'assets/icons/culture.png',     primary: false),
    (key: 'esportes',  label: 'Esportes',  asset: 'assets/icons/sports.png',      primary: false),
    (key: 'feiras',    label: 'Feiras',    asset: 'assets/icons/fair.png',        primary: false),
    (key: 'educacao',  label: 'Educação',  asset: 'assets/icons/education.png',   primary: false),
    (key: 'saude',     label: 'Saúde',     asset: 'assets/icons/health.png',      primary: false),
    (key: 'obras',     label: 'Obras',     asset: 'assets/icons/maintenance.png', primary: false),
    (key: 'anuncios',  label: 'Anúncios',  asset: 'assets/icons/ad.png',          primary: false),
  ];

  @override
  Widget build(BuildContext context) {
    final filters = FilterScope.of(context);

    return SafeArea(
      child: Column(
        children: [
          const SizedBox(height: 32),
          Text(
            'Escolha a Categoria',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: Colors.black,
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 12),

          // Botões auxiliares
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                const SizedBox(width: 8),
                TextButton(
                  onPressed: () => filters.clear(),
                  child: const Text('Limpar'),
                ),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // Grid de categorias
          Expanded(
            child: GridView.count(
              crossAxisCount: 3,
              children: [
                for (final c in _items)
                  _SelectableTile(
                    label: c.label,
                    asset: c.asset,
                    selected: filters.isSelected(c.key),
                    primary: c.primary,
                    onTap: () => filters.toggle(c.key),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Tile selecionável que reaproveita CategoryTile e mostra "check" quando ativo
class _SelectableTile extends StatelessWidget {
  final String label;
  final String asset;
  final bool selected;
  final bool primary;
  final VoidCallback onTap;

  const _SelectableTile({
    required this.label,
    required this.asset,
    required this.selected,
    required this.primary,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        CategoryTile(
          imageLink: asset,
          label: label,
          backgroundColor: selected
              ? AppColors.primary // quando selecionado
              : (primary ? AppColors.primary.withOpacity(0.8) : AppColors.textInputBackground),
          onTap: onTap,
        ),
        if (selected)
          const Positioned(
            right: 10,
            top: 10,
            child: CircleAvatar(
              radius: 10,
              backgroundColor: Colors.white,
              child: Icon(Icons.check, size: 14, color: Colors.green),
            ),
          ),
      ],
    );
  }
}
