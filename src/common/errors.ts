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
    
    // Request's format is invalid (e.g., the request expects a string and receives