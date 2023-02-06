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
    appLogger.error(err);
}

/**
 * Cretes a signed url for a given image. Upload the image to the signed url.
 * 
 * @param fileName The image's file name.
 * @param fileType The image's file type.
 * @returns A promised to be either resolved with the image's url and signed url or rejected with an Error.
 */
export async function generateS3SignedUrl(fileName: string, fileType: ImageFileType): Promise<SignedUrl> {
    if (s3Client == null) return Promise.reject(
        new Error("ImageService not initialized. Missing environment configuration.")
    );

    const s3Params = {
      Bucket: S3_BUCKET,
      Key: fileName,
      Expires: EXPIRES,
      ContentType: fileType,
    };
  
    const signedUrl = await s3Client.getSignedUrlPromise('putObject', s3Params);
    return {
        url: signedUrl.split("?")[0],
        signed: signedUrl
    };
}