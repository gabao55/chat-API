import express from "express";
import cors from "cors";
import dayjs from "dayjs";

const app = express();

app.use(express.json());
app.use(cors());

const participants = [];
const messages = [];

function validateMessage({ to, text, type }) {
    if (to === "" || text === "" || type !== "message" || type === "private_message") {
        return false
    }

    return true
}

function checkParticipant(name, participants) {
    const existingParticipants = participants.find(participant => participant.name === name);

    if (existingParticipants) {
        return true
    }

    return false
}

app.post("/participants", (req, res) => {
    const {name} = req.body;

    if (typeof(name) !== "string" || name === "") {
        return res.sendStatus(422);
    }

    if (checkParticipant(name, participants)) {
        return res.sendStatus(409);
    }

    const now = Date.now();

    participants.push({ name, lastStatus: now });
    messages.push({
        from: name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: dayjs(now).format("HH:mm:ss")
    });

    res.sendStatus(201);
});

app.get("/participants", (req, res) => {
    res.send(participants);
});

app.post("/messages", (req, res) => {
    const { to, text, type } = req.body;
    const { User } = req.headers;

    if (!validateMessage(to, text, type) || !checkParticipant(User, participants)) {
        return res.sendStatus(422);
    }
    
});

app.listen(5000, () => console.log("Listening to PORT 5000"));