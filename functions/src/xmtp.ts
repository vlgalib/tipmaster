import { Client } from "@xmtp/node-sdk";

let xmtpModule: typeof import("@xmtp/node-sdk") | null = null;

export async function getXMTPModule() {
  if (!xmtpModule) {
    xmtpModule = await import("@xmtp/node-sdk");
  }
  return xmtpModule;
}

export type XMTPConversation = any;
export type XMTPMessage = any;

export interface XMTPSigner {
  type: "SCW";
  getIdentifier: () => {
    identifier: string;
    identifierKind: number;
  };
  signMessage: (message: string) => Promise<Uint8Array>;
  getChainId: () => bigint;
} 