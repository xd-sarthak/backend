import mongoose, {Schema} from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";


const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: [true,"username is not available"],
            lowercase: true,
            trim: true,
            index: true //better searching in db
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        fullname: {
            type: String,
            required: true,
            trim: true,
            index: true
        },

        avatar: {
            type: String, //url aaega cloudinary ka for img
            required: true,
        },

        coverimage: {
            type: String, //url
        },

        watchHistory: [
            {
                type: Schema.Types.ObjectId,
                ref: "Videos"
            }
        ],

        password: {
            type: String,
            required: [true,"password is required"]
        },

        refreshToken : {
            type: String
        }
        
    },
    {
        timestamps : true
    }
);

userSchema.pre("save",async function (next) {
    if(!this.isModified("password")) return next();

    this.password = bcrypt.hash(this.password, 10);
    next()
})

userSchema.methods.isPasswordCorrect = async function(password){
   return await bcrypt.compare(password, this.password)
}

userSchema.methods.generateAccessToken = function(){
    return jwt.sign({
        _id: this._id,
        email: this.email,
        username: this.username,
        fullname: this.fullname
    },process.env.ACCESS_TOKEN_SECRET,{
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY
    })
}

userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
    {
        _id: this._id,
    },
    process.env.REFERESH_TOKEN_SECRET,
    {
        expiresIn: process.env.REFERESH_TOKEN_EXPIRY
    })
}

export const User = mongoose.model("User", userSchema);

