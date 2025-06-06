import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN || "*",  // Allow all origins for testing
    credentials: true
}));


app.use(express.json({limit: "16kb"})) //limits incoming json payload to acoid large payload affecting performance
app.use(express.urlencoded({extended: true, limit: "16kb"})) //parses data from urlencoded like forms
app.use(express.static("public")) //public mai stored files can be served
app.use(cookieParser()); //gives cookie access to req.cookies and used in auth etc

//routes

import userRouter from "./routes/user.routes.js"


//routes declaration
app.use("/api/v1/users", (req, res, next) => {
    console.log(`[ROUTER] Request hitting /api/v1/users`);
    next();
}, userRouter);




export {app};