
import connectDB from './database/index.js';
import dotenv from "dotenv";
import express from "express";
import {app} from './app.js'
dotenv.config({
    path: './env'
})


app.use((req, res, next) => {
    console.log(`[INCOMING REQUEST] ${req.method} ${req.url}`);
    next();
});


connectDB()
.then( () => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`server is running at port ${process.env.PORT}`)
    })
})
.catch((err) => {
    console.log("MONGODB connection failed" , err);
});





















//METHOD 1:
// const app = express();

// (async () => {
//     try {
//       // Connect to MongoDB
//       const dbUri = `${process.env.MONGODB_URI}/${process.env.DB_NAME}`;
//       await mongoose.connect(dbUri, {
//         useNewUrlParser: true,
//         useUnifiedTopology: true,
//       });
  
//       console.log("Database connected successfully");
  
//       // Handle application errors
//       app.on("error", (error) => {
//         console.error("Application Error:", error);
//       });
  
//       // Start the server
//       const port = process.env.PORT || 3000;
//       app.listen(port, () => {
//         console.log(`App is listening on port ${port}`);
//       });
//     } catch (error) {
//       console.error("Startup Error:", error);
//       process.exit(1); // Exit the process with failure
//     }
//   })();
  