import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  console.log("🚀 ~ uploadOnCloudinary ~ localFilePath:", localFilePath)
  try {
    if (!localFilePath) return null;

    // Upload to Cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    console.log("🚀 ~ uploadOnCloudinary ~ response:", response)

    // Remove file after upload
    await fs.promises.unlink(localFilePath);

    return response;
  } catch (error) {
    console.log("🚀 ~ uploadOnCloudinary error:", error);

    // Clean up if upload failed
    if (localFilePath) {
      await fs.promises.unlink(localFilePath).catch(() => {});
    }

    return null;
  }
};

export { uploadOnCloudinary };
