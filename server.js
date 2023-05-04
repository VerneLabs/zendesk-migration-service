require('dotenv').config()
const express = require("express")
const cors = require('cors');
let app1 = express();  // Compliant
app1.disable("x-powered-by");
const PORT = process.env.PORT || 5000
const ticketsRoute = require('./application/routes/tickets')
const defaultRoute = require('./application/routes/default')


app1.use(express.json())
app1.use(cors());

app1.use('/', defaultRoute)
app1.use('/internal-api', defaultRoute)

app1.use('/tickets', ticketsRoute)
app1.use('/internal-api/tickets', ticketsRoute)

app1.listen(PORT, () => console.log('server started, litening on port ' + PORT))











