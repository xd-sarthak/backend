//multer -> upload to local server -> upload to server
//cloudinary is a SDK 
import { v2 as cloudinary } from 'cloudinary';
import fs from "fs";

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


const uploadOncloudinary = async (localfilepath) => {
    try {
        if(!localfilepath) return null

       const response = await cloudinary.uploader.upload(localfilepath, {
            resource_type: "auto"
        })

        console.log("file is uploaded", response.url);

        return response;
    } catch (error) {
        fs.unlinkSync(localfilepath); //removes file from local server
        return null;
    }
}

export {uploadOncloudinary};