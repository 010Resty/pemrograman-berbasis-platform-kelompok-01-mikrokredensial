// Tiptap JSON → teks polos untuk tampilan materi bacaan.
// Server menyimpan `content` sebagai JSON Tiptap.
import 'dart:convert';

String tiptapToText(Object? content) {
  if (content is String) {
    final trimmed = content.trim();
    if (trimmed.isEmpty) return '';
    if (trimmed.startsWith('{')) {
      try {
        return _walk(jsonDecode(trimmed)).trim();
      } catch (_) {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (content is Map) return _walk(content).trim();
  return '';
}

String _walk(Object? node) {
  if (node == null) return '';
  if (node is String) return node;
  if (node is num || node is bool) return '$node';
  if (node is List) {
    return node.map(_walk).where((s) => s.trim().isNotEmpty).join('\n\n');
  }
  if (node is Map) {
    final type = node['type'];
    if (type == 'text') return '${node['text'] ?? ''}';
    final content = node['content'];
    if (content is List) {
      final sep = type == 'listItem' ? ' ' : '\n\n';
      return content.map(_walk).where((s) => s.trim().isNotEmpty).join(sep);
    }
    return '';
  }
  return '';
}
