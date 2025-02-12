import { Router } from "express";
import { registerUser } from "../controllers/user.controller.js"; // Correct the path if needed
import { upload } from "../middlewares/multer.js";               // Correct the path if needed
import {loginUser,logoutUser,refreshAccessToken} from "../controllers/user.controller.js"
import {verifyJWTtoken} from "../middlewares/auth.middleware.js"

const router = Router();

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        }, 
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
    )

router.route("/login").post(loginUser)

router.route("/logout").post(verifyJWTtoken,logoutUser)

router.route("/refresh-token").post(refreshAccessToken)

export default router;
