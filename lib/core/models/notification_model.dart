class NotificationModel {
  final String id;
  final String? actorId;
  final String? actorName;
  final String? actorPhotoUrl;
  final String type;
  final String? referenceType;
  final String? referenceId;
  final DateTime? readAt;
  final DateTime createdAt;
  final String? achievementName;
  final String? achievementIcon;
  final int? achievementXp;

  bool get isRead => readAt != null;

  const NotificationModel({
    required this.id,
    this.actorId,
    this.actorName,
    this.actorPhotoUrl,
    required this.type,
    this.referenceType,
    this.referenceId,
    this.readAt,
    required this.createdAt,
    this.achievementName,
    this.achievementIcon,
    this.achievementXp,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: json['id'] as String,
      actorId: json['actor_id'] as String?,
      actorName: json['actor_name'] as String?,
      actorPhotoUrl: json['actor_photo_url'] as String?,
      type: json['type'] as String,
      referenceType: json['reference_type'] as String?,
      referenceId: json['reference_id']?.toString(),
      readAt: json['read_at'] != null
          ? DateTime.tryParse(json['read_at'] as String)
          : null,
      createdAt: DateTime.parse(json['created_at'] as String),
      achievementName: json['achievement_name'] as String?,
      achievementIcon: json['achievement_icon'] as String?,
      achievementXp: (json['achievement_xp'] as num?)?.toInt(),
    );
  }

  String get displayText {
    final actor = actorName ?? 'Alguém';
    switch (type) {
      case 'like':
        return '$actor curtiu sua reclamação';
      case 'comment':
        return '$actor comentou na sua reclamação';
      case 'friend_request':
        return '$actor enviou um pedido de amizade';
      case 'achievement_unlocked':
        return achievementName != null
            ? 'Conquista desbloqueada: $achievementName'
            : 'Você desbloqueou uma conquista!';
      default:
        return 'Nova notificação';
    }
  }
}
