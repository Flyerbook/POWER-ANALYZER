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
const S3_ACCESS_KEY = process.