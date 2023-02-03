import { Request, Response } from "express";
import { FieldErrors, ValidateError } from "tsoa";
import { appLogger } from "../utils/logger";

export enum AppErrorCode {
    // Unspecified error.
    UNSPECIFIED = "unspecified",
    
    // Missing authentication token.
    TOKEN_MISSING = "token.missing",
    
    // Authentication token expired.
    TOKEN_EXPIRED = "token.expired",
    
    // Invalid authentication token.
    TOKEN_INVALID = "token.invalid",
    
    // Request doesn't have enough privileges for the given action.
    PRIVILEGE = "request.privilege",
    
    // Request's format is invalid (e.g., the request expects a string and receives a number).
    REQ_FORMAT = "request.format",

    // The request can't be completed because the target resource doesn't exist.
    NOT_FOUND = "resource.not_found",

    // The request can't be completed because of confliting data with an existing resource.
    DUPLICATED = "resource.duplicated",
}

/**
 * @param code The app error.
 * @param message A message describing the error.
 * @param fields The fields that generated the error.
 * Each field has a message describing the error for that field and may have the associated value. 
 */
interface AppErrorConstructor {
    name?: string,
    code?: AppErrorCode,
    message?: string,
    fields?: FieldErrors,
}

/**
 * A wrapper class for the application custom errors.
 * We don't need a stack frame for this type of errors.
 */
export class AppError {
    name?: string;
    code?: AppErrorCode;
    message?: string;
    fields?: FieldErrors;

    constructor(params?: AppErrorConstructor) {
        this.name = params?.name || "AppError";
        this.message = params?.message;
        this.code = params?.code || AppErrorCode.UNSPECIFIED;
        this.fields = params?.fields;
    }
}

export class BadRequestError extends AppError {name = "BadRequestError"}
export class AuthenticationError extends AppError {name = "AuthenticationError"};
export class ForbiddenError extends AppError {name = "ForbiddenError"};
export class NotFoundError extends AppError {name = "NotFoundError"};
export class ConflitError extends AppError {name = "ConflitError"}

/**
 * Run this handler when an error is raised. For example, the server can't connect to the database. 
 * 
 * @param error Error object.
 * @param request Express Request object.
 * @param response Express Response object.
 * @param next Callback function. Will be ignored.
 */
export function requestErrorHandler(error: Error | AppError, request: Request, response: Response, next: Function): void {
    // Error pre-processing
    // All errors, except unexpected ones, should be of type AppError.
    switch(error.constructor) {
        case ValidateError:
            error = new BadRequestError({
                name: error.name,
                code: AppErrorCode.REQ_FORMAT,
                message: error.message,
                fields: (error as ValidateError).fields
            });
            break;
        case SyntaxError:
            error = new BadRequestError({
                name: error.name,
                code: AppErrorCode.REQ_FORMAT,
                message: error.message,
            });
            break;
        default:
            ;
    }

    if (error instanceof AppError) {
        appLogger.info(error);
    }

    switch(error.constructor) {
        case BadRequestError:
            sendBadRequestError(response, error as BadRequestError);
            break;
        case AuthenticationError:
            sendAuthenticationError(response, error as AuthenticationError);
            break;
        case ForbiddenError:
            sendAuthorizationError(response, error as ForbiddenError);
            break;
        case NotFoundError:
            sendNotFoundError(response, error as NotFoundError);
            break;
        case ConflitError:
            sendConflitError(response, error as ConflitError);
            break;
        default:
            appLogger.error(error + "\n" + (error as any).stack);
            sendUnexpectedServerError(response);
    }
}

/**
 * When the client's request is malformed or contains invalid data, even after passing through the
 * checks, send a "400 Bad Request" JSON response.
 * 
 * @param response Express Response object.
 * @param error BadRequestError object.
 */
 async function sendBadRequestError(response: Response, error: BadRequestError): Promise<void> {
    const body: BadRequestErrorResponse = {
        status: 400,
        error: {
            code: error.code,
            message: error.message,
            fields: error.fields
        }
    }

    response.status(400).json(body);
}

/**
 * When the client can't be authenticated, send a "403 Forbidden" JSON response.
 * 
 * @param response Express Response object.
 * @param error AuthenticationError object.
 */
 async function sendAuthenticationError(response: Response, error: AuthenticationError): Promise<void> {
    const body: AuthenticationErrorResponse = {
        status: 401,
        error: {
            code: error.code,
            message: error.message
        }
    }

    // The 401 Unauthorized status code states that WWW-Authenticate MUST be used.
    // However, our authentication isn't one of the schemes maintained by IANA.
    // Technically, even though the scheme "Cookie" doesn't exist, we are allowed to use whatever.
    // User agent (e.g. browser) behaviour is undefined in this case.
    response.setHeader("WWW-Authenticate", "Cookie");
    response.status(401).json(body);
}

/**
 * When the client can't access the requested resource, send a "403 Forbidden" JSON response.
 * 
 * @param response Express Response object.
 * @param error AuthorizationError object.
 */
async function sendAuthorizationError(response: Response, error: ForbiddenError): Promise<void> {
    const body: ForbiddenErrorResponse = {
        status: 403,
        error: {
            code: error.code,
            message: error.message
        }
    }

    response.status(403).json(body);
}

/**
 * When the client requests a resource that doesn't exist, send a "401 Not Found" JSON response.
 * 
 * @param response Express Response object.
 * @param error NotFoundError object.
 */
 async function sendNotFoundError(response: Response, error: NotFoundError): Promise<void> {
    const body: NotFoundErrorResponse = {
        status: 404,
        error: {
            code: error.code,
            message: error.message
        }
    }

    response.status(404).json(body);
}

/**
 * When the client requests to create/update a resource, but that resource is duplicated or can't be updated.
 * Send a "409 Conflit" JSON response.
 * 
 * @param response Express Response object.
 * @param error NotFoundError object.
 */
 async function sendConflitError(response: Response, error: ConflitError): Promise<void> {
    const body: ConflitErrorResponse = {
        status: 409,
        error: {
            code: error.code,
            message: error.message,
            fields: error.fields,
        }
    }

    response.status(409).json(body);
}

/**
 * All unexpected errors (e.g., no database connection), are sent as a "500 Internal Server" Error JSON response.
 * 
 * @param response Express Response object.
 */
async function sendUnexpectedServerError(response: Response): Promise<void> {
    const body: ServerErrorResponse = {
        status: 500,
        error: {
            message: "Unexpected error."
        }
    }
    response.status(500).json(body);
}

// ------------------------------ Response Formats ------------------------------ //

interface BaseErrorResponse {
    status: number,
    error: {
        code?: AppErrorCode,
        message?: string,
        fields?: FieldErrors
    }
}

/** JSON response format for a "400 Bad Request" error. */
export interface BadRequestErrorResponse extends BaseErrorResponse {
    status: 400,
}

/** JSON response format for a "401 Unauthorized" error. */
export interface AuthenticationErrorResponse extends BaseErrorResponse {
    status: 401,
}

/** JSON response format for a "403 Forbidden" error. */
export interface ForbiddenErrorResponse extends BaseErrorResponse {
    status: 403,
}

/** JSON response format for a "404 Not Found" error. */
export interface NotFoundErrorResponse extends BaseErrorResponse {
    status: 404,
}

/** JSON response format for a "409 Conflit" error. */
export interface ConflitErrorResponse extends BaseErrorResponse {
    status: 409,
}

/** JSON response format for a "500 Internal Server Error" error. */
export interface ServerErrorResponse extends BaseErrorResponse {
    status: 500,
}