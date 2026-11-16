import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api_client.dart';
import '../../shared_ui.dart';
import 'report_api.dart';

enum _Range { all, d7, d30 }

/// Laporan admin read-only: ringkasan + keuangan + per kursus.
/// Sumber: `GET /admin/reports` (agregat server, tanpa angka contoh).
class AdminReportsPage extends StatefulWidget {
  const AdminReportsPage({super.key, required this.api});

  final ApiClient api;

  @override
  State<AdminReportsPage> createState() => _AdminReportsPageState();
}

class _AdminReportsPageState extends State<AdminReportsPage> {
  AdminReports? _data;
  bool _loading = true;
  String? _error;
  bool _sharing = false;
  _Range _range = _Range.all;

  @override
  void initState() {
    super.initState();
    _load();
  }

  DateTime? get _from {
    final now = DateTime.now();
    switch (_range) {
      case _Range.all:
        return null;
      case _Range.d7:
        return DateTime(now.year, now.month, now.day).subtract(const Duration(days: 6));
      case _Range.d30:
        return DateTime(now.year, now.month, now.day).subtract(const Duration(days: 29));
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ReportApi(widget.api).fetch(from: _from);
      if (!mounted) return;
      setState(() => _data = data);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _shareCsv() async {
    final data = _data;
    if (data == null || _sharing) return;
    setState(() => _sharing = true);
    try {
      final buf = StringBuffer('bagian,metrik,nilai\n');
      final s = data.summary;
      void row(String bagian, String metrik, Object nilai) =>
          buf.writeln('$bagian,$metrik,$nilai');
      row('ringkasan', 'totalStudents', s.totalStudents);
      row('ringkasan', 'totalTeachers', s.totalTeachers);
      row('ringkasan', 'totalCourses', s.totalCourses);
      row('ringkasan', 'totalCertificates', s.totalCertificates);
      row('ringkasan', 'activeEnrollments', s.activeEnrollments);
      row('ringkasan', 'completedEnrollments', s.completedEnrollments);
      row('keuangan', 'paymentsMenunggu', s.paymentsMenunggu);
      row('keuangan', 'paymentsDiverifikasi', s.paymentsDiverifikasi);
      row('keuangan', 'paymentsDitolak', s.paymentsDitolak);
      row('keuangan', 'revenueVerified', s.revenueVerified);
      row('keuangan', 'voucherRedemptions', s.voucherRedemptions);
      row('sertifikat', 'issued', data.certificatesIssued);
      row('sertifikat', 'revoked', data.certificatesRevoked);
      buf.writeln('kursus,courseId,title,status,studentCount,avgProgress,pendingReviews,revenueVerified,paymentsMenunggu,paymentsDiverifikasi,certificatesIssued,certificatesRevoked');
      for (final c in data.perCourse) {
        final title = c.title.replaceAll(',', ' ').replaceAll('\n', ' ');
        buf.writeln(
            'kursus,${c.courseId},$title,${c.status},${c.studentCount},${c.avgProgress},${c.pendingReviews},${c.revenueVerified},${c.paymentsMenunggu},${c.paymentsDiverifikasi},${c.certificatesIssued},${c.certificatesRevoked}');
      }
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/laporan-admin.csv');
      await file.writeAsString(buf.toString(), flush: true);
      await SharePlus.instance.share(ShareParams(
        files: [XFile(file.path)],
        text: 'Laporan admin ARISTOTELES',
      ));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Gagal membagikan CSV: $e')),
      );
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Laporan'),
        actions: [
          IconButton(
            tooltip: 'Bagikan CSV',
            icon: _sharing
                ? const SizedBox(
                    width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.share_outlined),
            onPressed: _data == null ? null : _shareCsv,
          ),
        ],
      ),
      body: _loading
          ? StateViews.loading()
          : _error != null
              ? StateViews.error(_error!, _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(12),
                    children: [
                      Wrap(
                        spacing: 8,
                        children: [
                          ChoiceChip(
                            label: const Text('Semua'),
                            selected: _range == _Range.all,
                            onSelected: (_) {
                              setState(() => _range = _Range.all);
                              _load();
                            },
                          ),
                          ChoiceChip(
                            label: const Text('7 hari'),
                            selected: _range == _Range.d7,
                            onSelected: (_) {
                              setState(() => _range = _Range.d7);
                              _load();
                            },
                          ),
                          ChoiceChip(
                            label: const Text('30 hari'),
                            selected: _range == _Range.d30,
                            onSelected: (_) {
                              setState(() => _range = _Range.d30);
                              _load();
                            },
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      _SectionTitle('Ringkasan'),
                      _StatGrid(items: [
                        _Stat('Peserta', '${_s().totalStudents}'),
                        _Stat('Instruktur', '${_s().totalTeachers}'),
                        _Stat('Kursus', '${_s().totalCourses}'),
                        _Stat('Sertifikat', '${_s().totalCertificates}'),
                        _Stat('Enrollment aktif', '${_s().activeEnrollments}'),
                        _Stat('Enrollment selesai', '${_s().completedEnrollments}'),
                      ]),
                      const SizedBox(height: 12),
                      _SectionTitle('Keuangan'),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                formatIDR(_s().revenueVerified),
                                style: const TextStyle(
                                    fontSize: 24, fontWeight: FontWeight.w900),
                              ),
                              const Text('Pendapatan diverifikasi'),
                              const SizedBox(height: 8),
                              Text(
                                  '${_s().paymentsMenunggu} menunggu · ${_s().paymentsDiverifikasi} diverifikasi · ${_s().paymentsDitolak} ditolak'),
                              Text('${_s().voucherRedemptions} voucher ditukar'),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      _SectionTitle('Sertifikat'),
                      Card(
                        child: ListTile(
                          leading: const Icon(Icons.verified, color: Colors.green),
                          title: Text(
                              '${_data!.certificatesIssued} terbit · ${_data!.certificatesRevoked} dicabut'),
                          subtitle: const Text('Periode filter yang dipilih'),
                        ),
                      ),
                      const SizedBox(height: 12),
                      _SectionTitle('Per kursus (${_data!.perCourse.length})'),
                      const Padding(
                        padding: EdgeInsets.only(bottom: 8),
                        child: Text(
                          'Progres rata-rata & antrean nilai adalah snapshot saat ini (tidak terpengaruh filter tanggal).',
                          style: TextStyle(fontSize: 11, color: Colors.grey),
                        ),
                      ),
                      if (_data!.perCourse.isEmpty)
                        StateViews.empty('Belum ada kursus',
                            'Data per kursus muncul setelah ada kursus.')
                      else
                        for (final c in _data!.perCourse)
                          Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            child: ExpansionTile(
                              title: Text(c.title,
                                  maxLines: 2, overflow: TextOverflow.ellipsis),
                              subtitle: Text(
                                  '${c.status} · ${c.studentCount} peserta · ${formatIDR(c.revenueVerified)}'),
                              children: [
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('Progres rata-rata: ${c.avgProgress}%'),
                                      Text(
                                          'Antrean nilai: ${c.pendingReviews} menunggu'),
                                      Text(
                                          'Pembayaran: ${c.paymentsMenunggu} menunggu · ${c.paymentsDiverifikasi} diverifikasi'),
                                      Text(
                                          'Sertifikat: ${c.certificatesIssued} terbit · ${c.certificatesRevoked} dicabut'),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                    ],
                  ),
                ),
    );
  }

  AdminReportSummary _s() => _data!.summary;
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
    );
  }
}

class _Stat {
  _Stat(this.label, this.value);

  final String label;
  final String value;
}

class _StatGrid extends StatelessWidget {
  const _StatGrid({required this.items});

  final List<_Stat> items;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 8,
      crossAxisSpacing: 8,
      childAspectRatio: 1.6,
      children: [
        for (final s in items)
          Card(
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(s.value,
                      style: const TextStyle(
                          fontSize: 24, fontWeight: FontWeight.bold)),
                  Text(s.label),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
