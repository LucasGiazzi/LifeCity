import 'package:flutter/widgets.dart';
import 'filter_controller.dart';

class FilterScope extends InheritedNotifier<FilterController> {
  const FilterScope({
    super.key,
    required FilterController controller,
    required super.child,
  }) : super(notifier: controller);

  static FilterController of(BuildContext context) {
    final scope =
        context.dependOnInheritedWidgetOfExactType<FilterScope>();
    assert(scope != null, 'FilterScope não encontrado no contexto.');
    return scope!.notifier!;
  }
}
