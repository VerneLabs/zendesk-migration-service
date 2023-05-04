const express = require('express')
const router = express.Router()

router.all('/', async (req, res) => {
    const data = {
        message: 'default route',
    }
    res.status(200).send(data);
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