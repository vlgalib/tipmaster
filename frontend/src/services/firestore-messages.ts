import { getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  Timestamp,
  doc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';

// Get existing Firebase app instead of creating new one
function getFirebaseApp() {
  const apps = getApps();
  if (apps.length === 0) {
    console.error('[Firestore] No Firebase app found! App should be initialized elsewhere.');
    throw new Error('Firebase app not initialized. Please ensure Firebase is initialized in the main app.');
  }
  return getApp(); // Get the default app
}

// Get Firestore instance from existing app (with error handling)
let db: any = null;

function getFirestore_safe() {
  if (db) return db;
  
  try {
    db = getFirestore(getFirebaseApp());
    console.log('[Firestore] ✅ Successfully connected to existing Firebase app');
    return db;
  } catch (error) {
    console.error('[Firestore] ❌ Failed to get Firestore:', error);
    throw error;
  }
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  from: string;
  to: string;
  content: string;
  timestamp: Date;
  sentAtNs?: string;
  senderInboxId?: string;
  recipientInboxId?: string;
  messageId?: string;
  isLocal?: boolean; // For local messages before synchronization
}

export interface ConversationInfo {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: Date;
  createdAt: Date;
}

/**
 * Save message to Firestore
 */
export async function saveMessageToFirestore(message: {
  conversationId: string;
  from: string;
  to: string;
  content: string;
  sentAtNs?: string;
  senderInboxId?: string;
  messageId?: string;
}): Promise<void> {
  try {
    console.log('[Firestore] 💾 Saving message to Firestore:', {
      conversationId: message.conversationId,
      from: message.from,
      to: message.to,
      contentLength: message.content.length
    });

    const messageData: Omit<StoredMessage, 'id'> = {
      conversationId: message.conversationId,
      from: message.from.toLowerCase(),
      to: message.to.toLowerCase(),
      content: message.content,
      timestamp: new Date(),
      sentAtNs: message.sentAtNs,
      senderInboxId: message.senderInboxId,
      messageId: message.messageId,
      isLocal: false
    };

    // Create unique ID for message
    const messageId = `${messageData.from}_${messageData.to}_${messageData.timestamp}`;
    
    // Update conversation information
    const conversationId = `${messageData.from}_${messageData.to}`;
    
    const firestore = getFirestore_safe();
    await setDoc(doc(firestore, 'xmtp_messages', messageId), messageData);
    
    // Update conversation information
    await updateConversationInfo(conversationId, [messageData.from, messageData.to], messageData.content);
    
    console.log('[Firestore] ✅ Message saved successfully');
  } catch (error) {
    console.error('[Firestore] ❌ Failed to save message:', error);
    throw error;
  }
}

  /**
   * Get message history from Firestore
   */
export async function getMessagesFromFirestore(walletAddress: string): Promise<StoredMessage[]> {
  try {
    console.log('[Firestore] 📖 Loading message history for:', walletAddress);
    
    const normalizedAddress = walletAddress.toLowerCase();
    
    // Get messages where user is either sender or recipient
    const firestore = getFirestore_safe();
    
    // Make two separate queries and combine results
    const fromQuery = query(
      collection(firestore, 'xmtp_messages'),
      where('from', '==', normalizedAddress),
      orderBy('timestamp', 'desc')
    );
    
    const toQuery = query(
      collection(firestore, 'xmtp_messages'),
      where('to', '==', normalizedAddress),
      orderBy('timestamp', 'desc')
    );
    
    const [fromSnapshot, toSnapshot] = await Promise.all([
      getDocs(fromQuery),
      getDocs(toQuery)
    ]);
    
    // Combine results and deduplicate
    const messageMap = new Map();
    
    // Process messages from user
    fromSnapshot.forEach((doc) => {
      const data = doc.data();
      messageMap.set(doc.id, {
        id: doc.id,
        conversationId: data.conversationId,
        from: data.from,
        to: data.to,
        content: data.content,
        timestamp: data.timestamp.toDate(),
        sentAtNs: data.sentAtNs,
        senderInboxId: data.senderInboxId,
        recipientInboxId: data.recipientInboxId,
        messageId: data.messageId,
        isLocal: data.isLocal || false
      });
    });
    
    // Process messages to user
    toSnapshot.forEach((doc) => {
      const data = doc.data();
      messageMap.set(doc.id, {
        id: doc.id,
        conversationId: data.conversationId,
        from: data.from,
        to: data.to,
        content: data.content,
        timestamp: data.timestamp.toDate(),
        sentAtNs: data.sentAtNs,
        senderInboxId: data.senderInboxId,
        recipientInboxId: data.recipientInboxId,
        messageId: data.messageId,
        isLocal: data.isLocal || false
      });
    });
    
    // Convert Map to Array and sort
    const messages = Array.from(messageMap.values()).sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );
    
    console.log('[Firestore] 📋 Loaded', messages.length, 'messages from history');
    return messages;
    
  } catch (error) {
    console.error('[Firestore] ❌ Failed to load messages:', error);
    return []; // Return empty array on error for stability
  }
}

  /**
   * Get messages for specific conversation
   */
export async function getConversationMessages(conversationId: string): Promise<StoredMessage[]> {
  try {
    console.log('[Firestore] 🗨️ Loading conversation messages:', conversationId);
    
    const firestore = getFirestore_safe();
    const conversationQuery = query(
      collection(firestore, 'xmtp_messages'),
      where('conversationId', '==', conversationId),
      orderBy('timestamp', 'asc')
    );
    
    const querySnapshot = await getDocs(conversationQuery);
    
    const messages: StoredMessage[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        conversationId: data.conversationId,
        from: data.from,
        to: data.to,
        content: data.content,
        timestamp: data.timestamp.toDate(),
        sentAtNs: data.sentAtNs,
        senderInboxId: data.senderInboxId,
        recipientInboxId: data.recipientInboxId,
        messageId: data.messageId,
        isLocal: data.isLocal || false
      });
    });
    
    console.log('[Firestore] 📋 Loaded', messages.length, 'messages for conversation');
    return messages;
    
  } catch (error) {
    console.error('[Firestore] ❌ Failed to load conversation messages:', error);
    return [];
  }
}

  /**
   * Get user's conversation list
   */
export async function getUserConversations(userAddress: string): Promise<ConversationInfo[]> {
  try {
    console.log('[Firestore] 💬 Loading conversations for:', userAddress);
    
    const firestore = getFirestore_safe();
    const conversationsQuery = query(
      collection(firestore, 'xmtp_conversations'),
      where('participants', 'array-contains', userAddress.toLowerCase()),
      orderBy('lastMessageTime', 'desc')
    );
    
    const querySnapshot = await getDocs(conversationsQuery);
    
    const conversations: ConversationInfo[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      conversations.push({
        id: doc.id,
        participants: data.participants,
        lastMessage: data.lastMessage,
        lastMessageTime: data.lastMessageTime?.toDate(),
        createdAt: data.createdAt.toDate()
      });
    });
    
    console.log('[Firestore] 💬 Loaded', conversations.length, 'conversations');
    return conversations;
    
  } catch (error) {
    console.error('[Firestore] ❌ Failed to load conversations:', error);
    return [];
  }
}

  /**
   * Update conversation information
   */
async function updateConversationInfo(conversationId: string, participants: string[], lastMessage: string): Promise<void> {
  try {
    const normalizedParticipants = participants.map(p => p.toLowerCase());
    
    const conversationData: Omit<ConversationInfo, 'id'> = {
      participants: normalizedParticipants,
      lastMessage: lastMessage.substring(0, 100), // Limit preview length
      lastMessageTime: new Date(),
      createdAt: new Date()
    };
    
    const firestore = getFirestore_safe();
    await setDoc(doc(firestore, 'xmtp_conversations', conversationId), conversationData, { merge: true });
    
  } catch (error) {
    console.warn('[Firestore] ⚠️ Failed to update conversation info:', error);
    // Not critical, continue working
  }
}

  /**
   * Clean up old messages (for optimization)
   */
export async function cleanupOldMessages(daysToKeep: number = 30): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    console.log('[Firestore] 🧹 Cleaning up messages older than:', cutoffDate);
    
    const firestore = getFirestore_safe();
    const oldMessagesQuery = query(
      collection(firestore, 'xmtp_messages'),
      where('timestamp', '<', Timestamp.fromDate(cutoffDate))
    );
    
    const querySnapshot = await getDocs(oldMessagesQuery);
    
    const deletePromises: Promise<void>[] = [];
    querySnapshot.forEach((documentSnapshot) => {
      deletePromises.push(deleteDoc(documentSnapshot.ref));
    });
    
    await Promise.all(deletePromises);
    
    console.log('[Firestore] ✅ Cleaned up', deletePromises.length, 'old messages');
    
  } catch (error) {
    console.error('[Firestore] ❌ Failed to cleanup old messages:', error);
  }
}

export default {
  saveMessageToFirestore,
  getMessagesFromFirestore,
  getConversationMessages,
  getUserConversations,
  cleanupOldMessages
}; 