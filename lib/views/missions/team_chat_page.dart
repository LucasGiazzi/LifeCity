import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/components/app_back_button.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_symbols.dart';
import '../../core/models/mission_model.dart';
import '../../core/services/mission_service.dart';
import '../../core/state/auth_state.dart';

class TeamChatPage extends StatefulWidget {
  final String teamId;
  final String teamName;

  const TeamChatPage(
      {super.key, required this.teamId, required this.teamName});

  @override
  State<TeamChatPage> createState() => _TeamChatPageState();
}

class _TeamChatPageState extends State<TeamChatPage> {
  final MissionService _service = MissionService();
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  List<TeamMessage> _messages = [];
  bool _isLoading = true;
  bool _isSending = false;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _load(scrollToBottom: true);
    _pollTimer =
        Timer.periodic(const Duration(seconds: 5), (_) => _load());
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

  Future<void> _load({bool scrollToBottom = false}) async {
    final wasAtBottom = scrollToBottom || _isAtBottom;
    final msgs = await _service.getTeamMessages(widget.teamId);
    if (!mounted) return;

    final hasNew = msgs.length != _messages.length ||
        (msgs.isNotEmpty &&
            _messages.isNotEmpty &&
            msgs.last.id != _messages.last.id);

    setState(() {
      _messages = msgs;
      _isLoading = false;
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

  List<Widget> _buildItems(String? myId) {
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

  @override
  Widget build(BuildContext context) {
    final myId =
        context.watch<AuthState>().currentUser?['id'] as String?;

    return Scaffold(
      appBar: AppBar(
        leading: const AppBackButton(),
        title: Text(widget.teamName,
            style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
      ),
      body: Column(
        children: [
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _messages.isEmpty
                    ? Center(
                        child: Text(
                          'Nenhuma mensagem ainda.\nSeja o primeiro a escrever!',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.poppins(
                              color: AppColors.placeholder, fontSize: 14),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: () => _load(),
                        child: ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.symmetric(
                              vertical: 12, horizontal: 16),
                          itemCount: _buildItems(myId).length,
                          itemBuilder: (_, i) => _buildItems(myId)[i],
                        ),
                      ),
          ),
          _InputBar(
            controller: _inputController,
            isSending: _isSending,
            onSend: _send,
          ),
        ],
      ),
    );
  }
}

// ─── Day divider ─────────────────────────────────────────────────────────────

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
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 8),
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
              hintStyle:
                  GoogleFonts.poppins(color: AppColors.placeholder, fontSize: 14),
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
