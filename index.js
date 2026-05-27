require('dotenv').config()

const connectToDatabase = require('./db')
const startServer = require('./server')

const PORT = process.env.PORT || 4000

startServer(PORT)