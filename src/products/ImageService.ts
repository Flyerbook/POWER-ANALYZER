/**
 * Upload to Amazon Web Services
 * Tutorial from Heroku
 * https://devcenter.heroku.com/articles/s3-upload-node
 */
import aws from "aws-sdk";
import { appLogger } from "../utils/logger";

export type ImageFileType = "image/jpeg" | "image/png";
export interface SignedUrl {
    url: string,
    signed: string,
}

const S3_REGION = process.env.S3_REGION;
const S3_BUCKET = process.env.S3_BUCKET;
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY;
const EXPIRES = 300;    // 5 minutes
let s3Client: aws.S3 | null = null;

// These values must be initialize to use this module
try {
    if (S3_REGION != null && S3_BUCKET != null && S3_ACCESS_KEY != null && S3_ACCESS_KEY != null && S3_SECRET_KEY != null) {
        s3Client = new aws.S3({
            region : S3_REGION,
            credentials: {
                accessKeyId: S3_ACCESS_KEY,
                secretAccessKey: S3_SECRET_KEY
            }
        });
    } else {
        appLogger.warn("ImageService not initialized. Missing environment configuration.");
    }
} catch (err) {
    // Invalid configuration
    appLogger.err