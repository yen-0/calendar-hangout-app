// functions/src/index.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK ONCE at the top level
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore(); // Use Admin SDK for Firestore access

// Interfaces for data expected by the function and for CalendarEvent
interface ConfirmHangoutPayload {
  hangoutRequestId: string;
  chosenSlot: {
    start: string; // Expected as ISO string from client
    end: string;   // Expected as ISO string from client
    availableParticipants: string[];
  };
  // requestName is not strictly needed if we fetch it, but can be passed for convenience
  // requestName: string;
}

interface CalendarEventData {
  title: string;
  start: admin.firestore.Timestamp;
  end: admin.firestore.Timestamp;
  allDay: boolean;
  color: string;
  hangoutRequestId: string; // Link back to the hangout request
  // Add other fields as per your CalendarEvent type in the main app
  // e.g., isStamp, emoji, occurrenceDate, originalStampId
}

export const confirmHangoutAndCreateEvents = functions.https.onCall(
  async (data: ConfirmHangoutPayload, context) => {
    // 1. Authentication Check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The function must be called while authenticated."
      );
    }
    const callingUid = context.auth.uid;

    // 2. Input Validation
    const { hangoutRequestId, chosenSlot } = data;
    if (
      !hangoutRequestId ||
      !chosenSlot ||
      !chosenSlot.start ||
      !chosenSlot.end ||
      !chosenSlot.availableParticipants
    ) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required data: hangoutRequestId or chosenSlot details."
      );
    }

    let chosenSlotStart: Date;
    let chosenSlotEnd: Date;
    try {
      chosenSlotStart = new Date(chosenSlot.start);
      chosenSlotEnd = new Date(chosenSlot.end);
      if (isNaN(chosenSlotStart.getTime()) || isNaN(chosenSlotEnd.getTime())) {
        throw new Error("Invalid date format for chosenSlot.");
      }
    } catch (dateError) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid date format for chosenSlot start or end."
      );
    }

    const hangoutRequestRef = db.collection("hangoutRequests").doc(hangoutRequestId);

    try {
      // Using a transaction to ensure atomicity of reading and updating the hangout request
      await db.runTransaction(async (transaction) => {
        const hangoutRequestDoc = await transaction.get(hangoutRequestRef);

        if (!hangoutRequestDoc.exists) {
          throw new functions.https.HttpsError(
            "not-found",
            "Hangout request not found."
          );
        }

        const requestData = hangoutRequestDoc.data();
        if (!requestData) {
          throw new functions.https.HttpsError( // Should not happen if doc.exists is true
            "internal",
            "Hangout request data is missing."
          );
        }

        // 3. Authorization Check
        if (requestData.creatorUid !== callingUid) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "Only the creator can confirm the hangout."
          );
        }

        // 4. Idempotency Check (Optional but good)
        //    Prevents re-confirming if already confirmed with the *same* slot.
        const existingFinalSlot = requestData.finalSelectedSlot as admin.firestore.Timestamp | undefined;
        if (
          requestData.status === "confirmed" &&
          existingFinalSlot &&
          existingFinalSlot.start.isEqual(admin.firestore.Timestamp.fromDate(chosenSlotStart)) &&
          existingFinalSlot.end.isEqual(admin.firestore.Timestamp.fromDate(chosenSlotEnd))
        ) {
          functions.logger.info(
            `Hangout ${hangoutRequestId} already confirmed with this exact slot by ${callingUid}.`
          );
          // Returning success as the desired state is already achieved.
          // The client can decide if it needs to show a specific message.
          return; // Exit transaction successfully
        }
        // If already confirmed but with a *different* slot, it's an error or needs specific handling.
        if (requestData.status === "confirmed") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "This hangout has already been confirmed with a different time slot. Please refresh."
          );
        }


        // 5. Update HangoutRequest Document within the transaction
        transaction.update(hangoutRequestRef, {
          finalSelectedSlot: {
            start: admin.firestore.Timestamp.fromDate(chosenSlotStart),
            end: admin.firestore.Timestamp.fromDate(chosenSlotEnd),
          },
          status: "confirmed",
        });

        // The creation of calendar events will happen outside the transaction
        // but after the transaction successfully commits.
        // This is because batch writes cannot be part of a transaction
        // if the transaction also reads documents (which ours does).
      });

      // Transaction successful, now create calendar events using a batch
      const batch = db.batch();
      const requestName = (await hangoutRequestRef.get()).data()?.requestName || "Hangout Event";

      for (const participantUid of chosenSlot.availableParticipants) {
        const userCalendarCollectionRef = db
          .collection("users")
          .doc(participantUid)
          .collection("calendarItems");

        const newCalendarEventData: CalendarEventData = {
          title: `Hangout: ${requestName}`,
          start: admin.firestore.Timestamp.fromDate(chosenSlotStart),
          end: admin.firestore.Timestamp.fromDate(chosenSlotEnd),
          allDay: false,
          color: "#38A169", // Example color for hangouts
          hangoutRequestId: hangoutRequestId,
          // Initialize other fields from your CalendarEvent type as needed
          // isStamp: false, (example)
        };
        batch.set(userCalendarCollectionRef.doc(), newCalendarEventData);
      }
      await batch.commit();

      functions.logger.info(
        `Hangout ${hangoutRequestId} confirmed by ${callingUid}. 
        Events created for ${chosenSlot.availableParticipants.length} participants.`
      );
      return {
        success: true,
        message: "Hangout confirmed and events added to calendars.",
      };
    } catch (error: any) {
      functions.logger.error(
        `Error in confirmHangoutAndCreateEvents for ${hangoutRequestId} by ${callingUid}:`,
        { errorMessage: error.message, errorStack: error.stack, code: error.code }
      );
      // Re-throw HttpsError if it's already one (from our checks or transaction failure)
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      // Otherwise, wrap it in a generic internal HttpsError
      throw new functions.https.HttpsError(
        "internal",
        error.message || "An unexpected error occurred while confirming the hangout."
      );
    }
  }
);