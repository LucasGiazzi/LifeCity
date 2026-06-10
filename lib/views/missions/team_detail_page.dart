import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/components/app_back_button.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_symbols.dart';
import '../../core/models/mission_model.dart';
import '../../core/routes/app_routes.dart';
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
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  TeamModel? _team;
  List<TeamMessage> _messages = [];
  bool _isLoading = true;
  bool _messagesLoading = true;
  bool _isSending = false;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  bool get _isAtBottom {
    if (!_scrollController.hasClients) return true;
    return _scrollController.offset >=
        _scrollController.position.maxScrollExtent - 100;
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    final team = await _service.getTeamById(widget.teamId);
    if (mounted) {
      setState(() {
        _team = team;
        _isLoading = false;
      });
      if (team?.myStatus == 'active') {
        _loadMessages(scrollToBottom: true);
        _pollTimer ??= Timer.periodic(
          const Duration(seconds: 5),
          (_) => _loadMessages(),
        );
      }
    }
  }

  Future<void> _loadMessages({bool scrollToBottom = false}) async {
    final wasAtBottom = scrollToBottom || _isAtBottom;
    final msgs = await _service.getTeamMessages(widget.teamId);
    if (!mounted) return;

    final hasNew = msgs.length != _messages.length ||
        (msgs.isNotEmpty &&
            _messages.isNotEmpty &&
            msgs.last.id != _messages.last.id);

    setState(() {
      _messages = msgs;
      _messagesLoading = false;
    });

    if ((wasAtBottom || hasNew) && _scrollController.hasClients) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            _scrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        }
      });
    }
  }

  Future<void> _send() async {
    final text = _inputController.text.trim();
    if (text.isEmpty || _isSending) return;

    setState(() => _isSending = true);
    _inputController.clear();

    final msg = await _service.sendTeamMessage(widget.teamId, text);
    if (!mounted) return;

    if (msg != null) {
      setState(() {
        _messages = [..._messages, msg];
        _isSending = false;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            _scrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        }
      });
    } else {
      setState(() => _isSending = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Erro ao enviar mensagem.'),
          backgroundColor: Colors.red,
        ));
      }
    }
  }

  List<Widget> _buildChatItems(String? myId) {
    final items = <Widget>[];
    DateTime? lastDate;
    for (final msg in _messages) {
      final msgDay =
          DateTime(msg.createdAt.year, msg.createdAt.month, msg.createdAt.day);
      if (lastDate == null || msgDay != lastDate) {
        items.add(_DayDivider(date: msg.createdAt));
        lastDate = msgDay;
      }
      items.add(_MessageBubble(message: msg, isMe: msg.userId == myId));
    }
    return items;
  }

  Future<void> _openEditPage() async {
    final updated = await Navigator.pushNamed(
      context,
      AppRoutes.teamEdit,
      arguments: {
        'teamId': _team!.id,
        'name': _team!.name,
        'description': _team!.description,
        'photoUrl': _team!.photoUrl,
      },
    );
    if (updated is TeamModel && mounted) {
      setState(() => _team = updated.copyWith(
            members: _team!.members,
            memberCount: _team!.memberCount,
            myStatus: _team!.myStatus,
          ));
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
              content:
                  Text(ok ? 'Convite enviado!' : 'Erro ao enviar convite.'),
              backgroundColor: ok ? AppColors.primary : Colors.red,
            ));
            if (ok) _load();
          }
        },
      ),
    );
  }

  void _openMembersSheet(String? currentUserId) {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => _MembersSheet(
        members: _team!.members,
        creatorId: _team!.creatorId,
        currentUserId: currentUserId,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final userId = context.watch<AuthState>().currentUser?['id'] as String?;
    final isCreator = _team?.creatorId == userId;
    final isActiveMember = _team?.myStatus == 'active';
    final activeMembers = _team?.members.where((m) => m.isActive).length ?? 0;
    final canInvite = isCreator && activeMembers < 7;

    return Scaffold(
      appBar: AppBar(
        leading: const AppBackButton(),
        title: Text(_team?.name ?? 'Equipe',
            style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
        actions: [
          if (isActiveMember)
            IconButton(
              icon: const Icon(Symbols.group),
              tooltip: 'Membros',
              onPressed: () => _openMembersSheet(userId),
            ),
          if (isCreator)
            IconButton(
              icon: const Icon(AppSymbols.edit),
              tooltip: 'Editar equipe',
              onPressed: _openEditPage,
            ),
          if (canInvite)
            IconButton(
              icon: const Icon(Symbols.person_add),
              tooltip: 'Convidar amigo',
              onPressed: userId != null ? () => _openInviteSheet(userId) : null,
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _team == null
              ? const Center(child: Text('Equipe não encontrada.'))
              : Column(
                  children: [
                    _TeamHeader(team: _team!),
                    Expanded(
                      child: isActiveMember
                          ? _ChatSection(
                              messages: _messages,
                              messagesLoading: _messagesLoading,
                              scrollController: _scrollController,
                              inputController: _inputController,
                              isSending: _isSending,
                              chatItems: _buildChatItems(userId),
                              onSend: _send,
                              onRefresh: _loadMessages,
                            )
                          : Center(
                              child: Text(
                                'Aguardando aprovação do convite.',
                                style: GoogleFonts.poppins(
                                    color: AppColors.placeholder),
                              ),
                            ),
                    ),
                  ],
                ),
    );
  }
}

// ─── Chat section ─────────────────────────────────────────────────────────────

class _ChatSection extends StatelessWidget {
  final List<TeamMessage> messages;
  final bool messagesLoading;
  final ScrollController scrollController;
  final TextEditingController inputController;
  final bool isSending;
  final List<Widget> chatItems;
  final VoidCallback onSend;
  final Future<void> Function() onRefresh;

  const _ChatSection({
    required this.messages,
    required this.messagesLoading,
    required this.scrollController,
    required this.inputController,
    required this.isSending,
    required this.chatItems,
    required this.onSend,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: messagesLoading
              ? const Center(child: CircularProgressIndicator())
              : messages.isEmpty
                  ? Center(
                      child: Text(
                        'Nenhuma mensagem ainda.\nSeja o primeiro a escrever!',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.poppins(
                            color: AppColors.placeholder, fontSize: 14),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: onRefresh,
                      child: ListView.builder(
                        controller: scrollController,
                        padding: const EdgeInsets.symmetric(
                            vertical: 12, horizontal: 16),
                        itemCount: chatItems.length,
                        itemBuilder: (_, i) => chatItems[i],
                      ),
                    ),
        ),
        _InputBar(
          controller: inputController,
          isSending: isSending,
          onSend: onSend,
        ),
      ],
    );
  }
}

// ─── Members bottom sheet ─────────────────────────────────────────────────────

class _MembersSheet extends StatelessWidget {
  final List<TeamMember> members;
  final String? creatorId;
  final String? currentUserId;

  const _MembersSheet({
    required this.members,
    required this.creatorId,
    required this.currentUserId,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: Text('Membros',
              style: GoogleFonts.poppins(
                  fontSize: 17, fontWeight: FontWeight.w600)),
        ),
        const Divider(height: 1),
        ConstrainedBox(
          constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.5),
          child: ListView.builder(
            shrinkWrap: true,
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            itemCount: members.length,
            itemBuilder: (_, i) => _MemberTile(
              member: members[i],
              isMe: members[i].userId == currentUserId,
              isCreator: members[i].userId == creatorId,
            ),
          ),
        ),
        SizedBox(height: MediaQuery.of(context).padding.bottom + 8),
      ],
    );
  }
}

// ─── Team header ──────────────────────────────────────────────────────────────

class _TeamHeader extends StatelessWidget {
  final TeamModel team;
  const _TeamHeader({required this.team});

  @override
  Widget build(BuildContext context) {
    final activeCount = team.members.where((m) => m.isActive).length;
    final pendingCount = team.members.where((m) => m.isPending).length;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Card(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
              CircleAvatar(
                radius: 26,
                backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                backgroundImage: team.photoUrl != null
                    ? NetworkImage(team.photoUrl!)
                    : null,
                child: team.photoUrl == null
                    ? const Icon(Symbols.groups,
                        color: AppColors.primary, size: 26)
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(team.name,
                          style: GoogleFonts.poppins(
                              fontSize: 15, fontWeight: FontWeight.w700)),
                      Text('$activeCount membro(s) ativo(s)',
                          style: GoogleFonts.poppins(
                              fontSize: 12, color: AppColors.placeholder)),
                    ]),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.amber.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(AppSymbols.emojiEvents,
                      color: Colors.amber.shade700, size: 16),
                  const SizedBox(width: 4),
                  Text('${team.totalXp} XP',
                      style: GoogleFonts.poppins(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Colors.amber.shade700)),
                ]),
              ),
            ]),
            if (team.description != null && team.description!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                team.description!,
                style: GoogleFonts.poppins(
                    fontSize: 12, color: AppColors.placeholder),
              ),
            ],
            if (pendingCount > 0) ...[
              const SizedBox(height: 8),
              Row(children: [
                const Icon(Symbols.hourglass_top,
                    size: 13, color: AppColors.placeholder),
                const SizedBox(width: 5),
                Text('$pendingCount convite(s) pendente(s)',
                    style: GoogleFonts.poppins(
                        fontSize: 11, color: AppColors.placeholder)),
              ]),
            ],
          ]),
        ),
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
              ? const Icon(AppSymbols.person, size: 24, color: Colors.grey)
              : null,
        ),
        const SizedBox(width: 12),
        Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
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
                      ? const Icon(AppSymbols.person, color: Colors.grey)
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

// ─── Day divider ──────────────────────────────────────────────────────────────

class _DayDivider extends StatelessWidget {
  final DateTime date;
  const _DayDivider({required this.date});

  String get _label {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    final d = DateTime(date.year, date.month, date.day);

    if (d == today) return 'Hoje';
    if (d == yesterday) return 'Ontem';

    const months = [
      'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
      'jul', 'ago', 'set', 'out', 'nov', 'dez',
    ];
    return '${date.day} de ${months[date.month - 1]}';
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(children: [
        const Expanded(child: Divider()),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            _label,
            style: GoogleFonts.poppins(
              fontSize: 12,
              color: AppColors.placeholder,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        const Expanded(child: Divider()),
      ]),
    );
  }
}

// ─── Message bubble ───────────────────────────────────────────────────────────

class _MessageBubble extends StatelessWidget {
  final TeamMessage message;
  final bool isMe;

  const _MessageBubble({required this.message, required this.isMe});

  String get _time {
    final h = message.createdAt.hour.toString().padLeft(2, '0');
    final m = message.createdAt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  @override
  Widget build(BuildContext context) {
    final bubbleBg = isMe
        ? AppColors.primary
        : Theme.of(context).colorScheme.surfaceContainerHighest;

    return Padding(
      padding: EdgeInsets.only(
        bottom: 6,
        left: isMe ? 56 : 0,
        right: isMe ? 0 : 56,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisAlignment:
            isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          if (!isMe) ...[
            CircleAvatar(
              radius: 16,
              backgroundColor: AppColors.gray,
              backgroundImage: message.userPhotoUrl != null
                  ? NetworkImage(message.userPhotoUrl!)
                  : null,
              child: message.userPhotoUrl == null
                  ? const Icon(AppSymbols.person, size: 18, color: Colors.grey)
                  : null,
            ),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: Column(
              crossAxisAlignment:
                  isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                if (!isMe && message.userName != null)
                  Padding(
                    padding: const EdgeInsets.only(left: 4, bottom: 2),
                    child: Text(
                      message.userName!,
                      style: GoogleFonts.poppins(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: bubbleBg,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(16),
                      topRight: const Radius.circular(16),
                      bottomLeft: Radius.circular(isMe ? 16 : 4),
                      bottomRight: Radius.circular(isMe ? 4 : 16),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        message.content,
                        style: GoogleFonts.poppins(
                          fontSize: 14,
                          color: isMe ? Colors.white : null,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _time,
                        style: GoogleFonts.poppins(
                          fontSize: 10,
                          color: isMe
                              ? Colors.white.withValues(alpha: 0.7)
                              : AppColors.placeholder,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Input bar ────────────────────────────────────────────────────────────────

class _InputBar extends StatelessWidget {
  final TextEditingController controller;
  final bool isSending;
  final VoidCallback onSend;

  const _InputBar({
    required this.controller,
    required this.isSending,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        16,
        8,
        8,
        MediaQuery.of(context).padding.bottom + 8,
      ),
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        border: Border(
            top: BorderSide(color: AppColors.gray.withValues(alpha: 0.4))),
      ),
      child: Row(children: [
        Expanded(
          child: TextField(
            controller: controller,
            minLines: 1,
            maxLines: 4,
            textCapitalization: TextCapitalization.sentences,
            style: GoogleFonts.poppins(fontSize: 14),
            decoration: InputDecoration(
              hintText: 'Digite uma mensagem...',
              hintStyle: GoogleFonts.poppins(
                  color: AppColors.placeholder, fontSize: 14),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(24),
                borderSide: BorderSide.none,
              ),
              filled: true,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
            onSubmitted: (_) => onSend(),
          ),
        ),
        const SizedBox(width: 8),
        IconButton.filled(
          onPressed: isSending ? null : onSend,
          icon: isSending
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white),
                )
              : const Icon(Symbols.send),
          style: IconButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14)),
          ),
        ),
      ]),
    );
  }
}
