import bcrypt from "bcrypt";
import crypto from "crypto";

const DEFAULT_TOKEN_SIZE = 32;
const SALT_ROUNDS = 8;

/**
 * @param data The data to be validated.
 * @param encrypted The encrypted data.
 * @returns A promise to be either resolved with the comparison result or rejected with an Error.
 */
export async function validateData(data: string | Buffer, encrypted: string): Promise<boolean> {
    return await bcrypt.compare(data, encrypted);
}

/**
 * @param data The data to be encrypted.
 * @returns A pr