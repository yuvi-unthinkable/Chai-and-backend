import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/Cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

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

    const { fullName, email, username, password } = req.body
    console.log("🚀 ~ req.body:", req.body)
    console.log("🚀 ~ fullName , email, username, password:", fullName, email, username, password)

    // if(fullName === "") {
    //     throw new ApiError(400, "full name is required")
    // }

    if (
        [fullName, email, username, password].some(() => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fiels are required")
    }


    const exitedUser = User.findOne({
        $or: [{ username }, { email }]
    })
    console.log("🚀 ~ exitedUser:", exitedUser)

    if (exitedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    console.log("🚀 ~ req.files:", req.files)
    const coverLocalPath =  req.files?.coverImage[0]?.path;

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avtar image is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverLocalPath);

    if(!avatar) {
        throw new ApiError(400, "Avtar image is required")
    }

    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        email,
        password,
        username: username.toLowercase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(createdUser){
        throw new ApiError(500, "Something went wrn while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Registered Sucessfully")
    )

})


export { registerUser, } 