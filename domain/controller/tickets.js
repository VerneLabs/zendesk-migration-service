let sunco = require('../../infrastructure/sunco');
let dalton = require('../../infrastructure/dalton');
let utils = require('./utils');
const zendesk = require('../../infrastructure/zendesk');
const fileHandle = require('./file');
let conversations = [];



module.exports = {
    async dev(req, res) {
        let file_data;
        const fileName = "execution.json"

        file_data = fileHandle.getJson('execution.json');


        // const credentials = await zendesk.checkCredentials()
        const export_data = await zendesk.getTicketsExport("1587972143")
        // console.log(export_data)


        const newIndex = export_data.next_page
        console.log('newIndex', newIndex)
        // modificar el contador





        // return res.json({ "message": "dev request", credentials: credentials });
        return res.json({ "message": "dev request", file_data: file_data, export_data: export_data });
    },
    async main(req, res) {
        return res.json({ "message": "you need to type the method" })
    },
    async export(req, res) {
        //get or init credentials
        const fileName = "execution.json"

        let file_data;
        try {
            file_data = fileHandle.getJson(fileName);
        } catch (error) {
            file_data = { "count": 0, "index": "" }
            fileHandle.createOrUpdateFile(fileName, JSON.stringify(file_data));
        }



        //luego de tener el index lo que hay que hacer es modificar el archivo fileData

        const newCount = 0;
        const newIndex = "";


        file_data = { ...file_data, count: newCount, index: newIndex };
        fileHandle.createOrUpdateFile(fileName, file_data)

        //contador
        return res.json({ "message": "export" })
    },


}
