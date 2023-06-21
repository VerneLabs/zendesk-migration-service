require('dotenv').config()


const express = require('express')
const router = express.Router()

let tickets = require('../../domain/controller/tickets');

router.post('/export', async (req, res) => {
    tickets.export(req, res)
})
router.all('/dev', async (req, res) => {
    tickets.dev(req, res)
})
router.all('/count', async (req, res) => {
    tickets.count(req, res)
})
router.all('/init', async (req, res) => {
    tickets.init(req, res)
})
router.all('/', async (req, res) => {
    tickets.main(req, res)
})

router.get('/health', (req, res) => {
    const data = {
        uptime: process.uptime(),
        message: 'Ok',
        date: new Date()
    }
    res.status(200).send(data);
});

module.exports = router;