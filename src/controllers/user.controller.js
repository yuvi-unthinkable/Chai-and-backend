import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User, unVerifiedUser } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { sendEmail } from "../utils/sendEmail.js";
import jwt from "jsonwebtoken";
import { Hotel } from "../models/hotel.model.js";
import { Room } from "../models/HotelRooms.model.js";
import { Booking } from "../models/Booking.model.js";

const registerUser = asyncHandler(async (req, res) => {
  try {
    const { fullName, email, username, password, role } = req.body;

    if (
      [fullName, email, username, password, role].some((f) => f?.trim() === "")
    ) {
      throw new ApiError(400, "All fields are required");
    }

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser)
      throw new ApiError(409, "User with email or username already exists");

    const user = await User.create({
      fullName,
      email,
      password,
      username: username.toLowerCase(),
      role,
      isVerified: false,
    });

    // const verificationToken = user.getVerificationToken();
    // console.log("🚀 ~ verificationToken:", verificationToken)
    // await user.save({ validateBeforeSave: false });

    // const verificationUrl = `${req.protocol}://${req.get('host')}/api/v1/users/verify/${verificationToken}`;
    // const message = `Please verify your email by clicking on this link : ${verificationUrl}`;
    // console.log("🚀 ~ message:", message)

    // await sendEmail({
    //   email: user.email,
    //   subject: 'Email Verification',
    //   message,
    // });

    // console.log("email sent");

    // return res.status(201).json({
    //   success: true,
    //   message: "Verification Email sent, please check your inbox"
    // });

    return res.status(201).json(new ApiResponse(201, user, "user is created"));
  } catch (error) {
    console.log("🚀 ~ error:", error);
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Server Error" });
  }
});

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

// const verifyEmail = asyncHandler(async (req, res) => {
//   try {
//     const token = req.param.id
//     const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

//     const user = await User.findOne({
//       verificationToken: hashedToken,
//       verificationTokenExpire: { $gt: Date.now() },
//     });

//     if (!user) {
//       console.log("🚀 ~ message:", message)
//       return res.status(400).json({ message: "Invalid or expired token" });
//     }

//     user.isVerified = true;
//     user.verificationToken = undefined;
//     user.verificationTokenExpire = undefined;

//     const newUser = User.create({
//       email,
//       username,
//       password,
//       fullName,
//     })

//     newUser.save()

//     await user.save();

//     res.status(200).json({ message: "Email verified successfully!" });
//     console.log("🚀 ~ verifyEmail.message:", verifyEmail.message)
//   } catch (error) {
//     console.log("🚀 ~ error:", error)
//     return res.status(400).json(new ApiError(400, "email not verified"))

//   }
// });

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
    console.log("🚀 ~ error:", error);
    throw new ApiError(401, "something went wrong while logging out");
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
      // console.log("🚀 ~ req.files.length:", req.files.length);
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

    const { checkIn, checkOut, adults, checkInTime, checkOutTime } =
      req.body?.dateData || {};

    if (!checkIn || !checkOut || !adults || !checkInTime || !checkOutTime) {
      throw new ApiError(402, "Incomplete date or guest details");
    }

    const rooms = await Room.find({ hotelId: id });
    if (!rooms || rooms.length === 0) {
      throw new ApiError(404, "No rooms found for this hotel");
    }

    for (const room of rooms) {
      const prevBookings = await bookings(
        checkIn,
        checkOut,
        room._id,
        checkInTime,
        checkOutTime
      );
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

    if (!cart.checkIn || !cart.checkOut)
      throw new ApiError(401, "checkin or checkout date cannot be empty");
    const booking = await Booking.create({
      hotel: cart.hotelId,
      user: req.user._id,
      hotelRooms: cart.cartItems,
      bookingAmount: cart.totalAmount,
      bookingForPeoples: Number(cart.adults) + Number(cart.children),
      checkInDate: cart.checkIn,
      checkOutDate: cart.checkOut,
      checkInTime: cart.checkInTime,
      checkOutTime: cart.checkOutTime,
    });
    console.log("🚀 ~ booking:", booking);

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

    const response = req.body;
    ``;
    return res.status(200).json(new ApiResponse(201, response, "heiii"));
  } catch (error) {
    console.log("🚀 ~ error:", error);
    return res.status(400).json(new ApiError(400, "heiii"));
  }
});

let sum = 0;

const bookings = async (checkInDate, checkOutDate, roomId, checkInTime, checkOutTime) => {

  try {

    const parsedCheckinDate = new Date(checkInDate)
    const parsedCheckOutDate = new Date(checkOutDate)

    if(!parsedCheckOutDate || !parsedCheckinDate) console.log("error with the date format");

    const overLappingBookings = await Booking.find({
      
      "hotelRooms.roomId": roomId,

      

      $or: [
        // CASE 1: Date ranges overlap
        {
          checkInDate: { $lt : parsedCheckOutDate},
          checkOutDate: { $gt: parsedCheckinDate },
        },
        
        // CASE 2: Same check-in date, but times overlap
        {
          checkOutDate:  parsedCheckinDate, // exact same date
          // checkInTime: { $: Number(checkOutTime) },
          checkOutTime: { $gt: Number(checkInTime+1) },
        },
      ],
    });


    console.log("🚀 ~ bookings ~ overLappingBookings:", overLappingBookings);

    let sum = 0;

    for (let booking of overLappingBookings) {
      for (let room of booking.hotelRooms) {
        if (room.roomId.toString() === roomId.toString()) {
          sum += room.quantity;
          console.log("room id - ", room.roomId);
          console.log("room qty - ", room.quantity);
        }
      }
    }
    console.log("🚀 ~ bookings ~ sum:", sum);

    return sum;
  } catch (error) {
    console.log("🚀 ~ bookings error:", error);
    throw new ApiError(
      401,
      "Something went wrong while fetching booking details."
    );
  }
};

const deleteBooking = asyncHandler(async (req, res) => {
  try {
    const { book_id } = req.body;
    await Booking.findByIdAndDelete(book_id);
    if (!(await Booking.findById(book_id))) console.log("Hotel is deleted");
    return res
      .status(201)
      .json(new ApiResponse(204, book_id, `booking id ${book_id} is deleted`));
  } catch (error) {
    console.log("🚀 ~ error:", error);
    res.status(401).json(new ApiError(401, "booking cannot be deleted"));
  }
});

const userBookings = asyncHandler(async (req, res) => {
  try {
    const userid = req.user._id;
    const userBooking = await Booking.find({ user: userid }).populate("hotel");
    console.log("🚀 ~ userBooking:", userBooking);
    console.log("🚀 ~ userBooking-rooms:", userBooking.hotelRooms);
    res.status(201).json(new ApiResponse(201, userBooking, "bookings fetched"));
  } catch (error) {
    console.log("🚀 ~ error:", error);
    throw new ApiError(401, "some error occured while getting hotels for user");
  }
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
  // verifyEmail
  refreshAcessToken,
  addHotels,
  getHotels,
  deleteHotel,
  HotelDetailPage,
  addRooms,
  getAvailableRooms,
  cart,
  bookings,
  userBookings,
  deleteBooking,
};
