import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()
const allowedOrigins = [
  'http://localhost:5173',
  'https://lords-hotel.netlify.app'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like curl or Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({limit:"16kb"}))
app.use(express.urlencoded({extended:true, limit:"16kb"}))
app.use(express.static("public"))
app.use(cookieParser())


// routes
import userRouter from './routes/user.routes.js'
// routes declaration
app.use("/api/v1/users", userRouter)

// http:localhost:800/api/v1/users/register


export {app}