# HandUP

HandUP is a volunteer coordination platform designed to make it easier for people to discover volunteer opportunities and for organizers to create and manage community events.

The project includes both a web application and a mobile application, with Firebase providing shared backend services.

## Project Overview

HandUP connects volunteers with organizations and individuals looking for help in their communities.

Users can create accounts, browse volunteer opportunities, view event information, manage their profiles, and interact with events. Organizers can create and manage volunteer opportunities and review participation requests.

The project was developed as my senior software engineering project and includes both web and mobile implementations.

## Features

### Volunteer Features

- Create and manage a user account
- Sign in and sign out
- Browse available volunteer opportunities
- View event details
- View personal event information
- Manage profile information
- Send and manage event requests

### Organizer Features

- Create volunteer events
- Manage created events
- View volunteer requests
- Manage event participation
- Access organizer-focused event information

## Mobile Application

The HandUP mobile application was built with React Native and Expo.

The app includes screens for:

- Authentication
- Event browsing
- Event creation
- Event details
- User profiles
- Event requests
- Personal event management

Reusable components such as event cards, headers, and buttons are used throughout the application.

## Web Application

HandUP also includes a browser-based interface with pages for:

- Login and signup
- Browsing volunteer opportunities
- Creating events
- Event details
- Volunteer dashboard
- Organizer dashboard
- My Events
- User profiles
- Settings

## Tech Stack

### Mobile

- React Native
- Expo
- Expo Router
- JavaScript / TypeScript

### Web

- HTML
- CSS
- JavaScript

### Backend & Services

- Firebase
- Firebase Authentication
- Cloud Firestore

## Project Structure

```text
HandUP/
├── HandUP-app/
│   ├── app/
│   │   ├── (tabs)/
│   │   ├── event-details.js
│   │   ├── login.js
│   │   ├── requests.js
│   │   └── signup.js
│   ├── components/
│   ├── providers/
│   ├── assets/
│   └── firebase.js
│
└── HandUP-website/
    ├── index.html
    ├── browse.html
    ├── create-event.html
    ├── event-details.html
    ├── volunteer-dashboard.html
    ├── organizer-dashboard.css
    ├── profile.html
    └── settings.html
```

## Running the Mobile App

### 1. Clone the repository

```bash
git clone https://github.com/a-nunez0/HandUP.git
cd HandUP/HandUP-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Firebase

Create the required local environment configuration for Firebase.

Sensitive credentials and environment files are excluded from version control.

### 4. Start Expo

```bash
npx expo start
```

The application can then be tested using a supported iOS or Android simulator or device.

## Security

Environment files and sensitive configuration are excluded from version control. Firebase configuration is separated from private local environment values.

## Status

HandUP is under active development as a senior software engineering project. The current version includes the core volunteer discovery, event management, authentication, and mobile application functionality.

## Author

**Alvaro Nunez**

Software Engineering Student  
Brigham Young University - Idaho