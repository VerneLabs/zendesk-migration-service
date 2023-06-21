require('dotenv').config()

module.exports = {

    numberIcon(number) {
        switch (number) {
            case 0:
                return "0️⃣";
            case 1:
                return "1️⃣"
            case 2:
                return "2️⃣"
            case 3:
                return "3️⃣"
            case 4:
                return "4️⃣"
            case 5:
                return "4️⃣"
            case 6:
                return "6️⃣"
            case 7:
                return "7️⃣"
            case 8:
                return "8️⃣"
            case 9:
                return "9️⃣"
            case 10:
                return "🔟"
            default:
                return number
                break;
        }
    },
    carsData(arrayOfCars) {
        const agenciesData = arrayOfCars.map((agency) => {
            let nameToUpdate = agency.value.replace("Dalton ", "");
            const brand = nameToUpdate.split(" ")[0]
            const agencyName = nameToUpdate.replace(`${brand} `, "")
            return { id: agency.id, value: agency.value, brand: brand, name: agencyName }

        })

        const carsArray = agenciesData.map((agency) => agency.brand)

        let uniqueCars = [...new Set(carsArray)];
        console.log("uniqueCars", uniqueCars)
        console.log("agenciesData", agenciesData)

        return [uniqueCars, agenciesData]
    },
    getWeekDay(index) {
        switch (Number(index)) {
            case 1:
                return "Lunes"
            case 2:
                return "Martes"
            case 3:
                return "Miercoles"
            case 4:
                return "Jueves"
            case 5:
                return "Viernes"
            case 6:
                return "Sabado"
            case 7:
                return "Domingo"

            default:
                return false
                break;
        }
    },
    timeout(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
