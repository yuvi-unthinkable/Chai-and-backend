import mongoose, { Schema, SchemaType } from "mongoose";
import { User } from "./user.model.js";
import { Hotel } from "./hotel.model.js";
import { Room } from "./HotelRooms.model.js";

const roomSchema = new Schema({

  roomId : {
    type : Schema.Types.ObjectId,
    ref : Room
  },
  quantity : {
    type : Number,
  },
  roomType : {
    type : String
  },
  price : {
    type : Number
  },
  totalPrice : {
    type : Number
  },
  noOfPerson : {
    type : Number
  }
  
})

const bookingSchema = new Schema(
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
    userName : {
      type : String,
      required: true,
    },
    hotelName : {
      type : String,
      required : true
    },
    hotelRooms: {
      type: [roomSchema],
      required: true,
    },

    bookingAmount: {
      type: Number,
      required: true,
    },
    bookingForPeoples: {
      type: Number,
      required: true,
    },
    checkInDate: {
      type: Date,
      required: true,
    },
    checkInTime : {
      type : String
    },
    checkOutDate: {
      type: Date,
      required: true,
    },
    checkOutTime :{
      type : String
    },
    feedbackEmailSent : {
      type : Boolean,
      default : false
    }
    

  },
  { timestamps: true }
);



export const Booking = mongoose.model("Booking", bookingSchema);
