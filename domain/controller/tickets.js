let sunco = require('../../infrastructure/sunco');
let dalton = require('../../infrastructure/dalton');
let utils = require('./utils');
const zendesk = require('../../infrastructure/zendesk');
const fileHandle = require('./file');
let conversations = [];



module.exports = {
    async dev(req, res) {
        let file_data;
        const executionFile = "execution.json"
        file_data = fileHandle.getJson('execution.json');
        try {
            file_data = fileHandle.getJson(executionFile);
        } catch (error) {
            file_data = { "count": 0, "index": "", "prev_index": "" }
            fileHandle.createOrUpdateFile(executionFile, JSON.stringify(file_data));
        }

        const timeStamp = file_data.index === "" ? "1587972143" : file_data.index;
        if (timeStamp === "END") return res.json({ "message": "Ended request" });

        // const credentials = await zendesk.checkCredentials()
        let export_data;
        // try {
        //     export_data = await zendesk.getTicketsExport(timeStamp)
        // } catch (error) {
        //     if (error.message !== "there are no tickets to list") return res.status(400).json({ message: error.message })
        //     fileHandle.createOrUpdateFile(executionFile, { "count": file_data.count, "index": "END", "prev_index": "" });
        //     return res.json({ "message": "Just Ended" });
        // }

        // const newIndex = export_data.end_time

        // const prev_index = file_data.index
        // const results = export_data.results
        // const results_count = Number(results.length)
        // const newCount = results_count + file_data.count;

        // fileHandle.createOrUpdateFile(`tickets-${prev_index}.json`, JSON.stringify(results))

        // file_data = { ...file_data, count: newCount, index: newIndex, prev_index: prev_index };
        // fileHandle.createOrUpdateFile(executionFile, file_data)

        let ticket_id = 50
        const comments = await this.commentsByTicket(ticket_id)
        console.log('comments', comments)
        fileHandle.createOrUpdateFile(executionFile, { "count": file_data.count, "index": "END", "prev_index": "", currentTicket: ticket_id });

        return res.json({ "message": "dev request", file_data: file_data, export_data: export_data });
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
        const timeStamp = file_data.index === "" ? "1587972143" : file_data.index;
        // validamos el index para saber si ya termino el proceso
        if (timeStamp === "END") return res.json({ "message": "Ended request" });
        let export_data;
        // intentamos obtener los tickets, en el caso de que no devuelva se termina, si devuelve seguimos el proceso
        try {
            export_data = await zendesk.getTicketsExport(timeStamp)
        } catch (error) {
            if (error.message !== "there are no tickets to list") return res.status(400).json({ message: error.message })
            fileHandle.createOrUpdateFile(executionFile, { "count": file_data.count, "index": "END", "prev_index": "" });
            return res.json({ "message": "Just Ended" });
        }

        //seteamos variables para guardado de datos
        const newIndex = export_data.end_time
        const prev_index = file_data.index
        const results = export_data.results
        const results_count = Number(results.length)
        const newCount = results_count + file_data.count;

        // creo los datos dentro de la sección de tickets
        fileHandle.createOrUpdateFile(`tickets-${prev_index}.json`, JSON.stringify(results))
        // modifico todos los createOrUpdate
        file_data = { ...file_data, count: newCount, index: newIndex, prev_index: prev_index };
        fileHandle.createOrUpdateFile(executionFile, file_data)

        return res.json({ "message": "export" })
    },


}
