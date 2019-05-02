
var express = require('express'), 
app = express(),
http = require('http'),
socketIo = require('socket.io'),
path= require('path');

var server = http.createServer(app);
var io = socketIo.listen(server);

const port = 8080;
server.listen(port);
app.use(express.static(__dirname + '/public'));
console.log("Server running on 127.0.0.1:"+ port);

app.use(express.static(path.join(__dirname, "public")));

app.get('/', function(req, res) {
   res.sendfile('index.html');
});

var users = [];
var currJudge = 0;

var prompts = ['What do old people smell like?', 'What gets better with age?', 'Sorry everyone, I just _________.', 'White people like _______.', 'I drink to forget ________.', 'Whats that sound?', 'Why am I sticky?'];
var randNum;

function newPrompt(){
	randNum = Math.floor(Math.random()*prompts.length);
	return prompts[randNum];
}

var currPrompt = "";
var userJudging = "";

var countdown = 5;
setInterval(function() {
	countdown--;
	io.sockets.emit('timer', {
		countdown: countdown
	});
	if (countdown <= 0){
		io.sockets.emit('chat message',"new judge");
		io.sockets.in(users[currJudge]).emit('timesUp');
		// io.sockets.emit('resetTimer');
	}
}, 1000);

io.sockets.on('connection', function(socket){
	socket.on('resetTimer', function(data){
		countdown = 5;
		io.sockets.in(users[currJudge]).emit('timer', {
			countdown: countdown
		});
	});
});

io.on('connection', function (socket) {
	users.push(socket.id);
	console.log(users);
	socket.emit('yourself', "Your id: " + socket.id);
	var line_history = [];

	//joins specific room
	if(io.sockets.adapter.rooms["judge"] === undefined){
		socket.join("judge");
		io.in(socket.id).emit("chat message", "You are judging");
		currPrompt = newPrompt();
		userJudging = socket.id;
	} else{
		socket.join("player");
		io.in(socket.id).emit("chat message", "You are playing");
	}
	socket.emit('prompt', "Prompt: " + currPrompt);
	socket.emit("chat message", userJudging + " is judging");
	io.to('player').emit('draw');

	//disconnect
	socket.on('disconnect', function(){
		//takes the player out of the users array
		for (var i=0; i < users.length; i++){
			if (users[i] == socket.id){
				users.splice(i,1);
			};
		};

		//adds the next user to the judging room
		if (io.sockets.adapter.rooms["judge"] === undefined) {
			if(users[currJudge] === undefined){
				currJudge=0;
			}
			// socket.emit('chat message', socket.id + " is judging!");
			io.in(users[currJudge]).emit('new judge', users[currJudge]);
		};
	});

	socket.on('timesUp', function(){
		socket.emit('chat message', 'Times Up. Current Judge is ' + users[currJudge]);

		socket.leave('judge');
		socket.join('player');
		socket.emit('clear chat');
		io.in(users[currJudge]).emit('chat message', "You are playing");

		console.log('curr judge', currJudge)
		if(users[currJudge+1] === undefined){
				currJudge=0;
		} else{
			currJudge++;
		}
		console.log('curr judge', currJudge)
		io.in(users[currJudge]).emit('new judge', users[currJudge]);
		// socket.emit('resetTimer');
	})

	//if the current judge leaves the game, then the games moves on to the next judge and the round
	socket.on('new judge', function(name) {
		socket.leave('player');
		socket.join('judge');
		userJudging = socket.id;
		socket.emit('clear chat');
		io.in(users[currJudge]).emit('chat message', "You are judging");
		currPrompt = newPrompt();
		socket.emit('prompt', "Prompt: " + currPrompt);
		for(var i=0; i<users.length; i++){
			io.in(users[i]).emit('clear');
		}
		socket.emit('resetTimer');
		io.to('player').emit('chat message', 'PLAYER');
		io.to('judge').emit('chat message', 'JUDGE');
	});

	// io.emit('some event', { for: 'everyone' });

	//drawing
	// for (var i in line_history) {
	// 	// socket.emit('draw_line', { line: line_history[i] } );
	// }

	socket.on('draw_line', function (data) {
		line_history.push(data.line);
		io.in(socket.id).emit('draw_line', { line: data.line } );
	});

	socket.on('clear', function(){
		line_history=[];
		console.log("clear");
	})
});