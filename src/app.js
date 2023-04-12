import express from "express"
import cors from 'cors'
import { MongoClient } from "mongodb"
import dotenv from 'dotenv'
import dayjs from "dayjs"
import Joi from "joi"

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


app.post("/participants", async (req, res) => {
    const {participant} = req.body

    const participantSchema = Joi.object({
        name: Joi.string().min(1).required(),
      });
    const validacao = participantSchema.validate(participant, {
        abortEarly: false
    })
    if(validacao.error) {
        const erros = validacao.error.details.map((detail) => detail.message)
        return res.status(422).send(erros)
    }
    try {
        const participantExist = await db.collection("participants").findOne({name: participant.name})
        if(participantExist) {
            return res.send(409)
        }
        await db.collection("participants").inserOne({
            name: participant.name,
            lastStatus: Date.now()
        })
        await db.collection("messages").inserOne({
            from: participant.name,
            to: "Todos",
            text: "entra na sala...",
            type: "status",
            time: dayjs().format("HH:mm:ss")
        })
        res.send(201)
    } 
    catch(error) {
        res.status(500).send(error.message)
    }
    
        
}) 
app.get("/participants", async (req, res) => {
    
})
app.post("/messages")
app.get("/messages")
app.post("/status")


const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))