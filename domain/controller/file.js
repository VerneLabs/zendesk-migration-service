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
    , deleteFile(fileName) {
        fs.unlink(BASIC_PATH + fileName, () => { console.log("file deleted properly") })
    },
    createFolder(folderName) {
        const new_location = BASIC_PATH + folderName
        fs.mkdir(new_location, () => { this.updatePermission(new_location) })
    },
    updatePermission(fileName) {
        fs.chmod(fileName, 0o777, () => { })
    }

}