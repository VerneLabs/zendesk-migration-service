let sunco = require('../../infrastructure/sunco');
let dalton = require('../../infrastructure/dalton');
let utils = require('./utils');
const zendesk = require('../../infrastructure/zendesk');
const fileHandle = require('./file');
let conversations = [];

const attachmentTempFolder = "./domain/buffer/tempAttachments"


module.exports = {
    async dev(req, res) {
        //get or init credentials
        let file_data;
        executionFile = 'this.json';
        //se valida que exista archivo execution
        try {
            file_data = fileHandle.getJson(executionFile);
        } catch (error) {
            file_data = { "count": 0, "done": 0, "index": "", "prev_index": "" }
            fileHandle.createOrUpdateFile(executionFile, JSON.stringify(file_data));
        }
        //luego de tener el index lo que hay que hacer es modificar el archivo fileData


        const filtered = file_data.filter((ticket) => ticket.id == 4 || ticket.id == 5).map((ticket) => {
            delete ticket.satisfaction_rating
            return ticket
        })

        // const filtered = filterTicketByTagsAndExternalId(file_data)

        if (filtered.length === 0) res.json({ "message": "No tickets to migrate" });
        const difference = Number(file_data.length) - filtered.length
        console.log("difference", difference)
        //todo guardo archivo en este momento con difference y con datos a enviar

        // const filteredWithComments = await this.fillAllTicketsWithComments(filtered)
        // const final = await this.replaceAttachmentsWithTokens(filteredWithComments)
        let result
        // result = await zendesk.createTicketsFetch(final)
        // fileHandle.createOrUpdateFile("ticketsfiltrados.json", final)


        //todo termino job y agrego en difference el filtered.length y borro archivo de buffer
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
            const done = file_data.done;
            if (isNaN(count))
                return res.json({ message: "not count yet" });
            return res.json({ count, done, percentage: done * 100 / count });
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
    filterTicketByTagsAndExternalId(tickets) {
        const tagsIncluded = ["duplicado", "live-migration", "live-migration-2"]
        const tickets_new = tickets.filter((ticket) => {
            if (ticket.external_id) {
                if (ticket.tags.includes(tagsIncluded[0]) || ticket.tags.includes(tagsIncluded[1]))
                    return ticket;
            }
        })

        return tickets_new.map((ticket) => {
            if (ticket?.satisfaction_rating?.score !== "good" && ticket?.satisfaction_rating?.score !== "bad") delete ticket.satisfaction_rating
            return ticket
        })
    },


    async fillAllTicketsWithComments(tickets) {
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
            //set solved at
            if (tickets[ticketIndex].status === "closed" || tickets[ticketIndex].status === "solved") {
                const recentUpdate = comments.map(comment => comment.created_at)
                const maxDate = new Date(
                    Math.max(
                        ...comments.map(element => {
                            return new Date(element.created_at);
                        }),
                    ),
                );
                const maxDateString = maxDate.toISOString().replace(".000", "")
                tickets[ticketIndex].solved_at = maxDateString;
                console.log('fechas de los comentarios', recentUpdate, maxDateString)
            }
        }
        return tickets
    },
    async replaceAttachmentsWithTokens(tickets) {
        return await Promise.all(tickets.map(async ticket => {
            ticket.comments = await Promise.all(ticket.comments.map(async (comment) => {
                const attachments = comment.attachments;
                const tokens = await Promise.all(attachments.map(async (attachment) => {
                    const token = await zendesk.migrateUpload(attachment, attachmentTempFolder);
                    return token
                }))
                comment.uploads = tokens;
                return comment
            }))
            return ticket
        }))
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
            file_data = { "count": 0, "index": "", "done": 0, "prev_index": "" }
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
        // const results = await this.fillAllTicketsWithComments(export_data.tickets)
        const results = export_data.tickets
        const results_count = Number(export_data.tickets.length)
        const newCount = results_count + file_data.count;

        const filtered = this.filterTicketByTagsAndExternalId(results)



        if (filtered.length === 0) {
            file_data = { ...file_data, count: newCount, index: newIndex, prev_index: prev_index, done: results_count + file_data.done };
            fileHandle.createOrUpdateFile(executionFile, file_data)
            res.json({ "message": "No tickets to migrate" });
        } else {
            //debo guardar todos los tickets que no fueron filtrados en el done
            const difference = Number(results.length) - filtered.length
            const newDone = Number(file_data.done) + difference
            file_data = { ...file_data, count: newCount, index: newIndex, prev_index: prev_index, done: newDone };
            fileHandle.createOrUpdateFile(executionFile, file_data)
        }

        // creo los datos dentro de la sección de tickets
        fileHandle.createOrUpdateFile(`tickets-${prev_index}.json`, JSON.stringify(filtered))

        const filteredWithComments = await this.fillAllTicketsWithComments(filtered)
        const final = await this.replaceAttachmentsWithTokens(filteredWithComments)
        let result
        result = await zendesk.createTicketsFetch(final)
        // fileHandle.createOrUpdateFile("ticketsfiltrados.json", final)








        return res.json({ "message": "export", result })
    },



}



