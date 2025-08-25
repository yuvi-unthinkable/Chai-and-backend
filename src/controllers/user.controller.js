import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose, { mongo, set } from "mongoose";
import jwt from "jsonwebtoken";
import { Hotel } from "../models/hotel.model.js";
import { Room } from "../models/HotelRooms.model.js";
import connectDB from "../db/index.js";
import { Booking } from "../models/Booking.model.js";

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
  // console.log("🚀 ~ req:", req);
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
    const { fullName, email, username, password, role } = req.body;

    if (
      [fullName, email, username, password, role].some(
        (field) => field?.trim() === ""
      )
    ) {
      throw new ApiError(400, "All fields are required");
    }

    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
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
      role,
    });

    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );
    if (!createdUser) {
      throw new ApiError(
        500,
        "Something went wrong while registering the user"
      );
    }

    return res
      .status(201)
      .json(new ApiResponse(200, createdUser, "User Registered Sucessfully"));
  } catch (error) {
    console.log("🚀 ~ error:", error);
    console.log("🚀 ~ error:", error.message, error.statusCode);
    if (error instanceof ApiError) {
      return res
        .status(200)
        .json(new ApiError(error.statusCode, error.message));
    }
    return res.status(200).json(new ApiError(409, "User already exist "));
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
    sameSite: "Lax",
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
    .json(new ApiResponse(200, req.user, "current user fetched sucessfully"));
});

const addHotels = asyncHandler(async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      throw new ApiError(400, "The user is not an admin");
    }

    const { hotelName, hotelAboutData } = req.body;

    if (!hotelName || !hotelAboutData) {
      throw new ApiError(400, "hotelname and hotel about data is important ");
    }

    const existingHotel = await Hotel.findOne({ hotelName });

    if (existingHotel) {
      throw new ApiError(409, "Hotel already exists");
    }

    if (!req.files || req.files.length < 1) {
      console.log("🚀 ~ req.files.length:", req.files.length);
      return res
        .status(400)
        .json(new ApiError(400, "provide at least one image"));
    }
    if (req.files.length > 5) {
      return res
        .status(400)
        .json(new ApiError(400, " at most 5 photos can be uploaded"));
    }

    const photoPath = req.files.map((file) => file.path);

    const photos = [];
    for (let path of photoPath) {
      const uploaded = await uploadOnCloudinary(path);
      if (uploaded.url)
        photos.push({
          url: uploaded.url,
          public_id: uploaded.public_id,
        });
    }

    if (photos.length < 1) {
      throw new ApiError(400, "Error while uploading photos to Cloudinary");
    } else {
      console.log("photos uploaded on cloudinary");
    }

    const hotel = await Hotel.create({
      hotelName,
      hotelAboutData,
      photos,
    });

    //  if(!hotel) {
    //    throw new ApiError (400, "something went wrong while registering hotel")
    //  }

    return res
      .status(201)
      .json(new ApiResponse(201, hotel, "hotel is registered sucessfully"));
  } catch (error) {
    console.log("🚀 ~ error:", error);
    return res
      .status(500)
      .json(
        new ApiError(
          500,
          "Something went wrong while registering the hotel",
          error
        )
      );
  }
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

// const getUserChannelProfile = asyncHandler(async (req, res) => {
//   const { username } = req.params;

//   if (!username?.trim()) {
//     throw new ApiError(400, "Username not fetched");
//   }

//   const channel = await User.aggregate([
//     {
//       $match: {
//         username: username?.toLowerCase(),
//       },
//     },
//     {
//       $lookup: {
//         from: "subscriptions",
//         localField: "_id",
//         foriegnFIeld: "channel",
//         as: "subscribers",
//       },
//     },
//     {
//       $lookup: {
//         from: "subscriptions",
//         localField: "_id",
//         foriegnFIeld: "subscriber",
//         as: "subscribedTo",
//       },
//     },
//     {
//       $addFields: {
//         subscribersCount: {
//           $size: "$subscribers",
//         },
//         channelsSubscribedToCount: {
//           $size: "$subscribeTo",
//         },
//       },
//     },
//     {
//       isSUbscribed: {
//         $cond: {
//           if: { $in: [req.user?._id, "$subscribers.subscriber"] },
//           then: true,
//           else: false,
//         },
//       },
//     },
//     {
//       $project: {
//         fullName: 1,
//         username: 1,
//         subscribersCount: 1,
//         channelsSubscribedToCount: 1,
//         avatar: 1,
//         coverImage: 1,
//         email: 1,
//       },
//     },
//   ]);

//   if (channel?.length) {
//     throw new ApiError(404, "Channel does not exists");
//   }

//   return res
//     .status(200)
//     .json(new ApiResponse(200, channel[0], "user channel fetched sucessfully"));
// });

// const getWatchHistory = asyncHandler(async (req, res) => {
//   const user = await User.aggregate([
//     {
//       $match: {
//         _id: new mongoose.Types.ObjectId.createFromHexString(req.user._id),
//       },
//     },
//     {
//       $lookup: {
//         from: "videos",
//         localField: "watchHistory",
//         foreignField: "_id",
//         as: "watchHistory",
//         pipeline: [
//           {
//             $lookup: {
//               from: "users",
//               localField: "owner",
//               foriegnFIeld: "_id",
//               as: "owner",
//               pipeline: [
//                 {
//                   $project: {
//                     fullName: 1,
//                     username: 1,
//                     avatar: 1,
//                   },
//                 },
//               ],
//             },
//           },
//           {
//             $addFields: {
//               owner: {
//                 $first: "$owner",
//               },
//             },
//           },
//         ],
//       },
//     },
//   ]);

//   return res
//     .status(200)
//     .json(
//       new ApiResponse(
//         200,
//         user[0].watchHistory,
//         "Watch history is fetched sucessfully"
//       )
//     );
// });

const getHotels = asyncHandler(async (req, res) => {
  try {
    const hotels = await Hotel.find({});
    res.status(200).json(new ApiResponse(200, hotels, "Hotels list fetched"));
  } catch (error) {
    res.status(500).json(new ApiError(500, "Error while fetching the hotels"));
  }
});

const deleteHotel = asyncHandler(async (req, res) => {
  try {
    if (req.user.role !== "admin")
      throw new ApiError(401, "user doesn't have access to delete hotels");
    const { hotelName } = req.body;
    await Hotel.findOneAndDelete({ hotelName });
    if (!(await Hotel.findOne({ hotelName }))) console.log("hotel is deleated");
    return res
      .status(200)
      .json(new ApiResponse(200, hotelName, `${hotelName} is deleted`));
  } catch (error) {
    console.log("🚀 ~ error:", error);
    return res
      .status(401)
      .json(new ApiError(401, "something went wrong the user is not deleted"));
  }
});

const HotelDetailPage = asyncHandler(async (req, res) => {
  try {
    const id = req.params.id;
    const hotel = await Hotel.findOne({ _id: id });
    if (!hotel) throw new ApiError(404, "Hotel not found");

    // const rooms = await Room.find({ hotelId: id });

    return res
      .status(200)
      .json(new ApiResponse(200, { hotel }, "hotel details fetched"));
  } catch (error) {
    console.log("🚀 ~ error:", error);
    return res
      .status(400)
      .json(
        new ApiError(400, "something went wrong while fetching hotel detail")
      );
  }
});

const getAvailableRooms = asyncHandler(async (req, res) => {
  try {
    const id = req?.params?.id;
    if (!id) throw new ApiError(402, "Hotel ID is required");

    const { checkIn, checkOut, adults } = req.body?.dateData || {};

    if (!checkIn || !checkOut || !adults) {
      throw new ApiError(402, "Incomplete date or guest details");
    }

    const rooms = await Room.find({ hotelId: id });
    if (!rooms || rooms.length === 0) {
      throw new ApiError(404, "No rooms found for this hotel");
    }

    for (const room of rooms) {
      const prevBookings = await bookings(checkIn, checkOut, room._id);
      room.availableRooms = Math.max(0, room.totalRooms - prevBookings);
      await room.save();
    }

    return res
      .status(200)
      .json(new ApiResponse(200, rooms, "Rooms availability fetched"));
  } catch (error) {
    console.log("🚀 ~ getAvailableRooms error:", error);
    throw new ApiError(401, "Cannot get rooms");
  }
});


const addRooms = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(400, "This user is not an admin");
  }
  try {
    const {
      hotelId,
      roomType,
      noOfPersons,
      price,
      description,
      totalRooms,
      availableRooms,
    } = req.body;
    const roomPhotoLocalPath = req.file?.path;
    // console.log("🚀 ~ Photo:", photo)
    if (!roomPhotoLocalPath) throw new ApiError(404, " room photo is required");

    const roomPhotoPath = await uploadOnCloudinary(roomPhotoLocalPath);

    if (!roomPhotoPath?.url)
      throw new ApiError(
        404,
        "error occured while uoloading the hotel image on cloudinary"
      );

    if (!hotelId) throw new ApiError(400, "Hotel ID is required");

    const room = await Room.create({
      roomType,
      noOfPersons,
      price,
      description,
      roomPhoto: roomPhotoPath.url,
      hotelId,
      totalRooms,
      availableRooms,
    });
    res.status(200).json(new ApiResponse(200, room, "room has been added"));
  } catch (error) {
    console.log("🚀 ~ error:", error);
    res
      .status(401)
      .json(new ApiError(401, "Something went wrong while adding the rooms"));
  }
});

const cart = asyncHandler(async (req, res) => {
  try {
    const cart = req.body;
    console.log("🚀 ~ cart-items:", cart.cartItems);

   
    if(!cart.checkIn || !cart.checkOut) throw new ApiError(401, "checkin or checkout date cannot be empty")
    const booking = await Booking.create({
      hotel: cart.hotelId,
      user : req.user._id,
      hotelRooms : cart.cartItems,
      bookingAmount: cart.totalAmount,
      bookingForPeoples: Number(cart.adults) + Number(cart.children),
      checkInDate: cart.checkIn,
      checkOutDate: cart.checkOut,
    });
    console.log("🚀 ~ booking:", booking)

    if (booking) console.log("booking is created");


    const today = new Date();
    today.setHours(0, 0, 0);
    if (cart.checkIn < today)
      throw new ApiError(422, "checkin date shoud be today or in future");
    if (cart.checkOut < cart.checkIn)
      throw new ApiError(422, "checkout date shoud be greater checkin date");

    if (cart.rooms / cart.adults > 2)
      throw new ApiError(
        400,
        `Book more rooms to accomodate ${cart.adults} these many persons`
      );

   
    const response = req.body;``
    return res.status(200).json(new ApiResponse(201, response, "heiii"));
  } catch (error) {
    console.log("🚀 ~ error:", error);
    return res.status(400).json(new ApiError(400, "heiii"));
  }
});

let sum =0


const bookings = async (checkInDate, checkOutDate, roomId) => {
  console.log("🚀 ~ bookings ~ roomId:", roomId)
  console.log("🚀 ~ bookings ~ roomId:", roomId)
  // console.log("🚀 ~ bookings ~ roomType:", roomType)
  console.log("🚀 ~ bookings ~ Booking:", await Booking.find({}))

  try {
    const overLappingBookings = await Booking.find({
  checkInDate: { $lt: checkOutDate },
  checkOutDate: { $gt: checkInDate },
  "hotelRooms.roomId": roomId, // dot notation works for nested fields in arrays
});
    

    console.log("🚀 ~ bookings ~ overLappingBookings:", overLappingBookings);

    let sum = 0;

    for (let booking of overLappingBookings) {

      for(let room of booking.hotelRooms){

        if(room.roomId.toString() === roomId.toString())

        sum += room.quantity;
      }

    }
    console.log("🚀 ~ bookings ~ sum:", sum)
    

    return sum;
  } catch (error) {
    console.log("🚀 ~ bookings error:", error);
    throw new ApiError(401, "Something went wrong while fetching booking details.");
  }
};


const deleteBooking = asyncHandler(async(req, res) => {
  try {
    const {book_id} = req.body;
    await Booking.findByIdAndDelete(book_id)
    if(!(await Booking.findById(book_id))) console.log("Hotel is deleted");
    return res.status(201)
    .json(new ApiResponse(204, book_id, `booking id ${book_id} is deleted`))
  } catch (error) {
    console.log("🚀 ~ error:", error)
    res.status(401)
    .json(new ApiError(401, "booking cannot be deleted"))
    
  }
})

const userBookings = asyncHandler(async(req, res) => {
  try {
    const userid = req.user._id
    const userBooking = await Booking.find({user : userid}).populate('hotel')
    console.log("🚀 ~ userBooking:", userBooking)
    console.log("🚀 ~ userBooking-rooms:", userBooking.hotelRooms)
    res.status(201)
    .json(new ApiResponse(201, userBooking, "bookings fetched"))
  } catch (error) {
    console.log("🚀 ~ error:", error)
    throw new ApiError(401, "some error occured while getting hotels for user")
    
  }
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
  updateUserCoverImage,
  // getUserChannelProfile,
  // getWatchHistory,
  addHotels,
  getHotels,
  deleteHotel,
  HotelDetailPage,
  addRooms,
  cart,
  bookings,
  getAvailableRooms,
  userBookings,
  deleteBooking
};
