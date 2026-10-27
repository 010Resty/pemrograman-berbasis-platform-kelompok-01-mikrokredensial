/**
 * Kontrak respons API Tahap 1 (auth).
 *
 * Sukses: { status: "success", message, data }
 * Gagal:   { status: "error", message, errors?, data: null }
 *
 * Frontend SvelteKit memetakan kontrak ini secara ketat
 * (perbandingan `status === "success"`, bukan truthy).
 */

export interface ApiSuccess<T> {
  status: "success";
  message: string;
  data: T;
}

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiError {
  status: "error";
  message: string;
  errors?: ApiFieldError[] | null;
  data: null;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export const success = <T>(message: string, data: T): ApiSuccess<T> => ({
  status: "success",
  message,
  data,
});

export const failure = (
  message: string,
  errors: ApiFieldError[] | null = null
): ApiError => ({
  status: "error",
  message,
  errors,
  data: null,
});
