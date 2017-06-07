'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const app = express()
var ConversationV1 = require('watson-developer-cloud/conversation/v1');
const fs = require('fs');

var MongoClient = require('mongodb').MongoClient;

var dburl = 'mongodb://localhost:27017/fisica-remedial';

app.set('port', (process.env.PORT || 5000))

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

var memory = "Hello world, I am a chat bot<br>";
var global_context = null;

app.use(express.static('./view'));
app.use(express.static('./fisica-remedial/view'));

// Index route
app.get('/', function (req, res) {
    fs.readFile(__dirname + '/view/chat.html', 'utf8', function(err, text){
     res.send(text);
 });
})

app.get('/send', function (req, res) {
    //console.log(req.query.text);
    getWatsonResponse("", req.query.text, req.query.context, function (sender, text, context) {
        res.send({text: text, context: context})
    })
})

const token = "fisica_remedial"

app.get('/privacypolicy', function (req, res){
    fs.readFile(__dirname + '/view/privacypolicy.html', 'utf8', function(err, text){
      res.send(text);
  });
});

// for Facebook verification
app.get('/webhook/', function (req, res) {
    if (req.query['hub.verify_token'] === token) {
        res.send(req.query['hub.challenge'])
    }
    res.send('Error, wrong token')
})

// Spin up the server
app.listen(app.get('port'), function() {
    console.log('running on port', app.get('port'))
})

app.post('/webhook/', function (req, res) {
    let messaging_events = req.body.entry[0].messaging
    for (let i = 0; i < messaging_events.length; i++) {
        let event = req.body.entry[0].messaging[i]
        let sender = event.sender.id
        var context = global_context;
        if (event.message && event.message.text) {
            let text = event.message.text
            //sendTextMessage(sender, "Text received, echo: " + text.substring(0, 200))
            getWatsonResponse(sender, text, context, sendTextMessage)
        }
    }
    res.sendStatus(200)
})

const page_token = "EAAB5fiZCxvzUBAHuIVImUOkOVaui7ddZCaU4T8Vdwvytfem4oqfEM5WMMr1AlL33nmnZCmQSnNUASB9EgWCJpeYpLwM6HTpZAxpF4feyZCYDfdjPBimA6SBU8ZBKwHCZAx1soe7ZCQj8KpIlwpJxxijGqb7pNJeoysnhEBMGeg4dQAZDZD";

function sendTextMessage(sender, text) {
    let messageData = { text:text }
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:page_token},
        method: 'POST',
        json: {
            recipient: {id:sender},
            message: messageData,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }
    })
}

var conversation = new ConversationV1({
    username: '00e8112d-4029-454f-a732-fd0771c96776',
    password: 'LJhYIuTOIIHG',
    version_date: ConversationV1.VERSION_DATE_2017_04_21
});

var insert = function(db, message, callback) {
    var collection = db.collection('messages');
    collection.insertOne({
	"input-text": message.input.text,
        "intents": message.intents,
	"entities": message.entities,
	"not-found": message.context.not_found
    }, function(err, result) {
        if(err){
            console.error(err);
        }
        else {
	    console.log("Inserted: " + message.input.text);
            callback(result);
        }
    });
}

function getWatsonResponse(sender, text, context, callback){

    conversation.message({
        input: { text: text },
        workspace_id: '804b460d-60aa-4546-b681-89d2e97d6099',
        context: context
    }, function(err, response) {
        if (err) {
            console.error(err);
        } else {
            //console.log(JSON.stringify(response, null, 2));
            callback(sender, response["output"]["text"].join(" "), response["context"]);
            global_context = response["context"];
            if (global_context["not_found"]) {
                memory += "<br>" + response["input"]["text"];
            }
	    MongoClient.connect(dburl, function(err, db) {
    		if(err){
        	    console.error(err);
    		}
    		else {
        	    console.log("Connected succesfully to mongodb");
        	    insert(db, response, function() {
            		db.close();
        	    });
    		}
	    });
        }
    });
}


