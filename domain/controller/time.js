require('dotenv').config()
let moment = require('moment');
require('moment-timezone')

const TIME_ZONE = process.env.TIME_ZONE
const SHOW_LOGS = (!process.env.SHOW_LOGS || process.env.SHOW_LOGS == 0 || process.env.SHOW_LOGS.trim().toLowerCase() == "false" || process.env.SHOW_LOGS == null || process.env.SHOW_LOGS == undefined) ? false : true


module.exports = {
    formatComments(body, audits) {
        if (SHOW_LOGS) console.log("formatComments")
        let bodyComments = ""
        const comments = body;
        for (const comment of comments) {
            if (comment.via && comment.via.channel === "chat") {//in the case of a chat started the conversation this will be the channel.
                audits.forEach(audit => { //we will have to search in to a nested object of audits>events>value>history and finally we will have our chats
                    audit.events.forEach(event => {
                        if (event.type == "ChatStartedEvent") {
                            event.value.history.forEach(chats => {
                                if (chats.type = "ChatMessage") {
                                    const time = moment.unix(chats.timestamp.toString());
                                    if (chats.message)
                                        bodyComments = `${bodyComments}\n ${time.format('DD/MM/YYYY hh:mm:ss')} - ${chats.actor_name}: ${chats.message}`
                                }
                            });
                        }
                    });
                });
            }

            if (comment.public) {
                const created_at = moment(comment.created_at);
                const time = created_at.tz(this.isValidTimeZone(TIME_ZONE));
                bodyComments = `${bodyComments}\n ${time.format('DD/MM/YYYY hh:mm:ss')} - ${comment.body}`
            }
        }
        if (!bodyComments || bodyComments === "") {
            throw (new Error("there was an error trying to create the data"));
        }
        return bodyComments
    }
    , isValidTimeZone(tz) {
        try {
            Intl.DateTimeFormat(undefined, { timeZone: tz });
            return tz;
        }
        catch (ex) {
            return "UTC"
        }
    }


}