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
exp