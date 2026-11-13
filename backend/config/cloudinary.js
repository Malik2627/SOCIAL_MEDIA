import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

function readCloudinaryEnv() {
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim() || '',
    apiKey: process.env.CLOUDINARY_API_KEY?.trim() || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET?.trim() || '',
  };
}

/**
 * Return true when all required Cloudinary credentials are present in the environment.
 */
export function isCloudinaryConfigured() {
  const { cloudName, apiKey, apiSecret } = readCloudinaryEnv();
  return Boolean(cloudName && apiKey && apiSecret);
}

/**
 * Configure and return the Cloudinary v2 client from environment variables.
 */
export function configureCloudinary() {
  const { cloudName, apiKey, apiSecret } = readCloudinaryEnv();

  cloudinary.config({
    cloud_name: cloudName || undefined,
    api_key: apiKey || undefined,
    api_secret: apiSecret || undefined,
    secure: true,
  });

  return cloudinary;
}

configureCloudinary();

export { cloudinary };
export default cloudinary;

