
const express = require('express')
const fs = require("fs")
const Binance = require('node-binance-api')
const app = express()

app.set("view engine", "ejs")
app.set("views", "./views")
app.use(express.static("public"));

const server = require("http").Server(app)
const io = require("socket.io")(server)
var request = require('request');
var moment = require('moment');

app.io = io
server.listen(3001)



loadConfigFile("config.json")

io.on("connection", function (socket) {
    console.log("New connection" + socket.id)
})

function loadConfigFile(file) {
    var obj;
    fs.readFile(file, "utf-8", function (err, data) {
        if (err)
            throw err
        obj = JSON.parse(data)
        require('./routes/client')(app)

        const binance = new Binance().options({
            APIKEY: obj.API,
            APISECRET: obj.KEY
        })

        binance.futuresMiniTickerStream('ETHUSDT', (data) => {
            var myJSONObject = {
                eventTime: data.eventTime.toString(),
                description: data.symbol,
                close: data.close,
            }
            
            request('https://bo.5chaumedia.com/api/control/data', async function (error, response, body) {
                if (error)
                    throw error
                if (!error && response.statusCode === 200) {
                    var results = JSON.parse(body).results
                    if(results == undefined){
                        app.io.sockets.emit("server-send-price-btc", myJSONObject)
                    }
                    else{
                        if (results.command == 'up') {
                            app.io.sockets.emit("server-send-price-btc", 
                            {
                                eventTime: results.period,
                                close: 2 + parseFloat(data.close),
                            })
                        }
                        else{
                            app.io.sockets.emit("server-send-price-btc", 
                            {
                                eventTime: results.period,
                                close: parseFloat(data.close) - 2,
                            })
                        }
                    }
                }
            })
            if (new Date().getSeconds() == 0 && new Date().getMilliseconds() > 100) {
                let kq;
                request({
                    url: "https://bo.5chaumedia.com/api/control",
                    method: "POST",
                    json: true,
                    body: {
                        eventTime: Math.floor(new Date().getTime()/1000),
                        description: data.symbol,
                        close: data.close,
                    }
                },
                    function (error, response, body) {
                        var data1 = body.results
                        console.log("-------------------------------------")
                        console.log(data1,Math.floor(data.eventTime / 1000))
                        kq = {
                            eventTime: data1.period,
                            command: data1.command
                        }
                        printIt(kq)

                    });
                let printIt = (res) => {
                    request({
                        url: "https://bo.5chaumedia.com/api/command-bet",
                        method: "POST",
                        json: true,
                        body: {
                            eventTime: moment(res.eventTime * 1000).format("YYYYMMDDHHmmss") / 100,
                            command: res.command
                        },
                    },
                        function (error, response, body) {
                            console.log(body)
                        });
                   
                }
            }
        });
    })
}
