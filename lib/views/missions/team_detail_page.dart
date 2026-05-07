import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/components/app_back_button.dart';
import '../../core/constants/app_colors.dart';
import '../../core/models/mission_model.dart';
import '../../core/services/friendship_service.dart';
import '../../core/services/mission_service.dart';
import '../../core/state/auth_state.dart';

class TeamDetailPage extends StatefulWidget {
  final String teamId;
  const TeamDetailPage({super.key, required this.teamId});

  @override
  State<TeamDetailPage> createState() => _TeamDetailPageState();
}

class _TeamDetailPageState extends State<TeamDetailPage> {
  final MissionService _service = MissionService();
  final FriendshipService _friendshipService = FriendshipService();

  TeamModel? _team;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    final team = await _service.getTeamById(widget.teamId);
    if (mounted) {
      setState(() {
        _team = team;
        _isLoading = false;
      });
    }
  }

  Future<void> _openInviteSheet(String currentUserId) async {
    final friends = await _friendshipService.listFriends();
    if (!mounted) return;

    final memberIds = _team!.members.map((m) => m.userId).toSet();
    final eligible = friends
        .where((f) => !memberIds.contains(f['friend_id'] as String?))
        .toList();

    if (eligible.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Todos os seus amigos já fazem parte desta equipe.'),
      ));
      return;
    }

    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => _InviteSheet(
        friends: eligible,
        onInvite: (friendId) async {
          Navigator.pop(ctx);
          final ok = await _service.inviteToTeam(widget.teamId, friendId);
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(ok ? 'Convite enviado!' : 'Erro ao enviar convite.'),
              backgroundColor: ok ? AppColors.primary : Colors.red,
            ));
            if (ok) _load();
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final userId = context.watch<AuthState>().currentUser?['id'] as String?;
    final isCreator = _team?.creatorId == userId;
    final activeMembers =
        _team?.members.where((m) => m.isActive).length ?? 0;
    final canInvite = isCreator && activeMembers < 7;

    return Scaffold(
      appBar: AppBar(
        leading: const AppBackButton(),
        title: Text(_team?.name ?? 'Equipe',
            style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
        actions: [
          if (canInvite)
            IconButton(
              icon: const Icon(Icons.person_add_rounded),
              tooltip: 'Convidar amigo',
              onPressed: userId != null ? () => _openInviteSheet(userId) : null,
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _team == null
              ? const Center(child: Text('Equipe não encontrada.'))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      _TeamHeader(team: _team!),
                      const SizedBox(height: 24),
                      Text('Membros',
                          style: GoogleFonts.poppins(
                              fontSize: 15, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 12),
                      ..._team!.members.map((m) => _MemberTile(
                            member: m,
                            isMe: m.userId == userId,
                            isCreator: m.userId == _team!.creatorId,
                          )),
                    ],
                  ),
                ),
    );
  }
}

// ─── Header ───────────────────────────────────────────────────────────────────

class _TeamHeader extends StatelessWidget {
  final TeamModel team;
  const _TeamHeader({required this.team});

  @override
  Widget build(BuildContext context) {
    final activeCount = team.members.where((m) => m.isActive).length;
    final pendingCount = team.members.where((m) => m.isPending).length;

    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(Icons.groups_rounded,
                  color: AppColors.primary, size: 26),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(team.name,
                    style: GoogleFonts.poppins(
                        fontSize: 16, fontWeight: FontWeight.w700)),
                Text('$activeCount membro(s) ativo(s)',
                    style: GoogleFonts.poppins(
                        fontSize: 12, color: AppColors.placeholder)),
              ]),
            ),
          ]),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.amber.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(children: [
              Icon(Icons.emoji_events_rounded,
                  color: Colors.amber.shade700, size: 18),
              const SizedBox(width: 8),
              Text('${team.totalXp} XP acumulado pela equipe',
                  style: GoogleFonts.poppins(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.amber.shade700)),
            ]),
          ),
          if (pendingCount > 0) ...[
            const SizedBox(height: 10),
            Row(children: [
              const Icon(Icons.hourglass_top_rounded,
                  size: 14, color: AppColors.placeholder),
              const SizedBox(width: 6),
              Text('$pendingCount convite(s) pendente(s)',
                  style: GoogleFonts.poppins(
                      fontSize: 12, color: AppColors.placeholder)),
            ]),
          ],
        ]),
      ),
    );
  }
}

// ─── Member tile ──────────────────────────────────────────────────────────────

class _MemberTile extends StatelessWidget {
  final TeamMember member;
  final bool isMe;
  final bool isCreator;

  const _MemberTile(
      {required this.member, required this.isMe, required this.isCreator});

  @override
  Widget build(BuildContext context) {
    final statusLabel = switch (member.status) {
      'pending' => 'Convite pendente',
      'rejected' => 'Recusou',
      _ => null,
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(children: [
        CircleAvatar(
          radius: 22,
          backgroundColor: AppColors.gray,
          backgroundImage:
              member.photoUrl != null ? NetworkImage(member.photoUrl!) : null,
          child: member.photoUrl == null
              ? const Icon(Icons.person, size: 24, color: Colors.grey)
              : null,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(
                child: Text(
                  member.name ?? 'Usuário',
                  style: GoogleFonts.poppins(
                      fontSize: 14, fontWeight: FontWeight.w600),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (isMe)
                Padding(
                  padding: const EdgeInsets.only(left: 5),
                  child: Text('(você)',
                      style: GoogleFonts.poppins(
                          fontSize: 11, color: AppColors.primary)),
                ),
            ]),
            if (isCreator)
              Text('Criador',
                  style: GoogleFonts.poppins(
                      fontSize: 11, color: Colors.amber.shade700))
            else if (statusLabel != null)
              Text(statusLabel,
                  style: GoogleFonts.poppins(
                      fontSize: 11, color: AppColors.placeholder)),
          ]),
        ),
        if (member.status == 'pending')
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: Colors.orange.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text('Pendente',
                style: GoogleFonts.poppins(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.orange.shade700)),
          ),
      ]),
    );
  }
}

// ─── Invite sheet ─────────────────────────────────────────────────────────────

class _InviteSheet extends StatelessWidget {
  final List<Map<String, dynamic>> friends;
  final void Function(String friendId) onInvite;

  const _InviteSheet({required this.friends, required this.onInvite});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
          child: Text('Convidar amigo',
              style: GoogleFonts.poppins(
                  fontSize: 17, fontWeight: FontWeight.w600)),
        ),
        const Divider(height: 1),
        ConstrainedBox(
          constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.45),
          child: ListView.builder(
            shrinkWrap: true,
            itemCount: friends.length,
            itemBuilder: (_, i) {
              final f = friends[i];
              final photoUrl = f['photo_url'] as String?;
              return ListTile(
                leading: CircleAvatar(
                  backgroundColor: AppColors.gray,
                  backgroundImage:
                      photoUrl != null ? NetworkImage(photoUrl) : null,
                  child: photoUrl == null
                      ? const Icon(Icons.person, color: Colors.grey)
                      : null,
                ),
                title: Text(f['name'] as String? ?? 'Amigo',
                    style: GoogleFonts.poppins(fontSize: 14)),
                trailing: TextButton(
                  onPressed: () => onInvite(f['friend_id'] as String),
                  child: Text('Convidar',
                      style: GoogleFonts.poppins(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w600)),
                ),
              );
            },
          ),
        ),
        SizedBox(height: MediaQuery.of(context).padding.bottom + 8),
      ],
    );
  }
}
