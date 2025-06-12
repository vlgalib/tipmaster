import type { Identifier } from '@xmtp/browser-sdk';

// Adapter to create XMTP V3 Signer from ethers signer
export async function createXmtpSigner(signer: any) {
  const address = await signer.getAddress();
  
  return {
    type: 'EOA' as const,
    getIdentifier: (): Identifier => {
      // Return proper Identifier object structure for XMTP V3
      return {
        identifier: address.toLowerCase(),
        identifierKind: 'address' as any
      } as Identifier;
    },
    signMessage: async (message: string) => {
      const signature = await signer.signMessage(message);
      
      // Convert hex signature string to Uint8Array as required by XMTP V3
      const hex = signature.startsWith('0x') ? signature.slice(2) : signature;
      return new Uint8Array(hex.match(/.{2}/g)?.map((byte: string) => parseInt(byte, 16)) || []);
    },
  };
} 