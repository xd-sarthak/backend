import mongoose from "mongoose"

mongoose.connect('mongodb+srv://sarthaksri0203:sarthak123@backend-cluster.g0d7g.mongodb.net', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error connecting to MongoDB:', err));
