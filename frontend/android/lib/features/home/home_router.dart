import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/models.dart';
import 'role_homes.dart';

/// Tanpa rute publik: pengguna yang sudah masuk langsung ke home per peran.
class HomeRouter extends StatelessWidget {
  const HomeRouter(
      {super.key, required this.api, required this.user, required this.onLogout});

  final ApiClient api;
  final AppUser user;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    switch (user.role) {
      case AppRole.teacher:
        return TeacherHome(api: api, user: user, onLogout: onLogout);
      case AppRole.admin:
        return AdminHome(api: api, user: user, onLogout: onLogout);
      case AppRole.student:
        return StudentHome(api: api, user: user, onLogout: onLogout);
    }
  }
}
