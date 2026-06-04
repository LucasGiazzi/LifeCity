class UserMissionModel {
  final String id;
  final String frequency;
  final String title;
  final String? description;
  final String goalType;
  final int goalCount;
  final int? goalResolvedPercent;
  final String? complaintCategory;
  final int baseXpReward;
  final int contributionCount;
  final int xpEarned;
  final int bonusXpEarned;
  final DateTime? completedAt;
  final DateTime expiresAt;
  final DateTime createdAt;

  bool get isCompleted => completedAt != null;
  bool get isExpired => !isCompleted && DateTime.now().isAfter(expiresAt);
  bool get isActive => !isCompleted && !isExpired;
  double get progressRatio =>
      goalCount > 0 ? (contributionCount / goalCount).clamp(0.0, 1.0) : 0.0;

  const UserMissionModel({
    required this.id,
    required this.frequency,
    required this.title,
    this.description,
    required this.goalType,
    required this.goalCount,
    this.goalResolvedPercent,
    this.complaintCategory,
    required this.baseXpReward,
    this.contributionCount = 0,
    this.xpEarned = 0,
    this.bonusXpEarned = 0,
    this.completedAt,
    required this.expiresAt,
    required this.createdAt,
  });

  factory UserMissionModel.fromJson(Map<String, dynamic> json) {
    return UserMissionModel(
      id: json['id'] as String,
      frequency: json['frequency'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      goalType: json['goal_type'] as String,
      goalCount: (json['goal_count'] as num).toInt(),
      goalResolvedPercent: (json['goal_resolved_percent'] as num?)?.toInt(),
      complaintCategory: json['complaint_category'] as String?,
      baseXpReward: (json['base_xp_reward'] as num?)?.toInt() ?? 0,
      contributionCount: (json['contribution_count'] as num?)?.toInt() ?? 0,
      xpEarned: (json['xp_earned'] as num?)?.toInt() ?? 0,
      bonusXpEarned: (json['bonus_xp_earned'] as num?)?.toInt() ?? 0,
      completedAt: json['completed_at'] != null
          ? DateTime.tryParse(json['completed_at'] as String)
          : null,
      expiresAt: DateTime.parse(json['expires_at'] as String),
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}

class TeamMember {
  final String userId;
  final String status;
  final String? name;
  final String? photoUrl;
  final DateTime joinedAt;

  bool get isPending => status == 'pending';
  bool get isActive => status == 'active';

  const TeamMember({
    required this.userId,
    required this.status,
    this.name,
    this.photoUrl,
    required this.joinedAt,
  });

  factory TeamMember.fromJson(Map<String, dynamic> json) {
    return TeamMember(
      userId: json['user_id'] as String,
      status: json['status'] as String,
      name: json['name'] as String?,
      photoUrl: json['photo_url'] as String?,
      joinedAt: DateTime.parse(json['joined_at'] as String),
    );
  }
}

class TeamModel {
  final String id;
  final String name;
  final String? creatorId;
  final int totalXp;
  final DateTime createdAt;
  final int memberCount;
  final String? myStatus;
  final List<TeamMember> members;

  bool get isPending => myStatus == 'pending';
  bool get isActive => myStatus == 'active';

  const TeamModel({
    required this.id,
    required this.name,
    this.creatorId,
    this.totalXp = 0,
    required this.createdAt,
    this.memberCount = 0,
    this.myStatus,
    this.members = const [],
  });

  factory TeamModel.fromJson(Map<String, dynamic> json) {
    final membersList = (json['members'] as List?)
            ?.map((e) => TeamMember.fromJson(e as Map<String, dynamic>))
            .toList() ??
        const [];
    return TeamModel(
      id: json['id'] as String,
      name: json['name'] as String,
      creatorId: json['creator_id'] as String?,
      totalXp: (json['total_xp'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.parse(json['created_at'] as String),
      memberCount: (json['member_count'] as num?)?.toInt() ?? membersList.length,
      myStatus: json['my_status'] as String?,
      members: membersList,
    );
  }
}
