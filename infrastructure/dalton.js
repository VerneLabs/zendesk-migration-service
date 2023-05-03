require('dotenv').config()

var http = require('http');
let axios = require('axios');
const REGION_KEY = 'intGENRegionKey'
const REGION_NAME = 'vchNombre'
const AGENCY_KEY = 'intGENAgenciaKey'
const AGENCY_NAME = 'vchAgencia'


module.exports = {
    async getRegions() {
        const url = "https://dlt-llantas-api01.azurewebsites.net/CitasDaltonLlantas/ObtenerRegiones"
        const request = await axios.get(url)
        let data = request.data.map((region) => {
            return { "id": region[REGION_KEY], "value": region[REGION_NAME] }
        })
        return data
    },
    async getAgencies(region_id) {
        const url = "https://dlt-llantas-api01.azurewebsites.net/CitasDaltonLlantas/ObtenerAgenciasPorRegion/" + region_id
        const request = await axios.get(url)
        let data = request.data.map((agency) => {
            return { "id": agency[AGENCY_KEY], "value": agency[AGENCY_NAME] }
        })
        return data
    },
    async getSchedule(agency_id, day, hour) {
        const url = "https://dlt-qa-apicitaswa.azurewebsites.net/api/CitasWA/GetDates"
        const request = await axios.post(url, {
            "day": day,
            "hour": hour,
            "agencyId": agency_id
        })
        let data = request.data.map((assesor) => assesor.dias);

        let dataMerged = [];
        for (const individualArr of data) {
            dataMerged = dataMerged.concat(individualArr)

        }

        // let data = request.data.map((agency) => {
        //     return { "id": agency[AGENCY_KEY], "value": agency[AGENCY_NAME] }
        // })

        return dataMerged
    },
}


