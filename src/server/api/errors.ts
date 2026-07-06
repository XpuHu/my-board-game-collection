import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import type { ApiError as ApiErrorDto } from "@/shared/api";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(code: string, message: string, details?: unknown) {
    return new ApiError(400, code, message, details);
  }

  static notFound(code: string, message: string, details?: unknown) {
    return new ApiError(404, code, message, details);
  }

  static conflict(code: string, message: string, details?: unknown) {
    return new ApiError(409, code, message, details);
  }
}

export function validationError(error: ZodError) {
  return ApiError.badRequest(
    "VALIDATION_ERROR",
    "Request validation failed",
    error.flatten(),
  );
}

export function toErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return apiErrorResponse(validationError(error));
  }

  if (error instanceof ApiError) {
    return apiErrorResponse(error);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return apiErrorResponse(
        ApiError.conflict("IMPORT_CONFLICT", "Unique constraint conflict", {
          target: error.meta?.target,
        }),
      );
    }

    if (error.code === "P2025") {
      return apiErrorResponse(
        ApiError.notFound("ITEM_NOT_FOUND", "Requested resource was not found"),
      );
    }
  }

  console.error(error);

  return apiErrorResponse(
    new ApiError(500, "INTERNAL_ERROR", "Unexpected server error"),
  );
}

export async function withApiErrorHandling<T>(
  handler: () => Promise<NextResponse<T>>,
) {
  try {
    return await handler();
  } catch (error) {
    return toErrorResponse(error);
  }
}

function apiErrorResponse(error: ApiError) {
  const body: ApiErrorDto = {
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
  };

  return NextResponse.json(body, { status: error.status });
}
