import { mongoose, Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Hotel } from "./hotel.model.js";
import { Room } from "./HotelRooms.model.js";
import crypto from "crypto";

// const crypto  = CryptoJS

const unVerifieduserSchema = new Schema({
  fullName: String,
  email: { type: String, },
  username: { type: String, },
  password: String,
  verificationToken:String,
  verificationTokenExpire: Date,
},
{timestamps : true}
);



const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      // lowercase : true,
      trim: true,
      index: true,
    },
    avatar: {
      type: String, //cloudnary url
      required: false,
    },
    coverImage: {
      type: String,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      required: true,
    },
    bookHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: "Hotel",
      },
    ],
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    refreshToken: {
      type: String,
    },

    hotel: {
      type: Schema.Types.ObjectId,
      ref: Hotel,
    },
    room: {
      type: Schema.Types.ObjectId,
      ref: Room,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAcessToken = function () {
  return jwt.sign(
    {
      _id: this.id,
      email: this.email,
      username: this.username,
      fullName: this.fullName,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this.id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

unVerifieduserSchema.methods.getVerificationToken = function () {
  const token = crypto.randomBytes(20).toString("hex");

  this.verificationToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  this.verificationTokenExpire = Date.now() + 10 * 60 * 1000;
  
  return token;
};

export const unVerifiedUser = mongoose.model(
  "unVerifiedUser",
  unVerifieduserSchema
);

export const User = mongoose.model("User", userSchema);
