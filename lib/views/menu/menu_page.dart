import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_colors.dart';
import '../../core/routes/app_routes.dart';
import '../../core/services/api_service.dart';
import '../../core/services/friendship_service.dart';
import '../../core/state/auth_state.dart';

class MenuPage extends StatefulWidget {
  const MenuPage({super.key});

  @override
  State<MenuPage> createState() => _MenuPageState();
}

class _MenuPageState extends State<MenuPage> with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final FriendshipService _friendshipService = FriendshipService();

  List<Map<String, dynamic>> _discover = [];
  List<Map<String, dynamic>> _incoming = [];
  List<Map<String, dynamic>> _outgoing = [];
  List<Map<String, dynamic>> _friends = [];
  bool _loading = true;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadAll());
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    final auth = Provider.of<AuthState>(context, listen: false);
    if (!auth.isAuthenticated) {
      if (mounted) {
        setState(() {
          _loading = false;
          _discover = [];
          _incoming = [];
          _outgoing = [];
          _friends = [];
        });
      }
      return;
    }

    if (mounted) {
      setState(() {
        _loading = true;
        _loadError = null;
      });
    }

    try {
      final results = await Future.wait([
        _friendshipService.discover(),
        _friendshipService.listIncoming(),
        _friendshipService.listOutgoing(),
        _friendshipService.listFriends(),
      ]);
      if (!mounted) return;
      setState(() {
        _discover = results[0];
        _incoming = results[1];
        _outgoing = results[2];
        _friends = results[3];
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = e.message;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = 'Não foi possível carregar os dados.';
        _loading = false;
      });
    }
  }

  Future<void> _sendRequest(String userId) async {
    try {
      await _friendshipService.sendRequest(userId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pedido de amizade enviado.')),
      );
      await _loadAll();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    }
  }

  Future<void> _accept(int id) async {
    try {
      await _friendshipService.accept(id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pedido aceite.')),
      );
      await _loadAll();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    }
  }

  Future<void> _reject(int id) async {
    try {
      await _friendshipService.reject(id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pedido recusado.')),
      );
      await _loadAll();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();

    if (!auth.isAuthenticated) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'Amigos',
                style: GoogleFonts.poppins(
                  fontSize: 22,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Inicie sessão para descobrir utilizadores, enviar pedidos de amizade e gerir pedidos recebidos.',
                textAlign: TextAlign.center,
                style: GoogleFonts.poppins(
                  fontSize: 14,
                  color: AppColors.placeholder,
                ),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () =>
                    Navigator.pushNamed(context, AppRoutes.loginOrSignup),
                child: const Text('Entrar ou registar'),
              ),
            ],
          ),
        ),
      );
    }

    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Text(
              'Amigos',
              style: GoogleFonts.poppins(
                fontSize: 22,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          TabBar(
            controller: _tabController,
            labelColor: AppColors.primary,
            unselectedLabelColor: AppColors.placeholder,
            indicatorColor: AppColors.primary,
            labelStyle: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w600),
            unselectedLabelStyle: GoogleFonts.poppins(fontSize: 13),
            tabs: const [
              Tab(text: 'Explorar'),
              Tab(text: 'Pedidos'),
              Tab(text: 'Amigos'),
            ],
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _loadError != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                _loadError!,
                                textAlign: TextAlign.center,
                                style: GoogleFonts.poppins(color: Colors.red[700]),
                              ),
                              const SizedBox(height: 16),
                              FilledButton.tonal(
                                onPressed: _loadAll,
                                child: const Text('Tentar novamente'),
                              ),
                            ],
                          ),
                        ),
                      )
                    : TabBarView(
                        controller: _tabController,
                        children: [
                          _DiscoverList(
                            users: _discover,
                            onRefresh: _loadAll,
                            onSendRequest: _sendRequest,
                          ),
                          _RequestsList(
                            incoming: _incoming,
                            outgoing: _outgoing,
                            onRefresh: _loadAll,
                            onAccept: _accept,
                            onReject: _reject,
                          ),
                          _FriendsList(
                            friends: _friends,
                            onRefresh: _loadAll,
                          ),
                        ],
                      ),
          ),
        ],
      ),
    );
  }
}

class _UserAvatar extends StatelessWidget {
  final String? photoUrl;
  final String name;
  final double radius;

  const _UserAvatar({
    required this.photoUrl,
    required this.name,
    this.radius = 22,
  });

  @override
  Widget build(BuildContext context) {
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';
    if (photoUrl != null && photoUrl!.isNotEmpty) {
      return CircleAvatar(
        radius: radius,
        backgroundColor: AppColors.textInputBackground,
        backgroundImage: CachedNetworkImageProvider(photoUrl!),
        onBackgroundImageError: (_, __) {},
        child: null,
      );
    }
    return _LetterAvatar(initial: initial, radius: radius);
  }
}

class _LetterAvatar extends StatelessWidget {
  final String initial;
  final double radius;

  const _LetterAvatar({required this.initial, required this.radius});

  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: radius,
      backgroundColor: AppColors.primary.withValues(alpha: 0.2),
      child: Text(
        initial,
        style: GoogleFonts.poppins(
          fontSize: radius * 0.85,
          fontWeight: FontWeight.w600,
          color: AppColors.primaryDark,
        ),
      ),
    );
  }
}

class _DiscoverList extends StatelessWidget {
  final List<Map<String, dynamic>> users;
  final Future<void> Function() onRefresh;
  final Future<void> Function(String userId) onSendRequest;

  const _DiscoverList({
    required this.users,
    required this.onRefresh,
    required this.onSendRequest,
  });

  String? _statusLabel(Map<String, dynamic> u) {
    final st = u['friendship_status'] as String?;
    final dir = u['direction'] as String?;
    if (st == null) return null;
    if (st == 'accepted') return 'Amigo';
    if (st == 'pending' && dir == 'outgoing') return 'Pedido enviado';
    if (st == 'pending' && dir == 'incoming') return 'Pedido recebido';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    if (users.isEmpty) {
      return RefreshIndicator(
        onRefresh: onRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(
              height: MediaQuery.sizeOf(context).height * 0.35,
              child: Center(
                child: Text(
                  'Nenhum utilizador encontrado.',
                  style: GoogleFonts.poppins(color: AppColors.placeholder),
                ),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        itemCount: users.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, i) {
          final u = users[i];
          final id = u['id']?.toString() ?? '';
          final name = u['name'] as String? ?? 'Utilizador';
          final photo = u['photo_url'] as String?;
          final label = _statusLabel(u);

          return ListTile(
            contentPadding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
            onTap: label == 'Amigo'
                ? () => Navigator.pushNamed(
                      context,
                      AppRoutes.friendProfile,
                      arguments: {'userId': id, 'userName': name, 'photoUrl': photo},
                    )
                : null,
            leading: _UserAvatar(photoUrl: photo, name: name),
            title: Text(name, style: GoogleFonts.poppins(fontWeight: FontWeight.w500)),
            subtitle: label != null
                ? Text(
                    label,
                    style: GoogleFonts.poppins(
                      fontSize: 12,
                      color: AppColors.placeholder,
                    ),
                  )
                : null,
            trailing: label == null
                ? FilledButton.tonal(
                    onPressed: id.isEmpty ? null : () => onSendRequest(id),
                    child: const Text('Pedir'),
                  )
                : (label == 'Pedido recebido'
                    ? Text(
                        'Veja em Pedidos',
                        style: GoogleFonts.poppins(fontSize: 11, color: AppColors.primary),
                      )
                    : null),
          );
        },
      ),
    );
  }
}

class _RequestsList extends StatelessWidget {
  final List<Map<String, dynamic>> incoming;
  final List<Map<String, dynamic>> outgoing;
  final Future<void> Function() onRefresh;
  final Future<void> Function(int id) onAccept;
  final Future<void> Function(int id) onReject;

  const _RequestsList({
    required this.incoming,
    required this.outgoing,
    required this.onRefresh,
    required this.onAccept,
    required this.onReject,
  });

  int _parseId(dynamic v) {
    if (v == null) return 0;
    return int.tryParse(v.toString()) ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          Text(
            'Recebidos',
            style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          if (incoming.isEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 20),
              child: Text(
                'Sem pedidos recebidos.',
                style: GoogleFonts.poppins(fontSize: 13, color: AppColors.placeholder),
              ),
            )
          else
            ...incoming.map((r) {
              final id = _parseId(r['id']);
              final name = r['name'] as String? ?? 'Utilizador';
              final photo = r['photo_url'] as String?;
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          _UserAvatar(photoUrl: photo, name: name, radius: 20),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              name,
                              style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: id == 0 ? null : () => onReject(id),
                              child: const Text('Recusar'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: FilledButton(
                              onPressed: id == 0 ? null : () => onAccept(id),
                              child: const Text('Aceitar'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }),
          Text(
            'Enviados (pendentes)',
            style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          if (outgoing.isEmpty)
            Text(
              'Sem pedidos enviados em espera.',
              style: GoogleFonts.poppins(fontSize: 13, color: AppColors.placeholder),
            )
          else
            ...outgoing.map((r) {
              final name = r['name'] as String? ?? 'Utilizador';
              final photo = r['photo_url'] as String?;
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: _UserAvatar(photoUrl: photo, name: name, radius: 20),
                  title: Text(name, style: GoogleFonts.poppins(fontWeight: FontWeight.w500)),
                  trailing: Text(
                    'Pendente',
                    style: GoogleFonts.poppins(fontSize: 12, color: AppColors.placeholder),
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _FriendsList extends StatelessWidget {
  final List<Map<String, dynamic>> friends;
  final Future<void> Function() onRefresh;

  const _FriendsList({
    required this.friends,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    if (friends.isEmpty) {
      return RefreshIndicator(
        onRefresh: onRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(
              height: MediaQuery.sizeOf(context).height * 0.35,
              child: Center(
                child: Text(
                  'Você ainda não tem nenhum amigo. Fudido',
                  style: GoogleFonts.poppins(color: AppColors.placeholder),
                ),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        itemCount: friends.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, i) {
          final f = friends[i];
          final id = f['id']?.toString() ?? '';
          final name = f['name'] as String? ?? 'Utilizador';
          final photo = f['photo_url'] as String?;
          return ListTile(
            contentPadding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
            onTap: id.isEmpty ? null : () => Navigator.pushNamed(
              context,
              AppRoutes.friendProfile,
              arguments: {'userId': id, 'userName': name, 'photoUrl': photo},
            ),
            leading: _UserAvatar(photoUrl: photo, name: name),
            title: Text(name, style: GoogleFonts.poppins(fontWeight: FontWeight.w500)),
            trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.placeholder, size: 20),
          );
        },
      ),
    );
  }
}
