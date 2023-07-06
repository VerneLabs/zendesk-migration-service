let sunco = require('../../infrastructure/sunco');
let dalton = require('../../infrastructure/dalton');
let utils = require('./utils');
const zendesk = require('../../infrastructure/zendesk');
const fileHandle = require('./file');
let conversations = [];

const attachmentTempFolder = "./domain/buffer/tempAttachments"
const allowNotNumbersInExternalId = false
const removeTagsFilter = false
const deleteDescription = true;


module.exports = {
    async dev(req, res) {
        await this.searchForSpecificTicket(10)
        await new Promise(resolve => setTimeout(resolve, 1000));

        const executionFile = "found.json"
        const result = await this.createOnlySelectedFilesOfTickets(executionFile)
        return res.json({ "message": "dev", result })
    },
    async searchForSpecificTicket(ticketId) {
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
        if (url === "END") return false
        let export_data;
        // intentamos obtener los tickets, en el caso de que no devuelva se termina, si devuelve seguimos el proceso
        let error_message = null;
        try {
            // export_data = await zendesk.getTicketsExport(url)
            export_data = await zendesk.getTicketsExportNew(url)
            if (export_data.end_of_stream === true)
                fileHandle.createOrUpdateFile(executionFile, { ...file_data, "index": "END" });
        } catch (error) {
            if (error.message !== "there are no tickets to list") return error_message = error.message
            if (error.message === "Zendesk rate limits 200 requests per minute") return error_message = "rate limit"
            fileHandle.createOrUpdateFile(executionFile, { ...file_data, "index": "END" });
            return false
        }
        const newIndex = export_data.after_url
        const prev_index = export_data.after_cursor
        // const results = await this.fillAllTicketsWithComments(export_data.tickets)
        const results = export_data.tickets
        const results_count = Number(results.length)
        const newCount = Number(results_count) + Number(file_data.count);
        const filtered = this.filterTicketByTagsAndExternalId(results)



        if (filtered.length === 0) {
            file_data = { ...file_data, count: newCount, index: newIndex, prev_index: prev_index, done: results_count + file_data.done };
            fileHandle.createOrUpdateFile(executionFile, file_data)
            return res.json({ "message": "No tickets to migrate" });
        } else {
            //debo guardar todos los tickets que no fueron filtrados en el done
            const difference = Number(results.length) - filtered.length
            const newDone = Number(file_data.done) + difference

            file_data = { ...file_data, count: newCount, index: newIndex, prev_index: prev_index, done: newDone };
            fileHandle.createOrUpdateFile(executionFile, JSON.stringify(file_data))
        }

        const hasValue = results.find(tickets => tickets.id === ticketId)

        if (hasValue) {
            fileHandle.createOrUpdateFile("found.json", JSON.stringify([hasValue]));
            return true

        }
        await new Promise(resolve => setTimeout(resolve, 1000));

        return this.searchForSpecificTicket(ticketId)
    },

    async createOnlySelectedFilesOfTickets(executionFile) {
        file_data = fileHandle.getJson(executionFile);
        // const filtered = this.filterTicketByTagsAndExternalId(file_data)
        const filteredWithComments = await this.fillAllTicketsWithComments(file_data)
        const final = await this.replaceAttachmentsWithTokens(filteredWithComments)
        return await zendesk.createTicketsFetch(final)

    },
    async main(req, res) {
        return res.json({ "message": "you need to type the method" })
    },
    async init(req, res) {
        let file_data = { "count": 0, "index": "", "done": 0, "prev_index": "" }
        executionFile = 'execution.json';

        fileHandle.createOrUpdateFile(executionFile, JSON.stringify(file_data));
        fileHandle.createFolder("tempAttachments")
        fileHandle.createFolder("idsToDelete")
        return res.json({ "message": "all done, ready to execute" })
    },
    async test(req, res) {
        let file_data = { "count": 0 }
        executionFile = 'test.json';
        try {
            file_data = fileHandle.getJson(executionFile);
        } catch (error) {
            file_data = { "count": 0 }
            fileHandle.createOrUpdateFile(executionFile, JSON.stringify(file_data));
        }
        file_data.count = file_data.count + 1;
        fileHandle.createOrUpdateFile(executionFile, JSON.stringify(file_data));
        return res.json({ "message": `count is ${file_data.count}` })
    },
    async count(req, res) {
        const executionFile = "execution.json"

        const initialFilesToNotInclude = "tickets"

        //GET FAILED FILES  
        const files = (await fileHandle.getAllFilesInFolder()).filter(file => {
            if (file === executionFile) return false // prevent to show execution
            if (file.substring(0, initialFilesToNotInclude.length) === initialFilesToNotInclude) return true //show only the one that starts with the word selected
            return false // otherwise will nor be shown
        });

        let errorCounter = 0;

        files.forEach(file => {
            try {
                file_data = fileHandle.getJson(file);
                if (file_data.length === 0) fileHandle.deleteFile(file)
                errorCounter += file_data.length
            } catch (error) {
                fileHandle.deleteFile(file)
            }
        })
        const total_tickets = await zendesk.countTickets();
        try {
            file_data = fileHandle.getJson(executionFile);
            const count = file_data.count;
            const done = file_data.count - errorCounter;
            if (isNaN(count))
                return res.json({ message: "not count yet" });
            return res.json({ count, done, percentageSuccess: done * 100 / count, total: total_tickets, totalExecutedPercentage: count / total_tickets });

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
    chunkArray(array, size) {
        let arrayOfArrays = []
        for (let i = 0; i < array.length; i += size) {
            const chunk = array.slice(i, i + size);
            arrayOfArrays.push(chunk);
        }
        return arrayOfArrays;
    },

    filterTicketByTagsAndExternalId(tickets) {
        const tagsIncluded = ["live-migration", "live-migration-2"]

        const tickets_new = tickets.filter((ticket) => {
            if (ticket.external_id || allowNotNumbersInExternalId)
                if (!isNaN(ticket.external_id) || allowNotNumbersInExternalId)
                    if (removeTagsFilter || ticket.tags.includes(tagsIncluded[0]) || ticket.tags.includes(tagsIncluded[1])) {
                        ticket.tags.push("migration-fix")
                        return ticket;
                    }

        })
        return tickets_new.map((ticket) => {
            if (ticket?.satisfaction_rating?.score !== "good" && ticket?.satisfaction_rating?.score !== "bad") delete ticket.satisfaction_rating
            return ticket
        })
    },

    async waitForStatusComplete(job, times = 0) {
        const url = job.job_status.url
        const response = await zendesk.request(url);
        const job_status = response?.data?.job_status;
        if (job_status.status === "completed") {
            console.log("este es el jobsStatus", job_status)
            const results = job_status.results
            const resultsWithIndex = results.map((result, index) => {
                result.pos = index
                return result
            }).filter(result => {
                if (result.status === "Error") return true;
                if (result.error) return true;
                return false
            })
            if (resultsWithIndex.length === 0) return true;
            return resultsWithIndex;
        }
        if (times > 5) return false
        await new Promise(resolve => setTimeout(resolve, 5000 * times));
        return this.waitForStatusComplete(job, times + 1)

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
            //validate in comments that are not system comments
            const final_comments = comments.map(comment => {
                if (comment.author_id < 0) delete comment.author_id
                return comment
            })


            tickets[ticketIndex].comments = final_comments;
            if (tickets[ticketIndex].group_id) delete tickets[ticketIndex].group_id

            if (deleteDescription) delete tickets[ticketIndex].description
            //set solved at
            if (tickets[ticketIndex].status === "closed" || tickets[ticketIndex].status === "solved") {
                const maxDate = new Date(
                    Math.max(
                        ...comments.map(element => {
                            return new Date(element.created_at);
                        }),
                    ),
                );
                const maxDateString = maxDate.toISOString().replace(".000", "")
                tickets[ticketIndex].solved_at = maxDateString;
            }
        }

        return tickets
    },
    async replaceAttachmentsWithTokens(tickets) {
        return await Promise.all(tickets.map(async ticket => {
            ticket.comments = await Promise.all(ticket.comments.map(async (comment) => {
                const attachments = comment.attachments;
                const tokens = await Promise.all(attachments.map(async (attachment) => {
                    try {
                        const token = await zendesk.migrateUpload(attachment, attachmentTempFolder);
                        return token
                    } catch (error) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        const token = await zendesk.migrateUpload(attachment, attachmentTempFolder);
                        return token
                    }
                }))
                comment.uploads = tokens;
                return comment
            }))
            return ticket
        }))
    },
    async export(req, res) {
        const resp = await this.execution();
        if (resp.error === true) res.status(500).json({ message: resp.message })
        res.json({ message: resp.message })
    }
    ,
    async fullMigrate(req, res) {
        try {
            const resp = await this.execution();
            if (resp.error === true) res.status(500).json({ message: resp.message })
            if (resp.message === "Ended request") return res.json({ "status": "full migrate route" })
            console.log(resp.message)
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            console.log("some error in full migrate route")
        } finally {
            return this.fullMigrate(req, res)
        }
    },
    async exportOld(req, res) {
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
        let error_message = null;
        try {
            // export_data = await zendesk.getTicketsExport(url)
            export_data = await zendesk.getTicketsExportNew(url)
            if (export_data.end_of_stream === true)
                fileHandle.createOrUpdateFile(executionFile, { ...file_data, "index": "END" });
        } catch (error) {
            if (error.message !== "there are no tickets to list") return error_message = error.message
            if (error.message === "Zendesk rate limits 200 requests per minute") return error_message = "rate limit"
            fileHandle.createOrUpdateFile(executionFile, { ...file_data, "index": "END" });
            return res.json({ "message": "Just Ended" });
        }
        if (error_message) return res.status(400).json({ message: error_message })

        //seteamos variables para guardado de datos
        const newIndex = export_data.after_url
        const prev_index = export_data.after_cursor
        // const results = await this.fillAllTicketsWithComments(export_data.tickets)
        const results = export_data.tickets
        const results_count = Number(results.length)
        const newCount = Number(results_count) + Number(file_data.count);
        const filtered = this.filterTicketByTagsAndExternalId(results)


        if (filtered.length === 0) {
            file_data = { ...file_data, count: newCount, index: newIndex, prev_index: prev_index, done: results_count + file_data.done };
            fileHandle.createOrUpdateFile(executionFile, file_data)
            return res.json({ "message": "No tickets to migrate" });
        } else {
            //debo guardar todos los tickets que no fueron filtrados en el done
            const difference = Number(results.length) - filtered.length
            const newDone = Number(file_data.done) + difference

            file_data = { ...file_data, count: newCount, index: newIndex, prev_index: prev_index, done: newDone };
            fileHandle.createOrUpdateFile(executionFile, file_data)
        }

        // creo los datos dentro de la sección de tickets
        const file_name = `tickets-${prev_index}.json`
        fileHandle.createOrUpdateFile(file_name, JSON.stringify(filtered))

        const filteredWithComments = await this.fillAllTicketsWithComments(filtered)
        const final = await this.replaceAttachmentsWithTokens(filteredWithComments)


        const maxValuesPossibles = 100;
        const arrays = this.chunkArray(final, maxValuesPossibles)
        const jobs = await Promise.all(arrays.map(async tickets => {
            return {
                tickets, execution: await zendesk.createTicketsFetch(
                    tickets)
            }
        }))
        //filtering in case there is an error in the execution and the job was not created
        const responses = await Promise.all(jobs.filter(job => job !== false).map(async job => {
            return { tickets: job.tickets, result: await this.waitForStatusComplete(job.execution) }
        }))
        let ticketsWithErrors = []
        let ticketsDone = []

        responses.forEach((responseObj) => {
            const response = responseObj.result;
            //when the complete file is not good
            if (response === false) return ticketsWithErrors.push(...responseObj.tickets)
            //when have punctual errors in the job and you want to filter them
            if (response !== true) {
                const failedFiles = responseObj.tickets.map((ticket, index) => {
                    const error = response.find(error => error.pos === index);
                    if (error) {
                        ticket.error_jobStatus = error
                        return ticket
                    }
                }).filter((element) => element != undefined)
                const successfullySended = responseObj.tickets.map((ticket, index) => {
                    const error = response.find(error => error.pos === index);
                    if (!error) {
                        return ticket.id
                    }
                }).filter((element) => element != undefined)
                ticketsWithErrors.push(...failedFiles)
                ticketsDone.push(...successfullySended)
            }
        });
        console.log('tickets to delete', JSON.stringify(ticketsDone))
        console.log('tickets to witherrors', JSON.stringify(ticketsWithErrors.length))
        //show the result of the operation
        if (ticketsWithErrors.length === 0) {
            fileHandle.deleteFile(file_name)
            return res.json({ "status": "ok" })
        }
        // console.log('ticketsWithErrors', ticketsWithErrors)
        fileHandle.createOrUpdateFile(file_name, JSON.stringify(ticketsWithErrors));
        return res.json({ "status": "not ok" })

    },
    async execution() {
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
        if (url === "END") return ({ "message": "Ended request" });
        let export_data;
        // intentamos obtener los tickets, en el caso de que no devuelva se termina, si devuelve seguimos el proceso
        let error_message = null;
        try {
            // export_data = await zendesk.getTicketsExport(url)
            export_data = await zendesk.getTicketsExportNew(url)
            if (export_data.end_of_stream === true)
                fileHandle.createOrUpdateFile(executionFile, { ...file_data, "index": "END" });
        } catch (error) {
            if (error.message !== "there are no tickets to list") return error_message = error.message
            if (error.message === "Zendesk rate limits 200 requests per minute") return error_message = "rate limit"
            fileHandle.createOrUpdateFile(executionFile, { ...file_data, "index": "END" });
            return ({ "message": "Just Ended" });
        }
        if (error_message) return ({ message: error_message, error: true })

        //seteamos variables para guardado de datos
        const newIndex = export_data.after_url
        const prev_index = export_data.after_cursor
        // const results = await this.fillAllTicketsWithComments(export_data.tickets)
        const results = export_data.tickets
        const results_count = Number(results.length)
        const newCount = Number(results_count) + Number(file_data.count);
        const filtered = this.filterTicketByTagsAndExternalId(results)


        if (filtered.length === 0) {
            file_data = { ...file_data, count: newCount, index: newIndex, prev_index: prev_index, done: results_count + file_data.done };
            fileHandle.createOrUpdateFile(executionFile, file_data)
            return ({ "message": "No tickets to migrate" });
        } else {
            //debo guardar todos los tickets que no fueron filtrados en el done
            const difference = Number(results.length) - filtered.length
            const newDone = Number(file_data.done) + difference

            file_data = { ...file_data, count: newCount, index: newIndex, prev_index: prev_index, done: newDone };
            fileHandle.createOrUpdateFile(executionFile, file_data)
        }

        // creo los datos dentro de la sección de tickets
        const file_name = `tickets-${prev_index}.json`
        fileHandle.createOrUpdateFile(file_name, JSON.stringify(filtered))

        const filteredWithComments = await this.fillAllTicketsWithComments(filtered)
        const final = await this.replaceAttachmentsWithTokens(filteredWithComments)


        const maxValuesPossibles = 100;
        const arrays = this.chunkArray(final, maxValuesPossibles)
        const jobs = await Promise.all(arrays.map(async tickets => {
            return {
                tickets, execution: await zendesk.createTicketsFetch(
                    tickets)
            }
        }))
        //filtering in case there is an error in the execution and the job was not created
        const responses = await Promise.all(jobs.filter(job => job !== false).map(async job => {
            return { tickets: job.tickets, result: await this.waitForStatusComplete(job.execution) }
        }))
        let ticketsWithErrors = []
        let ticketsDone = []

        responses.forEach((responseObj) => {
            const response = responseObj.result;
            //filter all tickets that are executed propperly
            const successfullySended = responseObj.tickets.map((ticket) => ticket.id)

            //when the complete file is not good
            if (response === false) {
                successfullySended = []
                return ticketsWithErrors.push(...responseObj.tickets)
            }
            //when have punctual errors in the job and you want to filter them
            if (response !== true) {

                const failedFiles = responseObj.tickets.map((ticket, index) => {
                    const error = response.find(error => error.pos === index);
                    if (error) {
                        ticket.error_jobStatus = error
                        return ticket
                    }
                }).filter((element) => element != undefined)
                ticketsWithErrors.push(...failedFiles)
                ///eliminate from successful the ones that are not
                successfullySended.forEach(ticket => {
                    const index = successfullySended.indexOf(ticket.id);
                    if (index > -1) { // only splice array when item is found
                        successfullySended.splice(index, 1); // 2nd parameter means remove one item only
                    }
                })
            }
            ticketsDone.push(...successfullySended)
        });
        if (ticketsDone.length > 0) fileHandle.createOrUpdateFile(`idsToDelete/ids-${prev_index}.json`, JSON.stringify(ticketsDone))
        //show the result of the operation
        if (ticketsWithErrors.length === 0) {
            fileHandle.deleteFile(file_name)
            return ({ "message": "migrated all good" })
        }
        // console.log('ticketsWithErrors', ticketsWithErrors)
        fileHandle.createOrUpdateFile(file_name, JSON.stringify(ticketsWithErrors));
        return ({ "message": "migrated with some errors" })

    },


    async logAndTimeout(num) {
        console.log(num)
        await new Promise(resolve => setTimeout(resolve, 2000));


    }

}



