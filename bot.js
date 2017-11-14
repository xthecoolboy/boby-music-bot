const Discord = require("discord.js");
const client = new Discord.Client();
const ytdl = require("ytdl-core");
const request = require("request");
const fs = require("fs");
const getYouTubeID = require("get-youtube-id");
const fetchVideoInfo = require("youtube-info");
const Sysinfo = require("systeminformation");
const moment = require("moment");
require("moment-duration-format");

const yt_api_key = process.env.YT_API_KEY;
const prefix = process.env.PREFIX;
const discord_token = process.env.BOT_TOKEN;
const embed_color = process.env.EMBED_COLOR;

var guilds = {};

client.login(discord_token);

client.on('message', function (message) {
    const member = message.member;
    const mess = message.content.toLowerCase();
    const args = message.content.split(' ').slice(1).join(" ");

    if (message.author.id == client.user.id) {
        setTimeout(() => message.delete(), 10000);
    }

    if (message.author.bot) return;

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
        message.delete().catch(O_o => { });
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
                        console.log(message.guild.id + " " + message.author.tag + " downloaded " + videoInfo.title + " " + videoInfo.url);
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
                        console.log(message.guild.id + " " + message.author.tag + " downloaded " + videoInfo.title + " " + videoInfo.url);
                    });
                });
            }
        } else {
            message.channel.send(":sos: You dont seem to be in a voice channel");
        }
    } else if (mess.startsWith(prefix + "skip")) {
        message.delete().catch(O_o => { });
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
        message.delete().catch(O_o => { });
        if (guilds[message.guild.id].queueNames.length == 0) {
            message.channel.send(":sos: Nothing has been queued");
            return;
        }

        if (guilds[message.guild.id].queueNames.length == 1) {
            const embed = new Discord.RichEmbed()
            .setTitle(":musical_note: Song Queue for " + message.guild.name + " " + message.guild.voiceConnection.channel.name)
            .setAuthor("Queue", client.user.avatarURL)
            .setColor(embed_color)
            .addField(":play_pause: Now Playing (More info with " + prefix + "np) :", "**" + guilds[message.guild.id].queueNames[0] + "** `" + moment.duration(guilds[message.guild.id].queueTimes[0], "seconds").format('hh:mm:ss') + "` added by **" + guilds[message.guild.id].queueAdders[0] + "**")
            .addField(":notepad_spiral: Next in Queue:", "Queue is empty :cry:")
            .setTimestamp();
            message.channel.send(embed);
            return;
        }

        var sendMessage = "";

        for (var i = 0; i < guilds[message.guild.id].queueNames.length; i++) {
            if (i == 0) {
                var i = 1;
            }
            var getqueue = "**" + (i) + "**: **" + guilds[message.guild.id].queueNames[i] + "** `" +  moment.duration(guilds[message.guild.id].queueTimes[i], "seconds").format('hh:mm:ss') + "` added by **" + guilds[message.guild.id].queueAdders[i] +"**\n";
            sendMessage += getqueue;
        }
        const embed = new Discord.RichEmbed()
        .setTitle(":musical_note: Song Queue for " + message.guild.name + " " + message.guild.voiceConnection.channel.name)
        .setAuthor("Queue", client.user.avatarURL)
        .setColor(embed_color)
        .addField(":play_pause: Now Playing (More info with " + prefix + "np) :", "**" + guilds[message.guild.id].queueNames[0] + "** `" + moment.duration(guilds[message.guild.id].queueTimes[0], "seconds").format('hh:mm:ss') + "` added by **" + guilds[message.guild.id].queueAdders[0] + "**")
        .addField(":notepad_spiral: Next in Queue", sendMessage)
        .setTimestamp();
        message.channel.send(embed);
    } else if (mess.startsWith(prefix + "np")) {
        message.delete().catch(O_o => { });
        if (guilds[message.guild.id].queueNames.length == 0) {
            message.channel.send(":sos: Nothing is playing right now");
            return;
        }
        fetchVideoInfo(guilds[message.guild.id].queue[0], function (err, videoInfo) {
            if (err) throw new Error(err);
            const embed = new Discord.RichEmbed()
            .setAuthor("Now Playing", client.user.avatarURL)
            .setColor(embed_color)
            .setThumbnail(videoInfo.thumbnailUrl)
            .addField(videoInfo.title, "by **" + videoInfo.owner + "**")
            .addField("Upload Date", videoInfo.datePublished)
            .addField("Requested By", guilds[message.guild.id].queueAdders[0])
            .addField("Video Length", moment.duration(guilds[message.guild.id].queueTimes[0], "seconds").format("D [Days,] hh [Hours,] mm [Minutes and] ss [Seconds]"))
            .addField("Video Link", videoInfo.url)
            .setTimestamp();
            message.channel.send(embed);
        })
    } else if (mess.startsWith(prefix + "botinfo")) {
        message.delete().catch(O_o => { });
        Sysinfo.osInfo(function (data) {
            hostinfo = data.codename + ", " + data.distro + ", " + data.kernel + ", " + data.arch;
            const embed = new Discord.RichEmbed()
                .setTitle("Bot Info for Boby Music")
                .setThumbnail(client.user.avatarURL)
                .setColor(embed_color)
                .addField("Owner", "Bobynoby#8634")
                .addField("BotID", client.user.id)
                .addField("Systems Time", Date())
                .addField("System Info", hostinfo)
                .setTimestamp();
            message.channel.send({ embed });
        });
    }
});

client.on('ready', function () {
    console.log("Online and running Boby Music");
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
                guilds[message.guild.id].voiceChannel.leave()
            } else {
                setTimeout(function () {
                    playMusic(guilds[message.guild.id].queue[0], message);
                }, 100);
            }
        });
    });
}

function getID(str, cb) {
    try {
        if (isYoutube(str)) {
            cb(getYouTubeID(str));
        } else {
            search_video(str, function (id) {
                cb(id);
            });
        }
    } catch (err) {
       message.channel.send(":sos: URL cant be used, Try using the share URL instead of the browser URL")
        return;
    }
}

function add_to_queue(strID, message, err) {
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
