import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import fs from "fs"

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null
        // upload the file on cloudinary server
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        // file uploaded sucessfully 
        // console.log("file is uploaded on  the cloudinary server", response.url);
        fs.unlinkSync(localFilePath)
        console.log("🚀 ~ uploadOnCloudinary ~ response:", response)
        return response;
    } catch (error) {
        fs.unlink(localFilePath) //removes the locally saved file from our server
        return null;

    }
}

export { uploadOnCloudinary }