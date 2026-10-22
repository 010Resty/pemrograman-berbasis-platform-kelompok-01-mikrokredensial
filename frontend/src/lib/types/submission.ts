/** Tipe submission PDF tugas -> Google Drive -> aplikasi. */

export type DriveMode = 'drive' | 'mock';

export type SubmissionStatus = 'Menunggu' | 'Dinilai';

export interface AssignmentSubmission {
	id: string;
	courseId: string;
	moduleId: string;
	materialId: string;
	studentName: string;
	studentNim: string;
	note: string;
	fileName: string;
	originalName: string;
	fileSize: number;
	mimeType: 'application/pdf';
	driveFileId: string;
	driveLink: string;
	driveDownload?: string | null;
	driveMode: DriveMode;
	status: SubmissionStatus;
	score: number | null;
	feedback?: string;
	createdAt: string;
	gradedAt?: string | null;
}

export interface UploadMeta {
	courseId: string;
	moduleId: string;
	materialId: string;
	studentName: string;
	studentNim: string;
	note: string;
}

/** Discriminated union status upload di UI. */
export type UploadPhase =
	| { kind: 'idle' }
	| { kind: 'selected'; file: File; previewUrl: string }
	| { kind: 'uploading'; file: File; previewUrl: string; progress: number }
	| { kind: 'uploaded'; submission: AssignmentSubmission; previewUrl: string }
	| { kind: 'error'; message: string; previewUrl?: string };

export interface ApiSuccess<T> {
	status: true;
	message: string;
	data: T;
}

export interface ApiError {
	status: false;
	message: string;
	errors?: Array<{ field: string; message: string }> | null;
	data: null;
}

export type ApiResult<T> = ApiSuccess<T> | ApiError;

export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export function formatBytes(n: number): string {
	if (!Number.isFinite(n) || n <= 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB'];
	const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
	const v = n / Math.pow(1024, i);
	return `${v >= 100 ? Math.round(v) : v.toFixed(v >= 10 ? 1 : 2)} ${units[i]}`;
}
