import { Response } from "express";

export interface ApiSuccessEnvelope<T> {
  ok: true;
  data: T;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorEnvelope {
  ok: false;
  error: ApiErrorDetail;
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  const envelope: ApiSuccessEnvelope<T> = {
    ok: true,
    data
  };
  return res.status(statusCode).json(envelope);
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode = 500,
  details?: unknown
): Response {
  const envelope: ApiErrorEnvelope = {
    ok: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {})
    }
  };
  return res.status(statusCode).json(envelope);
}

