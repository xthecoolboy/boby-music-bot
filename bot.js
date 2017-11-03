const Discord = require("discord.js");
const client = new Discord.Client();
const ytdl = require("ytdl-core");
const request = require("request");
const fs = require("fs");
const getYoutubeID = require("get-youtube-id");
const fetchVideoInfo = require("youtube-info");
const moment = require("moment");
require("moment-duration-format");

const yt_api_key = process.env.YT_API_KEY;
const bot_controller = process.env.BOT_CONTROLLER;
const prefix = process.env.PREFIX;
const discord_token = process.env.BOT_TOKEN;

var guilds = {};

client.login(discord_token);

client.on('message', function (message) {
    const member = message.member;
    const mess = message.content.toLowerCase();
    const args = message.content.split(' ').slice(1).join(" ");

    if (message.author.bot) return;

    if (args.includes("http") || args.includes("www")) {
        message.channel.send(":sos: URLs are not supported sorry!");
        return;
    }

    if (!guilds[message.guild.id]) {
        guilds[message.guild.id] = {
            queue: [],
            queueNames: [],
            queueTimes: [],
            queueAdders: [],
            isPlaying: false,
            dispatcher: null,
            voiceChannel: null,
            skipReq: 0,
            skippers: [],
        };
    }

    if (mess.startsWith(prefix + "play")) {
        if (message.member.voiceChannel || guilds[message.guild.id].voiceChannel != null) {
            if (guilds[message.guild.id].queue.length > 0 || guilds[message.guild.id].isPlaying) {
                getID(args, function (id) {
                    add_to_queue(id, message);
                    fetchVideoInfo(id, function (err, videoInfo) {
                        if (err) throw new Error(err);
                        guilds[message.guild.id].queueNames.push(videoInfo.title);
                        guilds[message.guild.id].queueTimes.push(videoInfo.duration);
                        guilds[message.guild.id].queueAdders.push(message.author.tag);
                        message.channel.send(":arrow_heading_down: Added **" + videoInfo.title + "** `" + moment.duration(videoInfo.duration, "seconds").format('hh:mm:ss') + "` to the queue");
                    });
                });
            } else {
                isPlaying = true;
                getID(args, function (id) {
                    guilds[message.guild.id].queue.push(id);
                    playMusic(id, message);
                    fetchVideoInfo(id, function (err, videoInfo) {
                        if (err) throw new Error(err);
                        guilds[message.guild.id].queueNames.push(videoInfo.title);
                        guilds[message.guild.id].queueTimes.push(videoInfo.duration);
                        guilds[message.guild.id].queueAdders.push(message.author.tag);
                        message.channel.send(":arrow_forward: Now playing **" + videoInfo.title + "** `" + moment.duration(videoInfo.duration, "seconds").format('hh:mm:ss') + "`");
                    });
                });
            }
        } else {
            message.channel.send(":sos: You dont seem to be in a voice channel");
        }
    } else if (mess.startsWith(prefix + "skip")) {
        if (guilds[message.guild.id].skippers.indexOf(message.author.id) === -1) {
            guilds[message.guild.id].skippers.push(message.author.id);
            guilds[message.guild.id].skipReq++;
            if (guilds[message.guild.id].skipReq >= Math.ceil((guilds[message.guild.id].voiceChannel.members.size - 1) / 2)) {
                skip_song(message);
                message.channel.send(":fast_forward: " + message.author + " your skip has been counted for, Skipping to next song now");
            } else {
                message.channel.send(":fast_forward: " + message.author + " your skip has been counted for, You need **" + (Math.ceil((guilds[message.guild.id].voiceChannel.members.size - 1) / 2) - guilds[message.guild.id].skipReq) + "**  more votes to skip");
            }
        } else {
            message.channel.send(":sos: " + message.author + " your skip has been counted already");
        }
    } else if (mess.startsWith(prefix + "queue")) {
        if (guilds[message.guild.id].queueNames.length == 0) {
            message.channel.send(":sos: Nothing is playing right now");
            return;
        }

        var info = ":musical_note: Song Queue for **" + message.guild.name + " " + message.guild.voiceConnection.channel.name + "**\n";
        var playing = ":play_pause: Currently Playing **" + guilds[message.guild.id].queueNames[0] + "** `" + moment.duration(guilds[message.guild.id].queueTimes[0], "seconds").format('hh:mm:ss') + "` added by **" + guilds[message.guild.id].queueAdders[0] + "**\n";
        var sendMessage = "";

        if (guilds[message.guild.id].queueNames.length == 1) {
            sendMessage += info;
            sendMessage += playing;
            sendMessage += ":notepad_spiral: Queue is empty :cry:";
            message.channel.send(sendMessage);
            return;
        }

        sendMessage += info;
        sendMessage += playing;
        sendMessage += ":notepad_spiral: Next in Queue \n";

        for (var i = 0; i < guilds[message.guild.id].queueNames.length; i++) {
            if (i == 0) {
                var i = 1;
            }
            var getqueue = "**" + (i) + "**: **" + guilds[message.guild.id].queueNames[i] + "** `" +  moment.duration(guilds[message.guild.id].queueTimes[i], "seconds").format('hh:mm:ss') + "` added by **" + guilds[message.guild.id].queueAdders[i] +"**\n";
            sendMessage += getqueue;
        }
        message.channel.send(sendMessage);
    }
});

client.on('ready', function () {
    console.log("Online and ready to party!");
    client.user.setGame("some hot tunes!");
});

function skip_song(message) {
    guilds[message.guild.id].dispatcher.end();
}

function playMusic(id, message) {
    guilds[message.guild.id].voiceChannel = message.member.voiceChannel;
    guilds[message.guild.id].voiceChannel.join().then(function (connection) {
        stream = ytdl("https://www.youtube.com/watch?v=" + id, {
            filter: 'audioonly'
        });
        guilds[message.guild.id].skipReq = 0;
        guilds[message.guild.id].skippers = [];
        guilds[message.guild.id].dispatcher = connection.playStream(stream);
        guilds[message.guild.id].dispatcher.on('end', function () {
            guilds[message.guild.id].skipReq = 0;
            guilds[message.guild.id].skippers = [];
            guilds[message.guild.id].queue.shift();
            guilds[message.guild.id].queueNames.shift();
            guilds[message.guild.id].queueTimes.shift();
            guilds[message.guild.id].queueAdders.shift();
            if (guilds[message.guild.id].queue.length === 0) {
                guilds[message.guild.id].queue = [];
                guilds[message.guild.id].queueNames = [];
                guilds[message.guild.id].queueTimes = [];
                guilds[message.guild.id].queueAdders = [];
                guilds[message.guild.id].isPlaying = false;
            } else {
                setTimeout(function () {
                    playMusic(guilds[message.guild.id].queue[0], message);
                }, 100);
            }
        });
    });
}

function getID(str, cb) {
    if (isYoutube(str)) {
        cb(getYouTubeID(str));
    } else {
        search_video(str, function (id) {
            cb(id);
        });
    }
}

function add_to_queue(strID, message) {
    if (isYoutube(strID)) {
        guilds[message.guild.id].queue.push(getYouTubeID(strID));
    } else {
        guilds[message.guild.id].queue.push(strID);
    }
}

function search_video(query, callback) {
    request("https://www.googleapis.com/youtube/v3/search?part=id&type=video&q=" + encodeURIComponent(query) + "&key=" + yt_api_key, function (error, response, body) {
        var json = JSON.parse(body);
        if (!json.items[0]) callback("onzL0EM1pKY");
        else {
            callback(json.items[0].id.videoId);
        }
    });
}

function isYoutube(str) {
    return str.toLowerCase().indexOf("youtube.com") > -1;
}
