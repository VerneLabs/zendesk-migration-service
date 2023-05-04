require('dotenv').config()
let zendesk = require('node-zendesk');
const SHOW_LOGS = (!process.env.SHOW_LOGS || process.env.SHOW_LOGS === 0 || process.env.SHOW_LOGS.trim().toLowerCase() === "false" || process.env.SHOW_LOGS === null || process.env.SHOW_LOGS === undefined) ? false : true
const fs = require('fs');
const request = require('request');
const fsp = fs.promises;

let remoteUri = process.env.HOSTNAME.includes("http") ? process.env.HOSTNAME : `https://${process.env.HOSTNAME}`;
if (!remoteUri.includes("/api/v2")) remoteUri += "/api/v2";
let remoteUri_old = process.env.HOSTNAME_OLD.includes("http") ? process.env.HOSTNAME_OLD : `https://${process.env.HOSTNAME_OLD}`;
if (!remoteUri_old.includes("/api/v2")) remoteUri_old += "/api/v2";
var http = require('http');
let axios = require('axios');
const combination = `${process.env.USERNAME.split("/")[0]}/token:${process.env.TOKEN}`
const combinationOld = `${process.env.USERNAME_OLD.split("/")[0]}/token:${process.env.TOKEN_OLD}`

const tokenCurrent = Buffer.from(combination).toString('base64')
const tokenOld = Buffer.from(combinationOld).toString('base64')



let client = zendesk.createClient({
    username: process.env.USERNAME.split("/")[0],
    token: process.env.TOKEN,
    remoteUri: remoteUri
});
let clientOther = zendesk.createClient({
    username: process.env.USERNAME_OLD.split("/")[0],
    token: process.env.TOKEN_OLD,
    remoteUri: remoteUri_old
});

module.exports = {

    async checkCredentials() {
        if (SHOW_LOGS) console.log("checkCredentials")
        try {
            return await client.users.me();
        } catch (error) {
            console.log("Error checkCredentials: ", error);
            throw (
                new Error('zendesk credetials are not working'));
        }
    },

    async getTickets() {
        if (SHOW_LOGS) console.log("getTicket")
        try {
            return await client.tickets.list();
        } catch (error) {
            console.log("Error getTickets: ", error);
            throw (new Error("there are no tickets to list"));
        }
    },
    async getTicketsExport(time) {
        if (SHOW_LOGS) console.log("getTicket")
        try {
            // incrementalInclude(startTime, includes, cb)        // New Export API supporing includes
            // incremental(startTime, cb)   
            return await client.tickets.export(time);
            // return await client.tickets.incremental(time);
            return await client.tickets.exportSample();
        } catch (error) {
            console.log("Error getTickets: ", error);
            throw (new Error("there are no tickets to list"));
        }
    },
    async getComments(id) {
        if (SHOW_LOGS) console.log("getComments")
        try {
            return await client.tickets.getComments(id);
        } catch (error) {
            console.log("Error getComments: ", error);
            throw (new Error('there is no ticket with this id'));
        }
    },
    async getAudits(id) {
        if (SHOW_LOGS) console.log("getAudits")
        try {
            return await client.tickets.exportAudit(id);
        } catch (error) {
            console.log("Error get audits: ", error);
            throw (new Error('there is no ticket with this id'));
        }
    },

    async uploadFile(fileDirection, file_name = "translations.pdf") {
        if (SHOW_LOGS) console.log("uploadFile")
        try {
            let upload_token;
            const result = await client.attachments.upload(fileDirection, { filename: file_name })
            upload_token = result.upload.token
            return upload_token
        } catch (error) {
            console.log("Error uploadFile: ", error);
            throw (new Error("Could not upload the pdf"));
        }
    },

    async createTicketComment(id, token_upload, fixedUser, comment = "Default comment", isPublic) {
        if (SHOW_LOGS) console.log("createTicketComment")
        try {
            const tokens = typeof (token_upload) ? token_upload : [token_upload]
            const ticketStructure =
            {
                "ticket": {
                    "comment": {
                        "body": comment,
                        public: isPublic,
                        uploads: tokens
                    }
                }
            }
            if (fixedUser) ticketStructure.ticket.comment.author_id = fixedUser
            return await client.tickets.update(id, ticketStructure)
        } catch (error) {
            console.log("Error createTicketComment: ", error);
            throw (new Error("Could not create a the comment"));
        }
    },
    async updateTicket(id, ticket) {
        console.log(JSON.stringify(ticket));
        return client.tickets.update(id, ticket)
    },
    async getComments(id) {
        return client.tickets.getComments(id)
        return client.ticketevents(id)
    },
    async searchUserByExternalId(external_id) {
        // return client.users.search(`id:11743103446929`)
        let f1 = await client.users.search(`id:11743103446929`)
        console.log('f1', f1)
        const f2 = await client.users.search("email=exequielmartin_53@hotmail.com")
        console.log('f2', f2)
        return client.users.search(external_id)

    },
    async searchUserByExternalIdFetch(external_id, configs) {
        // const url = remoteUri + "/users/me.json";
        const url = remoteUri + "/users/search?external_id=" + external_id;
        let usersSearch = await axios.get(url, {
            headers: {
                'Authorization': 'Basic b3BlcmFjaW9uZXNAdmVybmVsYWJzLmN4L3Rva2VuOkRBOXZRMkdqMXY1YVowOEZvNUExZFN2WU1SNzZPUVJPM3hmMmRUQVE='
            }
        })
        if (usersSearch.data.count === 1) {
            return usersSearch.data.users[0].id
        } else if (usersSearch.data.count === 0) {
            //user does not exist in new instance, lets create it now

            const userInOldInstance = await this.bringOldUserFromInstance(external_id)
            userInOldInstance.external_id = userInOldInstance.id;
            delete userInOldInstance.id
            delete userInOldInstance.url

            const groups = configs.groupsTranslations;
            const roles = configs.rolesTranslations;
            let newGroup;
            if (userInOldInstance.role == "agent" && userInOldInstance.email === null && userInOldInstance.active == false) {
                userInOldInstance.email = `userdisabled+${userInOldInstance.external_id}@betwarrior.com`
                delete userInOldInstance.default_group_id
                delete userInOldInstance.custom_role_id
            } else {

                for (const group of groups) {
                    const key = Object.keys(group)[0]
                    if (key == userInOldInstance.default_group_id) newGroup = group[key];
                }
                delete userInOldInstance.default_group_id
                if (newGroup) userInOldInstance.default_group_id = newGroup
                let newRole;
                for (const role of roles) {
                    const key = Object.keys(role)[0]
                    if (key == userInOldInstance.custom_role_id) newRole = role[key];
                }
                delete userInOldInstance.custom_role_id
                if (newRole) userInOldInstance.custom_role_id = newRole
            }

            console.log("-----------------")
            console.log(JSON.stringify(userInOldInstance))
            const userCreated = await this.createUserInNewInstance({ user: userInOldInstance })
            return userCreated.id

        } else {
            console.log("existe mas de 1 valor");
            console.log('usersSearch', usersSearch)
        }

    },
    async searchManyUsersByExternalIdFetch(external_id, configs) {
        const url = remoteUri + "/users/search?external_id=" + external_id;
        let usersSearch = await axios.get(url, {

            headers: {
                'Authorization': `Basic b3BlcmFjaW9uZXNAdmVybmVsYWJzLmN4L3Rva2VuOkRBOXZRMkdqMXY1YVowOEZvNUExZFN2WU1SNzZPUVJPM3hmMmRUQVE=`
            }
        })
        if (usersSearch.data.count > 0) {
            return usersSearch.data.users.map(user => ({ external_id: user.external_id, id: user.id }))
        } else if (usersSearch.data.count === 0) {
            //user does not exist in new instance, lets create it now

            const userInOldInstance = await this.bringOldUserFromInstance(external_id)
            userInOldInstance.external_id = userInOldInstance.id;
            delete userInOldInstance.id
            delete userInOldInstance.url

            const groups = configs.groupsTranslations;
            const roles = configs.rolesTranslations;
            let newGroup;
            for (const group of groups) {
                const key = Object.keys(group)[0]
                if (key == userInOldInstance.default_group_id) newGroup = group[key];
            }
            delete userInOldInstance.default_group_id
            if (newGroup) userInOldInstance.default_group_id = newGroup
            let newRole;
            for (const role of roles) {
                const key = Object.keys(role)[0]
                if (key == userInOldInstance.custom_role_id) newRole = role[key];
            }
            delete userInOldInstance.custom_role_id
            if (newRole) userInOldInstance.custom_role_id = newRole

            const userCreated = await this.createUserInNewInstance({ user: userInOldInstance })
            return [{ id: userCreated.id, external_id: userCreated.external_id }]
        } else {
            console.log("existe mas de 1 valor");
            console.log('usersSearch', usersSearch)
        }

    },
    async createTickets(tickets) {
        // return client.tickets.createMany(tickets)
        // return client.imports({ tickets: tickets })


        return client.tickets.createMany({ tickets: tickets })
        return client.imports("tickets", tickets)
        return client.ticketimport(tickets)
    },
    async createTicketsFetch(tickets) {
        let data = JSON.stringify({ tickets: tickets });
        const url = remoteUri + "/imports/tickets/create_many";
        let importTickets = await axios.post(url, data, {
            headers: {
                'Authorization': `Basic ${tokenCurrent}`
                , 'Content-Type': 'application/json',
            },

        })
        if (!importTickets.data.error) {
            return importTickets.data
        } else {
            console.log("existe mas de 1 valor");
            console.log('importTickets', importTickets.data.error)

        }
    },
    async createTicketFetch(tickets) {
        let data = JSON.stringify({ ticket: tickets });
        const url = remoteUri + "/imports/tickets";
        let importTickets = await axios.post(url, data, {
            headers: {
                'Authorization': `Basic ${tokenCurrent}`
                , 'Content-Type': 'application/json',
            },

        })
        if (!importTickets.data.error) {
            return importTickets.data
        } else {
            console.log("existe mas de 1 valor");
            console.log('importTickets', importTickets.data.error)

        }
    },
    async request(url, file) {
        return axios.get(url, {
            headers: {
                'Authorization': `Basic ${tokenCurrent}`
            }
        })
    },
    async validateIfTicketExist(id) {
        try {

            const url = remoteUri + `/tickets.json?external_id=${id}`;
            const response = await axios.get(url, {
                headers: {
                    'Authorization': 'Basic b3BlcmFjaW9uZXNAdmVybmVsYWJzLmN4L3Rva2VuOkRBOXZRMkdqMXY1YVowOEZvNUExZFN2WU1SNzZPUVJPM3hmMmRUQVE='
                }
            })
            const rateLimit = response?.headers["rate-limit-remaining"]
            if (rateLimit == 1) {
                const rateLimitTimeout = response?.headers["rate-limit-reset"]
                console.log("longtimout", rateLimitTimeout + 1)
                this.timeout((rateLimitTimeout + 1) * 1000)
            }
            if (response?.data?.count === 0) return [false, false, false]
            return [response?.data?.tickets[0].id, response?.data?.tickets[0].status, response?.data?.tickets[0]]
        } catch (error) {
            const response = error.response;
            if (response?.status === 429 && response?.statusText === 'Too Many Requests') {
                console.log("Cooldown")
                await this.timeout(60000)
                return this.validateIfTicketExist(id)
            }
        }
    },

    async validateIfTicketsExist(id) {
        try {

            const url = remoteUri + `/tickets/show_many.json?external_id=${id}`;
            const response = await axios.get(url, {
                headers: {
                    'Authorization': 'Basic b3BlcmFjaW9uZXNAdmVybmVsYWJzLmN4L3Rva2VuOkRBOXZRMkdqMXY1YVowOEZvNUExZFN2WU1SNzZPUVJPM3hmMmRUQVE='
                }
            })
            const rateLimit = response?.headers["rate-limit-remaining"]
            if (rateLimit == 1) {
                const rateLimitTimeout = response?.headers["rate-limit-reset"]
                console.log("longtimout", rateLimitTimeout + 1)
                this.timeout((rateLimitTimeout + 1) * 1000)
            }
            if (response?.data?.count === 0) return [false, false, false]
            return [response?.data?.tickets[0].id, response?.data?.tickets[0].status, response?.data?.tickets[0]]
        } catch (error) {
            const response = error.response;
            if (response?.status === 429 && response?.statusText === 'Too Many Requests') {
                console.log("Cooldown")
                await this.timeout(60000)
                return this.validateIfTicketExist(id)
            }
        }
    },
    bringOldUserFromInstance(id) {
        return clientOther.users.show(id)
    },
    createUserInNewInstance(user) {
        console.log('user', JSON.stringify(user))
        return client.users.create(user)
    },
    newInstanceMe() {
        return client.users.me()
    },
    oldInstanceMe() {
        return clientOther.users.me()
    },

    getAttachment(url) {
        console.log('url', url)
        return clientOther.attachments.show(url)
    },

    timeout(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    async deleteTicket(id) {
        return client.tickets.delete(id)

    },


    async handleCompleteUpload(newFileDirection, downloadName) {
        console.log("entro en cb", newFileDirection)
        const uploadToken = await this.uploadFile(newFileDirection, downloadName)
        fs.unlinkSync(newFileDirection)
        return uploadToken;
    }
    , async migrateUpload(attachment, folder, waitForFile) {
        const downloadName = attachment.file_name;
        const id = attachment.id;
        let cb;
        const newFileDirection = `${folder}/${id}`
        await this.download(attachment.content_url, newFileDirection, cb)
        try {
            // await this.timeout(800)
            //todo, el upload file tiene que ser asincrono de verdad
            const uploadToken = await this.uploadFile(newFileDirection, downloadName)
            fs.unlinkSync(newFileDirection)
            return uploadToken;

        }
        catch (err) {
            try {
                console.log("entro al catch por que no espero a que existiera el archivo");
                await this.timeout(1400)
                uploadToken = await this.uploadFile(newFileDirection, downloadName)
                fs.unlinkSync(newFileDirection)
                return uploadToken;

            } catch (error) {
                try {
                    console.log("entro al catch por que no espero a que existiera el archivo");
                    await this.timeout(1400)
                    uploadToken = await this.uploadFile(newFileDirection, downloadName)
                    fs.unlinkSync(newFileDirection)
                    return uploadToken;

                } catch (error) {
                    return null;
                }
            }
        }
    }

    ,
    async download(url, dest, cb, name) {
        return new Promise(resolve => {
            try {

                const sendReq = request.get(url, {
                    headers: {
                        'Authorization': `Basic ${tokenOld}`
                    }
                });

                const file = fs.createWriteStream(dest);
                // verify response code
                sendReq.on('response', (response) => {
                    sendReq.pipe(file);
                });

                // close() is async, call cb after close completes
                file.on('finish', () => {
                    file.close()
                    resolve("done!")
                });

                // check for request errors
                // sendReq.on('error', (err) => {
                //     fs.unlink(dest); // delete the (partial) file and then return the error

                // });

                file.on('error', (err) => { // Handle errors
                    fs.unlink(dest); // delete the (partial) file and then return the error

                });
            } catch (error) {
                try {
                    this.timeout(3000)
                    return this.download(url, dest, cb, name)
                } catch (error) {
                    return Promise.resolve()
                }
            }
            // });
        });
    }


}


