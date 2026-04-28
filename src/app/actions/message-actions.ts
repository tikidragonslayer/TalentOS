'use server';

import { db } from '@/lib/firebase-admin';
import { auth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Conversation } from '@/types';

const MAX_MESSAGE_LENGTH = 5000;

/**
 * Send a message in a conversation. Server-side validated:
 * - Verifies Firebase Auth token
 * - Confirms sender is a conversation participant
 * - Validates content (non-empty, length limit)
 * - Creates message + updates conversation.lastMessage atomically
 */
export async function sendMessageAction(idToken: string, conversationId: string, content: string) {
    try {
        // 1. Verify auth token
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch {
            return { success: false, error: 'Invalid authentication token' };
        }
        const senderId = decodedToken.uid;

        // 2. Validate content
        const trimmedContent = content?.trim();
        if (!trimmedContent) {
            return { success: false, error: 'Message cannot be empty' };
        }
        if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
            return { success: false, error: `Message exceeds ${MAX_MESSAGE_LENGTH} character limit` };
        }

        // 3. Resolve companyId for employers (conversations store companyId, not employer UID)
        const userDoc = await db.collection('users').doc(senderId).get();
        const companyId = userDoc.exists ? userDoc.data()?.companyId : null;

        // 4. Verify sender is a participant
        const convRef = db.collection('conversations').doc(conversationId);
        const convDoc = await convRef.get();

        if (!convDoc.exists) {
            return { success: false, error: 'Conversation not found' };
        }

        const convData = convDoc.data() as Conversation;
        const isParticipant = convData.participantIds.includes(senderId)
            || (companyId && convData.participantIds.includes(companyId));
        if (!isParticipant) {
            return { success: false, error: 'You are not a participant in this conversation' };
        }

        const receiverId = convData.participantIds.find(id => id !== senderId && id !== companyId);
        if (!receiverId) {
            return { success: false, error: 'Could not determine receiver' };
        }

        // 4. Create message + update lastMessage atomically
        const batch = db.batch();

        const messageRef = convRef.collection('messages').doc();
        batch.set(messageRef, {
            senderId,
            receiverId,
            content: trimmedContent,
            timestamp: FieldValue.serverTimestamp(),
            revealLevelAtSend: convData.currentMessagingTier,
        });

        batch.update(convRef, {
            'lastMessage.content': trimmedContent,
            'lastMessage.timestamp': FieldValue.serverTimestamp(),
            'lastMessage.senderId': senderId,
        });

        await batch.commit();

        return { success: true, messageId: messageRef.id };
    } catch (error: any) {
        console.error('[sendMessageAction] Error:', error);
        return { success: false, error: error.message || 'Failed to send message' };
    }
}
