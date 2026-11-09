import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../shared_ui.dart';
import 'admin_api.dart';

class AdminUsersPage extends StatefulWidget {
  const AdminUsersPage({super.key, required this.api});

  final ApiClient api;

  @override
  State<AdminUsersPage> createState() => _AdminUsersPageState();
}

class _AdminUsersPageState extends State<AdminUsersPage> {
  List<AdminUser> _rows = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await AdminApi(widget.api).users();
      if (!mounted) return;
      setState(() => _rows = rows);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Peserta')),
      body: _loading
          ? StateViews.loading()
          : _error != null
              ? StateViews.error(_error!, _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _rows.isEmpty
                      ? ListView(children: [
                          StateViews.empty('Belum ada peserta',
                              'Belum ada akun peserta terdaftar.')
                        ])
                      : ListView.builder(
                          itemCount: _rows.length,
                          itemBuilder: (context, i) {
                            final u = _rows[i];
                            return ListTile(
                              leading: CircleAvatar(
                                  child: Text(u.name.isEmpty
                                      ? '?'
                                      : u.name[0].toUpperCase())),
                              title: Text(u.name),
                              subtitle: Text(
                                  '${u.email} · ${u.isActive ? 'aktif' : 'nonaktif'}'),
                            );
                          },
                        ),
                ),
    );
  }
}

class AdminInvitationsPage extends StatefulWidget {
  const AdminInvitationsPage({super.key, required this.api});

  final ApiClient api;

  @override
  State<AdminInvitationsPage> createState() => _AdminInvitationsPageState();
}

class _AdminInvitationsPageState extends State<AdminInvitationsPage> {
  List<AdminInvitation> _rows = [];
  bool _loading = true;
  String? _error;
  final _email = TextEditingController();
  final _name = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _email.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await AdminApi(widget.api).invitations();
      if (!mounted) return;
      setState(() => _rows = rows);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _create() async {
    if (_email.text.trim().isEmpty) return;
    try {
      final inv = await AdminApi(widget.api).createInvitation(
        email: _email.text.trim(),
        name: _name.text.trim().isEmpty ? null : _name.text.trim(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(
              'Undangan dibuat.${inv.token != null ? ' Token: ${inv.token}' : ''}')));
      _email.clear();
      _name.clear();
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Undangan Instruktur')),
      body: _loading
          ? StateViews.loading()
          : _error != null
              ? StateViews.error(_error!, _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(12),
                    children: [
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const Text('Undang instruktur baru',
                                  style:
                                      TextStyle(fontWeight: FontWeight.bold)),
                              const SizedBox(height: 8),
                              TextField(
                                controller: _email,
                                keyboardType: TextInputType.emailAddress,
                                decoration: const InputDecoration(
                                  labelText: 'Email',
                                  border: OutlineInputBorder(),
                                ),
                              ),
                              const SizedBox(height: 8),
                              TextField(
                                controller: _name,
                                decoration: const InputDecoration(
                                  labelText: 'Nama (opsional)',
                                  border: OutlineInputBorder(),
                                ),
                              ),
                              const SizedBox(height: 8),
                              FilledButton(
                                  onPressed: _create,
                                  child: const Text('Buat undangan')),
                            ],
                          ),
                        ),
                      ),
                      for (final r in _rows)
                        Card(
                          child: ListTile(
                            title: Text(r.email),
                            subtitle: Text('Status: ${r.status}'),
                            trailing: r.token == null
                                ? null
                                : IconButton(
                                    tooltip: 'Info token',
                                    icon: const Icon(Icons.key),
                                    onPressed: () =>
                                        ScaffoldMessenger.of(context)
                                            .showSnackBar(SnackBar(
                                                content: Text(
                                                    'Token: ${r.token}'))),
                                  ),
                          ),
                        ),
                    ],
                  ),
                ),
    );
  }
}

class AdminVouchersPage extends StatefulWidget {
  const AdminVouchersPage({super.key, required this.api});

  final ApiClient api;

  @override
  State<AdminVouchersPage> createState() => _AdminVouchersPageState();
}

class _AdminVouchersPageState extends State<AdminVouchersPage> {
  List<AdminVoucher> _rows = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await AdminApi(widget.api).vouchers();
      if (!mounted) return;
      setState(() => _rows = rows);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Voucher')),
      body: _loading
          ? StateViews.loading()
          : _error != null
              ? StateViews.error(_error!, _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _rows.isEmpty
                      ? ListView(children: [
                          StateViews.empty('Belum ada voucher',
                              'Buat voucher dari dasbor web bila diperlukan.')
                        ])
                      : ListView.builder(
                          itemCount: _rows.length,
                          itemBuilder: (context, i) {
                            final v = _rows[i];
                            return ListTile(
                              leading: const Icon(
                                  Icons.confirmation_number_outlined),
                              title: Text(v.code,
                                  style: const TextStyle(
                                      fontFamily: 'monospace',
                                      fontWeight: FontWeight.bold)),
                              subtitle: Text(
                                  '${v.kind} · kursus #${v.courseId} · ${v.status}'),
                            );
                          },
                        ),
                ),
    );
  }
}

class AdminPaymentsPage extends StatefulWidget {
  const AdminPaymentsPage({super.key, required this.api});

  final ApiClient api;

  @override
  State<AdminPaymentsPage> createState() => _AdminPaymentsPageState();
}

class _AdminPaymentsPageState extends State<AdminPaymentsPage> {
  List<AdminPaymentRow> _rows = [];
  bool _loading = true;
  bool _acting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await AdminApi(widget.api).pendingPayments();
      if (!mounted) return;
      setState(() => _rows = rows);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _verify(AdminPaymentRow r, bool accept) async {
    int? amount;
    String? reason;
    if (accept) {
      amount = r.amountExpected;
    } else {
      reason = await _askReason();
      if (reason == null) return;
    }
    setState(() => _acting = true);
    try {
      await AdminApi(widget.api).verifyPayment(
        paymentId: r.id,
        accept: accept,
        amountPaid: amount,
        reason: reason,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(accept ? 'Pembayaran diterima.' : 'Pembayaran ditolak.')));
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<String?> _askReason() async {
    final ctrl = TextEditingController();
    final res = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Tolak pembayaran'),
        content: TextField(
          controller: ctrl,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Alasan penolakan (wajib)',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Batal')),
          FilledButton(
            onPressed: () => Navigator.of(ctx)
                .pop(ctrl.text.trim().isEmpty ? null : ctrl.text.trim()),
            child: const Text('Tolak'),
          ),
        ],
      ),
    );
    return res;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Verifikasi Pembayaran')),
      body: _loading
          ? StateViews.loading()
          : _error != null
              ? StateViews.error(_error!, _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _rows.isEmpty
                      ? ListView(children: [
                          StateViews.empty('Antrean bersih',
                              'Tidak ada pembayaran menunggu verifikasi.')
                        ])
                      : ListView.builder(
                          padding: const EdgeInsets.all(12),
                          itemCount: _rows.length,
                          itemBuilder: (context, i) {
                            final r = _rows[i];
                            return Card(
                              margin: const EdgeInsets.only(bottom: 12),
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(r.invoice,
                                        style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontFamily: 'monospace')),
                                    Text(
                                        '${r.userName} · ${r.courseTitle}'),
                                    Text(
                                        'Tagihan: ${formatIDR(r.amountExpected)}'),
                                    const SizedBox(height: 8),
                                    Row(
                                      children: [
                                        Expanded(
                                          child: FilledButton(
                                            onPressed: _acting
                                                ? null
                                                : () => _verify(r, true),
                                            child: const Text('Terima'),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: OutlinedButton(
                                            onPressed: _acting
                                                ? null
                                                : () => _verify(r, false),
                                            child: const Text('Tolak'),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                ),
    );
  }
}
