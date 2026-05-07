import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/constants/app_colors.dart';
import '../../core/models/mission_model.dart';
import '../../core/routes/app_routes.dart';
import '../../core/services/mission_service.dart';

class MissionsPage extends StatefulWidget {
  const MissionsPage({super.key});

  @override
  State<MissionsPage> createState() => _MissionsPageState();
}

class _MissionsPageState extends State<MissionsPage> {
  final MissionService _service = MissionService();

  UserMissionModel? _daily;
  UserMissionModel? _weekly;
  List<TeamModel> _teams = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    final results = await Future.wait([
      _service.getMyMissions(),
      _service.getTeams(),
    ]);
    if (!mounted) return;
    final missions = results[0] as ({UserMissionModel? daily, UserMissionModel? weekly});
    final teams = results[1] as List<TeamModel>;
    setState(() {
      _daily = missions.daily;
      _weekly = missions.weekly;
      _teams = teams;
      _isLoading = false;
    });
  }

  Future<void> _respondTeam(TeamModel team, bool accept) async {
    final ok = accept
        ? await _service.acceptTeamInvite(team.id)
        : await _service.rejectTeamInvite(team.id);
    if (ok && mounted) {
      _load();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(accept ? 'Você entrou na equipe!' : 'Convite recusado.'),
        backgroundColor: accept ? AppColors.primary : Colors.grey,
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final pendingTeams = _teams.where((t) => t.isPending).toList();
    final activeTeams = _teams.where((t) => t.isActive).toList();

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: Text('Missões', style: GoogleFonts.poppins(fontWeight: FontWeight.w700)),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await Navigator.pushNamed(context, AppRoutes.createTeam);
          _load();
        },
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.group_add_rounded, color: Colors.white),
        label: Text('Nova equipe',
            style: GoogleFonts.poppins(color: Colors.white, fontWeight: FontWeight.w600)),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                children: [
                  _SectionTitle('Missão diária'),
                  const SizedBox(height: 8),
                  _daily != null
                      ? _MissionCard(mission: _daily!)
                      : _EmptyCard('Nenhuma missão diária disponível'),
                  const SizedBox(height: 20),
                  _SectionTitle('Missão semanal'),
                  const SizedBox(height: 8),
                  _weekly != null
                      ? _MissionCard(mission: _weekly!)
                      : _EmptyCard('Nenhuma missão semanal disponível'),
                  if (pendingTeams.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    _SectionTitle('Convites de equipe',
                        badge: pendingTeams.length),
                    const SizedBox(height: 8),
                    ...pendingTeams.map((t) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _TeamInviteCard(
                            team: t,
                            onAccept: () => _respondTeam(t, true),
                            onReject: () => _respondTeam(t, false),
                          ),
                        )),
                  ],
                  const SizedBox(height: 24),
                  _SectionTitle('Minhas equipes'),
                  const SizedBox(height: 8),
                  if (activeTeams.isEmpty)
                    _EmptyCard('Você ainda não faz parte de nenhuma equipe')
                  else
                    ...activeTeams.map((t) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _TeamCard(
                            team: t,
                            onTap: () async {
                              await Navigator.pushNamed(
                                  context, AppRoutes.teamDetail,
                                  arguments: t.id);
                              _load();
                            },
                          ),
                        )),
                ],
              ),
            ),
    );
  }
}

// ─── Section title ─────────────────────────────────────────────────────────

class _SectionTitle extends StatelessWidget {
  final String text;
  final int? badge;
  const _SectionTitle(this.text, {this.badge});

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Text(text,
          style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w700)),
      if (badge != null && badge! > 0) ...[
        const SizedBox(width: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
          decoration: BoxDecoration(
              color: Colors.redAccent, borderRadius: BorderRadius.circular(10)),
          child: Text('$badge',
              style: const TextStyle(color: Colors.white, fontSize: 11)),
        ),
      ],
    ]);
  }
}

// ─── Empty state card ──────────────────────────────────────────────────────

class _EmptyCard extends StatelessWidget {
  final String text;
  const _EmptyCard(this.text);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.gray.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Text(text,
          textAlign: TextAlign.center,
          style: GoogleFonts.poppins(fontSize: 13, color: AppColors.placeholder)),
    );
  }
}

// ─── Mission card ──────────────────────────────────────────────────────────

class _MissionCard extends StatelessWidget {
  final UserMissionModel mission;
  const _MissionCard({required this.mission});

  @override
  Widget build(BuildContext context) {
    final isDaily = mission.frequency == 'daily';
    final badgeColor = isDaily ? Colors.orange : AppColors.primary;
    final badgeLabel = isDaily ? 'Diária' : 'Semanal';

    Color statusColor;
    String statusLabel;
    if (mission.isCompleted) {
      statusColor = Colors.green;
      statusLabel = 'Concluída';
    } else if (mission.isExpired) {
      statusColor = Colors.grey;
      statusLabel = 'Expirada';
    } else {
      final hoursLeft = mission.expiresAt.difference(DateTime.now()).inHours;
      statusColor = AppColors.primary;
      statusLabel = isDaily
          ? (hoursLeft <= 1 ? 'Menos de 1h' : '${hoursLeft}h restantes')
          : '${mission.expiresAt.difference(DateTime.now()).inDays + 1}d restantes';
    }

    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: badgeColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(badgeLabel,
                  style: GoogleFonts.poppins(
                      fontSize: 11, fontWeight: FontWeight.w700, color: badgeColor)),
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(statusLabel,
                  style: GoogleFonts.poppins(
                      fontSize: 11, fontWeight: FontWeight.w600, color: statusColor)),
            ),
          ]),
          const SizedBox(height: 10),
          Text(mission.title,
              style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600)),
          if (mission.description != null) ...[
            const SizedBox(height: 2),
            Text(mission.description!,
                style: GoogleFonts.poppins(fontSize: 12, color: AppColors.placeholder)),
          ],
          if (mission.complaintCategory != null) ...[
            const SizedBox(height: 4),
            Row(children: [
              const Icon(Icons.category_rounded, size: 12, color: AppColors.placeholder),
              const SizedBox(width: 4),
              Text(mission.complaintCategory!,
                  style: GoogleFonts.poppins(
                      fontSize: 11, color: AppColors.placeholder)),
            ]),
          ],
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: mission.progressRatio,
              minHeight: 7,
              backgroundColor: AppColors.gray,
              valueColor: AlwaysStoppedAnimation<Color>(
                mission.isCompleted ? Colors.green : AppColors.primary,
              ),
            ),
          ),
          const SizedBox(height: 6),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('${mission.contributionCount} / ${mission.goalCount} reclamações',
                style: GoogleFonts.poppins(fontSize: 11, color: AppColors.placeholder)),
            Row(children: [
              Text('+${mission.baseXpReward} XP',
                  style: GoogleFonts.poppins(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Colors.amber.shade700)),
              if (!isDaily && mission.bonusXpEarned > 0) ...[
                const SizedBox(width: 6),
                Text('+${mission.bonusXpEarned} bônus equipe',
                    style: GoogleFonts.poppins(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Colors.teal)),
              ],
            ]),
          ]),
          if (mission.goalType == 'count_and_resolved' &&
              mission.goalResolvedPercent != null) ...[
            const SizedBox(height: 4),
            Text('+ ${mission.goalResolvedPercent}% devem estar resolvidas',
                style: GoogleFonts.poppins(
                    fontSize: 11, color: AppColors.placeholder)),
          ],
        ]),
      ),
    );
  }
}

// ─── Team card ────────────────────────────────────────────────────────────

class _TeamCard extends StatelessWidget {
  final TeamModel team;
  final VoidCallback onTap;
  const _TeamCard({required this.team, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      elevation: 1,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.groups_rounded,
                  color: AppColors.primary, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(team.name,
                    style: GoogleFonts.poppins(
                        fontSize: 14, fontWeight: FontWeight.w600),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                Text('${team.memberCount} membro(s) · ${team.totalXp} XP',
                    style: GoogleFonts.poppins(
                        fontSize: 12, color: AppColors.placeholder)),
              ]),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.placeholder),
          ]),
        ),
      ),
    );
  }
}

// ─── Team invite card ─────────────────────────────────────────────────────

class _TeamInviteCard extends StatelessWidget {
  final TeamModel team;
  final VoidCallback onAccept;
  final VoidCallback onReject;
  const _TeamInviteCard(
      {required this.team, required this.onAccept, required this.onReject});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: AppColors.primary.withValues(alpha: 0.3)),
      ),
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.mail_outline_rounded,
                size: 16, color: AppColors.primary),
            const SizedBox(width: 6),
            Text('Convite recebido',
                style: GoogleFonts.poppins(
                    fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w600)),
          ]),
          const SizedBox(height: 6),
          Text(team.name,
              style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: OutlinedButton(
                onPressed: onReject,
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.red,
                  side: const BorderSide(color: Colors.red),
                  padding: const EdgeInsets.symmetric(vertical: 8),
                ),
                child: Text('Recusar', style: GoogleFonts.poppins(fontSize: 13)),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: ElevatedButton(
                onPressed: onAccept,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(vertical: 8),
                ),
                child: Text('Aceitar',
                    style: GoogleFonts.poppins(
                        fontSize: 13,
                        color: Colors.white,
                        fontWeight: FontWeight.w600)),
              ),
            ),
          ]),
        ]),
      ),
    );
  }
}
