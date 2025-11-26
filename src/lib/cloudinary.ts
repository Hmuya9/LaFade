import cloudinary from "cloudinary";
import { env } from "@/lib/env";

// Configure Cloudinary with env vars (if available)
if (env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret) {
  cloudinary.v2.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
  });
}

// Export cloudinary v2 instance
export { cloudinary };

