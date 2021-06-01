const express = require('express');
const app = express();
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

const peerServer = ExpressPeerServer(server, {
    debug: true
});

//connect to db
const dbURI = "mongodb://localhost:27017/creative-teams"
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then((result) => server.listen(3030))
    .catch((err) => console.log(err))

//Error
let error = [];
let newError = false;

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
    res.redirect('/welcome')
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
    let graphData = await getMonthlyData(req.user);

    const weekNumber = moment().format("w");
    console.log("weekNumber is " + weekNumber)

    Meeting.find({ userId: req.user._id }).sort({ createdAt: -1 })
        .then((result) => {
            // console.log(result)
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
                newData: graphData
            })
        })
        .catch((err) => {
            console.log(err)
        })
    // res.render('dashboard', { title: "Dashboard" });
})

app.get("/meetings", isLoggedIn, async (req, res) => {

    console.log("requesr query is  ")
    console.log(req.query)

    if (req.query.search) {
        console.log("search is active")
    }

    const monthStart = moment().startOf('month');
    const monthEnd = moment().endOf('month');
    const today = new Date()
    const upcomingMeeting = await Meeting.find({ userId: req.user._id, startAt: { $gte: new Date(today) } })
    const monthlyMeeting = await Meeting.find({ userId: req.user._id, startAt: { $gte: new Date(monthStart), $lte: new Date(monthEnd) } })

    const weekNumber = moment().format("w");
    console.log("weekNumber is " + weekNumber)

    Meeting.find({ userId: req.user._id }).sort({ createdAt: -1 })
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
            })
        })
        .catch((err) => {
            console.log(err)
        })
    // res.render('dashboard', { title: "Dashboard" });
})

app.get("/user/register", (req, res) => {
    res.render('user_register');
})

app.get("/user/login", isLoggedOut, (req, res) => {
    // console.log("request body", req.body)
    res.render('login', { title: 'Login / Sign Up', newError: false, error: req.query.error });
})

app.post('/register', async (req, res) => {

    let numDoc = await User.count({ email: req.body.email })
    console.log("number of old users with same email ", numDoc);

    if (numDoc == 0) {
        try {
            console.log("got here")

            console.log("REQUEST IS ", req.body)
            const hashedPassword = await bcrypt.hash(req.body.password2, 10)
            console.log(hashedPassword)

            const user = new User({
                username: req.body.username,
                email: req.body.email,
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
    console.log("requesr query is  ")
    console.log(req.query)
    let userId = req.user.id;
    let meetDate = new Date(req.body.meetingStart);
    let time = req.body.meetingTime.split(":")
    meetDate.setHours(time[0], time[1])

    console.log("user id is: ", userId)
    const meeting = new Meeting({
        title: req.body.meetingTitle,
        briefInfo: req.body.briefInfo,
        startAt: meetDate,
        time: req.body.meetingTime,
        userId: userId
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
    successRedirect: '/welcome',
    failureRedirect: '/user/login?error=true'
}))

app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
})

app.get('/newView', function (req, res) {
    res.render('newView');
})

app.get('/setup', async (req, res) => {
    const exists = await User.exists({ email: "admin@gmail.com" });

    if (exists) {
        console.log("User Exists")
        res.redirect('/user/login');
        return;
    };

    bcrypt.genSalt(10, function (err, salt) {
        if (err) return next(err);
        bcrypt.hash("Pass12345!", salt, function (err, hash) {
            if (err) return next(err);

            const newAdmin = new User({
                email: "admin@gmail.com",
                password: hash,
                username: "Josh",

            });

            newAdmin.save();

            res.redirect('/user/login');
        });
    });
});

app.get("/instant-meeting", (req, res) => {
    let meetingId = uuidv4()
    res.redirect(`/${meetingId}`);
})

app.get('/:room', (req, res) => {
    // console.log("room Id ", req.params.room)
    res.render('room', { roomId: req.params.room, title: "Room" })
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

const getWeeklyData = async () => {
    const weekStart = moment().startOf('week');
    const weekEnd = moment().endOf('week');
    const lastWeekBegins = moment().subtract(1, 'months').startOf('month')
    const lastWeekEnds = moment().subtract(1, 'months').endOf('month')
    const previousWeekBegins = moment().subtract(1, 'months').startOf('month')
    const previousWeekEnds = moment().subtract(1, 'months').endOf('month')

}