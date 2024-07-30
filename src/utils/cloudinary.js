import {v2 as cloudinary} from "cloudinary"
import { log } from "console";
import fs from "fs"

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: CLOUDINARY_API_KEY, 
    api_secret:CLOUDINARY_API_SECRET 
});

const uploadOnCloudinary =async (localFilePath)=>{
    try{
        if(!localFilePath) return null;
        //upload the file on cloudinary
       const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type:"auto"
        })
        //file upload succesfully
        console.log("File uploaded on cloudinary",response.url);
        return response;
    }catch(error){
       fs.unlinkSync(localFilePath) // remove the locally saved temporary file as upload operation got failed
    }
}

export {uploadOnCloudinary};