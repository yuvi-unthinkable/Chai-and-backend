
import mongoose, { Schema } from "mongoose";
// import { Hotel } from "./hotel.model";

const roomSchema = new Schema({
  hotelId: {
    type: Schema.Types.ObjectId,
    ref: "Hotel",
  },
  roomType: {
    type: String,
    required: true,
  },
  noOfPersons: {
    type: Number,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  roomPhoto: {
    type: String,
    required: true,
  },
  totalRooms : {
    type : Number,
    required : true
  },
  availableRooms : {
    type : Number,
    required : true
    
  }
});

export const Room = mongoose.model("Room", roomSchema);
