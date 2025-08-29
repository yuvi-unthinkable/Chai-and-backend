import mongoose, { Schema } from "mongoose";
import { Hotel } from "./hotel.model.js";
import { User } from "./user.model.js";
import { Booking } from "./Booking.model.js";

const feedbackSchema = new Schema(
  {
    hotel: {
      type: Schema.Types.ObjectId,
      ref: Hotel,
      required: true,
    },

    user: {
      type: Schema.Types.ObjectId,
      ref: User,
      required: true,
    },
    booking : {
        type : Schema.Types.ObjectId,
        ref : Booking,
        required : true
    },
    hotelName: {
      type: String,
    },
    userName: {
      type: String,
    },

    ratingStar: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    reviewText: {
      type: String,
      maxLegth: 2000,
      required: true,
    },

    // future scope items will handle thiem in the future
    photos: [
      {
        url: String,
      },
    ],
    stayDate: {
      type: Date,
    },
    isApproved: {
      type: Boolean,
      default: true,
    },
    reportCount: {
      type: Number,
      default: 0,
    },

    likes: {
      type: Schema.Types.ObjectId,
      ref: User,
    },
    disLikes: {
      type: Schema.Types.ObjectId,
      ref: User,
    },
    createDate: {
      type: Date,
    },
    updateDate: {
      type: Date,
    },
  },
  { timestamps: true }
);

feedbackSchema.index({ user: 1, booking: 1 }, { unique: true })

export const feedback = mongoose.model("feedback", feedbackSchema);
