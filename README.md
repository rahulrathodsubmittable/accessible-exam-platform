# AI Accessible Exam Platform
**SISTec Innovation Hackathon 2026 — Problem Statement DT-13**

> *“No Visual Barrier. No Learning Barrier. No Examination Barrier.”*

An accessibility-first examination and practice platform designed specifically for visually impaired candidates.

---

## Key Features

1. **No Student Login/Registration Requirement**: Authentication via unique Exam/Candidate IDs (`EXM-2026-XXXXX`).
2. **Dual Operation Modes**:
   - **Exam Mode**: Strict fixed-duration assessment with single attempt, answer auto-save, and server-enforced explanation caps.
   - **Practice Mode**: Flexible learning environment with unlimited tries, AI assistance, and topic recommendations.
3. **Dedicated Voice & Keyboard Control**: Full Web Speech API integration (`SpeechSynthesis` + `SpeechRecognition`) alongside high-contrast ARIA live regions.
4. **4 Core AI Services**:
   - **AI Learning Assistant**: Concept explanations and navigation helper.
   - **AI Paper Improvement**: Question clarity analysis for teachers.
   - **AI Barrier Replay**: Aggregates navigation difficulties without exposing personal user data.
   - **Vision & OCR Accessibility**: Converts uploaded images and PDFs into screen-reader descriptions.
5. **Server-Enforced Explanation Limits**: PostgreSQL database logic capping explanations per question (Default: 3 max standard, 2 max reset).
6. **Progressive Web App (PWA)**: IndexedDB caching and background sync for internet drops.

---

## Folder Structure