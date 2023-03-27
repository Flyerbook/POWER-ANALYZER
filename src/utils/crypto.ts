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
 * @returns A promise to be either resolved with the encrypted data or rejected with an Error.
 */
export async function hashData(data: string | Buffer): Promise<string> {
    return await bcrypt.hash(data, SALT_ROUNDS);
}

/**
 * Source: https://stackoverflow.com/questions/8855687/secure-random-token-in-node-js
 * 
 * @returns A promise to be either resolved with a random token or rejected with an Error.
 */
export async function randomToken(tokenSize: number = DEFAULT_TOKEN_SIZE): Promise<string> {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(tokenSize, (err: any, buf: Buffer) => {
            if (err) {
                reject(err);
            } else {
                resolve(buf.toString("hex")