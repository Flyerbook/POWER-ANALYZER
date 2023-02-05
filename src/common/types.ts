import { Transaction } from "sequelize";

/** 
 * @pattern ^[A-Za-z][\w]{4,19}$
 * @example "user000"
 */
export type Username = string;

/**
 * @pattern ^[\w]{8,19}$
 * @example "password"
 */
export type Password = string;

/**
 * @pattern \A[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\Z
 * @example "user000@mail.com"
 */
export type Email = string;

/** @example "Alice" */
export type Fullname = string;

// Callback signature for the sequelize.transaction() function.
export type SequelizeTransactionCallback<T> = (t: Transaction) => Promise<T>

/**
 * @pattern ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$
 * @format uuid
 */
export type UUID = string

export const USERNAME_PATTERN = /^[A-Za-z][\w]{4,19}$/i
export const PASSWORD_PATTERN = /^[\w]{8,19}$/i