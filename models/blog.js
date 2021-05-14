const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    username: {
        type: String,
        require: false
    },
    email: {
        type: String,
        require: true
    },
    password: {
        type: String,
        require: true
    },
    dob: {
        type: Date,
        require: false
    },
    address: {
        type: String,
        require: false
    },
    city: {
        type: String,
        require: false
    },
    country: {
        type: String,
        require: false
    }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
module.exports = User;