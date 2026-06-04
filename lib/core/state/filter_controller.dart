import 'package:flutter/foundation.dart';

class FilterController extends ChangeNotifier {
  final Set<String> _selected = {};

  Set<String> get selected => Set.unmodifiable(_selected);
  bool isSelected(String key) => _selected.contains(key);

  void toggle(String key) {
    if (_selected.contains(key)) {
      _selected.remove(key);
    } else {
      _selected.add(key);
    }
    notifyListeners();
  }

  void setAll(Iterable<String> keys) {
    _selected
      ..clear()
      ..addAll(keys);
    notifyListeners();
  }

  void clear() {
    _selected.clear();
    notifyListeners();
  }
}
