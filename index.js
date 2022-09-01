import express from "express";
import cors from "cors";
import dayjs from "dayjs";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());

const mongoClient = new MongoClient(process.env.MONGO_URI);

let db;
const dbName = "live-chat";
mongoClient.connect().then(() => db = mongoClient.db(dbName));

let participants = [];
const messages = [];

app.post("/participants", async (req, res) => {
    const {name} = req.body;

    if (typeof(name) !== "string" || name === "") {
        return res.sendStatus(422);
    }

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
        res.send(error)
    }
});

async function checkParticipant(name) {
    const existingParticipant = await db.collection("participants").findOne({name});
    let response;
    
    try {
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
    const dbResponse = await db.collection("participants").find().toArray();
    console.log(dbResponse);

    try {
        res.send(dbResponse);
    } catch (error) {
        res.send(error)
    }
});

app.post("/messages", (req, res) => {
    const { to, text, type } = req.body;
    const { user } = req.headers;

    if (!validateMessage(to, text, type) || !checkParticipant(user)) {
        return res.sendStatus(422);
    }

    messages.push({
        from: user,
        to,
        text,
        type,
        time: getTime(true)
    });
    
    res.sendStatus(201);
});

function validateMessage(to, text, type) {
    if (to === "" || text === "" || (type !== "message" && type !== "private_message")) {
        return false
    }

    return true
}

app.get("/messages", async (req, res) => {
    const {limit} = req.query;
    const { user } = req.headers;

    const dbResponse = await db.collection("messages").find().toArray();

    try {
        const dbMessages = dbResponse;

        const filteredMessages = dbMessages.filter(message => message.to === user 
            || message.to === "Todos"
            || message.from === user);
    
        const lastMessages = limit ? filteredMessages.slice(-limit) : filteredMessages;
    
        res.send(lastMessages);
    } catch (error) {
        res.send(error);
    }
});

app.post("/status", (req, res) => {
    const { user } = req.headers;

    if (!checkParticipant(user)) return res.sendStatus(404);

    const userObj = participants.find(participant => participant.name === user);
    userObj.lastStatus = getTime();

    res.sendStatus(200);
});

setInterval(() => {
    participants = participants.filter(participant => {
        if (isAFK(participant)) {
            messages.push({
                from: participant.name,
                to: "Todos",
                text: "sai da sala...",
                type: "status",
                time: getTime(true)
            });

            return false
        }

        return true
    });
}, 15000);

function isAFK(user) {
    if (getTime() - user.lastStatus > 10000) return true

    return false
}

app.listen(5000, () => console.log("Listening to PORT 5000"));