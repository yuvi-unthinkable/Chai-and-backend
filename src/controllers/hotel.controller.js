import { Hotel } from "../models/hotel.model.js";
import { Room } from "../models/HotelRooms.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

export {
  addHotels,
  getHotels,
  deleteHotel,
  HotelDetailPage,
  addRooms,
  getAvailableRooms,
  // getWatchHistory,
  // getUserChannelProfile,
};
