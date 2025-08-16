import mongoose, { Schema } from "mongoose";
import { User } from "./user.model";
import { Hotel } from "./hotel.model";
import { Room } from "./HotelRooms.model";

const bookingSchema =  new Schema({
    hotel : {
        type : Schema.Types.ObjectId,
        ref : Hotel,
        required : true
    },
    user : {
        type : Schema.Types.ObjectId,
        ref : User,
        required : true
    },
    hotelRooms : {
        type : [Schema.Types.ObjectId],
        ref : Room,
        required : true
    },
    bookingAmount : {
        type : Number,
        required : true
    },
    bookingForPeoples : { 
        type : Number,
        required : true
    },
    bookingDate : {
        type : Date,
        required : true
    },
    checkInData : {
        type : Date,
        required : true
    },
    checkOutData : {
        type : Date,
        required : true
    }
}, {timestamps : true})

export const Booking = mongoose.model("Booking", bookingSchema);