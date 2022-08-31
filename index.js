import express from "express";
import cors from "cors";
import dayjs from "dayjs";

const app = express();

app.use(express.json());
app.use(cors());

let participants = [];
const messages = [];

app.post("/participants", (req, res) => {
    const {name} = req.body;

    if (typeof(name) !== "string" || name === "") {
        return res.sendStatus(422);
    }

    if (checkParticipant(name, participants)) {
        return res.sendStatus(409);
    }

    participants.push({ name, lastStatus: getTime() });
    messages.push({
        from: name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: getTime(true)
    });

    res.sendStatus(201);
});

function checkParticipant(name, participants) {
    const existingParticipants = participants.find(participant => participant.name === name);

    if (existingParticipants) {
        return true
    }

    return false
}

function getTime(isFormated=false) {
    const now = Date.now();

    if (isFormated) return dayjs(now).format("HH:mm:ss");

    return now
}

app.get("/participants", (req, res) => {
    res.send(participants);
});

app.post("/messages", (req, res) => {
    const { to, text, type } = req.body;
    const { user } = req.headers;

    if (!validateMessage(to, text, type) || !checkParticipant(user, participants)) {
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

app.get("/messages", (req, res) => {
    const {limit} = req.query;
    const { user } = req.headers;

    const filteredMessages = messages.filter(message => message.to === user 
        || message.to === "Todos"
        || message.from === user);

    const lastMessages = limit ? filteredMessages.slice(-limit) : filteredMessages;
    console.log(lastMessages);

    res.send(lastMessages);
});

app.post("/status", (req, res) => {
    const { user } = req.headers;

    if (!checkParticipant(user, participants)) return res.sendStatus(404);

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