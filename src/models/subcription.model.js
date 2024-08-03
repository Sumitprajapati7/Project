import mongoose ,{Schema} from "mongoose";

const subcriptionSchema =new Schema({
    subscriber:{
        types:Schema.Types.ObjectId,
        //one who is subsribing
        ref:"User"
    },
    channel:{
        types:Schema.Types.ObjectId,
        //one to whom subscriber is subscribing
        ref:"User"
    }
},
{timestamps:true})

export const Subcription = mongoose.model("Subscription",subcriptionSchema)