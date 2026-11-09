# Changelog Kontrak `frontend/shared/`

## 1.0.0 — 2026-11-10 (Tahap 2 multi-platform)

- Awal: `contract/envelope.md`, `contract/endpoints.json` (±80 endpoint),
  `scenarios/k-01-k-08.md`.
- Diselaraskan dengan backend pasca refresh-token (migrasi 0020) dan
  K-08 materi (`expectedUpdatedAt`/`MATERIAL_CONFLICT`,
  `changeSignificance`/`changeReason`, `GET /materials/:id/changes`).
- Skenario K-01–K-08 ditulis level HTTP agar dapat diimplementasikan
  identik oleh web (SvelteKit/TS) dan Android (Flutter/Dart).
