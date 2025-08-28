import mongoose, { Schema } from "mongoose";
import { Hotel } from "./hotel.model.js";
import { User } from "./user.model.js";

const feedbackSchema = new Schema({
    hotel : {
        type : Schema.Types.ObjectId,
        ref : Hotel,
        required : true,
    },
    hotelName : {
        type : String,
    },
    user : {
        type : Schema.Types.ObjectId,
        ref : User,
        required : true,
    },
    userName : {
        type : String
    },

    ratingStar : {
        type : Number,
        min : 1,
        max : 5,
        required : true,
    },
    reviewText : {
        type  : String,
        maxLegth : 2000,
        required : true,

    },

    // future scope items will handle thiem in the future
    photos : [
        {
            url : String,
        }
    ],
    stayDate : {
        type : Date,
    },
    isApproved : {
        type : Boolean,
        default :true,
    },
    reportCount : {
        type : Number,
        default : 0,
    },

    likes : {
        type : Schema.Types.ObjectId,
        ref : User,
    },
    disLikes : {
        type : Schema.Types.ObjectId,
        ref : User
    },
    createDate : {
        type : Date
    },
    updateDate : {
        type : Date
    }
}, {timestamps: true})

feedbackSchema.index({user:1, hotel:1}, {unique:true})

export const feedback = mongoose.model("feedback", feedbackSchema)