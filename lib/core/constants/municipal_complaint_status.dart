import 'package:flutter/material.dart';
import 'package:material_symbols_icons/symbols.dart';

import 'app_symbols.dart';

typedef MunicipalStatusEntry = (IconData icon, Color color, String label);

class MunicipalComplaintStatus {
  MunicipalComplaintStatus._();

  static const municipalStatusMap = <String, MunicipalStatusEntry>{
    'pending':     (AppSymbols.radioButtonUnchecked, Colors.orange, 'Registrada'),
    'triaged':     (Symbols.manage_search,           Colors.indigo, 'Em análise'),
    'assigned':    (Symbols.forward,                 Colors.deepPurple, 'Encaminhada'),
    'in_progress': (AppSymbols.autorenew,            Colors.blue,   'Em andamento'),
    'resolved':    (AppSymbols.checkCircle,         Colors.green,  'Resolvida'),
    'closed':      (AppSymbols.lock,                Colors.blueGrey, 'Encerrada'),
    'reopened':    (Symbols.replay,                 Colors.amber,  'Reaberta'),
    'cancelled':   (Symbols.cancel,                 Colors.red,    'Cancelada'),
  };

  static MunicipalStatusEntry entryFor(String? status) {
    return municipalStatusMap[status] ?? municipalStatusMap['pending']!;
  }

  static String labelFor(String? status) => entryFor(status).$3;
}
