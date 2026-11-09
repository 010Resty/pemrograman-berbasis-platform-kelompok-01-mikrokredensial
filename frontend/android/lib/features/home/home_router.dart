import 'package:flutter/material.dart';

import '../../core/models.dart';
import 'role_homes.dart';

/// Tanpa rute publik: pengguna yang sudah masuk langsung ke home per peran.
class HomeRouter extends StatelessWidget {
  const HomeRouter({super.key, required this.user, required this.onLogout});

  final AppUser user;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    switch (user.role) {
      case AppRole.teacher:
        return TeacherHome(user: user, onLogout: onLogout);
      case AppRole.admin:
        return AdminHome(user: user, onLogout: onLogout);
      case AppRole.student:
        return StudentHome(user: user, onLogout: onLogout);
    }
  }
}
