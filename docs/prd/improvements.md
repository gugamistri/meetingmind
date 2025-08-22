Feature: Meeting Capture & Transcription
Screen: Main Application Window
State: Idle / Ready to Record
User Goal: To start a new meeting recording with minimal friction.

UI/UX: The main content area prominently features a single, clear call-to-action. A large "Start Recording" Primary Button is centered, using Primary Deep Blue background and White text. Above it, a welcoming H2 title like "Ready when you are." The overall layout is minimal to focus the user on the primary task. The left sidebar is visible, showing navigation options, with the "Home" item selected using a Secondary Light Blue background.

State: Recording in Progress
User Goal: To have confidence the recording is active and to be able to stop it easily, while minimizing distraction from the actual conversation.

UI/UX: Upon clicking "Start Recording," the button instantly transitions into a "Stop Recording" button, changing its background color to Error Red to clearly signify a terminal action.

Animation: The button animates using the Microinteraction timing (180ms, ease-in-out) to scale down slightly on press and then transition color and text.

Feedback: A persistent visual indicator appears. A subtle, pulsating dot icon using Accent Electric Blue is placed in the top bar next to a running timer (Body Small text style). The microcopy reads "Recording..." in Neutral Slate. This provides constant, non-intrusive feedback that the system is working. The main content area can be minimized or shows a simple visualization of the audio waveform to confirm input is being received without being distracting.

Screen: Meeting Details Page
State: Transcript Tab - Populated
User Goal: To read, search, and understand the full conversation from a past meeting.

UI/UX: The screen is titled with the meeting name in H2 style. Below, tabs for "Summary" and "Transcript" are available, with "Transcript" active. The transcript content is displayed in the main content area with a Body Large text style for maximum readability.

Hierarchy: Each speaker's turn is a distinct block, separated by 24px of vertical space. The speaker's name is displayed in Body Small (Semibold weight) and Dark Charcoal, followed by the transcript text. Timestamps (Caption style, Neutral Slate color) are aligned to the left of each block. This structure makes the conversation easy to follow.

Feature: AI Summary Generation
Screen: Meeting Details Page (Summary Tab)
State: Processing
User Goal: To understand that the AI is working and to know how long it might take.

UI/UX: Immediately after a meeting ends, the user is navigated to the Meeting Details page. The main content area, under an H3 heading "Executive Summary," displays a skeleton loader component. This component mimics the final layout of the summary (lines for bullet points and paragraphs) but uses shimmering, animated placeholder bars.

Animation: The shimmer effect on the skeleton loader uses a Loading States loop (300ms, ease-in-out) to indicate active processing.

Microcopy: Below the skeleton loader, a message in Body Small text and Neutral Slate color reads: "Analyzing your meeting... This usually takes a few moments." This manages user expectations and reduces perceived wait time.

State: Success
User Goal: To quickly grasp the most important outcomes and decisions from the meeting.

UI/UX: The skeleton loader is replaced by the generated content using a Standard Transition fade-in (250ms). The screen is divided into clear sections using Card components, separated by 32px of space.

Executive Summary Card: Titled with an H3 heading. Key insights are presented as a bulleted list. Text uses the Body style. Any mentions of speakers or key metrics can be highlighted using a Semibold weight or the Accent Electric Blue color.

Full Summary Card: Titled with an H3. This section provides a more detailed, paragraph-based summary using the Body Large style for comfortable reading.

State: Failure
User Goal: To understand why a summary wasn't created and what to do next.

UI/UX: The main content area of the Meeting Details page displays a dedicated Card styled for warnings.

Visuals: The card has a prominent 2px left border in Warning Orange. It contains a Warning Orange icon (24x24px) for immediate visual identification.

Content: The card has a title "Summary Not Available" in H4 style and Dark Charcoal color. The explanatory text ("This meeting was too short to generate a summary. At least 30 seconds of speech is required.") uses the Body style. This is clear, direct, and actionable feedback.

Feature: Centralized Task Dashboard
Screen: Tasks Page
State: Empty State (New User)
User Goal: To understand what this screen is for and how to populate it with tasks.

UI/UX: The screen has an H1 title "Tasks." The main content area is empty but not blank. A centered block of content provides guidance. It features a large, decorative icon (e.g., a checklist, 64x64px) in Neutral Slate.

Microcopy: Below the icon, a header "Your action items will appear here" (H3 style) and a sub-text "Record a meeting, and Jamie will automatically extract tasks for you." (Body style) guide the user. A Secondary Button labeled "Record Your First Meeting" provides a direct path to action.

State: Populated with Tasks
User Goal: To view all assigned tasks, understand their context, and mark them as complete.

UI/UX: The H1 "Tasks" title is followed by a list of tasks. Each task is a row in a list, with 16px vertical padding.

Task Item Layout:

Checkbox: A custom-styled checkbox is on the far left.

Task Description: The main text of the task, styled as Body.

Context: Below the description, the source meeting's name is displayed as Link Text in Primary Deep Blue, allowing the user to navigate back for context.

Assignee/Date: Aligned to the right, using Caption style and Neutral Slate color.

Interaction: On hover, the task row background changes to Secondary Light Blue with a 150ms Ease-out transition.

State: Task Completion
User Goal: To receive clear visual feedback that a task has been successfully completed.

UI/UX: When the user clicks the checkbox:

Animation: The checkbox fills with the Success Green color using a Microinteraction spring animation (180ms).

Visual Change: The entire task description text receives a strikethrough decoration, and its color changes from Dark Charcoal to Neutral Slate. This transition happens over 250ms. The row immediately moves to a "Completed" section at the bottom of the list (if one exists) or is visually de-emphasized. This provides immediate, satisfying feedback.

Feature: Meeting Dashboard
Screen: Home Page
State: Populated
User Goal: To get a quick overview of recent activity and easily access past meetings.

UI/UX: The main content area greets the user with a time-sensitive H1 (e.g., "Good morning, Gustavo"). Below, a section titled "Recently Recorded" (H3 style) displays a list of the last 5-7 meetings.

Meeting List Item: Each meeting is presented as a Card. The card contains:

The meeting title as H4 text.

A list of applied tags (see Tagging System).

The date/time of the meeting in Caption style and Neutral Slate color.

Interaction: The entire card is a clickable element. On hover, its shadow deepens slightly (Y-offset 4px, Blur 16px) using an Emphasis Transition (350ms, Spring curve), providing an affordance for interaction. A "View all meetings" Text Button is at the bottom of the list.

Feature: Tagging System
Screen: Meeting Details Page (Right Sidebar)
State: Adding/Viewing Tags
User Goal: To categorize a meeting for easy filtering and retrieval later.

UI/UX: In the right sidebar, under a "Tags" label (Caption style, Bold), existing tags are displayed as pills.

Tag Pill Style: Each tag has a background of Secondary Light Blue, 12px horizontal padding, 4px vertical padding, and a 16px corner radius. The tag text uses Body Small.

Adding a Tag: An input field styled like a tag pill but with a "+" icon is present. Clicking it reveals an Input Field where the user can type a new tag name. An autocomplete dropdown appears, suggesting existing tags. Pressing Enter creates and applies the new tag, which animates into place using the Emphasis Transition.

Feature: Google Calendar Integration
Screen: Settings > Integrations Page
State: Not Connected
User Goal: To understand the benefits of the integration and connect their account easily.

UI/UX: The page has an H2 title "Integrations." A Card is dedicated to Google Calendar. The card shows the Google Calendar logo (Large Icon, 32x32px), a title "Connect Google Calendar" (H4), and a brief description of the benefits in Body Small text.

Call to Action: A prominent Primary Button labeled "Connect" is the main interactive element.

State: Connected
User Goal: To confirm the connection is active and have the ability to disconnect.

UI/UX: The content of the Google Calendar Card changes. It now shows a Success Green checkmark icon and the text "Connected as [user's email]." The primary button is replaced by a Secondary Button with a Error Red text color and border, labeled "Disconnect," for managing the integration. This provides clear status and control to the user.

Feature: Team & Billing
Screen: Settings > Team & Billing Page
State: Free Plan
User Goal: To understand their current usage, the limits of their plan, and how to upgrade or invite members.

UI/UX: The page is structured with Cards.

Current Plan Card: Displays "Your Plan: Free" (H4). Below, a progress bar visualizes credit usage (e.g., "4/10 meetings used"). The progress bar fill uses Accent Electric Blue. A Primary Button "Upgrade to Plus" is placed here.

Users Card: Lists current workspace members. An "Invite team members" Secondary Button is present.

Usage Info Box: A simple info box (no shadow, light grey border) with Body Small text explains the credit logic: "Credits are only used for meetings longer than 5 minutes." This preemptively answers a likely user question.