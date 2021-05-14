const express = require('express');
const bcrypt = require('bcrypt')
const app = express();
const server = require('http').Server(app);
const { v4: uuidv4 } = require('uuid')
const io = require('socket.io')(server)
const { ExpressPeerServer } = require('peer')
const User = require('./models/blog')
const passport = require('passport')
const localStrategy = require('passport-local').Strategy;
const session = require('express-session')
const morgan = require('morgan')
const mongoose = require('mongoose');

const peerServer = ExpressPeerServer(server, {
    debug: true
});

//connect to db
const dbURI = "mongodb://localhost:27017/creative-teams"
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then((result) => server.listen(3040))
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
    res.redirect('/dashboard')
}

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
app.get("/home", (req, res) => {
    res.render('landing', { title: "Home" });
})

app.get("/home2", (req, res) => {
    res.render('landing2', { title: "Home" });
})

app.get("/dashboard", (req, res) => {
    res.render('home', { title: "Home" });
})

app.get("/newdashboard", (req, res) => {
    res.render('dashboard', { title: "Home" });
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
            const hashedPassword = await bcrypt.hash(req.body.password, 10)
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

app.post('/login', passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/user/login?error=true'
}))

// app.post('/login', async (req, res) => {
//     console.log("request body is ", req.body)
//     const user = await User.findOne({ email: req.body.useremail })
//     // .then((res) => {
//     //     console.log("response user", res)
//     // })
//     console.log("user is ", user)
//     if (user == null) {
//         console.log("NO USER")
//         error.push('Cannot find User. The email is not registered')
//         newError = true;
//         return res.render('login', { title: 'Login / Sign Up', newError, error: error.pop() });

//     }

//     try {
//         if (await bcrypt.compare(req.body.userpassword, user.password)) {
//             //bert alert success and redirect to dashboard or home page or profile page
//             return res.json({ success: true, message: "Success", user })
//         }

//         //bert alert Credentials does not match
//         error.push("Credentials does not match")
//         newError = true;
//         return res.render('login', { title: 'Login / Sign Up', newError, error: error.pop() });

//     } catch (e) {
//         console.log("Error ", e)
//         error.push('It seems you dont have internet access')
//         newError = true;
//         return res.render('login', { title: 'Login / Sign Up', newError, error: error.pop() });
//         //return res.status(500).json({ message: "It seems you dont have internet access" })
//     }
// })

app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/home');
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