import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {sendEmail} from "../utils/sendEmail.js"

const registerUser = asyncHandler(async (req, res) => {
  try {
    const { fullName, email, username, password, role } = req.body;

    if ([fullName, email, username, password, role].some(f => f?.trim() === "")) {
      throw new ApiError(400, "All fields are required");
    }

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) throw new ApiError(409, "User with email or username already exists");

    const user = await User.create({
      fullName,
      email,
      password,
      username: username.toLowerCase(),
      role,
      isVerified: false,
    });

    const verificationToken = user.getVerificationToken();
    console.log("🚀 ~ verificationToken:", verificationToken)
    await user.save({ validateBeforeSave: true });

    const verificationUrl = `${req.protocol}://${req.get('host')}/api/auth/verify?token=${verificationToken}`;
    const message = `Please verify your email by clicking on this link : ${verificationUrl}`;
    console.log("🚀 ~ message:", message)

    await sendEmail({
      email: user.email,
      subject: 'Email Verification',
      message,
    });

    console.log("email sent");

    return res.status(201).json({
      success: true,
      message: "Verification Email sent, please check your inbox"
    });

  } catch (error) {
    console.log("🚀 ~ error:", error)
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Server Error" });
  }
});


const verifyEmail = asyncHandler(async (req, res) => {
  try {
    const token = req.param.id
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  
    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpire: { $gt: Date.now() },
    });
  
    if (!user) {
      console.log("🚀 ~ message:", message)
      return res.status(400).json({ message: "Invalid or expired token" });
    }
  
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpire = undefined;
    await user.save();
  
    res.status(200).json({ message: "Email verified successfully!" });
    console.log("🚀 ~ verifyEmail.message:", verifyEmail.message)
  } catch (error) {
    console.log("🚀 ~ error:", error)
    return res.status(400).json(new ApiError(400, "email not verified"))
    
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
    secure: true,
    sameSite: "none",
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
  try {
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
  } catch (error) {
    console.log("🚀 ~ error:", error)
    throw new ApiError(401,"something went wrong while logging out")
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
    .json(new ApiResponse(200, req.user, "current user fetched sucessfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  // console.log("🚀 ~ avatarLocalPath:", avatarLocalPath)

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar image is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar?.url) {
    throw new ApiError(400, "Error while uploading avatar to Cloudinary");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { avatar: avatar.url } },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar image updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const CoverImageupdateLocalPath = req.files?.path;

  if (!CoverImageupdateLocalPath) {
    throw new ApiError(400, "Cover fie is missing");
  }
  const CoverImage = await uploadOnCloudinary(CoverImageupdateLocalPath);

  if (!CoverImage.url) {
    throw new ApiError(400, "Error while uploading on CoverImage");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "cover image updates sucessfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;
  
  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated sucessfully"));
});


export {
  registerUser,
  loginUser,
  logoutUser,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  verifyEmail
};
