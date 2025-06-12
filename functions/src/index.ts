import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as cors from "cors";
import { sendXmtpNotification, getXmtpHistory as getXmtpHistoryFromServices } from "./services";

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
      
      res.status(201).send(savedData);
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

// API to send XMTP notification after tip transaction
export const notifyTip = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    try {
      const { senderAddress, senderSignature, recipientAddress, amount, txHash, message } = req.body;

      // Validation
      if (!senderAddress || typeof senderAddress !== 'string' || !senderAddress.startsWith('0x')) {
        res.status(400).send({ error: "Invalid or missing senderAddress." });
        return;
      }
      if (!senderSignature || typeof senderSignature !== 'string') {
        res.status(400).send({ error: "Invalid or missing senderSignature." });
        return;
      }
      if (!recipientAddress || typeof recipientAddress !== 'string' || !recipientAddress.startsWith('0x')) {
        res.status(400).send({ error: "Invalid or missing recipientAddress." });
        return;
      }
      // Convert amount to number if it's a string
      const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      if (numericAmount === undefined || isNaN(numericAmount) || numericAmount <= 0) {
        res.status(400).send({ error: "Invalid or missing amount. Must be a positive number." });
        return;
      }
      if (!txHash || typeof txHash !== 'string' || !txHash.startsWith('0x')) {
        res.status(400).send({ error: "Invalid or missing transaction hash." });
        return;
      }
      if (message && typeof message !== 'string') {
        res.status(400).send({ error: "Invalid message format. Must be a string." });
        return;
      }

      const lowerCaseSender = senderAddress.toLowerCase();
      const lowerCaseRecipient = recipientAddress.toLowerCase();

      // Send XMTP notification from sender to recipient
      await sendXmtpNotification(lowerCaseSender, senderSignature, lowerCaseRecipient, numericAmount, txHash, message);

      res.status(200).send({
        message: "XMTP notification sent successfully!",
        transactionHash: txHash,
      });
    } catch (error) {
      console.error("Error sending XMTP notification:", error);
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      res.status(500).send({ error: "Failed to send notification.", details: errorMessage });
    }
  });
});

// API to get XMTP conversation history
export const getXmtpHistory = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    try {
      const { walletAddress, signature, message } = req.body;

      if (!walletAddress || !signature || !message) {
        res.status(400).send({ error: "Missing required fields: walletAddress, signature, message" });
        return;
      }

      console.log(`[XMTP History] Request for address: ${walletAddress}`);

      // Get real XMTP conversation history
      const tips = await getXmtpHistoryFromServices(walletAddress, signature, message);

      console.log(`[XMTP History] Returning ${tips.length} tips for ${walletAddress}`);

      res.status(200).send({
        success: true,
        tips,
        count: tips.length
      });

    } catch (error) {
      console.error("[XMTP History] Error:", error);
      res.status(500).send({ 
        error: "Failed to fetch XMTP history",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// API to search for users by name or wallet address
export const searchUser = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "GET") {
      res.status(405).send("Method Not Allowed");
      return;
    }
    try {
      const query = req.query.query as string;
      if (!query) {
        res.status(400).send("Missing query parameter.");
        return;
      }
      
      console.log('🔍 Searching for user:', query);
      
      // Check if query looks like a wallet address (starts with 0x and is 42 characters)
      const isWalletAddress = query.startsWith('0x') && query.length === 42;
      
      if (isWalletAddress) {
        // Search by wallet address
        const lowerCaseQuery = toLower(query);
        const staffDoc = await db.collection("staff").doc(lowerCaseQuery).get();
        
        if (staffDoc.exists) {
          const data = staffDoc.data();
          res.status(200).send({
            found: true,
            user: {
              walletAddress: data?.walletAddress,
              name: data?.name,
              photoUrl: data?.photoUrl
            }
          });
        } else {
          res.status(200).send({ found: false });
        }
      } else {
        // Search by name (case-insensitive)
        // Since Firestore doesn't support case-insensitive queries directly,
        // we'll get all staff and filter in memory for small datasets
        // For larger datasets, consider storing a lowercase version of the name
        const staffQuery = await db.collection("staff").get();
        
        let foundUser = null;
        const searchTerm = query.toLowerCase().trim();
        
        staffQuery.docs.forEach(doc => {
          const data = doc.data();
          if (data.name && data.name.toLowerCase().trim() === searchTerm) {
            foundUser = {
              walletAddress: data.walletAddress,
              name: data.name,
              photoUrl: data.photoUrl
            };
          }
        });
        
        if (foundUser) {
          res.status(200).send({
            found: true,
            user: foundUser
          });
        } else {
          res.status(200).send({ found: false });
        }
      }
    } catch (error) {
      console.error("Error searching user:", error);
      res.status(500).send("Internal Server Error");
    }
  });
}); 