import express from "express"
import cors from 'cors'
import { MongoClient } from "mongodb"
import dotenv from 'dotenv'

const app = express()
app.use(cors())
app.use(express.json())
dotenv.config()

//Conexão com o Banco
let db
const mongoClient = new MongoClient(process.env.DATABASE_URL)
mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch((err) => res.status(500).send(err.message))



const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))