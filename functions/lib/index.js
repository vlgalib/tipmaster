"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHistory = exports.sendTip = exports.getStaff = exports.registerStaff = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors");
admin.initializeApp();
const db = admin.firestore();
const corsHandler = cors({ origin: true });
// API to register a new staff member
exports.registerStaff = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== "POST") {
            res.status(405).send("Method Not Allowed");
            return;
        }
        try {
            const { walletAddress, name, photoUrl } = req.body;
            if (!walletAddress || !name || !photoUrl) {
                res.status(400).send("Missing required fields.");
                return;
            }
            const staffRef = db.collection("staff").doc(walletAddress);
            await staffRef.set({
                walletAddress,
                name,
                photoUrl,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            res.status(201).send({ status: "success", staffId: walletAddress });
        }
        catch (error) {
            console.error("Error registering staff:", error);
            res.status(500).send("Internal Server Error");
        }
    });
});
// API to get a single staff member's public data
exports.getStaff = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== "GET") {
            res.status(405).send("Method Not Allowed");
            return;
        }
        try {
            const staffId = req.query.staffId;
            if (!staffId) {
                res.status(400).send("Missing staffId query parameter.");
                return;
            }
            const staffDoc = await db.collection("staff").doc(staffId).get();
            if (!staffDoc.exists) {
                res.status(404).send("Staff member not found.");
                return;
            }
            res.status(200).send(staffDoc.data());
        }
        catch (error) {
            console.error("Error fetching staff:", error);
            res.status(500).send("Internal Server Error");
        }
    });
});
// API to send a tip
exports.sendTip = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== "POST") {
            res.status(405).send("Method Not Allowed");
            return;
        }
        try {
            const { staffId, amount, message, senderAddress, txHash } = req.body;
            if (!staffId || !amount || !senderAddress || !txHash) {
                res.status(400).send("Missing required fields.");
                return;
            }
            // Here you would integrate with Coinbase AgentKit in the future
            // For now, just save to DB
            await db.collection("tips").add({
                staffId,
                amount: Number(amount),
                message,
                senderAddress,
                txHash, // For now, this will be the real txHash from the frontend
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // TODO: Send XMTP notification to staff
            res.status(201).send({ status: "success" });
        }
        catch (error) {
            console.error("Error sending tip:", error);
            res.status(500).send("Internal Server Error");
        }
    });
});
// API to get tip history for a staff member
exports.getHistory = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== "GET") {
            res.status(405).send("Method Not Allowed");
            return;
        }
        try {
            const staffId = req.query.staffId;
            if (!staffId) {
                res.status(400).send("Missing staffId query parameter.");
                return;
            }
            const tipsSnapshot = await db.collection("tips")
                .where("staffId", "==", staffId)
                .orderBy("createdAt", "desc")
                .get();
            const tips = tipsSnapshot.docs.map((doc) => (Object.assign({ id: doc.id }, doc.data())));
            res.status(200).send(tips);
        }
        catch (error) {
            console.error("Error getting history:", error);
            res.status(500).send("Internal Server Error");
        }
    });
});
//# sourceMappingURL=index.js.map