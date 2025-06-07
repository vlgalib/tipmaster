import { CdpWalletProvider } from "@coinbase/agentkit";
import { Client } from "@xmtp/xmtp-js";
import { Wallet, ethers } from "ethers";
import * as functions from "firebase-functions";

// Initialize Coinbase AgentKit
let agentKitWalletProvider: CdpWalletProvider;
async function getAgentKitProvider() {
  if (agentKitWalletProvider) return agentKitWalletProvider;

  const cdpApiKeyName = functions.config().coinbase.cdp_api_key_name;
  const cdpApiKeyPrivateKey = functions.config().coinbase.cdp_api_key_private_key;

  if (!cdpApiKeyName || !cdpApiKeyPrivateKey) {
    throw new Error("Coinbase CDP API credentials are not set in Firebase function config.");
  }

  agentKitWalletProvider = await CdpWalletProvider.configureWithWallet({
    apiKeyId: cdpApiKeyName,
    apiKeyPrivate: cdpApiKeyPrivateKey,
    networkId: "base-mainnet",
  });
  return agentKitWalletProvider;
}

// Initialize XMTP Client for the service wallet
let xmtpClient: Client;
async function getXmtpClient() {
    if (xmtpClient) return xmtpClient;

    const privateKey = functions.config().xmtp.service_wallet_private_key;
    if (!privateKey) {
        throw new Error("XMTP service wallet private key is not set in Firebase function config.");
    }
    const wallet = new Wallet(privateKey);
    xmtpClient = await Client.create(wallet, { env: "production" });
    return xmtpClient;
}


/**
 * Transfers USDC to a recipient using Coinbase AgentKit.
 * @param {string} recipientAddress The recipient's wallet address.
 * @param {number} amount The amount of USDC to send.
 * @return {Promise<string>} The transaction hash.
 */
export async function transferUsdc(recipientAddress: string, amount: number): Promise<string> {
    const provider = await getAgentKitProvider();
    
    // AgentKit's transfer action for ERC20 tokens
    const usdcContractAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base Mainnet USDC
    const bigAmount = ethers.parseUnits(amount.toString(), 6); // USDC has 6 decimals

    const tx = await provider.transfer(usdcContractAddress, recipientAddress, bigAmount.toString());

    if (!tx.transactionHash) {
        throw new Error("Failed to send transaction via AgentKit.");
    }
    
    return tx.transactionHash;
}

/**
 * Sends a notification message via XMTP.
 * @param {string} recipientAddress The recipient's wallet address.
 * @param {number} amount The amount of USDC sent.
 * @param {string} txHash The transaction hash.
 */
export async function sendXmtpNotification(recipientAddress: string, amount: number, txHash: string) {
    const xmtp = await getXmtpClient();

    // A special conversation ID to easily identify tip transactions
    const conversationId = `tipmaster-tip/${txHash}`;
    
    const conversation = await xmtp.conversations.newConversation(
        recipientAddress, 
        {
            conversationId: conversationId,
            metadata: {
                "source": "TipMaster"
            }
        }
    );
    
    const message = `You received a new tip of ${amount} USDC! View transaction: https://basescan.org/tx/${txHash}`;
    
    await conversation.send(message);
    
    console.log(`XMTP notification sent to ${recipientAddress}`);
} 