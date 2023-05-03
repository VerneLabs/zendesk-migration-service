require('dotenv').config()
var https = require('follow-redirects').https;
var fs = require('fs');
const SUNCO_HOSTNAME = process.env.SUNCO_HOSTNAME
const SUNCO_APP_ID = process.env.SUNCO_APP_ID
const SUNCO_BASIC_TOKEN = process.env.SUNCO_BASIC_TOKEN

module.exports = {
    sendMessage(id, content) {

        var options = {
            'method': 'POST',
            'hostname': SUNCO_HOSTNAME,
            'path': `/sc//v2/apps/${SUNCO_APP_ID}/conversations/${id}/messages`,
            'headers': {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${SUNCO_BASIC_TOKEN}`
            },
            'maxRedirects': 20
        };
        var req = https.request(options, function (res) {
            var chunks = [];
            res.on("data", function (chunk) {
                chunks.push(chunk);
            });
            res.on("end", function (chunk) {
                var body = Buffer.concat(chunks);
                return body;
            });
            res.on("error", function (error) {
                console.error(error);
            });
        });

        var postData = JSON.stringify({
            "author": {
                "type": "business"
            },
            "content": content
        });
        req.write(postData);
        req.end();
        return req
    },
    passControl(id) {

        var options = {
            'method': 'POST',
            'hostname': SUNCO_HOSTNAME,
            'path': `/sc//v2/apps/${SUNCO_APP_ID}/conversations/${id}/passControl`,
            'headers': {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${SUNCO_BASIC_TOKEN}`
            },
            'maxRedirects': 20
        };
        var req = https.request(options, function (res) {
            var chunks = [];
            res.on("data", function (chunk) {
                chunks.push(chunk);
            });
            res.on("end", function (chunk) {
                var body = Buffer.concat(chunks);
                return body;
            });
            res.on("error", function (error) {
                console.error(error);
            });
        });

        var postData = JSON.stringify({
            "switchboardIntegration": "next"
        });
        req.write(postData);
        req.end();
        return req
    }
}