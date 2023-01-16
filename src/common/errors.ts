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
 async functi