class AchievementModel {
  final String id;
  final String name;
  final String? description;
  final String? icon;
  final int xpReward;
  final String triggerType;
  final int triggerCount;
  final DateTime? unlockedAt;
  final bool isFeatured;
  final bool unlocked;

  const AchievementModel({
    required this.id,
    required this.name,
    this.description,
    this.icon,
    this.xpReward = 0,
    required this.triggerType,
    required this.triggerCount,
    this.unlockedAt,
    this.isFeatured = false,
    this.unlocked = false,
  });

  factory AchievementModel.fromJson(Map<String, dynamic> json) {
    return AchievementModel(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      icon: json['icon'] as String?,
      xpReward: (json['xp_reward'] as num?)?.toInt() ?? 0,
      triggerType: json['trigger_type'] as String? ?? '',
      triggerCount: (json['trigger_count'] as num?)?.toInt() ?? 0,
      unlockedAt: json['unlocked_at'] != null
          ? DateTime.tryParse(json['unlocked_at'] as String)
          : null,
      isFeatured: json['is_featured'] as bool? ?? false,
      unlocked: json['unlocked'] as bool? ?? json['unlocked_at'] != null,
    );
  }
}
