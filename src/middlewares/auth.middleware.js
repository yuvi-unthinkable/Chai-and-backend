import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import jwt from 'jsonwebtoken'


export const verifyJWT = asyncHandler(async (req, _, next) => {
    console.log("🚀 ~ req:", req?.cookies)
    console.log("🚀 ~ req?.cookies:", req?.cookies?.['accessToken'])
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer", "")
        console.log("🚀 ~ token:", token)

        if (!token || token===undefined) {
            throw new ApiError(401, "unauthorized request")
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")

        if (!user) {

            throw new ApiError(401, "Invalid acess token")
        }

        req.user = user;
        next()

    } catch (error) {
        throw new ApiError(401, error?.message || "invalid acess token")
    }
})