import { browser } from '$app/environment';

/**
 * Voucher kursus gratis — SIMULASI LOKAL (browser saja, demo).
 *
 * Kode di sini HANYA untuk demo alur UI (`ARISTO-...`) dan BUKAN token/otorisasi
 * produksi. Keunikan kode global, penyimpanan permanen, validasi hak peserta,
 * batas pemakaian atomik (anti-race), pencatatan riwayat penukaran, dan pemberian
 * akses kursus wajib dilakukan backend. Jangan pernah menganggap voucher lokal
 * sudah memberi akses kursus sungguhan.
 *
 * Gap vs K-03: keputusan K-03 menargetkan 1 voucher = 1 akun + 1 kursus 1x pakai
 * dengan status Aktif/Digunakan/Dinonaktifkan. Model di berkas ini mengikuti
 * spesifikasi fitur (Personal 1x global + Umum Nx, status Aktif/Habis
 * digunakan/Kedaluarsa/Dibatalkan) — pemetaan "Digunakan" ≈ "Habis digunakan".
 */
export type VoucherKind = 'Personal' | 'Umum';

/** Status turunan — prioritas: Dibatalkan > Habis digunakan > Kedaluarsa > Aktif. */
export type VoucherStatus = 'Aktif' | 'Habis digunakan' | 'Kedaluarsa' | 'Dibatalkan';

export interface RedemptionRecord {
	id: string;
	/** Waktu penukaran simulasi (ISO). */
	redeemedAt: string;
	/**
	 * Catatan penukaran. Sengaja TANPA identitas peserta: backend belum ada
	 * sehingga riwayat di sini hanya penghitung demo, bukan data peserta nyata.
	 */
	note: string;
}

export interface Voucher {
	id: string;
	/** Kode demo lokal. Keunikan global final wajib dijamin backend. */
	code: string;
	kind: VoucherKind;
	courseId: number;
	courseTitle: string;
	createdAt: string;
	/** Null = tanpa batas waktu. */
	expiresAt: string | null;
	maxUses: number;
	usedCount: number;
	cancelled: boolean;
	cancelledAt: string | null;
	/** Riwayat TIDAK dihapus saat voucher dibatalkan/kedaluarsa. */
	history: RedemptionRecord[];
}

export type VoucherView = Voucher & { status: VoucherStatus };

const KEY = 'aristoteles:vouchers:v1';
const MAX_ITEMS = 100;

/** Alfabet kode: tanpa karakter ambigu (0/O, 1/I/L). */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_PREFIX = 'ARISTO';

function uid(prefix: string): string {
	return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function randomChunk(len: number): string {
	let out = '';
	const buf = new Uint32Array(len);
	if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
		crypto.getRandomValues(buf);
		for (let i = 0; i < len; i++) out += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
	} else {
		for (let i = 0; i < len; i++) {
			out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
		}
	}
	return out;
}

/** Buat kode demo yang belum dipakai daftar lokal. Keunikan global tetap tugas backend. */
export function generateCode(taken: Set<string>): string {
	for (let attempt = 0; attempt < 50; attempt++) {
		const code = `${CODE_PREFIX}-${randomChunk(4)}-${randomChunk(4)}`;
		if (!taken.has(code)) return code;
	}
	return `${CODE_PREFIX}-${randomChunk(4)}-${randomChunk(4)}-${randomChunk(2)}`;
}

function demoHistory(count: number, baseIso: string): RedemptionRecord[] {
	const base = new Date(baseIso).getTime();
	return Array.from({ length: count }, (_, i) => ({
		id: uid('rdm'),
		redeemedAt: new Date(base + (i + 1) * 24 * 3600 * 1000).toISOString(),
		note: 'Penukaran simulasi (demo) — tanpa identitas peserta.'
	}));
}

/** Data demonstrasi awal agar filter/status teruji. Berlabel demo di UI. */
function seed(): Voucher[] {
	const now = Date.now();
	const day = 24 * 3600 * 1000;
	const iso = (t: number) => new Date(t).toISOString();
	return [
		{
			id: 'vch-seed-personal-aktif',
			code: 'ARISTO-DEMO-PRS1',
			kind: 'Personal',
			courseId: 1,
			courseTitle: 'Pengembangan Web Frontend',
			createdAt: iso(now - 6 * day),
			expiresAt: null,
			maxUses: 1,
			usedCount: 0,
			cancelled: false,
			cancelledAt: null,
			history: []
		},
		{
			id: 'vch-seed-umum-aktif',
			code: 'ARISTO-DEMO-U1TM',
			kind: 'Umum',
			courseId: 2,
			courseTitle: 'Basis Data & SQL',
			createdAt: iso(now - 10 * day),
			expiresAt: iso(now + 20 * day),
			maxUses: 20,
			usedCount: 7,
			cancelled: false,
			cancelledAt: null,
			history: demoHistory(7, iso(now - 10 * day))
		},
		{
			id: 'vch-seed-umum-habis',
			code: 'ARISTO-DEMO-HB15',
			kind: 'Umum',
			courseId: 5,
			courseTitle: 'Machine Learning Dasar',
			createdAt: iso(now - 30 * day),
			expiresAt: null,
			maxUses: 5,
			usedCount: 5,
			cancelled: false,
			cancelledAt: null,
			history: demoHistory(5, iso(now - 30 * day))
		},
		{
			id: 'vch-seed-personal-kedaluarsa',
			code: 'ARISTO-DEMO-EXP1',
			kind: 'Personal',
			courseId: 4,
			courseTitle: 'Keamanan Siber',
			createdAt: iso(now - 40 * day),
			expiresAt: iso(now - 2 * day),
			maxUses: 1,
			usedCount: 0,
			cancelled: false,
			cancelledAt: null,
			history: []
		},
		{
			id: 'vch-seed-umum-batal',
			code: 'ARISTO-DEMO-BTL1',
			kind: 'Umum',
			courseId: 3,
			courseTitle: 'Jaringan Komputer Dasar',
			createdAt: iso(now - 15 * day),
			expiresAt: iso(now + 15 * day),
			maxUses: 10,
			usedCount: 2,
			cancelled: true,
			cancelledAt: iso(now - 3 * day),
			history: demoHistory(2, iso(now - 15 * day))
		}
	];
}

function loadAll(): Voucher[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(KEY);
		if (raw === null) {
			const initial = seed();
			try {
				localStorage.setItem(KEY, JSON.stringify(initial));
			} catch {
				/* abaikan — data hanya sesi ini */
			}
			return initial;
		}
		const parsed = JSON.parse(raw) as Voucher[];
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((v) => v && typeof v === 'object' && typeof v.id === 'string');
	} catch {
		return [];
	}
}

function persistAll(list: Voucher[]): void {
	if (!browser) return;
	try {
		localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ITEMS)));
	} catch {
		/* penyimpanan penuh/diblokir — perubahan hanya berlaku sesi ini */
	}
}

export function isExpired(v: Pick<Voucher, 'expiresAt'>, now = Date.now()): boolean {
	if (v.expiresAt === null) return false;
	return new Date(v.expiresAt).getTime() <= now;
}

/**
 * Status turunan dengan prioritas tetap:
 * Dibatalkan > Habis digunakan > Kedaluarsa > Aktif.
 */
export function statusOf(v: Voucher, now = Date.now()): VoucherStatus {
	if (v.cancelled) return 'Dibatalkan';
	if (v.usedCount >= v.maxUses) return 'Habis digunakan';
	if (isExpired(v, now)) return 'Kedaluarsa';
	return 'Aktif';
}

export function toView(v: Voucher): VoucherView {
	return { ...v, status: statusOf(v) };
}

export function listVouchers(): VoucherView[] {
	return loadAll().map(toView);
}

export interface CreateVoucherInput {
	kind: VoucherKind;
	courseId: number;
	courseTitle: string;
	/** Diabaikan untuk Personal (dipaksa 1). */
	maxUses: number;
	/** Null = tanpa batas waktu. */
	expiresAt: string | null;
}

export function createVoucher(input: CreateVoucherInput): VoucherView {
	const now = new Date();
	const taken = new Set(loadAll().map((v) => v.code));
	const voucher: Voucher = {
		id: uid('vch'),
		code: generateCode(taken),
		kind: input.kind,
		courseId: input.courseId,
		courseTitle: input.courseTitle,
		createdAt: now.toISOString(),
		expiresAt: input.expiresAt,
		maxUses: input.kind === 'Personal' ? 1 : input.maxUses,
		usedCount: 0,
		cancelled: false,
		cancelledAt: null,
		history: []
	};
	persistAll([voucher, ...loadAll()].slice(0, MAX_ITEMS));
	return toView(voucher);
}

/** Batalkan voucher yang masih Aktif. Riwayat tetap dipertahankan. */
export function cancelVoucher(id: string): boolean {
	let changed = false;
	persistAll(
		loadAll().map((v) => {
			if (v.id !== id || statusOf(v) !== 'Aktif') return v;
			changed = true;
			return { ...v, cancelled: true, cancelledAt: new Date().toISOString() };
		})
	);
	return changed;
}
