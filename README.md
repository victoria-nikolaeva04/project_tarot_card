# Project - Tarot Card Reader
A tarot card reader/dictionary for the whimsical people

## Day 1
 - Brainstorm/Figure out Product Requirements of the application
 - Set up basic files + connections between python, flask, html/css, and the browser
 - Added in the dataset that will be used

## Day 2
 - Added Tarot Card Images
 - Dynamically linked the card images to the dataset
 - Added multiple routes/pages (home, reading, guide, about)
 - Added search/filter capabilities for the cards
 - Added a way to see the reverse meanings of the card
 - Build the foundation of the 3-card reading
 - Added basic 'content' to About + Landing Page (may change/move content later)

## Day 3
- Added Styling to Home, About, and Guide Pages
- Added pop-up overlay to show each card's meaning in Guide Page
- Fix minor bugs all over the appilcation

## Day 4
- Added Styling to Reading Page
- Created the "whimsy" button to allow for more than one reading experience
- Fixed minor bugs/touch-up items throughout the pages
- Started connecting an AI API to start the building of the "Oracle"

## Day 5
- Got the AI API to work initally via terminal
- Connect AI to Flask & the overall project
- Updated/Cleaning up the prompting + response output
- Style the AI Oracle Section with a crystal ball
- Added a loader + a re-try button if API request initally fails due to 503 HTTP Error
- Update the images to be smaller + webp format to help with performance

## Day 6
- Fix minor bugs throughout the site
- Added user tracking/logging
- Worked on Code Cleanup
- Reorganize the CSS
- Added alot more error handling for the AI Oracle

## Day 7
- Figured out deployment on PythonAnywhere.com
- Added TIMEOUT on the AI Oracle

## Error Cases
For the AI Oracle, since I am using a free-tier of Gemini's API keys, so here is a graph of all the errors and their message: 
<img width="499" height="242" alt="image" src="https://github.com/user-attachments/assets/1186af12-c05b-4d09-aa69-eee4f2fa1d7a" />


## Use of AI
Used AI as an additional tool for debugging and building basic 'content' (for example - text within the 'About' page)

## Citations
### Dataset of Tarot Cards
Aura, S., & Deckaura. (2026). Tarot Card Meanings: A Complete 78-Card Semantic Dataset [Dataset]. Zenodo. https://doi.org/10.5281/zenodo.19475329
### Tarot Card Images
Grab Images from: https://github.com/mixvlad/TarotCards
Original Creator: Rider-Waite-Smith -> Within the Public Domain



