/** apiservices.selcuk.edu.tr standart cevap zarfı */
export interface SelcukApiError {
  errorCode?: string;
  errorMessage?: string;
}

export interface SelcukServiceResponse<T> {
  isSucceeded: boolean;
  error: SelcukApiError | null;
  value: T | null;
  sessionId?: string | null;
  message?: string | null;
  executionTime?: number;
}

/** POST /api/v1/Auth/Login → value */
export interface SelcukLoginValue {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken: string;
}

/** POST /api/v1/Auth/Refresh body */
export interface SelcukRefreshRequest {
  refreshToken: string;
  fcmToken?: string;
}

/** POST /api/v1/Permission/HasPermission body */
export interface SelcukHasPermissionRequest {
  groupCode: string;
  codes: string[];
  operation: number;
}
