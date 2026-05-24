import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

// Initialize admin if not already
if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

export const submitApplication = functions.https.onCall(async (request) => {
  const { auth, data } = request;
  
  // 1. Auth check
  if (!auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  }

  const { jobId, coverMessage, proposedRate, rateType, proposedTimeline, portfolioItems } = data;

  // 2. Validate inputs
  if (coverMessage.length < 50) {
    throw new functions.https.HttpsError('invalid-argument', 'Cover message too short.');
  }
  if (proposedRate <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Rate must be positive.');
  }

  // 3. Fetch Job & verify status
  const jobRef = db.collection('projects').doc(jobId);
  const jobSnap = await jobRef.get();
  
  if (!jobSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Job not found.');
  }
  
  const job = jobSnap.data()!;
  if (job.status !== 'open') {
    throw new functions.https.HttpsError('failed-precondition', 'This job is no longer open.');
  }

  // 4. Check for duplicates
  const appCheck = await db.collection('applications')
    .where('jobId', '==', jobId)
    .where('freelancerId', '==', auth.uid)
    .get();

  if (!appCheck.empty) {
    throw new functions.https.HttpsError('already-exists', 'You have already applied to this job.');
  }

  // 5. Build Atomic Batch
  const batch = db.batch();
  
  const convId = `${auth.uid}_${job.clientId}_${jobId}`;
  const convRef = db.collection('conversations').doc(convId);
  const msgRef = convRef.collection('messages').doc();
  const appRef = db.collection('applications').doc();

  // A. Create Conversation
  batch.set(convRef, {
    participants: [auth.uid, job.clientId],
    type: 'application',
    jobId: jobId,
    lastMessage: {
      text: coverMessage.substring(0, 50) + '...',
      senderId: auth.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    },
    unreadCount: {
      [job.clientId]: 1
    }
  });

  // B. Create First Message (Proposal Card)
  batch.set(msgRef, {
    senderId: auth.uid,
    type: 'application_proposal',
    text: coverMessage,
    proposedRate,
    rateType,
    proposedTimeline,
    portfolioItems,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  // C. Create Application Record
  batch.set(appRef, {
    jobId,
    freelancerId: auth.uid,
    clientId: job.clientId,
    conversationId: convId,
    coverMessage,
    proposedRate,
    rateType,
    proposedTimeline,
    portfolioItems,
    status: 'pending',
    jobSnapshot: {
      title: job.title,
      budgetMin: job.budgetMin,
      budgetMax: job.budgetMax,
      category: job.category
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // D. Increment Job App Count
  batch.update(jobRef, {
    applicationCount: admin.firestore.FieldValue.increment(1)
  });

  await batch.commit();

  // 6. Send Push Notification (FCM)
  try {
    const clientRef = db.collection('users').doc(job.clientId);
    const clientSnap = await clientRef.get();
    const fcmToken = clientSnap.data()?.fcmToken;

    if (fcmToken) {
      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: 'New Application Received',
          body: `A designer has applied to your job: ${job.title}`
        },
        data: {
          type: 'new_application',
          jobId,
          conversationId: convId
        }
      });
    }
  } catch (err) {
    console.error("FCM Send failed:", err);
  }

  return { conversationId: convId, applicationId: appRef.id };
});
