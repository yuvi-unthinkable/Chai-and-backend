import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose, { mongo, set } from "mongoose";
import jwt from "jsonwebtoken";

const generateAcessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const acessToken = user.generateAcessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { acessToken, refreshToken };
  } catch (error) {
    // console.log("🚀 ~ generateAcessAndRefreshTokens ~ error:", error)
    throw new ApiError(
      500,
      "Something went wrong while generating the refresh and acess tokens ",
      error
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  // validation
  // check if user already exists : from email and username
  // files are present or not i.e. avatar and user image
  // upload them to cloudinary , avatar
  // create user object - create entry in db
  // remove pass and refresh token field from response
  // check for user creation
  // return response

 try {
   const { fullName, email, username, password } = req.body;

 
   if (
     [fullName, email, username, password].some((field) => field?.trim() === "")
   ) {
     throw new ApiError(400, "All fields are required");
   }
 
   const existingUser = await User.findOne({
     $or : [{ username }, { email }],
   });
   // console.log("🚀 ~ exitedUser:", exitedUser)
 
   if (existingUser) {
     throw new ApiError(409, "User with email or username already exists");
   }
 
   // const avatarLocalPath = req.files?.avatar[0]?.path;
   // console.log("🚀 ~ req.files:", req.files)
   // const coverLocalPath = req.files?.coverImage[0]?.path;
 
   // if (!avatarLocalPath) {
   //   throw new ApiError(400, "Avtar image is required");
   // }
 
   // const avatar = await uploadOnCloudinary(avatarLocalPath);
   // const coverImage = await uploadOnCloudinary(coverLocalPath);
 
   // if (!avatar) {
   //   throw new ApiError(400, "Avtar image is required");
   // }
 
   const user = await User.create({
     fullName,
     // avatar: avatar?.url || '',
    //  coverImage: coverImage?.url || "",
     email,
     password,
     username: username.toLowerCase(),
   });
 
   const createdUser = await User.findById(user._id).select(
     "-password -refreshToken"
   );
   if (!createdUser) {
     throw new ApiError(500, "Something went wrong while registering the user");
   }
 
   return res
     .status(201)
     .json(new ApiResponse(200, createdUser, "User Registered Sucessfully"));
 } catch (error) {
   console.log("🚀 ~ error:", error)
   console.log("🚀 ~ error:", error.message, error.statusCode)
   if(error instanceof ApiError) {
    return res.status(200).json( new ApiError(error.statusCode, error.message))
  }
  return res.status(200)
  .json(new ApiError(409, "User already exist "))
  
 }
});

const loginUser = asyncHandler(async (req, res) => {
  // taking username or email and password from the user
  // check if the fields are not empty
  // find the user
  // then sending the request to the database to check the username and the password
  // if pswd is correct access token and refresh token will be generated
  // send it to insecure cookies form
  // if wrong giving the user a chance to rest using email

  const { email, username, password } = req.body;
  if (!(username || email)) {
    throw new ApiError(400, "username or password is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist, Kindly Register");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(404, "Invalid user Credentials");
  }

  const { acessToken, refreshToken } = await generateAcessAndRefreshTokens(
    user._id
  );
  // console.log("🚀 ~ refreshToken:", refreshToken)
  // console.log("🚀 ~ acessToken:", acessToken)

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: false,
    sameSite: 'Lax'
  };

  return res
    .status(200)
    .cookie("accessToken", acessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          acessToken,
          refreshToken,
        },
        "User Logged in Sucssfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged out"));
});

const refreshAcessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { acessToken, newRefreshToken } = await generateAcessAndRefreshTokens(
      user._id
    );

    return res
      .status(200)
      .cookie("acessToken", acessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { acessToken, refreshToken: newRefreshToken },
          "Acess Tokrn refreshed sucessfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "invalid old password");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed sucessfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
  .status(200)
  .json(new ApiResponse(200, req.user, "current user fetched sucessfully"))
})

const updateAccountDetails = asyncHandler(async (req, res) => {
  const {fullName, email} = req.body

  if(!fullName || !email) {
    throw new ApiError(400, "All fields are required")
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set : {
        fullName,
        email,
      }
    },
    {new : true}
  ).select("-password")

  return res.status(200)
  .json(new ApiResponse(200, user, "Account details updated sucessfully"))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.files?.path

  if(!avatarLocalPath){
    throw new ApiError(400, "Avatar fie is missing")
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath)

  if(!avatar.url){
    throw new ApiError(400, "Error while uploading on avatar")
  }

  const user = await User.findByIdAndUpdate(req.user?._id,
    {
      $set : {
        avatar : avatar.url
      }
    },
    {new: true}
  ).select("-password")

  return res
  .status(200)
  .json(new ApiResponse(200, user, "Avatar image updates sucessfully"))

})

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const CoverImageupdateLocalPath = req.files?.path

  if(!CoverImageupdateLocalPath){
    throw new ApiError(400, "Cover fie is missing")
  }
  const CoverImage = await uploadOnCloudinary(CoverImageupdateLocalPath)

  if(!CoverImage.url){
    throw new ApiError(400, "Error while uploading on CoverImage")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set : {
        coverImage: coverImage.url
      }
    },
    {new: true}
  ).select("-password")

  return res
  .status(200)
  .json(new ApiResponse(200, user, "cover image updates sucessfully"))

})

const getUserChannelProfile = asyncHandler(async(req, res) => {
  const {username} = req.params
  
  if(!username?.trim()){
    throw new ApiError(400, "Username not fetched")
  }

  const channel = await User.aggregate([
    
      {
        $match : 
        {
          username : username?.toLowerCase()
        }
      },
      {
        $lookup : {
            from: "subscriptions",
            localField : "_id",
            foriegnFIeld  : "channel",
            as: "subscribers"
          }
      },
      {
        $lookup:{
          from: "subscriptions",
          localField : "_id",
          foriegnFIeld  : "subscriber",
          as: "subscribedTo"
        }
      },
      {
        $addFields : {
          subscribersCount : {
            $size : "$subscribers"            
          },
          channelsSubscribedToCount : {
            $size : "$subscribeTo"
          }
        }
      },
      {
        isSUbscribed :{
          $cond : {
            if: {$in: [req.user?._id, "$subscribers.subscriber"]},
            then : true,
            else : false
          }
        }
      },
      {
        $project : {
          fullName : 1,
          username: 1,
          subscribersCount:1,
          channelsSubscribedToCount : 1,
          avatar:1,
          coverImage : 1,
          email : 1
        }
      }

      
    
  ])

  if(channel?.length) {
    throw new ApiError(404, "Channel does not exists")
  }

  return res
  .status(200)
  .json( new ApiResponse(200, channel[0], "user channel fetched sucessfully"))



})

const getWatchHistory = asyncHandler(async(req, res) => {
  const user = await User.aggregate([
    {
      $match : {
        _id : new mongoose.Types.ObjectId.createFromHexString(req.user._id)
      }
    },
    {
      $lookup : {
        from : "videos",
        localField : "watchHistory",
        foreignField : "_id",
        as : "watchHistory",
        pipeline : [
          {
            $lookup : {
              from : "users",
              localField : "owner",
              foriegnFIeld : "_id",
              as : "owner",
              pipeline : [
                {
                  $project : {
                    fullName : 1,
                    username : 1,
                    avatar : 1
                  }
                }
              ]
            }
          },
          {
            $addFields : {
              owner : {
                $first : "$owner"
              }
            }
          }
        ]

      }
    }
  ])

  return res.status(200)
  .json(new ApiResponse(
    200, 
    user[0].watchHistory,
    "Watch history is fetched sucessfully"
  ))
})

export { 
  registerUser,
   loginUser,
   logoutUser,
   refreshAcessToken,
   changeCurrentPassword,
   getCurrentUser,
   updateAccountDetails,
   updateUserAvatar,
   updateUserCoverImage, getUserChannelProfile,
   getWatchHistory
  };
