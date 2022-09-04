import express from "express";
import cors from "cors";
import dayjs from "dayjs";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import Joi from "joi";
import { stripHtml } from "string-strip-html";
dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());

const mongoClient = new MongoClient(process.env.MONGO_URI);

let db;
const dbName = "live-chat";
mongoClient.connect().then(() => db = mongoClient.db(dbName));

const participantSchema = Joi.object({
    name: Joi.string().required().min(1)
});

const messageSchema = Joi.object({
    to: Joi.string().required().min(1),
    text: Joi.string().required().min(1),
    type: Joi.string().required().valid("message", "private_message")
});

app.post("/participants", async (req, res) => {
    const participantValidation = participantSchema.validate(req.body, { abortEarly: false });
    if (participantValidation.error) {
        const errors = participantValidation.error.details.map(error => error.message);
        return res.status(422).send(errors);
    }

    const name = stripHtml(req.body.name).result.trim();

    if (await checkParticipant(name)) {
        return res.sendStatus(409);
    }

    try {
        await db.collection("participants").insertOne({
            name,
            lastStatus: getTime()
        })
        await db.collection("messages").insertOne({
            from: name,
            to: "Todos",
            text: "entra na sala...",
            type: "status",
            time: getTime(true)
        });

        res.sendStatus(201);
    } catch (error) {
        res.status(500).send(error)
    }
});

async function checkParticipant(name) {
    let response;
    
    try {
        const existingParticipant = await db.collection("participants").findOne({name});

        if (existingParticipant !== null) {
            response = true;
        } else {
            response = false;
        }
    } catch (error) {
        console.log(error);
        response = error;
    }

    return response;
}

function getTime(isFormated=false) {
    const now = Date.now();

    if (isFormated) return dayjs(now).format("HH:mm:ss");

    return now
}

app.get("/participants", async (req, res) => {
    try {
        const dbResponse = await db.collection("participants").find().toArray();
        res.send(dbResponse);
    } catch (error) {
        res.status(500).send(error)
    }
});

app.post("/messages", async (req, res) => {
    const messageValidation = messageSchema.validate(req.body, { abortEarly: false });
    if (messageValidation.error) {
        const errors = messageValidation.error.details.map(error => error.message);
        return res.status(422).send(errors);
    }

    let { to, text, type } = req.body;
    let { user } = req.headers;

    to = stripHtml(to).result.trim();
    text = stripHtml(text).result.trim();
    type = stripHtml(type).result.trim();
    user = stripHtml(user).result.trim();

    if (!await checkParticipant(user)) return res.sendStatus(422);

    try {
        await db.collection("messages").insertOne({
            from: user,
            to,
            text,
            type,
            time: getTime(true)
        });
        
        res.sendStatus(201);        
    } catch (error) {
        res.status(500).send(error);       
    }
});

app.get("/messages", async (req, res) => {
    const {limit} = req.query;
    const { user } = req.headers;

    try {
        const dbMessages = await db.collection("messages").find().toArray();

        const filteredMessages = dbMessages.filter(message => message.to === user 
            || message.to === "Todos"
            || message.from === user);
    
        const lastMessages = limit ? filteredMessages.slice(-limit) : filteredMessages;
    
        res.send(lastMessages);
    } catch (error) {
        res.status(500).send(error);
    }
});

app.post("/status", async (req, res) => {
    const { user } = req.headers;

    try {
        if (!await checkParticipant(user)) return res.sendStatus(404);

        await db.collection("participants").updateOne(
            {name: user},
            { $set: {lastStatus: getTime()} }
        );

        res.sendStatus(200);
    } catch (error) {
        res.status(500).send(error)
    }
});

app.delete("/messages/:messageId", async (req, res) => {
    const { user } = req.headers;
    const messageId = req.params.messageId;
    console.log(messageId);

    const message = await db.collection("messages").findOne({ _id: ObjectId(messageId) });
    if (!message) {
        return res.sendStatus(404);
    }

    if (message.from !== user) return res.sendStatus(401);

    await db.collection("messages").deleteOne({ _id: ObjectId(message._id) });

    res.sendStatus(200);    
});

app.put("/messages/:messageId", async (req, res) => {
    const messageValidation = messageSchema.validate(req.body, { abortEarly: false });
    if (messageValidation.error) {
        const errors = messageValidation.error.details.map(error => error.message);
        return res.status(422).send(errors);
    }

    const { user } = req.headers;
    const messageId = req.params.messageId;

    if (!await checkParticipant(user)) return res.sendStatus(422);

    const message = await db.collection("messages").findOne({ _id: ObjectId(messageId) });
    if (!message) {
        return res.sendStatus(404);
    }

    if (message.from !== user) return res.sendStatus(401);

    await db.collection("messages").updateOne(
        { _id: ObjectId(message._id) },
        { $set: req.body }
    );

    res.sendStatus(200);
});

setInterval(async () => {
    try {
        const participants = await db.collection("participants").find().toArray();

        participants.forEach(async participant => {
            if (isAFK(participant)) {
                await db.collection("participants").deleteOne({
                    _id: participant._id
                });
                
                await db.collection("messages").insertOne({
                    from: participant.name,
                    to: "Todos",
                    text: "sai da sala...",
                    type: "status",
                    time: getTime(true)
                })
            }
        });
    } catch (error) {
        console.log(error)
    }
}, 15000);

function isAFK(user) {
    if (getTime() - user.lastStatus > 10000) return true

    return false
}

app.listen(5000, () => console.log("Listening to PORT 5000"));