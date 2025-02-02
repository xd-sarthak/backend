import { asyncHandler } from "../utils/asyncHandler";
import {Apierror} from "../utils/APIerror.js";
import {User} from "../models/user_model.js"
import {uploadOncloudinary} from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js"

const registerUser = asyncHandler(async (req,res) => {
   const {fullname,email,userame,passowrd} = req.body;

   if(
      [fullname,email,userame,passowrd].some((field) => field?.trim() === "")
   ){
      throw new ApiError(400,"all fields are required")
   }

   const existedUser = User.findOne({
      $or : [{userame}, {email}]
   })

   if(existedUser) throw new Apierror(409,"username with email exists")

   const avatarLocalPath = req.files?.avatar[0]?.path;
   const imageLocalPath = req.files?.coverImage[0]?.path;

   if(!avatarLocalPath){
      throw new ApiError(400,"avatar file is required")
   }

   const avatar = await uploadOncloudinary(avatarLocalPath)
   const coverImage = await uploadOncloudinary(imageLocalPath);

   if(!avatar){
      throw new Apierror(400,"avatar file is required")
   }

   const user = await User.create({
      fullname,
      avatar : avatar.url,
      coverImage : coverImage?.url || "",
      email,
      passowrd,
      username: userame.toLowerCase()
   })

   const userCheck = await User.findById(user._id).select(
      "-passwod -refreshToken"
   )

   if(userCheck){
      throw new Apierror(500,"something went wrong while registering")
   }

   return res.status(201).json(
      new ApiResponse(200,userCheck,"user registered successfully")
   )
})

export {registerUser}