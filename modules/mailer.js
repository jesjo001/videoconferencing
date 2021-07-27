const nodemailer = require("nodemailer")

const sendMail = (email, subject, content) => {

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.MAILUSER,
            pass: process.env.MAILAUTH
        }
    });

    let mailOptions = {
        from: process.env.MAILAUTH,
        to: email,
        subject: subject,
        html: content
    };

    send(transporter, mailOptions);
}


const send = (transporter, mailOptions) => {
    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    })
}

module.exports = {
    sendMail
}