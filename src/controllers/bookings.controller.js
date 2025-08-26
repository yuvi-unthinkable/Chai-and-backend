import { Booking } from "../models/Booking.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

const bookings = async (checkInDate, checkOutDate, roomId) => {
  console.log("🚀 ~ bookings ~ roomId:", roomId);
  console.log("🚀 ~ bookings ~ roomId:", roomId);
  // console.log("🚀 ~ bookings ~ roomType:", roomType)
  console.log("🚀 ~ bookings ~ Booking:", await Booking.find({}));

  try {
    const overLappingBookings = await Booking.find({
      checkInDate: { $lt: checkOutDate },
      checkOutDate: { $gt: checkInDate },
      "hotelRooms.roomId": roomId, // dot notation works for nested fields in arrays
    });

    console.log("🚀 ~ bookings ~ overLappingBookings:", overLappingBookings);

    let sum = 0;

    for (let booking of overLappingBookings) {
      for (let room of booking.hotelRooms) {
        if (room.roomId.toString() === roomId.toString()) sum += room.quantity;
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

export { cart, bookings, userBookings, deleteBooking };
