import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from '@fastify/type-provider-zod';

/** Base for domain errors. Repositories translate Prisma errors into these. */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(409, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}

export interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details?: { path: string; message: string }[];
}

const STATUS_NAMES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

function body(statusCode: number, message: string, details?: ErrorBody['details']): ErrorBody {
  return {
    statusCode,
    error: STATUS_NAMES[statusCode] ?? 'Error',
    message,
    ...(details ? { details } : {}),
  };
}

/** Single error shape for the whole API. 5xx details only go to the log. */
export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (hasZodFastifySchemaValidationErrors(error)) {
    const details = error.validation.map((issue) => ({
      path: issue.instancePath || '/',
      message: issue.message ?? 'Invalid value',
    }));
    return reply.status(400).send(body(400, 'Request validation failed', details));
  }

  if (isResponseSerializationError(error)) {
    // The response didn't match its schema: a bug on our side, never the client's.
    request.log.error({ err: error }, 'response serialization failed');
    return reply.status(500).send(body(500, 'Internal Server Error'));
  }

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(body(error.statusCode, error.message));
  }

  // Fastify and plugin errors (rate limit, payload too large, bad JSON...) carry their own 4xx.
  const statusCode = error.statusCode ?? 500;
  if (statusCode < 500) {
    return reply.status(statusCode).send(body(statusCode, error.message));
  }

  request.log.error({ err: error }, 'unhandled error');
  return reply.status(statusCode).send(body(statusCode, STATUS_NAMES[statusCode] ?? 'Error'));
}
