import mongoose, { Schema } from "mongoose";

const hotelSchema = new Schema ({
    hotelName : {
        type : String,
        required : true,
        unique : true,
        index : true,
    },
    hotelAboutData : {
        type : String,
        required : true,

    }
}, {timestamps : true})

export const Hotel = mongoose.model("Hotel", hotelSchema)