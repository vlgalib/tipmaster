import * as functions from "firebase-functions";
import { Request, Response } from "express";
// import { getXMTPModule as loadXMTPModule, XMTPSigner, XMTPConversation, XMTPMessage } from "./xmtp";
import * as path from "path";

// Dynamic import for XMTP V3 ES module
let XMTPModule: any = null;
async function getXMTPModule() {
  if (!XMTPModule) {
    XMTPModule = await import("@xmtp/node-sdk");
  }
  return XMTPModule;
}

/**
 * Sends XMTP notification from sender to recipient about tip transfer.
 * Note: XMTP Node SDK doesn't work in Firebase Functions due to filesystem restrictions.
 * This function logs data for debugging, actual sending happens through frontend.
 */
export async function sendXmtpNotification(
  senderAddress: string,
  senderSignature: string,
  recipientAddress: string, 
  amount: number, 
  txHash: string, 
  customMessage?: string
): Promise<void> {
  console.log(`📨 XMTP notification request logged:`);
  console.log(`   From: ${senderAddress}`);
  console.log(`   To: ${recipientAddress}`);
  console.log(`   Amount: ${amount} USDC`);
  console.log(`   TX: ${txHash}`);
  console.log(`   Message: ${customMessage || 'No custom message'}`);
  
  // In Firebase Functions XMTP SDK doesn't work due to filesystem restrictions
  // Real sending happens through frontend XMTP client
  console.log(`✅ XMTP notification logged successfully (frontend will handle actual sending)`);
}

// Stub function to get XMTP conversation history
export async function getXmtpHistory(walletAddress: string, signature: string, message: string) {
  try {
    console.log('[XMTP] Getting conversation history for:', walletAddress);
    console.log('[XMTP] Using stub implementation - XMTP Node SDK not compatible with Firebase Functions');
    
    // Return empty history for now
    // TODO: Implement actual XMTP integration via REST API or separate microservice
    const history: any[] = [];

    console.log('[XMTP] Returning empty history - frontend XMTP client handles real conversations');
    return history;
  } catch (error) {
    console.error('[XMTP] Error in stub implementation:', error);
    // Even if there's an error, return empty array to prevent 500 errors
    return [];
  }
}

// Express handler for API
export const getXmtpConversationHistory = async (req: Request, res: Response) => {
  try {
    const { walletAddress, signature, message } = req.body;
    
    if (!walletAddress || !signature || !message) {
      console.error('[XMTP] Missing required parameters:', { walletAddress, hasSignature: !!signature, message });
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const history = await getXmtpHistory(walletAddress, signature, message);
    return res.json({ history });
  } catch (error) {
    console.error('[XMTP] Error getting conversation history:', error);
    return res.status(500).json({ 
      error: 'Failed to get conversation history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}; 