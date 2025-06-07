import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as cors from "cors";
import { transferUsdc, sendXmtpNotification } from "./services";

admin.initializeApp();
const db = admin.firestore();
const corsHandler = cors({ origin: true });

// Helper to ensure wallet addresses are consistently lowercase
const toLower = (address: string) => address.toLowerCase();

// API to register a new staff member
export const registerStaff = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }
    try {
      const { walletAddress, name, photoUrl } = req.body;
      console.log('📝 Registration request received:', { walletAddress, name, photoUrl: photoUrl ? 'provided' : 'missing' });
      
      if (!walletAddress || !name || !photoUrl) {
        console.error('❌ Missing required fields:', { walletAddress: !!walletAddress, name: !!name, photoUrl: !!photoUrl });
        res.status(400).send("Missing required fields.");
        return;
      }
      
      const lowerCaseAddress = toLower(walletAddress);
      const staffRef = db.collection("staff").doc(lowerCaseAddress);
      const staffData = {
        walletAddress: lowerCaseAddress,
        name,
        photoUrl,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      console.log('💾 Writing to Firestore:', { walletAddress, name, collection: 'staff' });
      await staffRef.set(staffData);
      console.log('✅ Data written to Firestore successfully');
      
      // Verify data was written by reading it back
      console.log('🔍 Verifying data was saved...');
      const verificationDoc = await staffRef.get();
      if (!verificationDoc.exists) {
        console.error('❌ Verification failed: Document not found after write');
        res.status(500).send("Data verification failed");
        return;
      }
      
      const savedData = verificationDoc.data();
      console.log('✅ Verification successful:', { 
        exists: verificationDoc.exists, 
        name: savedData?.name, 
        photoUrl: savedData?.photoUrl ? 'present' : 'missing'
      });
      
      res.status(201).send({ status: "success", staffId: lowerCaseAddress });
    } catch (error) {
      console.error("❌ Error registering staff:", error);
      res.status(500).send("Internal Server Error");
    }
  });
});

// API to get a single staff member's public data
export const getStaff = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== "GET") {
            res.status(405).send("Method Not Allowed");
            return;
        }
        try {
            const staffId = req.query.staffId as string;
            if (!staffId) {
                res.status(400).send("Missing staffId query parameter.");
                return;
            }
            
            const lowerCaseStaffId = toLower(staffId);
            const staffDoc = await db.collection("staff").doc(lowerCaseStaffId).get();
            
            if (!staffDoc.exists) {
                res.status(404).send("Staff member not found.");
                return;
            }
            res.status(200).send(staffDoc.data());
        } catch (error) {
            console.error("Error fetching staff:", error);
            res.status(500).send("Internal Server Error");
        }
    });
});

// API to send a tip
export const sendTip = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const { recipientAddress, amount } = req.body;
      const lowerCaseRecipient = recipientAddress.toLowerCase();

      // 1. Perform the transfer via AgentKit
      const txHash = await transferUsdc(lowerCaseRecipient, amount);

      // 2. Send XMTP notification
      await sendXmtpNotification(lowerCaseRecipient, amount, txHash);

      res.status(200).send({
        message: "Tip sent and notification dispatched successfully!",
        transactionHash: txHash,
      });
    } catch (error) {
      console.error("Error sending tip:", error);
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      res.status(500).send({ error: "Failed to send tip.", details: errorMessage });
    }
  });
}); 