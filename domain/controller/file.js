const fs = require('fs');
const BASIC_PATH = "domain/buffer/"
module.exports = {

    getFile(fileName) {
        const readMe = fs.readFileSync(BASIC_PATH + fileName, 'utf-8');
        return readMe
    },
    getJson(fileName) {
        const data = this.getFile(fileName)
        try {
            return JSON.parse(data)
        } catch (error) {
            console.error(error);
            return false
        }

    },
    createOrUpdateFile(fileName, fileData) {
        const dataString = typeof fileData === 'string' ? fileData : JSON.stringify(fileData);

        fs.writeFile(BASIC_PATH + fileName, dataString, err => {
            if (err) {
                console.error(err);
            }
            // file written successfully
        });
    }


}