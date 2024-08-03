import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/apiError.js";
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessTokenAndRefereshToken =async(userId)=>{
  try {
    const user = await User.findById(userId)
    const accessToken=user.generateAccessToken()
    const refreshToken=user.generateRefreshToken()
    
    user.refreshToken =refreshToken
    await user.save({validateBeforeSave :false})

    return {accessToken,refreshToken}

  } catch (error) {
    throw new ApiError(500,"something went wrong while generating refresh and access token")
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
  console.log('Request body:', req.body);

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

  const { accessToken, refreshToken } = await generateAccessTokenAndRefereshToken(user._id);

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
      awaitUser.findByIdAndUpdate(
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
})

export {registerUser,loginUser,logoutUser};