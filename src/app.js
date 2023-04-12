import express from "express"
import cors from 'cors'
import { MongoClient, ObjectId } from "mongodb"
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

const participantSchema = Joi.object({
    name: Joi.string().min(1).required(),
});
const mensagemSchema = Joi.object({
    from: Joi.string().required(),
    to: Joi.string().min(1).required(),
    text: Joi.string().min(1).required(),
    type: Joi.string().valid("message", "private_message").required(),
    time: Joi.string()
})

app.post("/participants", async (req, res) => {
    const participant = req.body

    
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
        await db.collection("participants").insertOne({
            name: participant.name,
            lastStatus: Date.now()
        })
        await db.collection("messages").insertOne({
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
    try {
        const participants = await db.collection("participants").find().toArray()
        if(!participants) {
            return res.status(404).send("Nenhum participante foi encontrado!")
        }
        res.send(participants)
    }   catch (error){
        res.status(500).send(error.message)
    }
})
app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body
    const { user } = req.headers
    try {
        const message = {
            from: user,
            to,
            text,
            type,
            time: dayjs().format("HH:mm:ss")
        }
        const validacao = mensagemSchema.validate(message, {
            abortEarly: false
        })
        if(validacao.error) {
            const erros = validacao.error.details.map((detail) => detail.message)
            return res.status(422).send(erros)
        }
        const participantExist = await db.collection("participants").findOne({name: user})
        if(!participantExist) {
            return res.send(422)
        }
        await db.collection("messages").insertOne(message)
        res.send(201)
    } catch (error) {
        res.status(500).send(error.message)
    }
})
app.get("/messages", async (req, res) => {
    const limit = parseInt(req.query.limit)
    const { user } = req.headers
    try {
        const messages = await db.collection("messages").find().toArray()
        const filterMessages = messages.filter(msg => {
            const { from, to, type } = msg
            const canRead = (to === "Todos") || (from === user) || (to === user)
            const isPublic = type === "message"
            return canRead || isPublic
        })

        if(limit && limit !== NaN && limit > 0) {
            return res.send(filterMessages.slice(-limit))
        }
        res.send(filterMessages)
    } catch (error) {
        res.status(500).send(error.message)
    }
})
app.post("/status", async (req, res) => {
    const {user} = req.headers
    try {
        const participantExist = await db.collection("participants").findOne({name: user})
        if(!participantExist) {
            return res.sendStatus(404)
        }
        await db.collection("participants").updateOne({name: user}, {$set: {lastStatus: Date.now()}})
        res.sendStatus(200)
    } catch(error) {
        res.status(500).send(error.message)
    }
})
app.delete("/messages/:id", async (req, res) => {
    const user = req.headers.user
    const {id} = req.params
    try{
        const messages = await db.collection("messages")
        const messageExist = await messages.findOne({_id: new ObjectId(id)})
        if(!messageExist) {
            return res.sendStatus(404)
        }
        if(messageExist.from !== user) {
            return res.sendStatus(401)
        }
        await messages.deleteOne({
            _id: messageExist._id
        })
        res.sendStatus(200)
    } catch(error) {
        res.sendStatus(500)
    }
})
app.put("/messages/:id", async (req, res) => {
    const mensagem = req.body
    const user = req.headers.user
    const {id} = req.params
    const validacao = mensagemSchema.validate(message)
    if(validacao.error) {
        return res.sendStatus(422)
    }
    try {   
        const participantExist = await db.collection("participants").findOne({name: user})
        if(!participantExist) {
            return res.sendStatus(422)
        }
        const messageExist = await db.collection("messages").findOne({_id: new ObjectId(id)})
        if(!messageExist) {
            return res.sendStatus(404)
        }
        if(messageExist.from !== user) {
            return res.sendStatus(401)
        }
        await db.collection("messages").updateOne({
            _id: new ObjectId(id)}, {
                $set: mensagem
            })
            res.sendStatus(201)
    } catch(error) {
        res.status(500).send(error.message)
    }
})

setInterval(async () => {
    const segundos = Date.now() - 10 * 1000
    try {
        const partInativos = await db
        .collection("participants")
        .find({lastStatus: {$lte: segundos}})
        .toArray()
        if(partInativos.length > 0) {
            const msgInatividade = partInativos.map(part => {
                return {
                    from: part.name,
                    to:"Todos",
                    text: "Sai da sala...",
                    type: "status",
                    time: dayjs().format("HH:mm:ss")
                }
            })
        }
        await db.collection("messages").insertMany(msgInatividade)
        await db.collection("participants").deleteMany({lastStatus: {$lte: segundos}})
    } catch(error) {
        res.status(500).send(error.message)
    }
}, 15000)

const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))