import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

const generateAccessAndRefereshTokens = async(userId) =>{
  try {
      const user = await User.findById(userId)
      const accessToken = user.generateAccessToken()
      const refreshToken = user.generateRefreshToken()

      user.refreshToken = refreshToken
      await user.save({ validateBeforeSave: false })

      return {accessToken, refreshToken}


  } catch (error) {
      throw new ApiError(500, "Something went wrong while generating referesh and access token")
  }
}

const registerUser = asyncHandler(async  (req,res)=>{
   // getting user details  
   // validation - not empty
   // check if user already exists: username ,email
   //check for images , check for avatar
   // upload them to cloudinary , avatar
   // create user object - create entry in db
   // remove password and refresh token field from response
   // check for user creation
   // return response
   const {fullname,email,username,password }=req.body
   console.log("email",email);
   
   if (
    [fullname,username,email,password].some((field) => field?.trim()==="")
   ){
      throw new ApiError( 400,"All fields are required")
   }

    const existedUser = await User.findOne({
    $or :[{username} , {email}]
    })

    if(existedUser){
      throw new ApiError( 409 , "User with username or email already exsisted")
    }

   const avatarLocalPath= req.files?.avatar[0]?.path;
  //  const coverImageLocalPath = req.files?.coverImage[1]?.path;

  let coverImageLocalPath;
  if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
    coverImageLocalPath=req.files.coverImage[0].path;

  }

   if(!avatarLocalPath){
    throw new ApiError(400,"Avtar file is required")
   }

  const avatar = await uploadOnCloudinary(avatarLocalPath)
  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if(!avatar){
    throw new ApiError(400,"Avatar is required")
  }

  const user = await User.create({
    fullname,
    avatar:avatar.url,
    coverImage:coverImage?.url || "",
    email,
    password,
    username:username.toLowerCase()
  })

  const createdUser = await User.findById(user._id).select("-password -refreshToken")
   if(!createdUser){
    throw new ApiError(500,"something went wrong while register a user")
   }


   return res.status(201).json(
    new ApiResponse(200,createdUser,"user registerd successfully")
   )

})

const loginUser = asyncHandler(async (req, res) => {
  // console.log('Request body:', req.body);

  const { email, username, password } = req.body;
  if (!username && !email) {
     console.log('Missing username or email');
     throw new ApiError(400, "Username or email is required");
  }

  const user = await User.findOne({
     $or: [{ username }, { email }]
  });

  if (!user) {
     console.log('User not found');
     throw new ApiError(400, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
     console.log('Invalid password');
     throw new ApiError(401, "Password incorrect");
  }

  console.log('User authenticated successfully');

  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id);

  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

  const options = {
     httpOnly: true,
     secure: true
  };

  console.log('Sending response with tokens');
  return res
     .status(200)
     .cookie("accessToken", accessToken, options)
     .cookie("refreshToken", refreshToken, options)
     .json(
        new ApiResponse(
           200,
           {
              user: loggedInUser,
              accessToken,
              refreshToken
           },
           "User logged in successfully"
        )
     );
});

const logoutUser=asyncHandler(async(req,res)=>{
      try {
        await User.findByIdAndUpdate(
          req.user._id,
  
          {
            $set:{
              refreshToken:undefined
            },  
          },
          {
            new:true
          }
        )
  
        const options= {
          httpOnly:true,
          secure:true
        }
  
        return res
        .status(200)
        .clearCookie("accessToken",options)
        .clearCookie("refreshToken",options)
        .json(new ApiResponse(200,{},"user logged out"))
      } catch (error) {
        throw new ApiError(500, "error in logout")
        
      }
})

const refereshAccessToken = asyncHandler(async(req,res)=>{
  
  const incomingRefreshToken =req.cookie.refreshToken || req.body.refreshToken
  if(!incomingRefreshToken){
    throw new ApiError(401,"unauthorised request")
  }

 try {
   const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
 
   const user= await User.findById(decodedToken?._id)
 
   if(!user){
     throw new ApiError(401,"invalid refresh token")
   }
 
   if(incomingRefreshToken !== user?.refreshToken){
     throw new ApiError(401,"refresh token is expired or used")
   }
   
   const options ={
     httpOnly:true,
     secure :true
   }
 
   const {accessToken,newrefreshToken}= await generateAccessAndRefereshTokens(user._id)
 
   return res
   .status(200)
   .cookie("accessToken",accessToken,options)
   .cookie("refreshToken",newrefreshToken,options)
   .json(
     new ApiResponse(
       200,
       {accessToken,refreshToken:newrefreshToken},
       "Access token refreshed"
     )
   )
 } catch (error) {
  throw new ApiError(401,error?.message || "Invalid refresh token")
  
 }

})

const changeCurrentPassword =asyncHandler(async(req,res)=>{
  const {oldPassword,newPassword} = req.body
  
  const user = await User.findById(req.user?._id)

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

  if(!isPasswordCorrect){
    throw new ApiError(400,"Invalid old password")
  }
  user.password = newPassword
  await user.save({validateBeforeSave:false})

  return res
  .status(200
  .json(new ApiResponse(200 ,{},"Password changes successfully"))  
  )

})

const getCurrentUser =asyncHandler(async (req,res)=>{
   return res
   .status(200)
   .json(200,req.user,"Current user fetched successfully")
})

const updateAccountDetails =asyncHandler(async (req,res)=>{
  const{fullname,email} =req.body

  if(!fullname || !email){
    throw new ApiError(400,"All field are required")
  }

  User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        fullname,
        email:email
      }
    },
    {new:true}
  ).select("-password")
  return res
  .status(200)
  .json(new ApiResponse(200,user,"Account details updated successfully"))

})

const updateUserAvatar = asyncHandler(async(req,res)=>{
  const avatarLocalPath= req.file?.path
  if(!avatarLocalPath){
    throw new ApiError(400,"avatar file missing")
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath)

  if(!avatar.url){
      throw new ApiError(400,"Error while uploading on avatar")
    }
  const user = await  User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        avatar:avatar.url
      }
    },
    {new:true}
  ).select("-password")

  return res
  .status(200)
  .json(
    new ApiResponse(200,user,"Avatar updated successfully")
  )
  
})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
  const coverImageLocalPath= req.file?.path
  if(!coverImageLocalPath){
    throw new ApiError(400,"Cover image file missing")
  }
  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if(!coverImage.url){
      throw new ApiError(400,"Error while uploading on coverImage")
    }
  const user = await  User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        coverImage:coverImage.url
      }
    },
    {new:true}
  ).select("-password")
  
  return res
  .status(200)
  .json(
    new ApiResponse(200,user,"coverImage updated successfully")
  )
})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
    const { username } = req.params 
    if(!username?.trim()){
      throw new ApiError(400,"username is missing")
    }
   
    const channel = await User.aggregate([
      {
       $match: {
        username:username?.toLowerCase()
       }
      },
      {
        $lookup:{
          from:"subscriptions",
          localField:"_id",
          foreignField:"channel",
          as:"subscribers"

        }
       },
       {
        $lookup:{
          from:"subscriptions",
          localField:"_id",
          foreignField:"subscriber",
          as:"subscribedTo"

        }
       },
       {
        $addFields:{
          subscriberCount:{
            $size: "$subscribers"
          },
          channelSubscribedToCount :{
            $size:"$subscribedTo"
          },
          issubscribed:{
            $cond:{
             if:{ $in:[req.user?._id,"$subscribes.subscriber"]},
             then:true,
             else:false

            }
          }
          }
       },
       {
        $project:{
          fullname:1,
          username:1,
          subscriberCount:1,
          channelSubscribedToCount:1,
          avatar:1,
          coverImage:1,
          email:1,


        }
       }

    ])
    
    if(!channel?.length){
      throw new ApiError(404,"Channel does not exist")
    }

    return res
    .status(200)
    .json(
      new ApiResponse(200,channel[0],"User channel fetched successfully")
    )
})

const getWatchHistory =asyncHandler(async(req,res)=>{
  const user =await User.aggregate([
    {
      $match:{
        _id: new mongoose.Types.ObjectId(req.user._id)
      }
    },
    {
      $lookup:{
        from:"videos",
        localField:"watchHistory",
        foreignField:"_id",
        as:"watchHistory",
        pipeline:[
          {
            $lookup:{
              from:"users",
              localField:"owner",
              foreignField:"_id",
              as:"owner",
              pipeline:[
                {
                  $project:{
                    fullname:1,
                    username:1,
                    avatar:1

                  }
                }
              ]
            }
          },
          {
            $addFields:{
              owner:{
                $first:"$owner"
              }
            }
          }
        ]
      }
    }
  ])

  return res
  .status(200)
  .json(
    new ApiResponse(
      200,
      user[0].watchHistory,
      "watch history fetched successsfully"
    )
  )
})

export {registerUser,loginUser,logoutUser,refereshAccessToken,changeCurrentPassword,getCurrentUser,updateAccountDetails,
  updateUserAvatar,updateUserCoverImage,getUserChannelProfile,getWatchHistory
};