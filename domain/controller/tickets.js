let sunco = require('../../infrastructure/sunco');
let dalton = require('../../infrastructure/dalton');
let utils = require('./utils');
const zendesk = require('../../infrastructure/zendesk');
const fileHandle = require('./file');
let conversations = [];



module.exports = {
    async dev(req, res) {
        //get or init credentials
        let file_data;
        executionFile = 'this.json';
        //se valida que exista archivo execution
        try {
            file_data = fileHandle.getJson(executionFile);
        } catch (error) {
            file_data = { "count": 0, "index": "", "prev_index": "" }
            fileHandle.createOrUpdateFile(executionFile, JSON.stringify(file_data));
        }
        //luego de tener el index lo que hay que hacer es modificar el archivo fileData


        const filtered = file_data.filter((ticket) => ticket.id == 4 || ticket.id == 5).map((ticket) => {
            delete ticket.satisfaction_rating
            return ticket
        })
        const filteredWithComments = await this.fillAllTicketsWithComments(filtered)
        const final = await this.replaceAttachmentsWithTokens(filteredWithComments)
        const result = await zendesk.createTicketsFetch(final)
        fileHandle.createOrUpdateFile("ticketsfiltrados.json", final)
        return res.json({ "message": "dev request", "res": result });
    },
    async main(req, res) {
        return res.json({ "message": "you need to type the method" })
    },
    async count(req, res) {
        const executionFile = "execution.json"
        try {
            file_data = fileHandle.getJson(executionFile);
            const count = file_data.count;
            if (isNaN(count))
                return res.json({ message: "not count yet" });
            return res.json({ count });
        } catch (error) {
            return res.json({ message: "not count yet by error" });
        }
    },
    async commentsByTicket(id) {
        try {
            const comments = await zendesk.getComments(id);
            return comments
        } catch (error) {
            console.log("error", error);
            return null;
        }
    },
    async fillAllTicketsWithComments(tickets) {

        //todo filter by external id
        // const tickets_new = tickets.filter((ticket) => ticket.external_id)
        // return tickets_new


        // if (tickets_new.length == 0) return tickets
        // tickets = tickets_new
        //todo filter by external id
        for (const ticketIndex in tickets) {
            console.log(tickets[ticketIndex].id, tickets[ticketIndex].external_id)
            let ticket_id = tickets[ticketIndex].id;
            let executeLoop = true;
            let timesExecuted = 0;
            let comments = null;

            while (executeLoop) {
                comments = await this.commentsByTicket(ticket_id)
                timesExecuted++;
                if (comments === null) {
                    await new Promise(resolve => setTimeout(resolve, 60000));
                } else {
                    break
                }
                if (timesExecuted > 9) {
                    return res.json({ "message": "error in comments" })
                }
            }
            tickets[ticketIndex].comments = comments;
        }
        return tickets
    },
    async replaceAttachmentsWithTokens(tickets) {
        return tickets.map(ticket => {



            ticket.comments = ticket.comments.map(comment => {


                const attachments = comment.attachments;
                console.log(attachments, "attachments")
                const tokens = attachments.map((attachment) => {
                    const url = attachment.content_url
                    const firstPart = url.slice(url.indexOf("/token/")).replace("/token/", "")
                    return firstPart.slice(0, firstPart.indexOf("/"))
                })
                comment.uploads = tokens;
                return comment
            })






            return ticket
        })
    }

    ,
    async export(req, res) {
        //get or init credentials
        let file_data;
        executionFile = 'execution.json';
        //se valida que exista archivo execution
        try {
            file_data = fileHandle.getJson(executionFile);
        } catch (error) {
            file_data = { "count": 0, "index": "", "prev_index": "" }
            fileHandle.createOrUpdateFile(executionFile, JSON.stringify(file_data));
        }
        //luego de tener el index lo que hay que hacer es modificar el archivo fileData
        const url = file_data.index;
        // validamos el index para saber si ya termino el proceso
        if (url === "END") return res.json({ "message": "Ended request" });
        let export_data;
        // intentamos obtener los tickets, en el caso de que no devuelva se termina, si devuelve seguimos el proceso
        try {
            // export_data = await zendesk.getTicketsExport(url)
            export_data = await zendesk.getTicketsExportNew(url)
        } catch (error) {
            console.log(error)
            if (error.message !== "there are no tickets to list") return res.status(400).json({ message: error.message })
            if (error.message === "Zendesk rate limits 200 requests per minute") res.json({ "message": "rate limit" });
            fileHandle.createOrUpdateFile(executionFile, { "count": file_data.count, "index": "END", "prev_index": "" });
            return res.json({ "message": "Just Ended" });
        }

        //seteamos variables para guardado de datos
        const newIndex = export_data.after_url
        const prev_index = export_data.after_cursor
        const results = await this.fillAllTicketsWithComments(export_data.tickets)
        const results_count = Number(export_data.tickets.length)
        const newCount = results_count + file_data.count;


        // creo los datos dentro de la sección de tickets
        fileHandle.createOrUpdateFile(`tickets-${prev_index}.json`, JSON.stringify(results))
        // modifico todos los createOrUpdate
        file_data = { ...file_data, count: newCount, index: newIndex, prev_index: prev_index };
        fileHandle.createOrUpdateFile(executionFile, file_data)
        return res.json({ "message": "export" })
    },



}



