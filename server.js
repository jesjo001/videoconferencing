const express = require('express');
const app = express();
require('dotenv').config()
//
const bcrypt = require('bcrypt')
const server = require('http').Server(app);
const { v4: uuidv4 } = require('uuid')
const io = require('socket.io')(server)
const { ExpressPeerServer } = require('peer')
const User = require('./models/blog')
const Meeting = require('./models/meeting')
const passport = require('passport')
const localStrategy = require('passport-local').Strategy;
const session = require('express-session')
const morgan = require('morgan')
const mongoose = require('mongoose');
const moment = require('moment');
const { response } = require('express');
const jwt = require("jsonwebtoken")
const { sendMail } = require("./modules/mailer")

const peerServer = ExpressPeerServer(server, {
    debug: true
});

//connect to db
const port = process.env.PORT || 3030
const dbURI = process.env.MONGODBURI
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then((result) => server.listen(port))
    .catch((err) => console.log(err))

//Error
let error = [];
let newError = false;
let loggedIn = false;
let username = "user";

//Middlewares
app.set('view engine', 'ejs');
app.use(express.static('public'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use('/peerjs', peerServer);
app.use(session({
    secret: 'sdrjmghkytukjdfgbstr',
    resave: false,
    saveUninitialized: true
}));


//passport 
app.use(passport.initialize())
app.use(passport.session())

//FUNCTIONS
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) return next()
    res.redirect('/user/login')
}

function isLoggedOut(req, res, next) {
    if (!req.isAuthenticated()) return next();
    res.redirect('/dashboard')
}

passport.serializeUser(function (user, done) {
    done(null, user.id)
})

passport.deserializeUser(function (id, done) {
    //setup user model
    User.findById(id, function (err, user) {
        done(err, user)
    });
});

passport.use(new localStrategy({
    usernameField: 'email',
    passwordField: 'password'
}, function (username, password, done) {

    User.findOne({ 'email': username }, function (err, user) {
        if (err) {
            console.log("Error is", err)
            return done(err);

        }
        if (!user) {
            console.log("Email does not match our record ")
            return done(null, false, { message: "Email does not match our record " });
        }
        bcrypt.compare(password, user.password, function (err, res) {
            if (err) {
                console.log("Error is", err)
                return done(err)
            }
            if (res === false) {
                console.log(" Incorrect password ")
                return done(null, false, { message: "Incorrect Password." })
            }

            return done(null, user);

        })
    })
}))


//Routes
// app.get("/home", (req, res) => {
//     res.render('landing', { title: "Home" });
// })

io.on('connection', socket => {
    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', userId);

        socket.on('message', message => {
            //send message to the same room
            io.to(roomId).emit('createMessage', message)
        })

        socket.on('disconnect', () => {
            socket.to(roomId).emit('user-disconnected', userId)
        })
    })
})

app.get("/", (req, res) => {
    res.render('index', { title: "Home" });
})

app.get("/welcome", isLoggedIn, (req, res) => {
    console.log("user is ", req.user)
    res.render('landing2', { title: "Home", user: req.user, newError: false, error: "" });
})

app.get("/dashboard2", isLoggedIn, (req, res) => {
    Meeting.find().sort({ createdAt: -1 })
        .then((result) => {
            console.log(result)
            res.render('dashboard', { title: "Dashboard", user: req.user, meetings: result })
        })
        .catch((err) => {
            console.log(err)
        })
    // res.render('dashboard', { title: "Dashboard" });
})

app.get("/dashboard", isLoggedIn, async (req, res) => {
    loggedIn = true;

    getWeeklyData()

    const total = await Meeting.countDocuments({ userId: req.user._id })
    const monthStart = moment().startOf('month');
    const monthEnd = moment().endOf('month');
    const today = new Date()
    const yearStart = moment().startOf('year');
    const yearEnd = moment().endOf('year');

    const thisYearMeetings = await Meeting.count({ userId: req.user._id, startAt: { $gte: new Date(yearStart), $lte: new Date(yearEnd) } })
    const amonthMeetings = await Meeting.count({ userId: req.user._id, startAt: { $gte: new Date(monthStart), $lte: new Date(monthEnd) } })
    const upcomingMeeting = await Meeting.find({ userId: req.user._id, startAt: { $gte: new Date(today) } })
    const monthlyMeeting = await Meeting.find({ userId: req.user._id, startAt: { $gte: new Date(monthStart), $lte: new Date(monthEnd) } })

    //get graph data to display on dashboard
    let graphData = await getMonthlyData(req.user);
    const weeklyData = await getWeeklyData(req.user._id);

    const weekNumber = moment().format("w");

    Meeting.find({ userId: req.user._id }).sort({ createdAt: -1 })
        .then((result) => {
            // console.log(result)
            username = req.user.username
            console.log(req.user)
            res.render('dashboard2', {
                title: "Dashboard",
                user: {
                    email: req.user.email,
                    username: req.user.username,
                    createdAt: req.user.createdAt,
                    updatedAt: req.user.updatedAt
                },
                meetings: result,
                upcomingMeeting,
                monthlyMeeting,
                statistics: {
                    amonthMeetings,
                    total,
                    thisYearMeetings,
                    upcomingMeetingCount: upcomingMeeting.length,

                },
                newData: graphData,
                weeklyData

            })
        })
        .catch((err) => {
            console.log(err)
        })
    // res.render('dashboard', { title: "Dashboard" });
})

app.get("/meetings", isLoggedIn, async (req, res) => {

    let page, search, totalMeetings, total;
    let ITEMS_PER_PAGE = 10;

    console.log("requesr query is  ")
    console.log(req.query)

    if (req.query.search) {
        search = req.query.search
    }



    const monthStart = moment().startOf('month');
    const monthEnd = moment().endOf('month');
    const today = new Date()
    const upcomingMeeting = await Meeting.find({ userId: req.user._id, startAt: { $gte: new Date(today) } })
    const monthlyMeeting = await Meeting.find({ userId: req.user._id, startAt: { $gte: new Date(monthStart), $lte: new Date(monthEnd) } })
    if (req.query.page) {
        page = +req.query.page || 1;
        totalUpcomingMeetings = upcomingMeeting.length
        console.log("upcoming meetings ", totalUpcomingMeetings)

    }

    Meeting.find({ userId: req.user._id }).sort({ createdAt: -1 })
        .countDocuments()
        .then(numMeetings => {
            total = numMeetings;
            return Meeting.find({ userId: req.user._id })
                .skip((page - 1) * ITEMS_PER_PAGE)
                .limit(ITEMS_PER_PAGE);
        })
        .then((result) => {
            // console.log(result)
            console.log(req.user)
            res.render('meetingList', {
                title: "Dashboard",
                user: {
                    email: req.user.email,
                    username: req.user.username,
                    createdAt: req.user.createdAt,
                    updatedAt: req.user.updatedAt
                },
                meetings: result,
                upcomingMeeting,
                monthlyMeeting,
                currentPage: page,
                hasNextPage: ITEMS_PER_PAGE * page < total,
                hasPreviousPage: page > 1,
                nextPage: page + 1,
                previousPage: page - 1,
                lastPage: Math.ceil(total / ITEMS_PER_PAGE)
            })
        })
        .catch((err) => {
            console.log(err)
        })
})

app.get("/profile", isLoggedIn, (req, res) => {
    console.log(req.user)
    res.render('profile', { title: "Profile", user: req.user, messageType: "Null", message: "" })
})

app.post("/update", isLoggedIn, async (req, res) => {

    console.log(req.body)
    try {
        let userUpdate = { ...req.body }
        console.log(req.user)
        console.log("user update is ")
        console.log(userUpdate)

        const user = await User.updateOne({ _id: req.user.id }, {
            $set:
            {
                username: userUpdate.username,
                email: userUpdate.email,
                firstName: userUpdate.firstName,
                lastName: userUpdate.lastName,
                address: userUpdate.address,
                city: userUpdate.city,
                country: userUpdate.country,
                postalCode: userUpdate.postalCode
            }
        })

        // console.log("new user is ", req.user)
        res.render('profile', { title: "Profile", user: req.user, message: "Profile updated", messageType: "Success" })
    } catch (e) {
        console.log(e)
        res.render('profile', { title: "Profile", user: req.user, message: "Error: something went wrong", messageType: "Error" })
    }


})

app.get("/user/register", (req, res) => {

    res.render('user_register');
})

app.get("/user/login", isLoggedOut, (req, res) => {
    // console.log("request body", req.body)
    res.render('login', { title: 'Login / Sign Up', newError: false, error: req.query.error });
})

app.post('/register', async (req, res) => {

    let numDoc = await User.count({ email: req.body.signupEmail })
    console.log("number of old users with same email ", numDoc);

    if (numDoc == 0) {
        try {
            console.log("got here")

            console.log("REQUEST IS ", req.body)
            const hashedPassword = await bcrypt.hash(req.body.password2, 10)
            console.log(hashedPassword)

            const user = new User({
                username: req.body.signupUsername,
                email: req.body.signupEmail,
                password: hashedPassword
            })

            user.save()
                .then((result) => {
                    // bert alert account creation success
                    console.log("response is ", result)
                    error.push("Nill")
                    return res.render("login", {
                        message: "Registration succeed! Check your mail for verification",
                        user: result,
                        newError: "message",
                        error: "Success. Check your email for verification...",
                    })
                })
                .catch((err) => {
                    console.log(err)
                    return res.render("login", {
                        newError: "true",
                        error: "Something went wrong. Check your network connection",
                    })
                })
        } catch (e) {
            // console.log("Error ", e)
            res.status(500).send()
        }
    } else {
        console.log("User Exist")
        error.push("User already exist...")
        newError = true;
        //send bert alert email taken
        return res.render('login', { title: 'Login / Sign Up', newError, error: error.pop() });
    }

})

app.post('/scheduleMeeting', isLoggedIn, (req, res) => {

    console.log(req.body)
    const userId = req.user.id;
    let meetDate = new Date(req.body.meetingStart);

    // date and time together
    const time = req.body.meetingTime.split(":")
    meetDate.setHours(time[0], time[1]);

    console.log("user id is: ", userId)
    //generate meeting link
    const meetingId = uuidv4()

    //generate new meeting object to be saved
    // in the database
    const meeting = new Meeting({
        title: req.body.meetingTitle,
        briefInfo: req.body.briefInfo,
        startAt: meetDate,
        time: req.body.meetingTime,
        userId: userId,
        meetingLink: meetingId
    })

    meeting.save()
        .then(() => {
            return res.redirect(url.format({
                pathname: "/welcome",
                query: {
                    "messageType": "success",
                    "title": "Home",
                    "message": "Meeting Scheduled Successfully!",
                    "errorType": "Message"
                }
            }));

        })
        .catch((err) => {
            console.log(err)
            return res.render('landing2', { error: "Something went wrong", newError: "true", title: "Home", user: req.user })
        })

    console.log(meeting)
})

app.post('/login', passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/user/login?error=true'
}))

app.get('/logout', function (req, res) {
    loggedIn = false;
    req.logout();
    res.redirect('/');
})


//RESET PASSWORD / FORGOTEN PASSWORD SECTION

app.get('/forgotten-password', function (req, res) {
    res.render('forgottenPassword', { messageType: "Null", message: "" })
})

app.post('/forgotten-password', async (req, res) => {
    ///get email from request body
    const { email } = req.body

    //check if email exists in db
    //if not send a message to usser
    const exists = await User.exists({ email });
    if (!exists) {
        console.log("doesnt exist")
        res.render("forgottenPassword", { message: "Email does not exist in our database", messageType: "Error" })
        return;
    }

    //if user exist, proceed
    if (exists) {

        //get user from db
        const user = await User.findOne({ email })
        console.log(user)

        //generate a secret and payload to use to generate a token 
        const secret = process.env.JWT_SECET + user.password
        const payload = {
            email: user.email,
            id: user._id
        }
        //generate a token with secret nd payload expires in 15 min
        //send token to user email. 
        const token = jwt.sign(payload, secret, { expiresIn: '15m' })

        //Uncomment section for local testing 
        // const link = `${process.env.HOST}${process.env.PORT}/reset-password/${user._id}/${token}`

        //COMMENT FR LOCAL TESTING
        const link = `${process.env.HEROKUHOST}/reset-password/${user._id}/${token}`

        console.log(link)
        //Send Email
        let content = `<h3>Creative Teams </h3> <br / > <h4> Reset Password</h4> <p>Yoe can now reset your password by following the link bellow <br/> ${link} </p>`


        sendMail(user.email, "Creative Teams | Reset Password", content)


        //send a message to user to check email.
        res.render("forgottenPassword", { message: "Password reset link sent to your email.", messageType: "Success" })
    }

})

app.get('/reset-password/:id/:token', async (req, res) => {

    const { id, token } = req.params;

    //check if the id of the user exist 
    const exists = await User.exists({ _id: id });
    console.log("Exist is ", exists)
    if (!exists) {
        console.log("doesnt exist")
        res.render("forgottenPassword", { message: "Email does not exist in our database", messageType: "Error" })
        return;
    }

    //generate secret since we have a user in db
    const user = await User.findOne({ _id: id })
    console.log(user)
    const secret = process.env.JWT_SECET + user.password;
    try {
        const payload = jwt.verify(token, secret)
        res.render(`resetPassword`, { messageType: "Null", message: "", email: user.email })
    } catch (e) {
        console.log(e.message)
        res.render(`resetPassword`, { messageType: "Error", message: "Opps!!! Something Went Wrong. Seems the link has Expires" })
    }
})

app.post('/reset-password/:id/:token', async (req, res) => {
    const { id, token } = req.params;
    const { password, password2 } = req.body;
    const exists = await User.exists({ _id: id });
    if (!exists) {
        console.log("doesnt exist")
        res.render("resetPassword", { message: "Email does not exist in our database", messageType: "Error", email: "" })
        return;
    }

    //generate secret since we have a user in db
    const user = await User.findOne({ _id: id })
    console.log(user)
    const secret = process.env.JWT_SECET + user.password;

    try {
        const payload = jwt.verify(token, secret)

        // validate passwords
        if (password !== password2) {
            res.render(`resetPassword`, { messageType: "Error", message: "Password does not match", email: user.email })
            return
        }

        const validated = checkPassword(password)

        if (!validated) {
            res.render(`resetPassword`, { messageType: "Error", message: "Password must contain small letters, Capital, Special Characters and a number", email: user.email })
            return
        }
        const hashedPassword = await bcrypt.hash(password, 10)

        const newUser = await User.updateOne({ _id: id }, {
            $set:
            {
                password: hashedPassword,
            }
        })

        let encodedMessage = encodeURIComponent('something that would break');
        res.render('login', { title: 'Login / Sign Up', newError: "false", message: "Password reset successfull", error: "Null" });

    } catch (e) {
        console.log(e.message)

        if (user) {
            res.render(`resetPassword`, { messageType: "Error", message: "Someting went Wrong", email: user.email })
            return
        }

        res.render(`resetPassword`, { messageType: "Error", message: e.message, email: "No User found" })

    }

})


app.get('/setup', async (req, res) => {
    const exists = await User.exists({ email: "admin@gmail.com" });

    if (exists) {
        console.log("User Exists")
        res.redirect('/user/login');
        return;
    };

    bcrypt.genSalt(10, function (err, salt) {
        if (err) return negetWeeklyData
    });
});

app.get("/instant-meeting", (req, res) => {
    let meetingId = uuidv4()
    res.redirect(`/${meetingId}`);
})

app.post("/instant-meeting/user", (req, res) => {
    console.log(req.body.username)
    username = req.body.username;
    res.redirect(`/instant-meeting`);
})

app.get('/:room', (req, res) => {
    // console.log("in room ")
    // console.log("username is ", username)
    // console.log("room Id ", req.params.room)
    res.render('room', { roomId: req.params.room, title: "Room", username })
})


const getMonthlyData = async (user) => {
    const monthStart = moment().startOf('month');
    const monthEnd = moment().endOf('month');
    const yearStart = moment().startOf('year');
    const yearEnd = moment().endOf('year');
    const thisYearMeetings = await Meeting.count({ userId: user._id, startAt: { $gte: new Date(yearStart), $lte: new Date(yearEnd) } })
    const lastMonthBegins = moment().subtract(1, 'months').startOf('month')
    const lastMonthEnds = moment().subtract(1, 'months').endOf('month')
    const previousMonthBegins = moment().subtract(2, 'months').startOf('month')
    const previousMonthEnds = moment().subtract(2, 'months').endOf('month')
    const threeMonthBackBegins = moment().subtract(3, 'months').startOf('month')
    const threeMonthBackEnds = moment().subtract(3, 'months').endOf('month')
    const fourMonthBackBegins = moment().subtract(4, 'months').startOf('month')
    const fourMonthBackEnds = moment().subtract(4, 'months').endOf('month')
    const fiveMonthBackBegins = moment().subtract(5, 'months').startOf('month')
    const fiveMonthBackEnds = moment().subtract(5, 'months').endOf('month')
    const sixMonthBackBegins = moment().subtract(6, 'months').startOf('month')
    const sixMonthBackEnds = moment().subtract(6, 'months').endOf('month')
    const sevenMonthBackBegins = moment().subtract(7, 'months').startOf('month')
    const sevenMonthBackEnds = moment().subtract(7, 'months').endOf('month')


    const monthlyMeeting = await Meeting.count({ userId: user._id, startAt: { $gte: new Date(monthStart), $lte: new Date(monthEnd) } })
    const lastMonthCount = await Meeting.count({ userId: user._id, startAt: { $gte: new Date(lastMonthBegins), $lte: new Date(lastMonthEnds) } })
    const previousMonthCount = await Meeting.count({ userId: user._id, startAt: { $gte: new Date(previousMonthBegins), $lte: new Date(previousMonthEnds) } })
    const threeMonthCount = await Meeting.count({ userId: user._id, startAt: { $gte: new Date(threeMonthBackBegins), $lte: new Date(threeMonthBackEnds) } })
    const fourMonthCount = await Meeting.count({ userId: user._id, startAt: { $gte: new Date(fourMonthBackBegins), $lte: new Date(fourMonthBackEnds) } })
    const fiveMonthCount = await Meeting.count({ userId: user._id, startAt: { $gte: new Date(fiveMonthBackBegins), $lte: new Date(fiveMonthBackEnds) } })
    const sixMonthCount = await Meeting.count({ userId: user._id, startAt: { $gte: new Date(sixMonthBackBegins), $lte: new Date(sixMonthBackEnds) } })

    return [
        monthlyMeeting,
        lastMonthCount,
        previousMonthCount,
        threeMonthCount,
        fourMonthCount,
        fiveMonthCount,
        sixMonthCount,
    ]

}

const getWeeklyData = async (userId) => {
    const curr = new Date; // get current date
    const first = curr.getDate() - curr.getDay(); // First day is the day of the month - the day of the week

    const firstDay = new Date(curr.setDate(first)).toUTCString();
    const secondDay = new Date(curr.setDate(first + 1)).toUTCString();
    const thirdDay = new Date(curr.setDate(first + 2)).toUTCString();
    const forthDay = new Date(curr.setDate(first + 3)).toUTCString();
    const fifthDay = new Date(curr.setDate(first + 4)).toUTCString();
    const sixthDay = new Date(curr.setDate(first + 5)).toUTCString();
    const lastDay = new Date(curr.setDate(first + 6)).toUTCString();

    const sundayMeeting = await Meeting.count({ userId: userId, startAt: { $gte: new Date(moment(firstDay).startOf('day')), $lte: new Date(moment(firstDay).endOf('day')) } })
    const mondayMeeting = await Meeting.count({ userId: userId, startAt: { $gte: new Date(moment(secondDay).startOf('day')), $lte: new Date(moment(secondDay).endOf('day')) } })
    const tuesdayMeeting = await Meeting.count({ userId: userId, startAt: { $gte: new Date(moment(thirdDay).startOf('day')), $lte: new Date(moment(thirdDay).endOf('day')) } })
    const wednesdayMeeting = await Meeting.count({ userId: userId, startAt: { $gte: new Date(moment(forthDay).startOf('day')), $lte: new Date(moment(forthDay).endOf('day')) } })
    const thursdayMeeting = await Meeting.count({ userId: userId, startAt: { $gte: new Date(moment(fifthDay).startOf('day')), $lte: new Date(moment(fifthDay).endOf('day')) } })
    const fridayMeeting = await Meeting.count({ userId: userId, startAt: { $gte: new Date(moment(sixthDay).startOf('day')), $lte: new Date(moment(sixthDay).endOf('day')) } })
    const saturdayMeeting = await Meeting.count({ userId: userId, startAt: { $gte: new Date(moment(lastDay).startOf('day')), $lte: new Date(moment(lastDay).endOf('day')) } })

    return [
        sundayMeeting,
        mondayMeeting,
        tuesdayMeeting,
        wednesdayMeeting,
        thursdayMeeting,
        fridayMeeting,
        saturdayMeeting
    ]

}

//password validator
function checkPassword(str) {
    var re = /^(?=.*\d)(?=.*[!@#$%^&*])(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
    return re.test(str);
}