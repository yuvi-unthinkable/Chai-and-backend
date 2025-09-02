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
import { feedback } from "../models/feedback.model.js";
import crypto from "crypto";
import cron from "node-cron";

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

    const user = await unVerifiedUser.create({
      fullName,
      email,
      password,
      username: username.toLowerCase(),
      role,
      isVerified: false,
    });

    if (user) {
      const verificationToken = user.getVerificationToken();
      console.log("🚀 ~ verificationToken:", verificationToken);
      await user.save({ validateBeforeSave: false });

      // send verification mail
      const verificationUrl = `${req.protocol}://${req.get("host")}/api/v1/users/verify/${verificationToken}`;
      const message = `Please verify your email by clicking on the following link : ${verificationUrl}`;
      await sendEmail({
        email: user.email,
        subject: "Email Verification",
        message,
      });

      // const token = await unVerifiedUser.$set(verificationToken)
      // console.log("🚀 ~ token:", token)

      console.log("email sent", message);

      return res.status(201).json({
        success: true,
        message: "Verification Email sent, please check your inbox",
      });
    }

    // return res.status(201).json(new ApiResponse(201, user, "user is created"));
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

const verifyEmail = asyncHandler(async (req, res) => {
  console.log("🚀 ~ req:", req.body);
  console.log("🚀 ~ req:", req.params);
  try {
    const token = req.params.token;
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    console.log("🚀 ~ hashedToken:", hashedToken);

    const user = await unVerifiedUser.findOne({
      verificationToken: hashedToken,
      verificationTokenExpire: { $gt: Date.now() },
    });
    console.log("🚀 ~ user:", user);

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpire = undefined;

    const { email, username, password, fullName } = user;

    const newUser = User.create({
      email,
      username,
      password,
      fullName,
    });

    res.redirect("https://lords-hotel.netlify.app/home");
    // res.status(200).json({ message: "Email verified successfully!" });
    console.log("🚀 ~ verifyEmail.message:", verifyEmail.message);
  } catch (error) {
    console.log("🚀 ~ error:", error);
    return res.status(400).json(new ApiError(400, "email not verified"));
  }
});

const loginUser = asyncHandler(async (req, res) => {
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
          acessToken: "",
          refreshToken: "",
        },
      },
      {
        new: true,
      }
    );

    const options = {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    };

    // Clear both cookies
    res.clearCookie("accessToken", options);
    res.clearCookie("refreshToken", options);

    return res.status(200).json(new ApiResponse(200, {}, "User Logged out"));
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
  try {
    const avatarLocalPath = req.file?.path;
    console.log("🚀 ~ avatarLocalPath:", avatarLocalPath)

    if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar image is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    console.log("🚀 ~ avatar url is here:", avatar?.url);

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
  } catch (error) {
    console.log("🚀 ~ error:", error);
    return res.status(400).json(
      new ApiError(400, error)
    );
  }
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

    const hotel = await Hotel.findById(cart.hotelId);
    console.log("🚀 ~ hotel:", hotel);

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
      userName: req.user.fullName,
      hotelName: hotel.hotelName,
    });
    console.log("🚀 ~ booking:", booking);

    if (booking) console.log("Booking is created");

    const formattedCheckIn = new Date(booking.checkInDate).toLocaleDateString();
    const formattedCheckOut = new Date(
      booking.checkOutDate
    ).toLocaleDateString();

    const user = req.user;

    // if hotelRooms is an array, collect room types
    const roomTypes = Array.isArray(booking.hotelRooms)
      ? booking.hotelRooms.map((room) => room.roomType).join(", ")
      : booking.hotelRooms.roomType;

    const message = `
Congratulations ${user.fullName}, 🎉

Your booking has been confirmed! Here are your booking details:

- Booking ID: ${booking._id}
- Rooms: ${roomTypes}
- Check-In: ${formattedCheckIn}
- Check-Out: ${formattedCheckOut}

We look forward to hosting you! 🏨
`;

    await sendEmail({
      email: user.email,
      subject: "Booking Confirmed",
      message,
    });

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

const bookings = async (
  checkInDate,
  checkOutDate,
  roomId,
  checkInTime,
  checkOutTime
) => {
  try {
    const parsedCheckinDate = new Date(checkInDate);
    const parsedCheckOutDate = new Date(checkOutDate);

    if (!parsedCheckOutDate || !parsedCheckinDate)
      console.log("error with the date format");

    const overLappingBookings = await Booking.find({
      "hotelRooms.roomId": roomId,

      $or: [
        // CASE 1: Date ranges overlap
        {
          checkInDate: { $lt: parsedCheckOutDate },
          checkOutDate: { $gt: parsedCheckinDate },
        },

        // CASE 2: Same check-in date, but times overlap
        {
          checkOutDate: parsedCheckinDate, // exact same date
          // checkInTime: { $: Number(checkOutTime) },
          checkOutTime: { $gt: Number(checkInTime - 1) },
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

const BookingInfo = asyncHandler(async (req, res) => {
  try {
    const bookId = req.params.bookId;
    console.log("🚀 ~ bookId:", bookId);
    const book = await Booking.findById(bookId);
    console.log("🚀 ~ book:", book);
    return res
      .status(200)
      .json(new ApiResponse(201, book, "Booking details fetched"));
  } catch (error) {
    console.log("🚀 ~ error:", error);
    return res
      .status(400)
      .json(
        new ApiError(400, "Booking details cannot be fetched at this moment")
      );
  }
});

const submitFeedback = asyncHandler(async (req, res) => {
  try {
    const { hotel, user, ratingStar, reviewText, userName, booking } = req.body;

    if (
      feedback.find({
        booking: booking,
      })
    ) {
      return res
        .status(409)
        .json(new ApiError(409, "The feedback is already submitted"));
    }

    const review = await feedback.create({
      hotel,
      user,
      ratingStar,
      reviewText,
      userName,
      booking,
    });
    // if(review) review.save()

    return res
      .status(201)
      .json(new ApiResponse(201, review, "the feedback has been saved"));
  } catch (error) {
    console.log("🚀 ~ error:", error);

    if (error.code === 11000) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            "You have already submitted feedback for this hotel"
          )
        );
    }
    res
      .status(500)
      .json(
        new ApiError(500, "something went wrong while saving the feedback")
      );
  }
});

const getUserFeedback = asyncHandler(async (req, res) => {
  try {
    const feedbacks = await feedback.find({
      user: req.body.userId,
    });
    console.log("🚀 ~ feedbacks:", feedbacks);
    return res
      .status(201)
      .json(new ApiResponse(201, feedbacks, "list of feedbacks fetched"));
  } catch (error) {
    console.log("🚀 ~ error:", error);
    return res
      .status(400)
      .json(
        new ApiError(400, "something went wrong while fetching the  feedbacks ")
      );
  }
});
const getHotelFeedback = asyncHandler(async (req, res) => {
  try {
    const hotelId = req.params.hotelId;
    const feedbacks = await feedback.find({
      hotel: hotelId,
    });
    console.log("🚀 ~ feedbacks:", feedbacks);
    return res
      .status(201)
      .json(new ApiResponse(201, feedbacks, "list of feedbacks fetched"));
  } catch (error) {
    console.log("🚀 ~ error:", error);
    return res
      .status(400)
      .json(
        new ApiError(400, "something went wrong while fetching the  feedbacks ")
      );
  }
});

cron.schedule(" 0 9 * * *", async () => {
  console.log("running feedback email job");

  try {
    const now = new Date();
    console.log("🚀 ~ now:", now);

    const bookings = await Booking.find({
      checkOutDate: { $lte: now }, // all bookings with checkout time up to now
      feedbackEmailSent: false,
    }).populate("user");
    console.log("🚀 ~ bookings:", bookings);

    for (const booking of bookings) {
      const feedbackLink = `https://chai-and-backend.onrender.com/bookingInfo/${booking._id}`;
      const message = `
Hi ${booking.user.fullName}, 

Thank you for staying with us! We hope you had a great experience.
Please take a moment to share your feedback: ${feedbackLink}
`;

      console.log("🚀 ~ booking.user.email,:", booking.user.email);
      await sendEmail({
        email: booking.user.email,
        subject: "We value your feedback",
        message,
      });

      booking.feedbackEmailSent = true;
      await booking.save();

      console.log(`feedback email sent to ${booking.user.email}`);
    }
  } catch (error) {
    console.log("🚀 ~ error:", error);
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
  verifyEmail,
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
  submitFeedback,
  getUserFeedback,
  getHotelFeedback,
  BookingInfo,
};
