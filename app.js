const express = require('express'),
http = require('http'),
socketIo = require('socket.io'),
path= require('path'),
bodyParser = require('body-parser'),
app = express();

const port = 8080;
const server = http.createServer(app);
const io = socketIo.listen(server);
server.listen(port);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
console.log("Server running on port:"+ port);

let users = {};
let userslst =[]; //this is just so we can keep the current structure of choosing the next player
let currJudge = 0;

const prompts = ['What do old people smell like?', 'What gets better with age?', 'Sorry everyone, I just _________.', 'White people like _______.', 'I drink to forget ________.', 'Whats that sound?', 'Why am I sticky?'];
let randNum;

function randInt(max){
	return Math.floor(Math.random()*max);
}

let currPrompt = "";
let userJudging = "";
let username = "";

app.get('/', function(req, res) {
	res.sendFile('home.html', { root: path.join(__dirname, 'public') });
});

app.post('/', function (req, res) {
		username = req.body.username;
		res.sendFile('game.html', { root: path.join(__dirname, 'public') });
});


let countdown = 30;
function startCountdown(keepCount = true) {
	if(keepCount) {
		setInterval(function(){
		countdown--;
		io.sockets.emit('timer', {
			countdown: countdown
		});

		if (countdown <= 0){
			io.sockets.emit('chat message', "new judge");
			io.sockets.in(userslst[currJudge]).emit('timesUp');
			// io.sockets.emit('resetTimer');
		}
		}, 1000);
	} else {
		countdown = 30;
		io.sockets.emit('chat message', 'Judgeing in progress...');
	}
}

io.on('connection', function (socket) {
	userslst.push(socket.id);
	// var username = "";
	// socket.emit('username');
	// socket.on('username', function(name){
		// username = name;
	let line_history = [];
	users[socket.id] = {username: username, line_history: [], score: 0};
	console.log(users);

	socket.emit('addScores', users[socket.id]);
	// socket.emit('yourself', "Your id: " + socket.id);
	

	//joins specific room
	if(io.sockets.adapter.rooms["judge"] === undefined){
		socket.join("judge");
		io.in(socket.id).emit("chat message", "You are judging");
		currPrompt = prompts[randInt(prompts.length)];
		// userJudging = socket.id;
		userJudging = users[socket.id].username;
	} else{
		socket.join("player");
		io.in(socket.id).emit("chat message", "You are playing");
	}

	if (userslst.length >= 2){
		userJudging = users[userslst[currJudge]].username;
		socket.emit('prompt', "Prompt: " + currPrompt);
		socket.emit("chat message", userJudging + " is judging");
		io.to('player').emit('draw');
		io.emit('startGame');
	}

	// })

	socket.on('startGame', function(){
		console.log("starting count");
		startCountdown();
	})
	
	//disconnect
	socket.on('disconnect', function(){
		//takes the player out of the users array
		for (var i=0; i < userslst.length; i++){
			if (userslst[i] == socket.id){
				userslst.splice(i,1);
			};
		};
		delete users[socket.id]; //is this a good way to delete? 

		//adds the next user to the judging room
		if (io.sockets.adapter.rooms["judge"] === undefined) {
			if(userslst[currJudge] === undefined){
				currJudge = 0;
			}
			// socket.emit('chat message', socket.id + " is judging!");
			io.in(userslst[currJudge]).emit('new judge', userslst[currJudge]);
		}

		//users.remove(socket.id);
	});

	socket.on('timesUp', function(){
		// var cj = userslst[currJudge];
		// socket.emit('chat message', 'Times Up. Current Judge is ' + cj.username);
		console.log("Time's Up");
		startCountdown(false);
		socket.emit('getData', users);

		// socket.leave('judge');
		// socket.join('player');

		// socket.emit('clear chat');
		// io.in(userslst[currJudge]).emit('chat message', "You are playing");

		// console.log('curr judge: ', currJudge)
		// if(userslst[currJudge+1] === undefined){
		// 		currJudge=0;
		// } else {
		// 	currJudge++;
		// }
		// console.log('curr judge: ', currJudge)
		// io.in(userslst[currJudge]).emit('new judge', userslst[currJudge]);
		// // socket.emit('resetTimer');
	});

	//if the current judge leaves the game, then the games moves on to the next judge and round
	socket.on('new judge', function(name) {
		socket.leave('player');
		socket.join('judge');

		userJudging = socket.id;
		socket.emit('clear chat');
		io.in(userslst[currJudge]).emit('chat message', "You are judging");
		currPrompt = prompts[randInt(prompts.length)];
		socket.emit('prompt', "Prompt: " + currPrompt);

		for(var i=0; i<userslst.length; i++){
			io.in(userslst[i]).emit('clear');
		}

		socket.emit('resetTimer');
		io.to('player').emit('chat message', 'PLAYER');
		io.to('judge').emit('chat message', 'JUDGE');
	});

	// io.emit('some event', { for: 'everyone' });
	//drawing
	//for (var i in line_history) {
	// 	// socket.emit('draw_line', { line: line_history[i] } );
	// }

	socket.on('draw_line', function (data) {
		var curr = users[socket.id].line_history;
		curr.push(data.line);
		// console.log(users[socket.id].line_history)
		// users[socket.id].line_history.push(data.line);
		io.in(socket.id).emit('draw_line', { line: data.line } );
	});

	socket.on('clear', function(){
		line_history=[];
		console.log("clear");
	});

	socket.on('resetTimer', function(data){
		countdown = 30;
		io.sockets.in(userslst[currJudge]).emit('timer', {
			countdown: countdown
		});
	});

});