import 'package:flutter/material.dart';

import '../../core/components/app_back_button.dart';
import '../../core/components/network_image.dart';
import '../../core/constants/app_defaults.dart';

class NotificationPage extends StatelessWidget {
  const NotificationPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const AppBackButton(),
        title: const Text(
          'Notificações',
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.only(top: AppDefaults.padding),
        children: const [
          NotificationTile(
            imageLink: 'https://i.imgur.com/e3z9DmE.png',
            title: 'Reclamação atendida',
            subtitle: 'Reclamação atendida! Clique para ver mais detalhes.',
            time: 'Agora',
          ),
          NotificationTile(
            imageLink: 'https://i.imgur.com/e3z9DmE.png',
            title: 'Em desenvolvimento',
            subtitle: 'As notificações serão exibidas aqui em tempo real.',
            time: 'Agora',
          ),
        ],
      ),
    );
  }
}

class NotificationTile extends StatelessWidget {
  const NotificationTile({
    super.key,
    this.imageLink,
    required this.title,
    required this.subtitle,
    required this.time,
  });

  final String? imageLink;
  final String title;
  final String subtitle;
  final String time;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () {},
      child: Padding(
        padding: const EdgeInsets.all(8.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: imageLink != null
                  ? AspectRatio(
                      aspectRatio: 1 / 1,
                      child: NetworkImageWithLoader(imageLink!),
                    )
                  : null,
              title: Text(
                title,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: Colors.black,
                    ),
              ),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(height: 4),
                  Text(subtitle),
                  const SizedBox(height: 4),
                  Text(
                    time,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            const Padding(
              padding: EdgeInsets.only(left: 86),
              child: Divider(thickness: 0.1),
            ),
          ],
        ),
      ),
    );
  }
}
