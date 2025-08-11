import mongoose, { Schema } from "mongoose";
import { User } from "./user.model";
import { Hotel } from "./hotel.model";

const bookingSchema =  new Schema({
    hotelName : {
        type : Schema.Types.ObjectId,
        ref : Hotel,
        required : true
    },
    bookedBy : {
        type : Schema.Types.ObjectId,
        ref : User,
        required : true
    },
    bookingAmount : {
        type : Number
    },
    bookingForPeoples : { 
        type : Number
    },
    bookingNoOfRooms : {
        type : Number
    }
}, {timestamps : true})

export const Booking = mongoose.model("Booking", bookingSchema);