import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/APIerror.js";
import {User} from "../models/user_model.js"
import {uploadOncloudinary} from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefToken = async(userId) => {
   try {
      const user = await User.findById(userId)
      const accessToken = user.generateAccessToken()
      const refreshToken = user.generateRefreshToken()

      user.refreshToken = refreshToken
      await user.save({validateBeforeSave: false})

      return {accessToken,refreshToken}


   } catch (error) {
      throw new ApiError(500,"something went wrong with tokens")
   }
}

const registerUser = asyncHandler( async (req, res) => {
   // get user details from frontend
   // validation - not empty
   // check if user already exists: username, email
   // check for images, check for avatar
   // upload them to cloudinary, avatar
   // create user object - create entry in db
   // remove password and refresh token field from response
   // check for user creation
   // return res

   //console.log(req);
   const {fullname, email, username, password } = req.body
   //console.log("email: ", email);

   if (
       [fullname, email, username, password].some((field) => field?.trim() === "")
   ) {
       throw new ApiError(400, "All fields are required")
   }
    //checks if any field is empty 

    //checks if user already exists
   const existedUser = await User.findOne({
       $or: [{ username }, { email }]
   })

   if (existedUser) {
       throw new ApiError(409, "User with email or username already exists")
   }
   //console.log(req.files);

   const avatarLocalPath = req.files?.avatar[0]?.path;
   //const coverImageLocalPath = req.files?.coverImage[0]?.path;

   let coverImageLocalPath;
   if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
       coverImageLocalPath = req.files.coverImage[0].path
   }
   

   if (!avatarLocalPath) {
       throw new ApiError(400, "Avatar file is required")
   }

   const avatar = await uploadOncloudinary(avatarLocalPath)
   const coverImage = await uploadOncloudinary(coverImageLocalPath)

   if (!avatar) {
       throw new ApiError(400, "Avatar file is required")
   }
  

   const user = await User.create({
       fullname,
       avatar: avatar.url,
       coverImage: coverImage?.url || "",
       email, 
       password,
       username: username.toLowerCase()
   })

   const createdUser = await User.findById(user._id).select(
       "-password -refreshToken"
   )

   if (!createdUser) {
       throw new ApiError(500, "Something went wrong while registering the user")
   }

   return res.status(201).json(
       new ApiResponse(200, createdUser, "User registered Successfully")
   )

} )

const loginUser = asyncHandler(async (req,res) => {

    console.log("Incoming login request:", req.body);

     const {email,username,password} = req.body;

     if(!username && !email){
      throw new ApiError(400, "username required")
     }

     const user = await User.findOne({
      $or: [{username},{email}]
     })

     if(!user){
      throw new ApiError(404,"user not found")
     }

     const passwordCheck = await user.isPasswordCorrect(password)

     if(!passwordCheck){
      throw new ApiError(401,"invalid password")
     }

     const {accessToken,refreshToken} = await generateAccessAndRefToken(user._id)

     const loggedInUser = await User.findById(user._id).select(
      "-password -refreshToken"
     )

     const options = {
      httpOnly : true,
      secure: true
     }

     return res.status(200).
     cookie("accessToken",accessToken,options).
     cookie("refreshToken", refreshToken,options).
     json(
      new ApiResponse(200,{
         user: loggedInUser,accessToken,refreshToken
      },"user logged in successfully")
     )
     
})

const logoutUser = (async (req,res) => {
   await User.findByIdAndUpdate(req.user._id,
    {
        $set: {
            refreshToken: undefined
        }
    },{
        new : true
    }
   )

   const options = {
    httpOnly : true,
    secure: true
   }

   return res.status(200)
             .clearCookie("accessToken")
             .clearCookie("refreshToken")
             .json(new ApiResponse(200,{},"user logged out"))

})

const refreshAccessToken = asyncHandler(async (req,res) => {
    const incomingRefeshToken = req.cookies.
    refreshToken || req.body.refreshToken

    if(!incomingRefeshToken){
        throw new ApiError(401,"unauthorised request")
    }

    const decodedToken = jwt.verify(
        incomingRefeshToken,
        process.env.REFERESH_TOKEN_SECRET)
    
    const user = await User.findById(decodedToken?._id)

    if(!user){
        throw new ApiError(401,"invalid refresh token")
    }

    if(incomingRefeshToken !== user?.refreshToken){
        throw new ApiError(401,"refresh token expired")
    }

    const options = {
        httpOnly: true,
        secure: true
    }

    const {accessToken,NewrefreshToken} = await generateAccessAndRefToken(user._id)

    return res
    .status(200)
    .cookie("accessToken" ,accessToken)
    .cookie("refreshToken",NewrefreshToken)
    .json(
        new ApiResponse(200,{accessToken,refreshToken : NewrefreshToken},
            "access token refreshed"
        )
    )
});

const changeCurrentPassword = asyncHandler(async (req,res) => {
    const {oldPassword,newPassword} = req.body;

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400,"invalid old password") 
    }

    user.password = newPassword
    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(new ApiResponse(200,{},"password changed successfullt"))

})

const getCurrentUser = asyncHandler(async (req,res) => {
    return res
    .status(200)
    .json(200,req.user,"current user fetched successfully")
})

const updateAccountDetails = asyncHandler(async (req,res) =>{
    const {fullname,email} = req.body
    if(!fullname || !email){
        throw new ApiError(400,"all fields required")
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                email: email
            }
        },
        {new:true}
    ).select("-password")

    return res
        .status(200
        .json(new ApiResponse(200,user,"account details updates successfully"))
    )
})

const updateUserAvatar = asyncHandler(async (req,res) => {
   const avatarLocalPath = req.file?.path

   if(!avatarLocalPath){
    throw new ApiError(400,"avatar file is missing")
   }

   const avatar = await uploadOncloudinary(avatarLocalPath)

   if(!avatar.url){
    throw new ApiError(400,"error while uploading avatar")
   }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new:true}
    ).select("-password")

    return res
        .status(200
        .json(new ApiResponse(200,user,"avatar updates successfully"))
    )
})

const updateUserCover = asyncHandler(async (req,res) => {
   const coverImageLocalPath = req.file?.path

   if(!coverImageLocalPath){
    throw new ApiError(400,"coverimage file is missing")
   }

   const cover = await uploadOncloudinary(coverImageLocalPath)

   if(!cover.url){
    throw new ApiError(400,"error while uploading cover")
   }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                cover: cover.url
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"coverimage updated"))
})

const getChannelProfile = asyncHandler(async (req,res) => {
    const {username} = req.params //url se laya hai isliye params

    if(!username?.trim()){
        throw new ApiError(400,"username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: username?.toLowerCase() //doc with username found
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers" //all subs found
            }
        },
        {
            
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscribers",
                as: "subscribedTo" //all subsriptions to found
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },

                channelsSubscribedToCount:{
                    $size: "$subscribedTo"
                },

                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }

            }
        },
        {
            $project: {
                fullname: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                avatar: 1,
                coverImage: 1,
                isSubscribed: 1,
                email: 1
                 //selects only these values to give
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404,"channel doesnt exist")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"user channe; fetched successfully")
    )

})


export {registerUser,
        loginUser,
        logoutUser,
        refreshAccessToken,
        changeCurrentPassword,
        getCurrentUser,
        updateAccountDetails,
        updateUserAvatar,
        updateUserCover,
        getChannelProfile
    }