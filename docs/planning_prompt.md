# Master Planning Prompt: Rebuilding "Veiled Ventures"

## 1. Project Vision & Core Mission

**Project Name:** Veiled Ventures (internally referred to as TalentOS)

**Mission:** To create a high-signal, anonymous hiring marketplace that replaces the inefficiencies and biases of traditional recruiting with a data-driven, strategic approach. We connect elite, often passive, talent with high-stakes roles by prioritizing verified skills, personality fit, and mutual commitment, all while maintaining strict confidentiality for both parties.

**Core Value Propositions:**
*   **For Talent ("Candidates"):** Explore the job market with zero risk. Your identity is protected. Your skills, not your resume's keywords, get you noticed. You are rewarded for your commitment with a "Vested Victory Bonus."
*   **For Builders ("Employers"):** Hire for strategic roles without alerting competitors. Access a pre-vetted pool of elite talent. Make hiring decisions based on verified data and team dynamics, not just resumes. Ensure candidate seriousness through a commitment-based economic model.

---

## 2. Foundational Architecture & Guiding Principles

### 2.1. Technology Stack
*   **Framework:** Next.js (App Router) with React Server Components by default.
*   **Language:** TypeScript.
*   **Styling:** Tailwind CSS with a CSS-in-JS approach for theme variables.
*   **UI Components:** ShadCN/UI. Create new components as needed, following ShadCN's style.
*   **Generative AI:** Genkit, utilizing Google's Gemini family of models.
*   **Backend & Database:** Firebase (Authentication and Firestore).

### 2.2. UI/UX & Style Guidelines
*   **Layout:** Clean, modern, card-based layout.
*   **Color Palette (Light Mode):**
    *   `--background`: Neutral gray (`#F5F5F5` / `0 0% 96.1%`)
    *   `--secondary`: Light blue (`#E0F7FA` / `190 78% 93%`)
    *   `--primary` & `--accent`: Teal (`#008080` / `180 100% 25%`)
*   **Responsiveness:** The application must be fully responsive on all screen sizes.
*   **State Management:** Use React Context for global state (like user session) and `useState`/`useReducer` for local component state. Avoid third-party state management libraries.

### 2.3. Firebase & Backend Principles
*   **Client-Side First:** All Firebase interactions (reads, writes) must occur on the client-side (`'use client'`). Do not use the Firebase Admin SDK in the Next.js application code.
*   **Security First:** All data access must be governed by strict Firestore Security Rules. The frontend should be built with the assumption that a user might try to access unauthorized data, and the backend rules are the ultimate source of truth for enforcement.
*   **Real-Time Data:** Utilize `onSnapshot` for features that require real-time updates (messaging, notifications, profile updates).
*   **Non-Blocking UI:** For all data mutations (`setDoc`, `addDoc`, `updateDoc`, `deleteDoc`), use a non-blocking approach. Do not `await` these calls in the UI; instead, chain `.catch()` blocks to handle permission errors gracefully using the provided `FirestorePermissionError` architecture. This ensures an optimistic and responsive UI.

---

## 3. Phased Implementation Plan

### **Phase 1: Backend Foundation & Data Modeling**

This is the most critical phase. The entire application hinges on a well-defined backend structure.

1.  **Provision Firebase:** Use the `RequestFirebaseBackendTool` to set up the Firebase project, Firestore database, and initial boilerplate code.
2.  **Define Data Models (`docs/backend.json`):** Meticulously define the JSON schema for every entity in the application. This is our contract.
    *   **`UserProfile`:** For candidates. Must include fields for `role`, `anonymizedName`, `location`, `locationPreference`, `anonymizedExperienceSummary`, `skills` (array), `verifiedSkills` (array of objects), `profileTags` (array), `mbti`, `bigFive`, `osCredits`, etc.
    *   **`Company`:** For employers. Must include `ownerId`, `anonymizedCompanyName`, `verificationStatus`, `hiringManager` (nested object with personality scores), `companyCulture`, `osCredits`, etc.
    *   **`EmployerProfile`:** A slim user record for employers, linking their `userId` to a `companyId`.
    *   **`JobPosting`:** The core job entity. Includes `companyId`, `anonymizedDescription`, `requirements` (array), `status` (`pending_deposit`, `open`, `closed`), `depositAmount`, `bonusAmount`, etc.
    *   **`MatchScore`:** To store the AI-generated match between a `userProfileId` and `jobListingId`. Must include `score` and `justification`.
    *   **`Conversation`:** A top-level collection to represent a chat instance, containing `participantIds`, `jobId`, and a snapshot of the last message for list views.
    *   **`Message`:** A sub-collection under `conversations`. Contains `senderId`, `receiverId`, `content`, and `timestamp`.
    *   **`ForumPost`** & **`ForumReply`**: For the community forum.
    *   **`LocalResource`**: For the resources page.
3.  **Implement Security Rules (`firestore.rules`):**
    *   Users can only read/write their own profile (`/users/{userId}`).
    *   Employers (as owners) can only manage their own company profile and job postings.
    *   Messages in a conversation can only be read by participants.
    *   Match scores and job listings should be publicly readable (`list`) but have restricted write access.
    *   Forum posts and resources should be publicly readable but write-restricted to authenticated users.

### **Phase 2: Authentication & Application Shell**

1.  **Implement Authentication:** Create a login page using FirebaseUI for Google and Email/Password auth. The flow must prompt the user to select their role ("Talent" or "Builder") upon first sign-up.
2.  **Create Global User Context:** Implement `UserProvider` (`src/contexts/user-context.tsx`) that listens to `onAuthStateChanged` and fetches the user's corresponding Firestore profile (`UserProfile` or `EmployerProfile`). This context will provide `authUser`, `profile`, `role`, and `isLoading` to the entire application.
3.  **Build the App Shell:** Create the main layout (`src/components/layout/app-shell.tsx`) with a persistent sidebar. The sidebar navigation items must be dynamically rendered based on the user's `role` from the `useUser` hook.

### **Phase 3: Core Feature Implementation - Candidate & Employer**

With the backend and auth in place, build out the core user journeys, connecting every UI element to live Firestore data.

1.  **Candidate Flow:**
    *   **Profile Page:** Connect the page to `useDoc` to fetch and display the user's profile in real-time. Implement the "Create Profile" flow for new users. Ensure all form inputs use `updateDocumentNonBlocking` to save changes live.
    *   **AI Skill Verification:** Implement the interview page. On completion, the AI flow's results (`knowledgeScore`, `justification`) must be saved back to the `verifiedSkills` array in the user's Firestore document, and their `osCredits` must be decremented.
    *   **Job Matches Page:** This page must query the `/matchScores` collection for the current user's ID, sorted by score. Display the results from the database, not mock data. Implement the feedback buttons to `update` the match document.
2.  **Employer Flow:**
    *   **Profile Page:** Connect the page to fetch the user's `EmployerProfile` and their associated `Company` document. Implement the creation and update flows.
    *   **Job Posting Flow:**
        *   The "New Job" form saves a new document to `/jobListings` with `status: 'pending_deposit'`.
        *   The "Pay Deposit" dialog simulates payment and then updates the document's `status` to `open`.
        *   **CRITICAL:** Upon a job's status changing to `open`, trigger the `matchCandidateToJob` AI flow. This flow should query all `UserProfile` documents and the target `JobPosting` document to generate `MatchScore` documents and save them to Firestore.
    *   **Manage Jobs Page:** This page must query the `/jobListings` collection for the current employer's `companyId`.

### **Phase 4: Communication & Community Features**

1.  **Live Messaging:**
    *   When a user "Expresses Interest," create a new document in the `/conversations` collection.
    *   The message list pages must query the `/conversations` collection where `participantIds` contains the current user's ID.
    *   The `[chatId]` page must use `useCollection` with `onSnapshot` on the `/conversations/{chatId}/messages` sub-collection to create a real-time chat experience. New messages are added via `addDocumentNonBlocking`.
2.  **Community Forum & Resources:**
    *   Connect all forum pages (list, detail, new post) to the `/forumPosts` collection and its `replies` sub-collection for full CRUD functionality.
    *   Connect the `/resources` page to a live Firestore collection.

### **Phase 5: Final Polish & Legal**

1.  **Homepage Legal Dialog:** Implement the non-dismissible modal on the homepage that forces agreement to the Terms of Service, including the binding arbitration clause. Use `sessionStorage` to prevent it from showing on every page load within a session.
2.  **Error Handling & Loading States:** Ensure all pages that fetch data have proper loading spinners and gracefully handle potential errors or empty states (e.g., "No matches found yet").
3.  **Review and Refine:** Conduct a full review of the application, ensuring every piece of mock data has been replaced and every button and form is connected to the live Firebase backend.

By following this master plan, we will construct a robust, scalable, and feature-complete application that fully realizes the vision of Veiled Ventures.