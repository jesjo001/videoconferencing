const express = require('express');
const app = express();
const server = require('http').Server(app);
const { v4: uuidv4 } = require('uuid')
const io = require('socket.io')(server)
const { ExpressPeerServer } = require('peer')
const peerServer = ExpressPeerServer(server, {
    debug: true
});

app.set('view engine', 'ejs');
app.use(express.static('public'))
app.use('/peerjs', peerServer);

app.get("/", (req, res) => {
    res.render('landing');
})

app.get("/instant-meeting", (req, res) => {
    let meetingId = uuidv4()
    res.redirect(`/${meetingId}`);
})

app.get('/:room', (req, res) => {
    // console.log("room Id ", req.params.room)
    res.render('room', { roomId: req.params.room })
})

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

server.listen(3040);