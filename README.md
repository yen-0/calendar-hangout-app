# Hangly (beta)

## Overview

Welcome to hangly - the Calendar & Hangout App! This application provides a comprehensive solution for managing personal calendar events, creating custom "stamps" for recurring activities, and facilitating group scheduling through a unique "Hangout Request" feature. Users can visually organize their time, define reusable event templates (stamps), and easily find common availability with friends or colleagues.

Built with Next.js and Firebase, this app offers a modern, responsive user experience with real-time data synchronization and robust authentication.

## Features

### 🗓️ Calendar System
*   **Multiple Views:** Month, Week, Day, and Agenda views to suit different planning needs.
*   **Simple Mode:** Classic calendar month view with colored dots on days indicating events.
*   **Detailed Mode:** Month view cells show event previews; Day/Week views show full event bars.
*   **Event Interaction:** Click on days or time slots to add events, or click existing events to edit.
*   **Day Details Modal:** View all events for a specific day in a clean modal interface.

### 📌 Stamp System (Custom Reusable Events)
*   **Create Custom Stamps:** Define "stamps" with a label, emoji icon, default start/end time, and color.
*   **Recurring Stamps:** Set stamps to repeat on specific days of the week within a defined date range.
*   **Stamp Palette:** A dedicated panel displays all your created stamps.
*   **Easy Application:** Select a stamp from the palette and click on a date in the calendar to quickly add an instance of that stamp.

### ➕ Event Management
*   **Manual Event Creation:** Full form for creating detailed one-off or all-day events with titles, specific start/end times, and colors.
*   **Edit & Delete:** Easily modify or remove any event or stamp instance.
*   **Confirmation Modals:** Safeguards for deletion actions.

### 🤝 Hangout Request Feature
*   **Create Hangout Requests:**
    *   Define a request name.
    *   Propose one or more date ranges.
    *   Propose one or more daily time ranges.
    *   Specify desired meeting duration and optional buffer/margin time.
    *   Set the desired number of members.
*   **Shareable Links:** Generate a unique link for each hangout request to share with potential attendees.
*   **Participant Availability Submission:** Users opening a shared link can view request details and submit their own availability (their busy slots from their calendar are automatically considered).
*   **Common Slot Calculation:** The system analyzes all submitted availabilities to find common free time slots that fit the request criteria.
*   **Confirm Final Time:** The request creator can review common slots and confirm a final time for the hangout.
*   **Notification System:**
    *   Participants are notified when a hangout they are part of is confirmed.
    *   A dedicated notifications area shows unread and read notifications.
    *   Participants can add the confirmed hangout event to their personal calendar directly from the notification.

### 👤 Authentication & User Management
*   **Email/Password:** Secure sign-up and sign-in.
*   **Google Sign-In:** Quick authentication using Google accounts.
*   **Guest Mode:** Explore core calendar features without creating an account (hangout requests and data saving require login).
*   **User-Specific Data:** All events, stamps, and hangout requests are tied to the authenticated user's account.

### 🛠️ Tech Stack
*   **Frontend:** Next.js (React framework), Tailwind CSS
*   **Backend & Database:** Firebase (Authentication, Cloud Firestore, Cloud Functions for some operations)
*   **Calendar Library:** `react-big-calendar`
*   **Date Management:** `date-fns`
*   **UI Components:** Shadcn/UI (or custom UI components inspired by it - *adjust if you used a different library or built fully custom*)
*   **Notifications:** Firestore-backed notifications with client-side listeners.

## Project Structure (Simplified)
Use code with caution.
Markdown
.
├── public/
├── src/
│ ├── app/ # Next.js App Router (pages, layouts)
│ │ ├── (auth)/ # Auth-related pages (sign-in, sign-up)
│ │ ├── (main)/ # Main app pages after login (calendar, hangouts)
│ │ └── layout.tsx # Root layout
│ │ └── page.tsx # Landing page
│ ├── components/
│ │ ├── calendar/ # Calendar-specific UI components
│ │ ├── common/ # Shared components (e.g., NotificationsModal)
│ │ ├── hangouts/ # Hangout-specific UI components
│ │ ├── layout/ # Layout components (e.g., AppHeader)
│ │ └── ui/ # Basic UI primitives (Button, Modal, Input, etc.)
│ ├── contexts/ # React Context providers (e.g., AuthContext)
│ ├── lib/
│ │ ├── firebase/ # Firebase configuration and services
│ │ └── toasts.ts # Toast notification helpers
│ ├── styles/ # Global styles, calendar-specific CSS
│ ├── types/ # TypeScript type definitions
│ └── utils/ # Utility functions (e.g., eventUtils, hangoutUtils)
├── functions/ # Firebase Cloud Functions (if used for specific backend logic)
│ ├── src/
│ │ └── index.ts
│ └── package.json
├── .env.local # Local environment variables (DO NOT COMMIT)
├── next.config.mjs
├── package.json
├── tsconfig.json
└── README.md
## Getting Started

### Prerequisites

*   Node.js (version X.X.X or later - *specify your Node version, e.g., 18.x or 20.x*)
*   npm or yarn
*   Firebase Account and a Firebase project set up.

### Setup

1.  **Clone the repository:**
    ```bash
    git clone https://your-repository-url.git
    cd calendar-hangout-app
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Set up Firebase:**
    *   Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/).
    *   In your project, enable:
        *   **Authentication:** Enable Email/Password and Google sign-in methods.
        *   **Firestore Database:** Create a Firestore database (choose your rules mode - start in test mode or with basic secure rules).
        *   **(Optional) Cloud Functions:** If you are using them.
    *   Obtain your Firebase project configuration SDK snippet:
        *   Go to Project Settings -> General -> Your apps -> Web app.
        *   Copy the `firebaseConfig` object values.

4.  **Configure Environment Variables:**
    *   Create a `.env.local` file in the root of the project.
    *   Add your Firebase configuration details (replace placeholders with your actual values):
        ```env
        NEXT_PUBLIC_FIREBASE_API_KEY="your_api_key"
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your_auth_domain"
        NEXT_PUBLIC_FIREBASE_PROJECT_ID="your_project_id"
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your_storage_bucket"
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your_messaging_sender_id"
        NEXT_PUBLIC_FIREBASE_APP_ID="your_app_id"
        # NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="your_measurement_id" # Optional
        ```

5.  **Set up Firestore Security Rules:**
    *   Navigate to your Firebase project -> Firestore Database -> Rules.
    *   Paste the necessary security rules to allow users to manage their own data and interact with hangout requests and notifications. *You might want to link to a `firestore.rules` file in your repo or summarize key rules here.*

6.  **(If using Cloud Functions) Deploy Firebase Functions:**
    *   Set up the Firebase CLI (`firebase-tools`) and log in.
    *   Navigate to the `functions` directory: `cd functions`
    *   Install dependencies: `npm install`
    *   Deploy: `firebase deploy --only functions`
    *   Navigate back to the project root: `cd ..`

### Running the Development Server

```bash
npm run dev
# or
yarn dev
Use code with caution.
Open http://localhost:3000 (or your configured port) to view it in your browser.
Deployment
This application is optimized for deployment on platforms like Vercel (recommended for Next.js).
Push your code to a Git repository (GitHub, GitLab, Bitbucket).
Import your project into Vercel.
Configure the Environment Variables in your Vercel project settings (same as your .env.local file).
Add your Vercel deployment URL(s) (e.g., your-app.vercel.app and any custom domains) to the "Authorized domains" list in Firebase Authentication settings.
Deploy!
Contributing

Future Enhancements / To-Do

Full Timezone Support across the application.
Advanced recurring event editing (edit series, this instance only, future instances).
Push notifications for hangout updates.
User profile page with more settings.
Drag-and-drop for stamps.
Integration with external calendar services (Google Calendar, Outlook Calendar).
License
