// Central icon catalogue for LifeCity.
//
// Source: material_symbols_icons (Material Symbols / Material Design 3).
// Convention:
//   - Default (fill: 0.0)  → outline — forms, info rows, inactive nav, actions
//   - fill: 1.0            → solid  — active nav, toggled engagement, avatar fallback
//   - weight defaults to 400 via the app's IconTheme
//
// Usage:
//   import 'package:lifecity/core/constants/app_symbols.dart';
//   Icon(AppSymbols.email)                   // outline
//   Icon(AppSymbols.favorite, fill: 1.0)     // solid (liked state)
//
// All names below are re-exported from Symbols; this file adds semantic aliases.

export 'package:material_symbols_icons/symbols.dart';

import 'package:material_symbols_icons/symbols.dart';
import 'package:flutter/widgets.dart';

abstract final class AppSymbols {
  // ── Navigation ──────────────────────────────────────────────────────────────
  static const IconData map          = Symbols.map;
  static const IconData group        = Symbols.group;
  static const IconData favorite     = Symbols.favorite;
  static const IconData person       = Symbols.person;
  static const IconData flag         = Symbols.flag;

  // ── Actions ─────────────────────────────────────────────────────────────────
  static const IconData arrowBack    = Symbols.arrow_back_ios_new;
  static const IconData arrowForward = Symbols.arrow_forward_ios;
  static const IconData chevronRight = Symbols.chevron_right;
  static const IconData expandMore   = Symbols.expand_more;
  static const IconData edit         = Symbols.edit;
  static const IconData delete       = Symbols.delete;
  static const IconData send         = Symbols.send;
  static const IconData close        = Symbols.close;
  static const IconData check        = Symbols.check;
  static const IconData search       = Symbols.search;
  static const IconData settings     = Symbols.settings;
  static const IconData logout       = Symbols.logout;

  // ── Forms ───────────────────────────────────────────────────────────────────
  static const IconData email        = Symbols.mail;
  static const IconData lock         = Symbols.lock;
  static const IconData visibility   = Symbols.visibility;
  static const IconData visibilityOff = Symbols.visibility_off;
  static const IconData phone        = Symbols.phone;
  static const IconData badge        = Symbols.badge;

  // ── Complaints ──────────────────────────────────────────────────────────────
  static const IconData construction     = Symbols.construction;
  static const IconData security         = Symbols.security;
  static const IconData cleaningServices = Symbols.cleaning_services;
  static const IconData traffic          = Symbols.traffic;
  static const IconData warning          = Symbols.warning;

  // ── Status ──────────────────────────────────────────────────────────────────
  static const IconData radioButtonUnchecked = Symbols.radio_button_unchecked;
  static const IconData autorenew            = Symbols.autorenew;
  static const IconData checkCircle          = Symbols.check_circle;

  // ── Info ────────────────────────────────────────────────────────────────────
  static const IconData locationOn    = Symbols.location_on;
  static const IconData calendarToday = Symbols.calendar_today;
  static const IconData navigation    = Symbols.navigation;
  static const IconData chatBubble    = Symbols.chat_bubble;
  static const IconData notifications = Symbols.notifications;
  static const IconData brokenImage   = Symbols.broken_image;
  static const IconData emojiEvents   = Symbols.emoji_events;
  static const IconData error         = Symbols.error;
  static const IconData category      = Symbols.category;
}
