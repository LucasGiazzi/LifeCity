import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/components/app_back_button.dart';
import '../../core/constants/app_colors.dart';
import '../../core/models/notification_model.dart';
import '../../core/services/notification_service.dart';

class NotificationPage extends StatefulWidget {
  const NotificationPage({super.key});

  @override
  State<NotificationPage> createState() => _NotificationPageState();
}

class _NotificationPageState extends State<NotificationPage> {
  final NotificationService _service = NotificationService();
  List<NotificationModel> _notifications = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    final data = await _service.getNotifications();
    if (mounted) setState(() { _notifications = data; _isLoading = false; });
  }

  Future<void> _markAllRead() async {
    await _service.markAllRead();
    if (mounted) {
      setState(() {
        _notifications = _notifications
            .map((n) => n.isRead ? n : _asRead(n))
            .toList();
      });
    }
  }

  NotificationModel _asRead(NotificationModel n) => NotificationModel(
        id: n.id,
        actorId: n.actorId,
        actorName: n.actorName,
        actorPhotoUrl: n.actorPhotoUrl,
        type: n.type,
        referenceType: n.referenceType,
        referenceId: n.referenceId,
        readAt: DateTime.now(),
        createdAt: n.createdAt,
        achievementName: n.achievementName,
        achievementIcon: n.achievementIcon,
        achievementXp: n.achievementXp,
      );

  Future<void> _markRead(NotificationModel notification) async {
    if (notification.isRead) return;
    await _service.markRead(notification.id);
    if (mounted) {
      setState(() {
        final idx = _notifications.indexWhere((n) => n.id == notification.id);
        if (idx != -1) _notifications[idx] = _asRead(notification);
      });
    }
  }

  int get _unreadCount => _notifications.where((n) => !n.isRead).length;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const AppBackButton(),
        title: Text(
          'Notificações',
          style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
        ),
        actions: [
          if (_unreadCount > 0)
            TextButton(
              onPressed: _markAllRead,
              child: Text(
                'Marcar tudo',
                style: GoogleFonts.poppins(
                  color: AppColors.primary,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _notifications.isEmpty
              ? _EmptyState()
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: _notifications.length,
                    separatorBuilder: (_, __) => const Divider(height: 1, indent: 72),
                    itemBuilder: (context, i) => _NotificationTile(
                      notification: _notifications[i],
                      onTap: () => _markRead(_notifications[i]),
                    ),
                  ),
                ),
    );
  }
}

// ─── Tile ────────────────────────────────────────────────────────────────────

class _NotificationTile extends StatelessWidget {
  final NotificationModel notification;
  final VoidCallback onTap;

  const _NotificationTile({required this.notification, required this.onTap});

  static const _typeIcons = <String, IconData>{
    'like': Icons.favorite_rounded,
    'comment': Icons.chat_bubble_rounded,
    'friend_request': Icons.person_add_rounded,
    'achievement_unlocked': Icons.emoji_events_rounded,
  };

  static const _typeColors = <String, Color>{
    'like': Colors.redAccent,
    'comment': AppColors.primary,
    'friend_request': Colors.blueAccent,
    'achievement_unlocked': Colors.amber,
  };

  @override
  Widget build(BuildContext context) {
    final icon = _typeIcons[notification.type] ?? Icons.notifications_rounded;
    final color = _typeColors[notification.type] ?? AppColors.primary;
    final isUnread = !notification.isRead;

    return InkWell(
      onTap: onTap,
      child: Container(
        color: isUnread ? AppColors.primary.withValues(alpha: 0.05) : null,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Avatar(
              photoUrl: notification.actorPhotoUrl,
              icon: icon,
              color: color,
              isAchievement: notification.type == 'achievement_unlocked',
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    notification.displayText,
                    style: GoogleFonts.poppins(
                      fontSize: 13,
                      fontWeight: isUnread ? FontWeight.w600 : FontWeight.w400,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _formatDate(notification.createdAt),
                    style: GoogleFonts.poppins(
                      fontSize: 11,
                      color: AppColors.placeholder,
                    ),
                  ),
                  if (notification.type == 'achievement_unlocked' &&
                      notification.achievementXp != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: _XpChip(xp: notification.achievementXp!),
                    ),
                ],
              ),
            ),
            if (isUnread)
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 4),
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime dt) {
    final diff = DateTime.now().difference(dt.toLocal());
    if (diff.inMinutes < 1) return 'Agora';
    if (diff.inMinutes < 60) return 'Há ${diff.inMinutes}min';
    if (diff.inHours < 24) return 'Há ${diff.inHours}h';
    if (diff.inDays == 1) return 'Ontem';
    return 'Há ${diff.inDays} dias';
  }
}

class _Avatar extends StatelessWidget {
  final String? photoUrl;
  final IconData icon;
  final Color color;
  final bool isAchievement;

  const _Avatar({
    required this.photoUrl,
    required this.icon,
    required this.color,
    required this.isAchievement,
  });

  @override
  Widget build(BuildContext context) {
    if (isAchievement || photoUrl == null || photoUrl!.isEmpty) {
      return Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: color, size: 22),
      );
    }
    return Stack(
      children: [
        CircleAvatar(
          radius: 22,
          backgroundColor: AppColors.gray,
          backgroundImage: NetworkImage(photoUrl!),
        ),
        Positioned(
          right: 0,
          bottom: 0,
          child: Container(
            width: 18,
            height: 18,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 1.5),
            ),
            child: Icon(icon, color: Colors.white, size: 10),
          ),
        ),
      ],
    );
  }
}

class _XpChip extends StatelessWidget {
  final int xp;
  const _XpChip({required this.xp});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.amber.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        '+$xp XP',
        style: GoogleFonts.poppins(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: Colors.amber.shade700,
        ),
      ),
    );
  }
}

// ─── Empty state ─────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.notifications_none_rounded, size: 64, color: AppColors.placeholder),
          const SizedBox(height: 16),
          Text(
            'Nenhuma notificação ainda',
            style: GoogleFonts.poppins(color: AppColors.placeholder, fontSize: 15),
          ),
        ],
      ),
    );
  }
}
