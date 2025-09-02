import express, { Router } from "express";
import {
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
} from "../controllers/user.controller.js";

import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { get } from "mongoose";

const router = Router();
const app = express();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);

router.route("/login").post(loginUser);
router.get("/verify-token", verifyJWT, (req, res) => {
  // console.log("🚀 ~ req:", req);
  // console.log("🚀 ~ verify-token:", verify-token)
  res.status(200).json({ user: req.user });
});

// only admin will be able to accress this route
router
  .route("/addHotels")
  .post(verifyJWT, upload.array("photos", 5), addHotels);

// these soutes can be accessed by bth the admin and the user

// secured routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAcessToken);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router.route("/update-account").patch(verifyJWT, updateAccountDetails);
router
  .route("/avatar-update")
  .patch(verifyJWT, upload.single("avatar"), updateUserAvatar);
router.route("/delete-hotel").post(verifyJWT, deleteHotel);
router.route("/get-hotels").get(verifyJWT, getHotels);
router.route("/hotel-details/:id").get(verifyJWT, HotelDetailPage);
router.route("/rooms-available/:id").post(getAvailableRooms);
router
  .route("/add-rooms")
  .post(verifyJWT, upload.single("roomPhoto"), addRooms);
router.route("/cart").post(verifyJWT, cart);
router.route("/bookings").get(verifyJWT, bookings);
router.route("/user-bookings").get(verifyJWT, userBookings);
router.route("/deleteBooking").post(verifyJWT, deleteBooking);
router.route("/verify/:token").get(verifyEmail);
router.route("/feedbackSubmit").post(submitFeedback);
router.route("/getUserFeedbacks").get(verifyJWT, getUserFeedback)
router.route("/getHotelFeedbacks/:hotelId").get(verifyJWT, getHotelFeedback)
router.route("/bookingInfo/:bookId").get(BookingInfo)

export default router;
