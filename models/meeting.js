const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const meetingSchema = new Schema({
    title: {
        type: String,
        require: true
    },
    briefInfo: {
        type: String,
        require: false
    },
    startAt: {
        type: Date,
        require: true
    },
    time: {
        type: String,
        require: true
    },
    userId: {
        type: String,
        require: true
    },
    meetingType: {
        type: String,
        require: false
    },
}, { timestamps: true });

const Meeting = mongoose.model('Meeting', meetingSchema);
module.exports = Meeting;